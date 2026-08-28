/**
 * Maranget union key analysis — pure derivation functions.
 *
 * Home of the former `DnaMarangetUnion` statics (SoC: the class carries
 * instance behavior + seed data; analysis/derivation lives here — a utils
 * module inside the core bundle, re-exported publicly through
 * `@ytrynot/dna/introspect`).
 *
 * Functions:
 * - `unwrapToDnaObject` — branch → underlying `DnaObject` (shape access),
 * - `detectDiscriminators` — routing columns (≥1 branch with a finite value
 *   set), required first then optional,
 * - `detectOptionalDiscriminators` / `isDiscriminatorColumnOptional` — single
 *   definition of column optionality (non-finite declaring branch, or a value
 *   set containing `undefined`),
 * - `detectPositionals` — CLI/parseArgs metadata (required, non-boolean,
 *   non-optional columns scored by 1/distinctValues). Positionals are a DERIVED
 *   view — never stored in the seed nor serialized in the ADN,
 * - `sortForCli` — CLI mode column order (requireds sorted by positional
 *   priority, optionals last without order semantics; routing-invariant),
 * - `isRequiredKey` / `finiteValueSet` — shared helpers.
 *
 * NOTE: this module imports the schema classes from `./dna-interfaces.js`
 * (they are defined there). The import is a module cycle (dna-interfaces
 * imports these functions back) — safe in ESM because every class reference
 * happens inside function bodies at call time, never at module init.
 */
import {
  DnaEnum,
  DnaLazy,
  DnaLiteral,
  DnaObject,
  DnaPipe,
  DnaType,
  type DnaSomeType,
} from "../builder/dna-interfaces.js";
import { ABSENT_TOLERANT_WRAPPERS, WRAPPERS_KEYOPT, WRAPPER_NAMES, WRAPPERS_XFAULT } from "../shared/const-wrp.js";
import type { tsPrimitiveLiteral } from "../shared/base.types.js";

/**
 * All wrapper type names (tsWrpTypes: optional/nullable/nullish/default/
 * prefault/catch/nonoptional/exactOptional). `_DnaWrapper` is internal (not
 * exported); its PUBLIC `type` getter returns the wrapperType — so
 * `isWrapper(s)` is the exact public-API equivalent of
 * `s instanceof _DnaWrapper` (no other class uses a wrapper name as its type).
 */
const WRAPPER_TYPES = new Set<string>(
  [...WRAPPER_NAMES, ...Object.values(WRAPPERS_KEYOPT)].map(String)
);

/**
 * Runtime type guard: a schema whose public `type` is a wrapper name IS a
 * wrapper (`_DnaWrapper` — internal, not exported) and therefore has a safe
 * `unwrap()`. `DnaSomeType` is an interface without `unwrap()`; this guard
 * narrows to the wrapper capability (the only class-export alternative would
 * be exporting the internal wrapper base).
 */
export const isWrapper = (s: DnaSomeType): s is DnaSomeType & { unwrap(): DnaSomeType } =>
  WRAPPER_TYPES.has(s.type);

/**
 * Unwraps a branch schema (which may be a `DnaPipe`, `_DnaWrapper`, or
 * `DnaLazy`) down to its underlying `DnaObject`. This is needed because
 * branches can carry mutations (`.transform()`, `.default()`, `.optional()`,
 * etc.) that wrap the object — the builder must read the object's `shape`
 * for discriminator/positional detection while emitting the full wrapper
 * chain as the branch DNA.
 */
export function unwrapToDnaObject(schema: DnaSomeType): DnaObject<any> {
  let s: DnaSomeType = schema instanceof DnaLazy ? schema.innerType : schema;
  while (isWrapper(s)) s = s.unwrap();
  if (s instanceof DnaPipe) {
    s = s._core.seed.steps[0];
    while (isWrapper(s)) s = s.unwrap();
  }
  if (!(s instanceof DnaObject)) {
    throw new Error(
      `cliUnion branch must be (or unwrap to) a DnaObject, got ${s.constructor.name}`
    );
  }
  return s;
}

/**
 * Whether a key is REQUIRED (must be present) for a schema:
 * - `nonoptional` meta → required,
 * - any absent-tolerant wrapper in the chain (`optional`/`nullish`/`catch`/`default`/
 *   `prefault`) → not required. `nullish` counts (it is optional + nullable); plain
 *   `nullable` does NOT (only an explicit `null` is allowed, not an absent key).
 * - otherwise the leaf's meta decides (e.g. `preprocess`/`exactOptional`).
 */
export function isRequiredKey(schema: DnaSomeType): boolean {
  if (schema.meta()[WRAPPERS_KEYOPT.nonoptional]) return true;
  let s: DnaSomeType = schema instanceof DnaLazy ? schema.innerType : schema;
  while (isWrapper(s)) {
    if (ABSENT_TOLERANT_WRAPPERS.includes(s.type)) return false;
    s = s.unwrap();
  }
  if (s instanceof DnaLazy) s = s.innerType;
  return !ABSENT_TOLERANT_WRAPPERS.some(it => s.meta()[it] !== undefined);
}

/**
 * Returns the OPTIONAL discriminator columns among the given list: a column
 * is optional when at least one DECLARING branch makes it so — optional/
 * nullish (undefined in values), `dna.undefined()`, or a non-finite schema
 * (any/unknown/string/...). Branches that do NOT declare the key do not
 * count (their absence is a plain wildcard, not an optional column) — the
 * wildcard rows are reached through the switch default / `if (key===undefined)`
 * path of the columns that DO route on undefined. Prevalidation separately
 * enforces "required = common to all branches" (a key absent from a branch is
 * never required).
 */
export function detectOptionalDiscriminators(
  schemas: readonly DnaSomeType[],
  discriminators: string[]
): string[] {
  return discriminators.filter(key =>
    schemas.some(branch => {
      const obj = unwrapToDnaObject(branch);
      const prop = obj.shape[key];
      return prop && isDiscriminatorColumnOptional(prop);
    })
  );
}

/**
 * Whether a discriminator column is OPTIONAL because of this branch's
 * declaration. Value-giving wrappers (default/prefault/catch) and pipes
 * (transform) provide the value without changing optionality — they are
 * unwrapped first (the "wrap gives the value" rule). The column is optional
 * when the resulting schema is non-finite (any/unknown/string/...) or its
 * value set includes `undefined` (optional/nullish/`dna.undefined()`).
 */
function isDiscriminatorColumnOptional(schema: DnaSomeType): boolean {
  let s: DnaSomeType = schema instanceof DnaLazy ? schema.innerType : schema;
  for (let i = 0; i < 8; i++) {
    if (isWrapper(s)) {
      const wt = s.type;
      if (wt === WRAPPERS_XFAULT.default || wt === WRAPPERS_XFAULT.prefault || wt === WRAPPERS_XFAULT.catch) {
        s = s.unwrap();
        continue;
      }
      break;
    }
    if (s instanceof DnaPipe) {
      s = s._core.seed.steps[0];
      continue;
    }
    break;
  }
  const values = finiteValueSet(s);
  if (values === undefined) return true;        // non-finite (any/unknown/string/...)
  if (values.includes(undefined)) return true;  // undefined as a value
  return false;
}

/**
 * Finite set of primitive values accepted by a schema, or `undefined` when the
 * schema is non-finite (any/unknown/string/number/...). Resolution order:
 * - wrapper -> inner set plus what the wrapper adds (`optional` -> undefined,
 *   `nullable` -> null, `nullish` -> both; default/prefault/catch add nothing)
 * - `z.null()` / `z.undefined()` -> `null` / `undefined`
 */
export function finiteValueSet(s: DnaSomeType): tsPrimitiveLiteral[] | undefined {
  // Unwrap wrappers first so optional/nullable can add their sentinel values.
  if (isWrapper(s)) {
    const inner = finiteValueSet(s.unwrap());
    if (!inner) return undefined;
    switch (s.type) {
      case "optional": return [...inner, undefined];
      case "nullable": return [...inner, null];
      case "nullish": return [...inner, undefined, null];
      default: return inner; // default / prefault / catch
    }
  }
  if (s instanceof DnaPipe) {
    return finiteValueSet(s._core.seed.steps[0]);
  }
  // Use the type itself if _head is not explicitly set (e.g. DnaLiteral, DnaNull, DnaUndefined).
  const head = s._head ?? s;
  if (head instanceof DnaLiteral) {
    return head._rawValues;
  }
  if (head instanceof DnaEnum) return [...head.values];
  if (head instanceof DnaLazy) {
    // Lazy: Zod does not enforce exhaustiveness on lazy schemas
    return undefined;
  }
  // Combinators: `DnaCombinator` is internal (not exported); its public `type`
  // is "union"/"intersection"/"xor" per combinatorType — only unions (anyOf)
  // have a value set.
  if (head instanceof DnaType && head.type === "union") {
    if (head._core.seed.combinatorType !== "anyOf") return undefined;
    const out: tsPrimitiveLiteral[] = [];
    for (const m of head._core.seed.schemas) {
      const mv = finiteValueSet(m);
      if (!mv) return undefined;
      out.push(...mv);
    }
    return out;
  }
  if (head instanceof DnaType) {
    if (head.type === "null") return [null];
    if (head.type === "undefined") return [undefined];
  }
  return undefined;
}

/**
 * Auto-detects discriminator keys: keys where `finiteValueSet` is non-undefined
 * for AT LEAST ONE branch. Candidate keys are the union of all keys across all
 * branches (not just the first). Accepts both required and optional keys (an
 * optional key with a finite literal/enum value routes on both the value and
 * `undefined`). Branches that do not declare a candidate key, or declare it
 * with a non-finite type, produce a wildcard cell in the clause matrix.
 *
 * Returns the columns ordered REQUIRED first, then OPTIONAL (use
 * {@link detectOptionalDiscriminators} to split).
 */
export function detectDiscriminators(schemas: readonly DnaSomeType[]): string[] {
  if (schemas.length === 0) return [];
  const candidateKeys = new Set<string>();
  for (const branch of schemas) {
    const obj = unwrapToDnaObject(branch);
    for (const key of Object.keys(obj.shape)) candidateKeys.add(key);
  }
  const candidates = [...candidateKeys].filter(key =>
    schemas.some(branch => {
      const obj = unwrapToDnaObject(branch);
      const prop = obj.shape[key];
      return prop && finiteValueSet(prop) !== undefined;
    })
  );
  const optional = new Set(detectOptionalDiscriminators(schemas, candidates));
  return [...candidates.filter(k => !optional.has(k)), ...candidates.filter(k => optional.has(k))];
}

/**
 * Auto-detects positional keys using a POSIX-inspired heuristic:
 * - optional columns → flags (positionals are required by nature),
 * - boolean keys → always flags,
 * - required + non-boolean keys → positional candidates, scored by 1/distinctValues,
 * - sorted: highest score first (fewest values = most likely subcommand), then declaration order.
 *
 * Positionals are CLI/parseArgs metadata — a DERIVED view of the Maranget
 * input (branch schemas + discriminator order). They are never stored in the
 * seed nor serialized in the ADN; `fromDna` reconstructs the class which
 * re-derives them. A CLI-level override lives in
 * `introspect.toParseArgsConfig(schema, { positionals })`.
 */
export function detectPositionals(
  schemas: readonly DnaSomeType[],
  discriminators: string[]
): string[] {
  // Optional columns are NEVER positional (JSDoc: "optional keys → flags,
  // positionals are required by nature"). A non-finite declaring branch
  // (dna.string()/any/unknown/...) makes the column optional — it routes on
  // anything including undefined. Single definition of optionality: the same
  // `detectOptionalDiscriminators` used for the discAdn sub-array.
  const optional = new Set(detectOptionalDiscriminators(schemas, discriminators));
  const candidates: Array<{ key: string; score: number; order: number }> = [];

  for (let i = 0; i < discriminators.length; i++) {
    const key = discriminators[i];
    if (optional.has(key)) continue;

    const isBoolean = schemas.every(branch => {
      const obj = unwrapToDnaObject(branch);
      const prop = obj.shape[key];
      // Absent key (wildcard branch) → not a boolean flag for this branch.
      if (!prop) return false;
      const values = finiteValueSet(prop);
      return values?.every(v => typeof v === 'boolean');
    });
    if (isBoolean) continue;

    const isRequired = schemas.every(branch => {
      const obj = unwrapToDnaObject(branch);
      const prop = obj.shape[key];
      // Absent key (wildcard branch) → not required for this branch.
      if (!prop) return false;
      return isRequiredKey(prop);
    });
    if (!isRequired) continue;

    const allValues = new Set<unknown>();
    for (const branch of schemas) {
      const obj = unwrapToDnaObject(branch);
      const prop = obj.shape[key];
      if (!prop) continue;
      const values = finiteValueSet(prop);
      if (values) for (const v of values) allValues.add(v);
    }

    candidates.push({ key, score: 1 / allValues.size, order: i });
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(c => c.key);
}

/**
 * CLI mode column order (mode `"cli"`): the required discriminator columns
 * are sorted so the positional priority is self-describing in `discAdn` —
 * [positionals (score order)] + [other required], then the optional columns
 * LAST in declaration order (optionals have NO order semantics).
 *
 * Routing is INVARIANT under this sort (verified empirically): the b
 * heuristic orders columns by (splitting, distinct-count) independently of
 * the column order, and the positional score ties exactly when the distinct
 * counts tie — a stable sort preserves the routing tie-breaks.
 */
export function sortForCli(schemas: readonly DnaSomeType[], discriminators: string[]): string[] {
  const optional = new Set(detectOptionalDiscriminators(schemas, discriminators));
  const required = discriminators.filter(k => !optional.has(k));
  // detectPositionals excludes optional columns (single optionality
  // definition) → positionals ⊆ required → the segments are disjoint.
  const positionals = detectPositionals(schemas, required);
  const sortedRequired = [...positionals, ...required.filter(k => !positionals.includes(k))];
  return [...sortedRequired, ...discriminators.filter(k => optional.has(k))];
}

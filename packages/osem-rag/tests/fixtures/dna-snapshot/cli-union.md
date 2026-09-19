# CLI Union (`dna.cliUnion`)

> **Renamed**: `dna.cliUnion` is a legacy alias — the canonical
> name is **`dna.marangetUnion`** (with a `mode` option). This page documents
> the builder API and usage (accurate under both names). For the
> **routing algorithm** (clause matrix, mixture rule, P2'-carrying, modes)
> with diagrams, see **[maranget.md](maranget.md)**.

`cliUnion`/`marangetUnion` is a DNA schema primitive for multi-key routing. It unions multiple object schemas (branches) that share discriminator keys, and compiles them into a Maranget decision tree for efficient dispatch.

Unlike `discriminatedUnion` (single-key, OpenAPI-compatible), `marangetUnion` is multi-key: it auto-detects discriminators, infers positionals vs flags, emits the `"maranget"` opcode, and can generate a `node:util.parseArgs` config from the schema.

## Architecture

### Pipeline

```
Command line tokens
       │
       ▼
┌─────────────────┐
│  util.parseArgs │  ← lexical tokenizer (config from toParseArgsConfig)
└─────────────────┘
       │
       ▼  { values, positionals }
┌─────────────────┐
│  @ytrynot/cli   │  ← flatten positionals[index] → key, flags → key
└─────────────────┘
       │
       ▼  flat looseObject
┌─────────────────┐
│  DnaCliUnion    │  ← routing + validation + branch mutation
└─────────────────┘
       │
       ▼  { success, data } | { success, errors }
```

**Responsibility boundaries:**

- **`util.parseArgs`**: tokenizes `process.argv` into `{ values, positionals }`. DNA provides the config via `toParseArgsConfig()`.
- **`@ytrynot/cli`** (planned): flattens `{ values, positionals }` into a single plain object. Maps positional indices to declared names, maps flag names to target keys.
- **`DnaCliUnion`**: receives the flat object, routes via decision tree, validates the selected branch, applies branch mutations (`.extend()`, `.default()`, `.transform()`, etc.).

### DNA format

```javascript
["maranget", ["cmd", "mode", ["verbose"]], discriminKeys, [prevalidationId, branch0Id, ...], mode]
```

- `discAdn`: routing key names (e.g. `["cmd", "mode"]`) — required as strings,
  **optional** columns grouped in a final sub-array (the optionality marker)
- `discriminKeys`: the **clause matrix** (one array per branch, position = column):
  singleton → direct value, multi-value → sub-array, `undefined` present → real
  value, position beyond the array length → wildcard
- `branchDef`: `[prevalidationId, branch0Id, ...]` — pre-validation object
  (type + required keys check) then branch sub-schemas
- `mode`: `"constructor-priority"` (default) | `"source-order"` — routing semantics

The clause matrix IS in the DNA (it is Maranget's input).
The builder builds it from the live branch shapes; the pure algorithm
`algo/maranget.ts > compile(rows, mode, isOptionalKey)` computes the tree; the
codegen converts absent cells → WILDCARD and emits JS.

### Codegen: Maranget decision tree

The `maranget` opcode handler builds a nested `switch`/`if` tree from the clause matrix. See [technical-maranget.md](technical-maranget.md) for the full algorithm, clause matrix format, compilation rules, heuristics, P2'-carrying, routing modes, wildcard encoding, and F1 fix.

### Maranget decision tree

The routing code is generated at codegen time from a **clause matrix** — a 2D grid where rows are branches and columns are discriminator keys. The algorithm is an adaptation of Luc Maranget's pattern-matching compilation (*"Compiling Pattern Matching to Good Decision Trees"*, ML'08, 2008).

The tree is computed at codegen time via `algo/maranget.ts`, not stored in DNA — the DNA carries the **clause matrix** (`["maranget", discAdn, discriminKeys, branchDef, mode]`) and the codegen compiles it. The generated JavaScript contains the full nested `switch`/`if` tree.

For the full algorithm, compilation rules, column selection heuristic, P2'-carrying scheme, and wildcard handling, see
[technical-maranget.md](technical-maranget.md).

### Routing complexity

The decision tree is O(log N) — each level eliminates half the candidates. A flat if-chain is O(N). The benchmark ([`perf/bench-ifchain-vs-maranget.ts`](../perf/bench-ifchain-vs-maranget.ts)) confirms the scaling:

| N branches | Speedup (Maranget vs if-chain) | CV% range | Verdict |
|---|---|---|---|
| 3  | 1.17x | 3-13% | Noise — no measurable difference |
| 10 | 1.15x | 1-6% | Maranget slightly faster |
| 25 | 1.50x | 2-4% | Maranget clearly faster |
| 50 | 1.91x | 1-12% | Maranget much faster (polymorphic); up to 2.5x monomorphic |

**CV%** (Coefficient of Variation) = (stddev / mean) × 100 — measures how much the 7 benchmark runs varied between each other. Low CV% (≤5%) means stable, repeatable results. High CV% (≥15%) means the measurement is noisy and the speedup factor may not be reliable. The "CV% range" column shows the min–max CV% observed across all test cases (first/mid/last/invalid/mixed-polymorphic).

The if-chain grows linearly with N; the tree stays nearly flat. For N ≤ 3, no measurable difference. For N ≥ 10, the tree is consistently faster. Speedup factors are portable across platforms; raw timings are not (see [AGENTS.md — Performance Reporting](../../AGENTS.md#performance-reporting-critical)).

## Usage

### Basic

```typescript
import { dna } from "@ytrynot/dna";

const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
  }),
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("prod"),
  }),
  dna.object({
    cmd: dna.literal("deploy"),
  }),
]);

const r = cli.safeParse({ cmd: "build", mode: "dev" });
// { success: true, data: { cmd: "build", mode: "dev" } }

const r2 = cli.safeParse({ cmd: "unknown" });
// { success: false, errors: [...] }
```

### Auto-detection

`cliUnion` auto-detects:

- **Discriminators**: keys where `finiteValueSet` is non-undefined for all branches (literals, enums, booleans, null, undefined).
- **Positionals**: non-boolean, required discriminator keys, sorted by `1/distinctValues` (fewest values first = most likely subcommand).

```typescript
const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
  dna.object({ cmd: dna.literal("deploy") }),
]);

cli.discriminators; // ["cmd", "mode"]
cli.positionals;    // ["cmd", "mode"] (cmd first: 2 values, mode: 2 values, tie → declaration order)
cli.flags;          // [] (no non-positional keys)
```

### Explicit discriminators

```typescript
const cli = dna.cliUnion(
  [
    dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
    dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
  ],
  { discriminators: ["cmd"] }
);
```

Positionals are **derived** from the branch shapes — they are not
accepted in the config. A CLI-level override lives in
`introspect.toParseArgsConfig(schema, { positionals })`.

### Optional discriminators

Optional keys can route on `undefined` (absence) and/or on a finite value:

```typescript
const cli = dna.cliUnion([
  // Branch 0: verbose present and true
  dna.object({
    cmd: dna.literal("build"),
    verbose: dna.literal(true).optional(),
  }),
  // Branch 1: verbose absent (undefined)
  dna.object({
    cmd: dna.literal("build"),
    verbose: dna.literal(undefined).optional(),
  }),
]);

cli.safeParse({ cmd: "build", verbose: true });    // → branch 0
cli.safeParse({ cmd: "build" });                    // → branch 1 (verbose absent)
```

### Branch mutations (`.extend()`, `.default()`, `.transform()`)

Each branch is a full DNA schema. Mutations are preserved after routing:

```typescript
const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
  }).extend({
    branchId: dna.string().optional().default("build-dev"),
  }),
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("prod"),
  }).extend({
    branchId: dna.string().optional().default("build-prod"),
  }),
]);

cli.safeParse({ cmd: "build", mode: "dev" });
// { success: true, data: { cmd: "build", mode: "dev", branchId: "build-dev" } }
```

`DnaPipe` branches (`.transform()`) are also supported — the builder unwraps to the underlying `DnaObject` for discriminator detection, then emits the full pipe as the branch DNA.

### `toParseArgsConfig()`

> **Architectural note**: `toParseArgsConfig()` is a convenience method on the schema class, similar to `toJSONSchema()`. It performs a schema→config transformation at definition time, not at runtime. It does NOT import `node:util`, does NOT call `parseArgs`, and does NOT execute any CLI runtime logic. The runtime CLI pipeline (parseArgs execution, flattening `{ values, positionals }`, help generation, error formatting) remains the responsibility of `@ytrynot/cli`.

Generates a `node:util.parseArgs` config from the schema:

```typescript
const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
    env: dna.literal("local"),
    verbose: dna.literal(true).optional(),
    output: dna.string().optional(),
  }),
  // ... more branches
]);

const config = cli.toParseArgsConfig();
// {
//   allowPositionals: true,
//   strict: false,
//   options: {
//     verbose: { type: 'boolean', multiple: false, short: 'v' },
//     output:  { type: 'string',  multiple: false, short: 'o' },
//   }
// }

import { parseArgs } from "node:util";
const { values, positionals } = parseArgs({ ...config, args: process.argv.slice(2) });
```

**Short aliases**: auto-generated from the first letter of each flag, skipping if already taken. Explicit overrides via `toParseArgsConfig({ shorts: { verbose: "V" } })`.

**Defaults are NOT injected** — DNA owns defaulting via `DnaDefault` wrappers in the branch schemas. `parseArgs` is a pure lexical tokenizer.

**Multiple**: `DnaArray` wrappers → `multiple: true` in the config.

**Type inference**:

| Leaf schema | `parseArgs` type |
|---|---|
| `DnaBoolean` | `"boolean"` |
| `DnaLiteral(true)` / `DnaLiteral(false)` | `"boolean"` |
| `DnaArray(DnaBoolean)` | `"boolean"`, `multiple: true` |
| everything else | `"string"` |

### Generated code portability

Generated parser and validator functions are self-contained when `requiredExternals` is empty:

```typescript
import { toJS } from "@ytrynot/dna";

const dnaSeq = cli.toDna();
const { code, requiredExternals } = toJS(false, true)(dnaSeq);

// requiredExternals: [] — no closure dependencies
// Use new Function(...code) to spread the parts correctly
const parseFn = new Function(...code)();

// Portable: rehydrate from the full parts array
const rehydrated = new Function(...code)();
rehydrated({ cmd: "build", mode: "dev" }); // works independently
```

> **Note on `toString()` rehydration**: `fn.toString()` only returns the inner function body — `STEP.OUT_CONST` entries (regexes, `_hop`, ref functions) in the outer closure are lost. For full portability, rehydrate from `new Function(...code)` using the original parts array, not from `fn.toString()`.

## API reference

### `dna.marangetUnion(branches, config?)` — canonical

Creates a `DnaMarangetUnion` (or `DnaCliUnion` when `mode: "cli"`).

**Parameters:**
- `branches`: array of `DnaObject` (or `DnaPipe`/wrapped) schemas
- `config.discriminators`: explicit discriminator keys (auto-detected if omitted)
- `config.mode`: `"constructor-priority"` (default) | `"source-order"` | `"cli"`

### `dna.cliUnion(branches, config?)` — legacy alias

Equivalent to `marangetUnion(branches, { ...config, mode: "cli" })`. Constructs
a `DnaCliUnion` instance. The `mode` config is not accepted here (`cliUnion` IS
the cli mode).

### `DnaMarangetUnion` getters

| Getter | Returns | Description |
|---|---|---|
| `.options` | `S` | Branch schemas (Zod v4 parity: `.options`) |
| `.discriminators` | `string[]` | Routing key names |

### `DnaCliUnion` additional getters (extends `DnaMarangetUnion`)

| Getter | Returns | Description |
|---|---|---|
| `.positionals` | `string[]` | Positional key names (derived, ordered by priority) |
| `.flags` | `string[]` | Non-positional keys across all branches |

### Methods (on `DnaMarangetUnion`, inherited by `DnaCliUnion`)

| Method | Returns | Description |
|---|---|---|
| `.toParseArgsConfig(opts?)` | `ParseArgsConfig` | Generates `node:util.parseArgs` config (delegate to `introspect.toParseArgsConfig`) |
| `.safeParse(input)` | `{ success, data } \| { success, errors }` | Parse + transform |
| `.validate(input)` | `boolean` | Fast boolean validation |
| `.toDna()` | `tsDnaSeq` | Emits DNA bytecode |

### Introspection utilities (`@ytrynot/dna/introspect`)

Formerly static methods on `DnaCliUnion` (moved to
`maranget-keys.ts`, exported via `@ytrynot/dna/introspect`):

| Function | Description |
|---|---|
| `detectDiscriminators(schemas)` | Auto-detects discriminator keys |
| `detectPositionals(schemas, discriminators)` | Auto-detects positional keys |
| `detectOptionalDiscriminators(...)` | Detects optional discriminator columns |
| `sortForCli(schemas, discriminators)` | Sorts discriminators by positional priority |
| `unwrapToDnaObject(schema)` | Unwraps `DnaPipe`/wrapper to `DnaObject` |
| `finiteValueSet(schema)` | Extracts finite value set from a leaf schema |
| `isRequiredKey(schema)` | Checks if a key is required |

## Discriminator rules

- **Required keys** route on finite defined primitive values. A required key is never `undefined`.
- **Optional keys** can route on `undefined` (absence) and/or on a finite value.
- All branches must declare all discriminator keys (required or optional).
- `finiteValueSet` must include valid finite primitive values, including `undefined` where supported.

## Relationship with `discriminatedUnion`

| | `discriminatedUnion` | `marangetUnion` / `cliUnion` |
|---|---|---|
| Discriminator keys | 1 | N |
| OpenAPI/JSON Schema | yes | no |
| Opcode | `discriminator` | `maranget` |
| Codegen | `switch` on single key | Maranget decision tree |
| Positional detection | no | yes |
| `toParseArgsConfig` | no | yes |
| Branch mutations | full (`.extend()`, `.transform()`, etc.) | full (`.extend()`, `.transform()`, etc.) |

`marangetUnion` is independent from `discriminatedUnion`. They serve different use cases: `discriminatedUnion` for OpenAPI-compatible single-key routing, `marangetUnion` for CLI multi-key routing with branch mutations.

## Typing model

### Type parameters

```typescript
// Canonical
export function marangetUnion<const S extends readonly DnaSomeType[]>(
  schemas: S,
  config?: ICliUnionConfig,
  meta?: string | tsDnaMeta
): DnaMarangetUnion<S>

// Legacy alias — equivalent to marangetUnion(schemas, { ...config, mode: "cli" })
export function cliUnion<const S extends readonly DnaSomeType[]>(
  schemas: S,
  config?: Omit<ICliUnionConfig, "mode">,
  meta?: string | tsDnaMeta
): DnaCliUnion<S>
```

- **`S`** (const type parameter): inferred as a **readonly tuple** of branch schema types. The `const` modifier on the type parameter preserves tuple order and length at the call site.
- **`ICliUnionConfig`**: `{ discriminators?: string[]; mode?: tsMarangetMode }` — minimal, runtime-only config. Positionals are derived, not accepted in config. No `shorts` or `strict` (these are `parseArgs`-level concerns, see [ADMIN decision 2026-08-15](#toparseargsconfig)).

### `_output` and `_input`

```typescript
// Base class
class DnaMarangetUnion<S extends readonly DnaSomeType[] = readonly DnaSomeType[]>
  extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: $Output<S[number]>;
  declare readonly _input: $Input<S[number]>;
}

// CLI subclass — adds derived positionals/flags
class DnaCliUnion<S extends readonly DnaSomeType[] = readonly DnaSomeType[]>
  extends DnaMarangetUnion<S> {}
```

`_output` is the **union of branch outputs** (`$Output<S[number]>`), and `_input` is the **union of branch inputs** (`$Input<S[number]>`). `$Output<S>` extracts `_output` via `S extends { _output: any } ? S["_output"] : unknown` (indexed access — see [technical.md](technical.md#deferred-outputinput-and-recursive-type-inference)).

### Deferred pattern

`DnaMarangetUnion` (and `DnaCliUnion`) follows the same [deferred pattern](technical.md#deferred-outputinput-and-recursive-type-inference) as `DnaDiscriminatedUnion` and `DnaObject`:

1. **Parent uses `any, any`**: `extends DnaTypeWithWrappers<any, any>` — the parent's `readonly declare _output: T` resolves to `any` and does not force eager resolution.
2. **Re-declare via `declare readonly`**: `_output` and `_input` are re-declared with `declare readonly _output: $Output<S[number]>` / `declare readonly _input: $Input<S[number]>`. `declare` fields are erased at runtime and deferred until explicitly queried (e.g. `dna.infer<typeof cli>`).
3. **No `out` variance on `S`**: `S` is invariant but never variance-checked (only used in `declare` fields), consistent with `DnaObject`'s `T`.

### `.options` getter — justified cast

```typescript
get options(): S {
  // CAST: _core.seed.schemas is DnaSomeType[] (erased at runtime);
  // S is the static tuple type and TS cannot verify the array-to-tuple correspondence
  return this._core.seed.schemas as unknown as S;
}
```

The `as unknown as S` cast is justified and documented with a `// CAST:` comment on its own line (per repo rules). `_core.seed.schemas` is typed `DnaSomeType[]` (runtime-erased array), while `S` is the static tuple type — TypeScript cannot verify the array-to-tuple correspondence. This is the same pattern as `DnaUnion.options`.

### `dna.infer<typeof cli>`

```typescript
import { dna } from "@ytrynot/dna";

const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
]);

type Routed = dna.infer<typeof cli>;
// { cmd: "build"; mode: "dev" } | { cmd: "deploy"; mode: "prod" }
```

`dna.infer<S>` is an alias for `$Output<S>`, which extracts `_output` from the schema. For `DnaMarangetUnion<S>` / `DnaCliUnion<S>`, this resolves to `$Output<S[number]>` — the union of branch outputs.

### Wrappers on `cliUnion`

The `.optional()`, `.nullable()`, `.nullish()`, `.default()`, `.transform()`, `.catch()` wrappers are all available on the `cliUnion` schema (inherited from `DnaTypeWithWrappers`). They are applied **after** routing and branch validation.

```typescript
const optCli = cli.optional();
// DnaOptional<DnaCliUnion<S>>
// _output = $Output<S[number]> | undefined
```

### Type erosion when widened

When a `DnaMarangetUnion<S>` (or `DnaCliUnion<S>`) is widened to `DnaMarangetUnion<readonly DnaSomeType[]>` (e.g. stored in a generic container), `_output` erodes to `unknown`:

```typescript
const erased: DnaMarangetUnion<readonly DnaSomeType[]> = cli;
type Out = typeof erased["_output"]; // unknown
```

This is because `$Output<DnaSomeType>` = `unknown` (the default branch of the conditional type). The `@ytrynot/cli` package stores the `cliUnion` as `DnaCliUnion<readonly DnaSomeType[]>` in `IProcessedContract.cliUnion` (see `packages/cli/src/types/contract.types.ts`), so the typed output is only available at the construction site, not after storage in the contract.

### Edge case: empty branch array

```typescript
const empty = dna.cliUnion([] as const);
type Out = typeof empty["_output"]; // never
```

`S = readonly []` → `S[number] = never` → `$Output<never>` distributes over `never` and yields `never` (distributive conditional types over `never` produce `never`, not the `false` branch `unknown`). This is **consistent with `DnaUnion<S>`** which uses the same `$Output<S[number]>` pattern. Semantically defensible: an empty union cannot produce any valid value. Documented here because it is counter-intuitive (`unknown` would have been a safer default to avoid silent `never` propagation in pipelines).

### `toParseArgsConfig()` return type

```typescript
toParseArgsConfig(opts?: { strict?: boolean }): {
  allowPositionals: true;
  strict: boolean;
  options: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }>;
}
```

The return type is a **concrete type**, not generic over `S`. This is deliberate: the `options` keys are determined at runtime by introspecting the branches (unwrapping `_DnaWrapper`/`DnaPipe`, extracting leaf types), and are not inferrable from the static tuple `S`. Inferring `options` from `S` would require mapping each branch, unwrapping wrappers at the type level, and extracting leaf types — extremely complex for marginal gain. The current typing is the right trade-off.

### Comparison with `DnaUnion` and `DnaDiscriminatedUnion`

| | `DnaUnion<S>` | `DnaDiscriminatedUnion<K, S>` | `DnaMarangetUnion<S>` / `DnaCliUnion<S>` |
|---|---|---|---|
| Constraint on `S` | `tsDnaTupleSchemaRO` | `tsDnaDiscriminatedUnionObjects<K>` | `readonly DnaSomeType[]` |
| `_output` | `$Output<S[number]>` | `$Output<S[number]>` | `$Output<S[number]>` |
| `extends` | `DnaCombinator<...>` (typed) | `DnaTypeWithWrappers<any, any>` | `DnaTypeWithWrappers<any, any>` |
| Empty array `_output` | `never` | n/a (requires ≥1 branch with key `K`) | `never` |

**Note on the `S` constraint**: `DnaUnion` uses `tsDnaTupleSchemaRO` (which is `readonly [DnaType, ...DnaType[]] | readonly []`), while `DnaMarangetUnion`/`DnaCliUnion` use the looser `readonly DnaSomeType[]`. The looser constraint means a non-`const` `DnaSomeType[]` array is accepted — in that case `S[number]` resolves to `DnaSomeType` and `_output` erodes to `unknown`. The `const` modifier on the type parameter ensures tuple inference at the call site, so in practice the output is correctly typed when using `dna.marangetUnion([...])` / `dna.cliUnion([...])` directly.

## Object modes in branches

Each branch is a `DnaObject` and inherits its object mode (`standard`, `strict`, or `loose`). The mode controls how unknown properties are handled **after** routing. There are two ways to set the mode: at construction time via the top-level factory, or by chaining a mode method on an existing object schema.

| Mode | Factory | Method | Unknown properties | Behavior |
|---|---|---|---|---|
| `standard` (default) | `dna.object({...})` | `.standard()` (alias: `.strip()`) | Stripped from output | Only declared keys appear in `data` |
| `strict` | `dna.strictObject({...})` | `.strict()` | Rejected — `safeParse` fails | `additionalProperties: false` |
| `loose` | `dna.looseObject({...})` | `.loose()` (alias: `.passthrough()`, deprecated) | Kept in output | `additionalProperties: true` |

```typescript
// Factory form
const cli = dna.cliUnion([
  dna.strictObject({ cmd: dna.literal("build") }),
  dna.looseObject({ cmd: dna.literal("deploy") }),
]);

// Method form (equivalent)
const cli2 = dna.cliUnion([
  dna.object({ cmd: dna.literal("build") }).strict(),
  dna.object({ cmd: dna.literal("deploy") }).loose(),
]);

cli.safeParse({ cmd: "build", extra: "x" });
// { success: false, errors: [{ message: "Unrecognized key: ...", ... }] }

cli.safeParse({ cmd: "deploy", extra: "x" });
// { success: true, data: { cmd: "deploy", extra: "x" } }
```

Mixed modes are supported: each branch applies its own mode independently after routing. The routing tree itself only reads the declared discriminator keys; it does not inspect unknown properties.

> **Warning — getter-throws on `strict`/`loose` inputs.** In parser mode, `strict` and `loose` objects use `Object.assign(Object.create(null), v)` to copy the input before checking/keeping unknowns. This triggers **all** own enumerable getters on the input, including getters on non-declared keys. If a getter throws, `safeParse` crashes with an uncaught exception instead of returning `{ success: false, errors }`. `standard` objects are not affected (they use `keepOnly`, which only reads declared keys). This is a known limitation shared with Zod v4's `.passthrough()` / `.strict()` on getter-throws inputs — see [Limitations](#limitations) below.

## Limitations

### By-design constraints

These limitations are inherent to the routing model and cannot be lifted without changing the architecture:

1. **Discriminator keys must have a finite primitive value set.** Only `literal`, `enum`, `boolean`, `null`, and `undefined` produce a finite `finiteValueSet`. `string`, `number`, `record`, `array`, `object`, `lazy`, `allOf`, `oneOf`, and `enumTypeDeep` (deep-equality enums) cannot be discriminators. Construction throws at `toDna()` time if a configured discriminator key has no finite value set in every branch.

2. **`enumTypeDeep` cannot be a discriminator.** Deep-equality enum values (objects/arrays) cannot be represented as JavaScript `switch`/`case` labels — `switch` uses `===` reference equality, not deep equality. Use `literal` or `enum` (primitive values) for routing keys.

3. **`allOf` / `oneOf` cannot be discriminators.** These combinators do not produce a finite value set. A key wrapped in `allOf`/`oneOf` cannot route.

4. **`DnaLazy` branches are supported, but `DnaLazy` discriminator keys are not.** `finiteValueSet` returns `undefined` for lazy schemas (Zod does not enforce exhaustiveness on lazy schemas). A lazy branch can be routed **to**, but a lazy key cannot be a routing key.

5. **All branches must declare all discriminator keys.** A branch missing a configured discriminator key throws at `toDna()` time. Optional discriminator keys (declared with `.optional()`) satisfy this requirement.

6. **DNA `.default()` on a routing key does not help routing.** The default is applied **inside the branch** (after routing), not before. If the key is absent, routing fails before the default is injected. To default a routing key before routing, use `parseArgs` `options[name].default` or a pre-routing transform owned by `@ytrynot/cli`. See [`.default()` on routing keys](#default-on-routing-keys) below.

7. **No JSON Schema / OpenAPI equivalent.** The `maranget` opcode is DNA-specific. `toJSONSchema()` does not emit a `marangetUnion`; it is only produced by the builder's `dna.marangetUnion()`/`dna.cliUnion()`.

### `.default()` on routing keys

A `.default()` on a routing key is applied **inside the branch** (after routing), not before. Its role is to give the branch a canonical name in the parsed output — when the branch is reached via another routing key and the routing key is absent, `.default()` injects the branch's canonical value.

```typescript
const cli = dna.cliUnion([
  // cmd has a default, but routing reads v["cmd"] BEFORE the default is applied.
  // If cmd is absent, routing fails — the default cannot save it.
  dna.object({ cmd: dna.literal("build").default("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
]);

cli.safeParse({});              // { success: false } — cmd absent, routing fails
cli.safeParse({ cmd: "build", mode: "dev" });  // { success: true } — cmd present, routes
```

To default a routing key **before** routing, inject the default at the `parseArgs` layer or in a pre-routing transform:

```typescript
// parseArgs default — injected before the flat object reaches cliUnion
const config = cli.toParseArgsConfig();
config.options.cmd = { type: "string", default: "build" };
```

### Edge cases

- **0 discriminators (auto-detection finds nothing):** if no key has a finite value set in all branches, `discriminators` is empty. The decision tree has no columns to split on and validates the **first branch** directly (first-match-wins). This is not a crash, but the result may be surprising — all inputs that match the first branch's shape are accepted, and inputs that don't are rejected with the first branch's errors.

- **Overlapping branches (same discriminator values in multiple branches):** not rejected at construction. The decision tree groups them together and **first-match-wins** (declaration order). The second branch is unreachable for those values.

- **Single branch:** `cliUnion` with one branch is valid. It behaves like a single object schema with a routing tree of depth 0 (the branch is always selected).

- **Wrappers on `cliUnion` itself:** `.optional()`, `.nullable()`, `.nullish()`, `.default()`, `.transform()`, `.catch()` are all supported on the `cliUnion` schema, applied after routing and branch validation. `undefined`/`null` inputs skip routing entirely and are handled by the wrapper.

- **Nested `cliUnion`:** a branch property can itself be a `cliUnion`. The outer routing tree selects the branch, then the inner `cliUnion` routes its own input. Both routing trees are independent.

## Warnings

### `parseArgs` boolean flags are presence-based

Node's `util.parseArgs` treats `type: "boolean"` options as **presence flags**: `--verbose` → `true`, absence → the key is **absent from `values`** (not `false`). `--verbose=false` in non-strict mode gives the **string** `"false"` (not boolean `false`); in strict mode it throws `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.

```typescript
const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
  dna.object({ cmd: dna.literal("deploy") }),
]);
const config = cli.toParseArgsConfig();

const parsed = parseArgs({ ...config, args: ["build"] });
// parsed.values.verbose === undefined (absent, not false)

const parsed2 = parseArgs({ ...config, args: ["build", "--verbose"] });
// parsed2.values.verbose === true
```

If a branch requires `verbose: false` (literal), the flag must be **absent** from `values` and the flattening step must explicitly set `verbose: false` — `parseArgs` will not do this automatically.

### `parseArgs` non-strict mode treats unknown flags as boolean

In non-strict mode (`strict: false`, the default from `toParseArgsConfig()`), unknown flags are treated as boolean (`--unknown` → `values.unknown = true`) and their "value" goes to `positionals`. In strict mode (`strict: true`), unknown flags throw `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.

### `parseArgs` does not coerce types

`parseArgs` returns strings for `type: "string"` options and positionals, and booleans for `type: "boolean"` options. It does **not** coerce to `number`, even if the schema declares `dna.number()`. Coercion must happen in the pre-routing transform or in the branch schema (via `.transform()` or `.pipe()`).

### Positionals out of bounds

If fewer positionals are provided than declared, the flattening step produces `undefined` for the missing indices. If the missing positional is a **required** discriminator key, routing fails. If it is an **optional** discriminator key, routing proceeds on `undefined`.

If **more** positionals are provided than declared, the extra positionals are retained by `parseArgs` but ignored by `cliUnion` (in `standard` mode) — they are not in the declared `keepOnly` list. In `loose` mode, they would only appear in the output if the flattening step explicitly maps them to a key.

### Getter-throws on `strict`/`loose` inputs

In parser mode, `strict` and `loose` branches use `Object.assign(Object.create(null), v)` to copy the input. This triggers all own enumerable getters. If a getter on a non-declared key throws, `safeParse` crashes with an uncaught exception. `standard` branches are not affected (they use `keepOnly`, which only reads declared keys).

This is a known limitation shared with Zod v4's `.passthrough()` / `.strict()` on getter-throws inputs. Avoid passing objects with throwing getters to `strict`/`loose` schemas.

## See also

- [Maranget decision tree codegen](technical.md#maranget-decision-tree-codegen-maranget-opcode) — codegen-specific subset (full reference in [technical-maranget.md](technical-maranget.md))
- [`maranget` opcode handler](opcode-patterns.md#maranget-opcode-handler--maranget-decision-tree-stepsarray-variant) — StepsArray pattern variant
- [technical-maranget.md](technical-maranget.md) — full algorithm reference (clause matrix, compilation rules, heuristics, P2'-carrying, F1 fix)
- [CLI union DNA format](../../../sandbox/cli-branches-union-dna-format.md) — design doc with benchmarks
- [Performance skill](../../.devin/skills/ytn-dna-perf/SKILL.md) — DNA-generated validator/parser performance findings

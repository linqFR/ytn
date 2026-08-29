# @ytrynot/dna

## 0.8.1

### Patch Changes

- 62d8bd3: Add public `.coerced()` method on DnaType
  
  - New `.coerced()` instance method clones a schema and enables coercion on its leaf, walking through wrappers and pipes.
  - Pipe handling is asymmetric (same logic as `isCoercible`): regular pipe coerces the first step (input), preprocess coerces the last step (target).
  - Silently no-ops on types without `coerceCode` (e.g. `dna.date()`).
- d7f6cbf: Introspect: add `isCoercible` utility
  
  - New `isCoercible(schema)` function in `@ytrynot/dna/introspect` checks whether a schema has coercion enabled at its leaf.
  - Walks wrapper chains (optional, nullable, default, ...) to find the leaf, unlike a flat `_coerce` check.
  - Handles pipes asymmetrically: regular pipe checks the first step (input), preprocess checks the last step (target).
- 4bfff90: Introspect `toParseArgsConfig`: single-pass option collection
  
  - `toParseArgsConfig` now collects declared keys and option metadata in a single loop over branches instead of two separate passes.
  - No behavior change — output is identical for all positional/strict configurations.

## 0.8.0

### Minor Changes

- c06294f: Export `fromDna` as a public subpath entry point
  
  - `fromDna` (DNA bytecode → fluent schema reconstruction) is now importable via `@ytrynot/dna/fromDna`.
  - Previously documented but not packaged — the subpath is now built and shipped.
- af05353: Maranget union: canonical name and routing modes
  
  - `dna.marangetUnion(schemas, config)` is the canonical name for discriminated unions with wildcard branches. `dna.cliUnion` remains available as a CLI convenience that sets `mode: "cli"` automatically.
  - `config.mode` selects routing semantics when a catch-all branch overlaps a constructor branch:
    - `"constructor-priority"` (default): constructor rows win over catch-all on the same column; catch-all acts as fallback.
    - `"source-order"`: first matching branch in declaration order wins (strict decision-tree semantics).
    - `"cli"`: constructor-priority routing with discriminator columns sorted by positional priority for CLI usage.
  - `introspect.toParseArgsConfig(schema, { positionals })` accepts a CLI-level positional override.

### Patch Changes

- 4d5aa05: Type safety improvements for public API
  
  - `custom()` params now typed as `tsRefineOptions`
  - `IIssue.input` now typed as `$Input<T>` (distinguishes input from output type)
  - `ODnaIssueNotMultipleOf.divisor` now accepts `number | bigint`
  - Add 38 unit tests for `toJs/inline-func.ts` (`FN_fCount`, `FN_dEq`,
  `FN_cidrV6`, `FN_toBigInt`, `FN_toDate`, `FN_dMerge`)

## 0.7.6

### Patch Changes

- 7b4bcf0: Parser and codec return types: fix to use precise output/input types instead of `any`
  
  - `safeParse()`, `safeParseAsync()`, `spa()`, `safeDecode()`, and `safeDecodeAsync()` now return `tsDnaParserResult<this["_output"]>` instead of unparameterized `tsDnaParserResult` (which defaulted to `any`).
  - `parse()` and `parseAsync()` now return `this["_output"]` / `Promise<this["_output"]>` instead of `T` (which was `any` in deferred subclasses).
  - `decode()` and `decodeAsync()` now return `this["_output"]` / `Promise<this["_output"]>` instead of `T` (which was `any` in deferred subclasses).
  - `DnaPromise.safeParseAsync()` override now returns `Promise<tsDnaParserResult<this["_output"]>>` instead of unparameterized `Promise<tsDnaParserResult>`.
  - `DnaPromise.parse()` and `DnaPromise.parseAsync()` overrides now return `this["_output"]` / `Promise<this["_output"]>` instead of `T`.
  - `safeEncode()` and `safeEncodeAsync()` now correctly return `tsDnaParserResult<this["_input"]>` (input type) instead of `tsDnaParserResult<this["_output"]>` (output type), matching Zod v4's `ZodSafeParseResult<core.input<this>>`.
  - `encode()` and `encodeAsync()` now correctly return `this["_input"]` instead of `this["_output"]`.
  - Added type-regression tests for codec encode/decode return types covering sync, async, identity codec, union types, error branch.
- 5cf7ad9: Dependency version bumps
  
  - Bump `jose` from `^6.2.9` to `^6.2.10` (transitive dep of `@ytrynot/dna`).
  - Bump `@ytrynot/dna` dependency range from `^0.7.0`/`^0.7.3` to `^0.7.5` in `@ytrynot/schvalid` and `@ytrynot/qb` (peerDependency).
  - No code changes — version range alignment only.
- 45711eb: `DnaDefault.defaultValue` / `DnaPrefault.prefaultValue` getters: resolve getter functions; `.default()` / `.prefault()` accept getter functions at the type level
  
  - `DnaDefault.defaultValue` getter now calls the function and returns the resolved value when the default was provided as a getter (`dna.x().default(() => value)`), instead of returning the raw function.
  - `DnaPrefault.prefaultValue` getter applies the same resolution for consistency.
  - `.default()` and `.prefault()` method signatures now accept both direct values and getter functions (`() => T`), via dual overloads matching Zod v4's API. Previously, passing a getter function was a compile-time error even though the runtime supported it.
  - `DnaDefault` and `DnaPrefault` BaseCore seed types now include `(() => T)` to reflect that the raw storage may hold a function.
  - `DnaCatch.catchValue` is unchanged — catch recovery functions take a `ctx` argument and are intentionally not resolved at access time.
  - `introspect.defaultValue()` now delegates to the schema's `defaultValue` getter instead of resolving separately.
  - Aligns with Zod v4's `def.defaultValue` getter, which always returns the resolved value.
  - The runtime parser/codegen is unaffected — it reads `seed.value` (raw storage) directly, not the getter.
  - Type regression tests added: `default-prefault-types.test.ts` (11 tests) and `infer-surface-types.test.ts` (20 tests) verify `dna.output` / `dna.input` / `dna.infer` parity with `_output` / `_input` across primitives, wrappers, default/prefault, composites, transforms, codecs, and nested objects.
  - Runtime regression tests added: `default-prefault-runtime.test.ts` (22 tests) verify getter resolution, static value passthrough, non-memoization, Zod v4 parity, codegen integrity (raw function preserved in `seed.value`), and `introspect.defaultValue()` delegation.

## 0.7.5

### Patch Changes

- 8be32ee: Fix `DnaDefault._input` silently typed as `any` and deduplicate type helpers.
  
  - Add `declare readonly _input: $Input<Inner> | undefined` on `DnaDefault`
    (was inherited as `any` from the deferred parent, breaking type inference
    for `.default()` consumers)
  - Re-export type helpers (`$IsAny`, `$ReadonlyValue`, `$RemoveUndefined`,
    `$Flatten`, `$UnionToIntersection`, `$EnumKeys`, `$MaybeAsync`, etc.) from
    `@ytrynot/shared/types` instead of duplicating them in `helpers.types.ts`
  - Add `expectTypeOf` regression tests for `_input` on all wrappers
    (DnaDefault, DnaOptional, DnaNullable, DnaNullish, DnaNonOptional)
    and for missing output types (nullish, prefault, exactOptional)
- 8be32ee: @ytrynot/shared: reorganize shared/types into thematic files
  
  - Split `modifiers.type.ts` into `structural.type.ts`, `predicates.type.ts`,
    `enum.type.ts`, `record.type.ts`
  - Add `$FlattenDistributive<T>` (preserves each union member independently)
  - Add `$FlattenCombinative<T>` and `$ToRecord<T>` as aliases of `$Flatten`
  - Add `$MaybeAsync<T>` and `$InferReturnType<F>` to `async.type.ts`
  - Rename `tsValidJSON` → `$isValidJSON` (predicate, not static type)
  - Add `README.md` and `wiki.md` with comparison tables and usage examples
  - Add `types.test.ts` with 43 `expectTypeOf` tests covering all helpers
  - Update `shared/README.md` with missing namespaces (regex, cli, polyfill)
  - Fix broken imports in `shared/js/set-ops.ts` and `packages/cli/src/preprocess.ts`
  
  Impact: @ytrynot/dna and @ytrynot/cli import from @ytrynot/shared/types.
  The import paths changed (modifiers.type.ts → structural.type.ts / record.type.ts).

## 0.7.4

### Patch Changes

- e897dff: Bump engines to Node >=26.0.0 across all packages. CI workflows updated to Node 26.

## 0.7.3

### Patch Changes

- ac6ddf2: Deprecate `shorts` in `cliUnion.toParseArgsConfig()`
  
  Short alias generation (auto-generation from first letter and `opts.shorts`
  override) is deprecated. Short aliases are a `node:util.parseArgs` concern,
  not a `cliUnion` schema concern (ADMIN decision 2026-08-15). The
  `opts.shorts` parameter and the `short` field in the returned `options`
  will be removed in a future release. Consumers should generate their own
  shorts at the `parseArgs` config level.
  
  `toParseArgsConfig()` itself, `opts.strict`, and all other fields
  (`allowPositionals`, `strict`, `type`, `multiple`) remain fully supported.
- ac6ddf2: Fix `dna.preprocess` and `dna.cliUnion` type inference
  
  - `dna.preprocess(fn, target)` now returns `DnaPipe<DnaTransform<unknown, R>, T>` — the target schema type `T` and the `fn` return type `R` are preserved in the return type.
  - `dna.cliUnion(schemas)` accepts `readonly` tuples and arrays (e.g. `as const` tuples, `.map()` results) without requiring a manual cast.

## 0.7.2

### Patch Changes

- 0bfa096: Presence-check modes renamed and documented
  
  - `toJS` third argument renamed: `"none"` → `"hasown"`, `"partial"` → `"in-filtered"`, `"full"` → `"in-object"`.
  - New documentation section in `docs/technical.md` covering the three modes, sensitive keys, compliance, and performance.
  - `docs/zod-comparison.md` presence-detection section updated to reflect the three modes instead of the old global `_hop` behavior.

## 0.7.1

### Patch Changes

- Presence-check modes renamed and documented
  
  - `toJS` third argument renamed: `"none"` → `"hasown"`, `"partial"` → `"in-filtered"`, `"full"` → `"in-object"`.
  - New documentation section in `docs/technical.md` covering the three modes, sensitive keys, compliance, and performance.
  - `docs/zod-comparison.md` presence-detection section updated to reflect the three modes instead of the old global `_hop` behavior.

## 0.7.0

### Minor Changes

- New schema constructors and faster object validation
  
  - `dna.not(inner)` — negation schema, validates that the input does NOT match the inner schema.
  - `dna.ifThenElse(if, then, else?)` — conditional schema; validates `then` when `if` passes, `else` when it fails.
  - `fromDna()` now reconstructs `not`, `ifThenElse`, `cli`, `c`, `cD`, `_s`, `_n`, and `_a` opcodes (previously unsupported, roundtrip would crash).
  - Object and array validation is significantly faster: ~30% on simple objects (5 keys), ~78% on nested objects, ~67% on arrays of 100 items, ~70% on discriminated unions. Average ~56% across benchmarks.
  - `toJS(validateMode, enhancedMapper, ownProperties?)` accepts an optional third argument: `"hasown"` (strict own-property via `Object.prototype.hasOwnProperty`), `"in-filtered"` (`in` for normal keys, `hasOwn` for the 12 well-known `Object.prototype` member names), `"in-object"` (`in` for all keys, Zod v4 fastpath). Defaults: `"in-filtered"` for JSON Schema conversion, `"in-object"` for the fluent builder.
- 3878c3f: JSON Schema conversion: proper `const`, `enum`, `not`, and `ifThenElse` output
  
  - `schema.toJSONSchema()` now emits correct JSON Schema for `const` (`c`/`cD`), `enum` (`eD`), `not`, and `ifThenElse` opcodes. Previously these fell back to a generic `{ type: "object", description: "DNA opcode: ..." }` placeholder.
  - `dna.promise()` is now formally deprecated (JSDoc), mirroring `z.promise()` deprecation in Zod v4. Kept for compatibility; prefer `await`-ing the value before parsing.
  - New type export: `tsCompiledParts` (the `string[]` parts passed to `new Function(...parts)`) is now available from `@ytrynot/dna/core`.
  - Compiler internals: `Set`-based body collections replaced with `Record<string, boolean>` to preserve insertion order and produce deterministic generated code across runs.
  - Internal type rename: `tsLaberlId` → `tsLabelId` (typo fix, compiler-internal only).
  - Removed unused `isDNA` placeholder function (never part of the public API, was a no-op returning `true`) and deleted duplicate `shared/inference.types.ts`.
  - Cast cleanups in `fromDna`: unjustified `as any` replaced with documented `as unknown as T` casts.
- 3878c3f: Object output: preserve explicitly-present `undefined` values (Zod v4 alignment)
  
  - `dna.object()`, `dna.strictObject()`, and `dna.looseObject()` now preserve optional keys with `undefined` value when the key is present in the input, matching Zod v4. Previously, standard mode stripped these keys.
  - Object parser performance: ~3.4x faster on simple objects, ~3.7x faster on nested objects. DNA parser is now faster than Zod on all object benchmarks.
  - `discriminatedUnion` with optional discriminator keys no longer adds an artificial `undefined` key to the output when the discriminator is absent from the input.
  
  BREAKING CHANGE: `safeParse().data` on standard objects now includes keys with `undefined` values when those keys were present in the input. Code that relied on `undefined`-valued optional keys being stripped must check key presence rather than value truthiness.

## 0.6.0

### Minor Changes

- Add `dna.cliUnion()` — multi-key CLI routing union with Maranget decision tree.
  
  - New `DnaCliUnion` class with auto-detection of discriminators (`finiteValueSet`) and positionals (non-boolean required keys, sorted by `1/distinctValues`).
  - New `cli` opcode handler in `dna-js-json.ts` — builds a Maranget decision tree (nested `switch`/`if`) at codegen time from a clause matrix (branches × discriminator keys). O(log N) routing vs O(N) if-chain.
  - `toParseArgsConfig()` method — generates a `node:util.parseArgs` config from the schema (option types, short aliases, multiple flags, positional detection).
  - Explicit `discriminators` and `positionals` config overrides via `ICliUnionConfig`.
  - Branch mutations (`.extend()`, `.default()`, `.transform()`, `.prefault()`, `.catch()`) preserved after routing.
  - Wrappers on `cliUnion` itself (`.optional()`, `.nullable()`, `.nullish()`, `.default()`, `.transform()`, `.catch()`).
  - `testedProp` optimization: `discriminator` and `cli` handlers propagate routing keys into branches via `parentCtx.testedProp` (key → pre-bound variable name); handler `o` skips redundant `hasOwn`, uses the pre-bound variable instead of re-reading `v[key]`, and `literal`/`enum` skip const check on tested keys. Removes the `DnaDiscriminatedUnion` cloner that replaced routing keys with `DnaAny` — branches are emitted as-is, preserving transforms/pipes on routing keys.
  - 91 tests in `cli-union.test.ts` (routing, auto-detection, overrides, optional discriminators, branch mutations, edge cases, portability, behavioral override tests).
  - 29 tests in `tested-keys.test.ts` (DU/cli hasOwn + const check counts, parser runtime, transform on routing key, optional absent, pre-bound variable usage, getter-called-once).
  - Full documentation in `docs/cli-union.md` (architecture, usage, API reference, object modes, limitations, warnings).

### Patch Changes

- Fix discriminator and cli handlers: crash on null/undefined input, getter-throws on prevalidation, transform overwrite, and dead code.
  
  - Open `discB0`/`cliB0` block before prevalidation and pass `failCase: "break <block>;"` so that prevalidation failure (null/non-object input, missing required key) exits the block directly instead of falling through to `v["cmd"]` which would crash on null.
  - Pass `""` as outVarName for the prevalidation step in `discriminator` and `cli` handlers. The prevalidation only checks type + required keys, it does not produce output (data is overwritten by the branch). Passing the real outVarName triggered `parserOutInit`'s `Object.assign(Object.create(null), v)` which fires all own getters on the input — crashing if a non-declared key has a throwing getter. With `""` the prevalidation skips `parserOutInit` (`hasOut=false`). Aligns DNA with Zod v4 which does not crash on DU with getter-throws inputs.
  - Remove the post-switch `data[discriminator]=discValVar` overwrite that was needed when the cloner replaced the discriminator key with `DnaAny`. Now that branches are emitted as-is, the branch's own object handler writes the discriminator key (potentially with transforms applied). The overwrite would discard transforms and add an unwanted `cmd: undefined` for optional absent discriminators.
  - Remove dead `data=undefined` in the `default:` case of the switch (unreachable — the return statement checks `errors.length`, not `data`).
  - An explicit guard `if(errors.length)break <block>;` is also needed after prevalidation in parser mode because the handler `o` type check uses `breakBase` (unconditional `break oB`) in parser mode — the `!mustMatchType` branch does not push an error (JSON Schema vacuous success), so a conditional failCase alone would not fire. Attempting to change L708 to use `parentCtx.failCase` in parser mode was tested and reverted: it breaks schvalid where the type check assigns `data=v` without pushing an error on non-objects.
  - Document the asymmetry at L708 (`isCond ? failCase : breakBase`) with cross-references to `_assignOrCondEnv` L113-117 and the discriminator/cli guards.
  - Remove stale TODO comment on `oneOf` error reassignment.
- Remove the unused `not?: string` field from `tsJSParentCtx`.
  
  - The field was commented out in `dna-js.types.ts` but still referenced as dead code: two `not: undefined` assignments in `dna-js-builder.ts` (`wrp` handler) and a stale `parentCtx.not ?? ""` snippet in `docs/technical.md`.
  - No handler ever reads `parentCtx.not`; the JSON-Schema `not` opcode handler (`dna-js-json.ts`) builds a fresh `childCtx` and never accesses this field.
  - Remove the obsolete JSDoc block, the two dead `not: undefined` assignments, and fix the documentation snippet.
- Add `testedProp` optimization to eliminate redundant validation on routing keys in discriminatedUnion/cliUnion branches.
  
  - Add `testedProp: Record<string, string>` field to `tsJSParentCtx`, propagated by `discriminator` and `cli` handlers toward their branches. Maps each routing key to the JavaScript variable name that holds the already-read value (e.g. `{ cmd: "discVal0" }`).
  - Handler `o` skips the redundant `hasOwn` check for keys in `testedProp` AND uses the pre-bound variable instead of re-reading `v[k]` — eliminating one property access per routing key per parse.
  - Handler `o` shrinks `testedProp` to `{ [k]: varName }` (or `undefined`) per property so `literal`/`enumType` handlers can skip their const check.
  - `discriminator` handler passes `{ [key]: discValVar }` — the branch uses `discVal0` instead of re-reading `v["cmd"]`.
  - `cli` handler pre-declares `const cliV<idx>_<col> = v[key], ...` for all routing keys and passes the map to branches. The decision tree also uses these variables instead of re-reading `v[key]`.
  - Remove the `DnaDiscriminatedUnion._emitSelf` cloner that replaced the routing key with `DnaAny`. Branches are now emitted as-is (like `DnaCliUnion`), preserving transforms/pipes on routing keys.
  - Add 29 non-regression tests covering DU, CLI, pipe/transform on routing key, nullable vs optional discriminator, unevaluatedProperties interaction, parser codegen (hasOwn + const check counts), parser runtime, transform on routing key in parser output, optional absent discriminator in parser output, pre-bound variable usage (DU + CLI), and getter-called-once verification.

## 0.5.1

### Patch Changes

- Fix discriminated union parity and object helper cloning
  
  - `extend`, `pick`, `omit` now use `cloner()` instead of `initDna` to
    preserve the full seed (catchall, requiredKeys, declared, etc.)
  - `discriminKeys` singletons are flattened to raw values (`"build"`
    instead of `["build"]`) to match schvalid's `const` format
  - `fromDna` clones each branch before reinjecting the discriminator
    to avoid mutating shared cached instances when branches share the
    same DNA index
  - Removed unused `tsDnaDiscriminatedBranch` type that caused
    assignability errors with private fields

## 0.5.0

### Minor Changes

- 90f4dde: Add `@ytrynot/dna/core` entry point — single source of truth for runtime classes and registry

  Introduces a new `./core` subpath export mirroring the `zod/v4/core` pattern.
  All runtime classes (`DnaType`, `DnaObject`, `DnaString`, ...), the instance
  factory (`initDna`, `BaseCore`), the compiler (`toJS`, `validator`, `parser`,
  `validatorBuilder`, `parserBuilder`), error types (`DnaError`, `DnaIssueCodes`),
  and the constructor registry (`registerExternal`, `getRegisteredExternals`) are
  now re-exported from a single `dist/core.js` bundle.

  All other entry points (`@ytrynot/dna`, `@ytrynot/dna/introspect`,
  `@ytrynot/dna/toJs`) import from `@ytrynot/dna/core` instead of bundling
  internal modules directly. This ensures:

  - **Single class identity**: `instanceof DnaType` / `instanceof DnaObject` works
    across bundles (fixes the duplicated-class bug when `introspect` was a
    separate entry point).
  - **Registry singleton**: the `externalRegistry` Map is shared across all
    bundles, so `registerExternal` calls are visible everywhere.
  - **Smaller bundles**: `dist/index.js` dropped from 136 KB to 21 KB,
    `dist/toJs.js` from 111 KB to 126 bytes. The full runtime lives in
    `dist/core.js` (220 KB), loaded once.

## 0.4.1

### Patch Changes

- 2c8dd88: Fix `isOptional()`/`isNullable()`/`isNullish()` introspection and preserve wrapper object identity in `fromDna` for recursive types.

  - `DnaType.isOptional()`, `isNullable()`, and `isNullish()` now traverse the wrapper chain (unwrapping `DnaLazy` first) instead of reading a single `meta` flag. `isOptional()` returns `false` when a `nonoptional` wrapper is encountered and `true` for absent-tolerant wrappers; `isNullable()`/`isNullish()` detect `nullable`/`nullish` wrappers respectively.
  - `DnaOptional`, `DnaNullable`, and `DnaNullish` now seed their `_core` with the corresponding `rawMeta` (`optional`, `nullable`, `nullish`) so the wrapper flags remain discoverable.
  - `fromDna` no longer calls `wrapped.meta(cleanMeta)` (which clones the wrapper and its inner, breaking object identity for recursive types whose cycle detection keys on `this._core`). It mutates the freshly-created wrapper's `_core` via `rawMeta` in place, preserving identity while still applying the reconstructed metadata.

## 0.4.0

### Minor Changes

- 35157b3: Expose `toJSONSchema()` top-level and export `validatorBuilder`/`parserBuilder` from `@ytrynot/dna`.

  - `dna.toJSONSchema()` is now available as a top-level function (previously only accessible as `schema.toJSONSchema()` instance method). Matches Zod's `z.toJSONSchema()` API.
  - `validatorBuilder` and `parserBuilder` are now exported from `@ytrynot/dna` (previously only accessible via internal import from `./toJs/dna-to-js.ts`). These are low-level APIs that recompile on every call — prefer `schema.validate()`/`schema.safeParse()` for cached compilation.

### Patch Changes

- 35157b3: Documentation consistency audit — fix inaccuracies across DNA docs.

  - `docs/technical.md`: Fix `tsDnaOpcode` type definition to use short opcodes (`"s"`, `"n"`, etc.) matching `core.types.ts`. Remove false `format: "safeint"` reference. Complete opcode list with all 34 opcodes from `core.types.ts`.
  - `docs/performance-technical-notes.md`: Reposition as a performance guide for AI agents (remove historical warning banner). Correct instanceof implementation examples to use `STEP.OUT_CONST`/`STEP.OUT_ARG` instead of outdated `preBody`/`getConstructor` pattern. Remove contradictory Key Takeaways bullet.
  - `docs/zod-comparison.md`: Remove incorrect numerical claims (11 missing, 15 advantages). Correct missing features list to match the table (error formatting functions only). Mark `z.refine()` and `z.check()` top-level as ✅ (DNA has `dna.refine()`/`dna.check()`). Remove incomplete trailing note.
  - `docs/externals.md`: Fix misleading "per-call" externals description — clarify that `ctx` is used at compile time only (function is cached). Add note recommending `schema.validate()`/`safeParse()` over low-level `validatorBuilder`/`parserBuilder`.
  - `docs/opcode-patterns.md`: Replace incorrect `STEP.CONST` with `STEP.OUT_CONST` for helper functions and regex patterns. Add 3-mechanism distinction table (`STEP.OUT_CONST` / `preDecls` → `STEP.BODY` / `STEP.CONST`). Shorten `fCount`/`dEq` examples with reference to `inline-func.ts`. Fix `oLen` conditional logic. Add `STEP.CONST` vs `STEP.OUT_CONST` subsection.
  - `docs/type-inventory.md`: Remove duplicate `.min()`/`.max()` entries in `dna.string()` key methods.

- a6a381d: Add `repository`, `bugs`, and `homepage` fields to package.json. Fix GitHub URLs to point to `linqFR/ytn`.

## 0.3.0

### Minor Changes

- 240ebbf: "@ytrynot/dna": Type-system refactor, new combinators, and validator performance improvements since the architecture changeset.

  - **Breaking**: Renames exported interface `IDnaType` → `DnaSomeType` to comply with naming conventions (`I*` is reserved for Input/Config data).
  - **Breaking**: Removes the `infer<T>` helper type alias from `helpers.types.ts` (use `$Output<T>` instead).
  - Adds `xor` combinator API (`dna.xor(...)`) and simplifies `DnaXorUnion` to a single type parameter.
  - Refactors `readonly()` return type to use `$ReadonlyReturnType<this>` for cleaner type inference instead of the previous explicit `DnaType<$ReadonlyValue<T>, ...> & Omit<this, ...>` intersection.
  - Refactors `default()` and `prefault()` method signatures to use `this["_output"]` / `this["_input"]` instead of the class-level `T` / `I` generics.
  - Refactors wrapper classes (`DnaOptional`, `DnaNullable`, `DnaNullish`, `DnaNonOptional`, `DnaDefault`, `DnaPrefault`, `DnaCatch`, `DnaExactOptional`) to use `declare readonly _output` / `declare readonly _input` instead of passing output/input types through `_DnaWrapper` generics.
  - Improves `DnaLazy` type inference with explicit `$Output<S>` / `$Input<S>` generic parameters.
  - Hoists regex constants to `OUT_CONST` steps in string validators (pattern + format) and object pattern-property validators, reducing per-call regex compilation and GC pressure.
  - Cleans up `toJs/todo.ts` backlog (205 lines removed) after the builder/`WrapperImpl` refactor.
  - Adds hybrid POC for Zod-like recursive type architecture in `sandbox/zod-like-type-architecture/`.
  - Adds comprehensive `docs/dnatype-inventory.md` (2186 lines) documenting the full DnaType architecture and type-system.
  - Bumps `jose` to ^6.2.7, adds `tsconfig.diag.json` for focused diagnostics, centralizes tsconfig include patterns.

  "@ytrynot/schvalid": Performance tooling and testing infrastructure.

  - Adds `perf/runtime-function-analyzer.ts` (258 lines) for inspecting generated validator/parser function characteristics.
  - Clarifies benchmark results documentation in README.
  - Adds JSON Schema Test Suite as git submodule for testing.
  - Migrates build back to tsup and cleans up imports.

  "@ytrynot/qb": Build infrastructure and configuration.

  - Migrates build from tsup to tsdown and back to tsup.
  - Centralizes tsconfig include patterns in `tsconfig.base.json`.

- 6abc226: "@ytrynot/dna": Major architecture hardening and feature expansion for the DNA bytecode engine.

  - Reworks the builder internals (`api-primitives.ts`, `api-enhanced.ts`, `dna-interfaces.ts`) for a clearer Zod-like fluent API.
  - Adds `fromDna` reconstruction to rebuild fluent schemas from DNA bytecode.
  - Renames the `chk` opcode to `chkSeq` and introduces `chkList` for `allOf` semantics.
  - Renames the `seq` pipeline to `pipe`.
  - Improves object `keepOnly` output handling and function tuple input support.
  - Reorganizes shared types and metadata: `base.types.ts`, `error-codes.ts`, `standard-schema.types.ts`, `runtime.types.ts`.
  - Adds `toJSONSchema` conversion support and handling for JWT, URL and `instanceOf` constraints.
  - Removes the `fastFail` option in favor of a cleaner compiler architecture.
  - Corrects `toJs` type declaration export paths.

  "@ytrynot/schvalid": JSON Schema conversion and testing improvements.

  - Integrates the official JSON Schema Test Suite as a git submodule.
  - Reorganizes tests under `tests/schemas/` with parser-fast, discriminator and edge-cases suites.
  - Improves `jschema-to-dna.ts` converter stability for edge-cases and discriminator handling.
  - Adds performance bundle and comparative benchmark harness.

- a8fc681: `DnaFunction` serialization, `fromDna` reconstruction, and `.implement()` externals support.

  - `DnaFunction._emitSelf` now serializes input and output schemas as DNA children: `["function", [inputDnaId, outputDnaId], meta?]` (previously emitted a generic `["T", {}]` that lost all schema information).
  - `fromDna` reconstructs `DnaFunction` via `case "function"` in `buildNode`, rebuilding both input tuple and output schema from the DNA graph.
  - `.implement(fn, externals?)` and `.implementAsync(fn, externals?)` now build a single closure via `toJS` instead of inlining parser source: input and output parsers are inlined as IIFEs that destructure externals from a shared argument (same codegen pattern as `transform`/`refine` — names are in scope, not accessed via `externals.name`).
  - `.implement()` is sync-only: detects async input/output schemas and async `fn` at construction time and throws a clear error directing to `.implementAsync()`. The generated function body is clean (no runtime `instanceof Promise` checks).
  - `DnaError` is inlined as `dnaErrorSource` (exported from `error.types.ts`) in `new Function` bodies — generated functions have no access to module imports.
  - `dna.function()` without `.input()` now defaults to a tuple with `rest: dna.unknown()` (pass-through, matching Zod). Explicit `.input([])` remains a strict empty tuple.
  - The returned function exposes `requiredExternals: string[]` (union of input and output parser externals), matching `parserBuilder`/`validatorBuilder`.
  - Externals are merged from `getRegisteredExternals()` and the explicit `externals` parameter, enabling both registered and ad-hoc externals patterns.
  - Adds `tests/from-dna-function.test.ts` (28 tests): basic roundtrip, implement/implementAsync, rest args, no input/output, registered and explicit externals, nested objects, DNA structure assertions, and error cases (wrong types, arity, refine, enum, async validation).

- adfc800: Expose `toJSONSchema()` top-level and export `validatorBuilder`/`parserBuilder` from `@ytrynot/dna`.

  - `dna.toJSONSchema()` is now available as a top-level function (previously only accessible as `schema.toJSONSchema()` instance method). Matches Zod's `z.toJSONSchema()` API.
  - `validatorBuilder` and `parserBuilder` are now exported from `@ytrynot/dna` (previously only accessible via internal import from `./toJs/dna-to-js.ts`). These are low-level APIs that recompile on every call — prefer `schema.validate()`/`schema.safeParse()` for cached compilation.

- 0e17551: Type-system cleanup, `fromDna` template support, and documentation accuracy pass.

  - Renames `BaseCore` constructor parameter `type` to `kind` (hybrid label: opcode or descriptive name).
  - Makes `_core` field public on `DnaType` and all subclasses; removes the `SymCore` symbol indirection.
  - Adds per-class `.type` getter overrides returning Zod-aligned descriptive names (e.g. `"number"`, `"union"`, `"optional"`) instead of raw DNA opcodes.
  - Marks `.format()` as internal (`_format` with `@internal` JSDoc); not part of the public API.
  - Adds `template` opcode support in `fromDna` via internal `DnaTemplateReconstructed` subclass (bypasses irreversible regex re-escaping).
  - Expands `fromDna` roundtrip test coverage from 2350 to 2550 tests (0 skipped, was 200 skipped).
  - Adds high-level schema methods (`.validate()`, `.safeParse()`, `.parse()`, async variants, `.spa()`) as primary API in README; relegates `toJs`/`validator`/`parser` to advanced section.
  - Fixes documentation: corrects `DnaUUID` casing, removes non-existent `z.deno()`/`z.node()`/`deepPartial()` from Zod v4 comparison, fixes `dna.coerce.int()` → `dna.int({ coerce: true })`, removes `dna.not()` references.
  - Marks `performance-technical-notes.md` as historical (patterns don't match current codegen).
  - Deletes `zod-test-evaluation.md` (porting tracking complete: 77/79 files ported).

- 95a3fd6: Normalize externals mechanism: registry typed as `Map<string, unknown>`, rename `jose` external to `jwtFn` (injects `jose.decodeProtectedHeader` directly), align code with documented contract. Move `zod` from peerDependencies to devDependencies in schvalid (used only for benchmarks).

### Patch Changes

- ea124bd: Documentation consistency audit — fix inaccuracies across DNA docs.

  - `docs/technical.md`: Fix `tsDnaOpcode` type definition to use short opcodes (`"s"`, `"n"`, etc.) matching `core.types.ts`. Remove false `format: "safeint"` reference. Complete opcode list with all 34 opcodes from `core.types.ts`.
  - `docs/performance-technical-notes.md`: Reposition as a performance guide for AI agents (remove historical warning banner). Correct instanceof implementation examples to use `STEP.OUT_CONST`/`STEP.OUT_ARG` instead of outdated `preBody`/`getConstructor` pattern. Remove contradictory Key Takeaways bullet.
  - `docs/zod-comparison.md`: Remove incorrect numerical claims (11 missing, 15 advantages). Correct missing features list to match the table (error formatting functions only). Mark `z.refine()` and `z.check()` top-level as ✅ (DNA has `dna.refine()`/`dna.check()`). Remove incomplete trailing note.
  - `docs/externals.md`: Fix misleading "per-call" externals description — clarify that `ctx` is used at compile time only (function is cached). Add note recommending `schema.validate()`/`safeParse()` over low-level `validatorBuilder`/`parserBuilder`.
  - `docs/opcode-patterns.md`: Replace incorrect `STEP.CONST` with `STEP.OUT_CONST` for helper functions and regex patterns. Add 3-mechanism distinction table (`STEP.OUT_CONST` / `preDecls` → `STEP.BODY` / `STEP.CONST`). Shorten `fCount`/`dEq` examples with reference to `inline-func.ts`. Fix `oLen` conditional logic. Add `STEP.CONST` vs `STEP.OUT_CONST` subsection.
  - `docs/type-inventory.md`: Remove duplicate `.min()`/`.max()` entries in `dna.string()` key methods.

- 4fcdb3c: @ytrynot/schvalid: Add `parserFast` hybrid parser (validate-then-parse) exposed via `schvalid("fast")` and `schvalid("all").compile(schema).parseFast`. Rename `schvalid("both")` mode to `schvalid("all")`, which now also returns `parseFast` alongside `validate`/`parse`, all compiled once and sharing the same `validate`/`parse` instances (see `combineFast`).

  @ytrynot/dna: Optimize object parser codegen (`dna-js-json.ts`) to skip the redundant `keepOnly` scratch object and filter-copy loop when there are no dynamic properties (no `patternProperties`/`propertyNames`/schema-based `additionalProperties`). Per-key writes are already scoped to the declared key set and conditionally guarded, so writing directly into the output variable is safe and equivalent — measured ~2.9x speedup on the parser's happy path for typical object schemas.

## 0.2.0

### Minor Changes

- Extract DNA JS builder from @ytrynot/schvalid into new @ytrynot/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude

## 0.1.0

### Minor Changes

- Extract DNA JS builder from @ytrynot/schvalid into new @ytrynot/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude

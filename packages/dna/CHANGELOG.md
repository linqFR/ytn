# @ytrynot/dna

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

  "@ytrynot/czvo": Codec refactor and build infrastructure.

  - Refactors `makeEmptyTo` in `zod-codecs.ts`: removes the `z.coerce.string().pipe(...)` wrapper in favor of a direct `z.preprocess(...)` with explicit return type annotation. Non-string inputs are no longer coerced to string before preprocessing — they fall through to the `""` branch (same as before for non-string `typeof` checks).
  - Reorganizes performance tests from `tests/performance/` to `perf/` (standalone tsx scripts).
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

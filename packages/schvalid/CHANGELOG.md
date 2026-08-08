# @ytn/schvalid

## 0.3.0

### Minor Changes

- 4fcdb3c: @ytn/schvalid: Add `parserFast` hybrid parser (validate-then-parse) exposed via `schvalid("fast")` and `schvalid("all").compile(schema).parseFast`. Rename `schvalid("both")` mode to `schvalid("all")`, which now also returns `parseFast` alongside `validate`/`parse`, all compiled once and sharing the same `validate`/`parse` instances (see `combineFast`).

  @ytn/dna: Optimize object parser codegen (`dna-js-json.ts`) to skip the redundant `keepOnly` scratch object and filter-copy loop when there are no dynamic properties (no `patternProperties`/`propertyNames`/schema-based `additionalProperties`). Per-key writes are already scoped to the declared key set and conditionally guarded, so writing directly into the output variable is safe and equivalent — measured ~2.9x speedup on the parser's happy path for typical object schemas.

### Patch Changes

- 240ebbf: "@ytn/dna": Type-system refactor, new combinators, and validator performance improvements since the architecture changeset.

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

  "@ytn/schvalid": Performance tooling and testing infrastructure.

  - Adds `perf/runtime-function-analyzer.ts` (258 lines) for inspecting generated validator/parser function characteristics.
  - Clarifies benchmark results documentation in README.
  - Adds JSON Schema Test Suite as git submodule for testing.
  - Migrates build back to tsup and cleans up imports.

  "@ytn/qb": Build infrastructure and configuration.

  - Migrates build from tsup to tsdown and back to tsup.
  - Centralizes tsconfig include patterns in `tsconfig.base.json`.

  "@ytn/czvo": Codec refactor and build infrastructure.

  - Refactors `makeEmptyTo` in `zod-codecs.ts`: removes the `z.coerce.string().pipe(...)` wrapper in favor of a direct `z.preprocess(...)` with explicit return type annotation. Non-string inputs are no longer coerced to string before preprocessing — they fall through to the `""` branch (same as before for non-string `typeof` checks).
  - Reorganizes performance tests from `tests/performance/` to `perf/` (standalone tsx scripts).
  - Migrates build from tsup to tsdown and back to tsup.
  - Centralizes tsconfig include patterns in `tsconfig.base.json`.

- 6abc226: "@ytn/dna": Major architecture hardening and feature expansion for the DNA bytecode engine.

  - Reworks the builder internals (`api-primitives.ts`, `api-enhanced.ts`, `dna-interfaces.ts`) for a clearer Zod-like fluent API.
  - Adds `fromDna` reconstruction to rebuild fluent schemas from DNA bytecode.
  - Renames the `chk` opcode to `chkSeq` and introduces `chkList` for `allOf` semantics.
  - Renames the `seq` pipeline to `pipe`.
  - Improves object `keepOnly` output handling and function tuple input support.
  - Reorganizes shared types and metadata: `base.types.ts`, `error-codes.ts`, `standard-schema.types.ts`, `runtime.types.ts`.
  - Adds `toJSONSchema` conversion support and handling for JWT, URL and `instanceOf` constraints.
  - Removes the `fastFail` option in favor of a cleaner compiler architecture.
  - Corrects `toJs` type declaration export paths.

  "@ytn/schvalid": JSON Schema conversion and testing improvements.

  - Integrates the official JSON Schema Test Suite as a git submodule.
  - Reorganizes tests under `tests/schemas/` with parser-fast, discriminator and edge-cases suites.
  - Improves `jschema-to-dna.ts` converter stability for edge-cases and discriminator handling.
  - Adds performance bundle and comparative benchmark harness.

- 95a3fd6: Normalize externals mechanism: registry typed as `Map<string, unknown>`, rename `jose` external to `jwtFn` (injects `jose.decodeProtectedHeader` directly), align code with documented contract. Move `zod` from peerDependencies to devDependencies in schvalid (used only for benchmarks).
- 6738937: Documentation consistency audit — fix inaccuracies across schvalid docs.

  - `docs/ajv-comparison.md`: Fix test runner description — `discoverJsonFiles()` IS recursive, optional/ files are filtered by `shouldSkipFile()`. Correct format count from 18 to 19 (matching `JSONFORMAT` in `string-formats.ts`). Qualify "~4x faster" compilation claim with reference to `tests/bench/`. Remove line counts from Source References. Fix test counts to 1243 passing per mode / 44 skipped (was 1201).
  - `AGENTS.md`: Update JSON Schema Test Suite count from 1160/1201 to 1243 passing per mode, 44 skipped.
  - `README.md`: Update test coverage count from 1201 to 1243 passing per mode, 44 skipped.

- Updated dependencies [240ebbf]
- Updated dependencies [6abc226]
- Updated dependencies [ea124bd]
- Updated dependencies [a8fc681]
- Updated dependencies [adfc800]
- Updated dependencies [0e17551]
- Updated dependencies [95a3fd6]
- Updated dependencies [4fcdb3c]
  - @ytn/dna@0.3.0

## 0.2.2

### Patch Changes

- Extract DNA JS builder from @ytn/schvalid into new @ytn/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude
- Updated dependencies
  - @ytn/dna@0.2.0

## 0.2.1

### Patch Changes

- Extract DNA JS builder from @ytn/schvalid into new @ytn/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude
- Updated dependencies
  - @ytn/dna@0.1.0

## 0.2.0

### Minor Changes

- - Refactor to use @ytn/dna as dependency for validation engine
  - Add convenience validate() and parse() functions combining schema conversion and validation
  - Create tsup build configuration with DTS generation
  - Add README documentation with usage examples
  - Configure test scripts (test, test:full, test:performance)
  - Update performance tests to use build output

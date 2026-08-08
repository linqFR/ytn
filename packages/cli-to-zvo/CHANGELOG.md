# @ytn/czvo

## 2.2.1

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

## 2.2.0

### Minor Changes

- d45a558: # Major Refactoring of the CZVO Runtime Engine Architecture

  Full refactoring of the runtime architecture toward a functional engine optimized for AOT.
  Introduction of `executeRaw` for live contract execution and `execWithFile` for dynamic AOT loading.
  Universal command dispatching via `launchCzvo`.
  Migration of core logic to `src/core.ts` and removal of legacy abstractions and obsolete utilities.
  Stabilization of the type system to support generic launchers.

### Patch Changes

- 3bcef00: Security, stability, and feature release:

  - **Feature**: Added `allowNegative` engine option to support negatable CLI flags (e.g., `--no-verbose` sets `verbose` to `false`).
  - **Stability**: Fixed positional argument mapping in the routing engine to correctly handle multi-argument signatures in complex test scenarios.
  - **Security**: Hardened the `pico` API with an immutable Proxy that prevents internal mutation of Zod properties.
  - **Robustness**: Enforced a 31-argument limit to prevent bitmask overflow on 32-bit signed integers in JavaScript.
  - **Documentation**: Comprehensive JSDoc audit and README update covering engine options (`onlyAllowedValues`, `allowNegative`) and safety constraints.
  - **Testing**: Reached 87/87 passing tests with new regression and behavioral suites.

- bac7fd2: # Major stabilization and Zod V4 compliance

  ## @ytn/qb

  - Stabilized `Introspector.getSchemaShape` to correctly handle ZodPipe (transforms/preprocess) and ZodLazy schemas using Zod V4 public APIs.
  - Implemented "First Object Wins" structural discovery for DDL generation.

  ## @ytn/czvo

  - Removed obsolete `intercept` (global flags) property from codebase and tests (feature removed in v2.1.0).

  ## Global

  - Standardized monorepo path exclusions in `tsconfig.base.json` using recursive glob patterns (`**/`) for `node_modules`, `dist`, `sandbox`, and `archive` folders.

## 2.1.0

### Minor Changes

- 35e18a6: Refactor: removal of the 'intercept' (global flags) feature from both the routing engine and documentation.

  - Cleanup: removed 'intercept' property from Contract validation schemas and built-in help injection.
  - Documentation: replaced the "Interceptor flags" section with clear patterns for global flags using 'fallbacks' and object composition.

### Patch Changes

- f1104fa: Refactor: removal of the 'intercept' (global flags) feature from both the routing engine and documentation.

## 2.0.0

### Major Changes

- 3353455: # Major Engine Refactor, Architecture Reorganization & Breaking Parameter Changes

  ## @ytn/czvo (v2.0.0)

  - **Engine Refactor**: Unified recursive Proxy logic into a single `bridgeZod` engine. Enforced strict Zod v4 nominal compliance while maintaining full API method chaining.
  - **Breaking API Changes**: Renamed `listof` to `list` and updated `pico` API methods to function calls for better consistency.
  - **Architecture**: Major reorganization into domain-specific folders (`core`, `cli-engine`, `schema`, `output`, `types`). Centralized bit-router logic and internal types.
  - **Public API**: Enhanced `index.ts` with explicit type exports (`OResponse`, `OHelpData`, `tsProcessedContract`). Fixed internal `Contract` import path.
  - **Tests**: Comprehensive suite expansion with dedicated tests for `codecs`, `dsl-conversion`, and `contract-schema` validation. Added `zvo-test-gate.ts` to streamline assertions.

  ## @ytn/qb (v2.0.0)

  - **Query Cloning**: Added `.clone()` method to the `Builder` to allow safe reuse of base queries without mutation.
  - **Breaking Search Change**: Switched `.search()` to use named parameters (`@search_term`) instead of the traditional `?` to improve parameter safety and consistency.
  - **DDL Improvements**: Updated `DDLEngine` to support both string and array formats for Primary Keys.

## 1.0.1

### Patch Changes

- feat(czvo): strengthen TypeScript types and stabilize parser logic

## 1.0.0

### Major Changes

- refactor(cli): release of @ytn/czvo

  - Implement new ZVO (Zod-Validated Objects) parsing logic
  - Update build configuration to use tsup and vitest

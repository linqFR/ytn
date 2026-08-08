# @ytn/qb

## 2.0.3

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

## 2.0.2

### Patch Changes

- bac7fd2: # Major stabilization and Zod V4 compliance

  ## @ytn/qb

  - Stabilized `Introspector.getSchemaShape` to correctly handle ZodPipe (transforms/preprocess) and ZodLazy schemas using Zod V4 public APIs.
  - Implemented "First Object Wins" structural discovery for DDL generation.

  ## @ytn/czvo

  - Removed obsolete `intercept` (global flags) property from codebase and tests (feature removed in v2.1.0).

  ## Global

  - Standardized monorepo path exclusions in `tsconfig.base.json` using recursive glob patterns (`**/`) for `node_modules`, `dist`, `sandbox`, and `archive` folders.

- d45a558: Standardize tsup build configuration using the centralized `buildConfig` helper and update dependencies. (commit: fea085c)

## 2.0.1

### Patch Changes

- af39494: Small adjustments to the TypeScript configuration for improved build consistency.

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

## 1.3.3

### Patch Changes

- Refactored package structure and modernized the testing infrastructure.

  - Renamed the package directory from `query_builder` to `query-builder`.
  - Migrated the test suite to Vitest for better workspace integration.
  - Standardized test file naming and cleaned up build configurations.

<<<<<<< HEAD

## 1.3.2

### Patch Changes

- refactor: harmonized file naming convention to kebab-case across the monorepo.

=======

> > > > > > > 1cf643b0373a16a06f158b4f8dcdfc9d770aa18b

## 1.3.1

### Patch Changes

- feat(core): implement automatic entry point discovery in tsup.config.base

## 1.3.0

### Minor Changes

- feat(ddl): add `pkauto` for explicit AUTOINCREMENT and refine `NOT NULL` logic.
  docs: overhaul README with detailed aliasing and correlated subquery examples.
  test: unify test suite with TS-based reporting infrastructure.

### Patch Changes

- aaf0f2d: build: expose minified bundles and improve documentation

## 1.2.1

### Patch Changes

- aaf0f2d: build: expose minified bundles and improve documentation

## 1.2.0

### Minor Changes <!-- v1.2.0 -->

- Added PragmaBuilder for fluent SQLite configuration, DML Returning clause support (SQLite 3.35+), and deep Zod v4 introspection with referential integrity (ON DELETE/UPDATE) via metadata.

## 1.1.0

### Minor Changes <!-- v1.1.0 -->

- Unify WHERE clauses across all DML statements and add SQLite RETURNING support.

## 1.0.0

### Major Changes

- a07b302: First Release of [query_builder](../packages/query_builder/README.md) an SQLite builder based on Zod v4.

### Patch Changes

- Documentation update

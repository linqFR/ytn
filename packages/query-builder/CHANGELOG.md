# @ytn/qb

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

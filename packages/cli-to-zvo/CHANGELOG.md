# @ytn/czvo

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

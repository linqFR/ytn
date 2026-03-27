---
"@ytn/czvo": major
"@ytn/qb": major
---

# Major Engine Refactor, Architecture Reorganization & Breaking Parameter Changes

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

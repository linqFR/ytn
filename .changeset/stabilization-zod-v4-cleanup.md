---
"@ytn/qb": patch
"@ytn/czvo": patch
---

# Major stabilization and Zod V4 compliance

## @ytn/qb

- Stabilized `Introspector.getSchemaShape` to correctly handle ZodPipe (transforms/preprocess) and ZodLazy schemas using Zod V4 public APIs.
- Implemented "First Object Wins" structural discovery for DDL generation.

## @ytn/czvo

- Removed obsolete `intercept` (global flags) property from codebase and tests (feature removed in v2.1.0).

## Global

- Standardized monorepo path exclusions in `tsconfig.base.json` using recursive glob patterns (`**/`) for `node_modules`, `dist`, `sandbox`, and `archive` folders.

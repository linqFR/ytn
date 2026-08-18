# @ytrynot/cli

## 0.0.3

### Patch Changes

- e897dff: Bump engines to Node >=26.0.0 across all packages. CI workflows updated to Node 26.
- Updated dependencies [e897dff]
  - @ytrynot/dna@0.7.4

## 0.0.2

### Patch Changes

- 67c6009: Documentation restructure and public API cleanup
  
  - Restructure docs per Diátaxis: README as Quick Start, new `docs/api-reference.md` (Reference), new `docs/architecture.md` (Explanation)
  - Add Requirements, Installation, Layers, and Public API sections to README
  - Add npm/CI/license badges to README
  - Add copyright year to License section
  - Update tagline and Overview to highlight standalone output (no DNA runtime dependency)
  - Document all public exports (previously undocumented: `formatCliError`, `IHandlers`, `RouteHandler`, `FormatterFn`, `OHandlerResultLoose`, `IContractOptions`, `ICliOptions`)
  - Fix factual errors: 228 tests (was 197), `files is []` not `undefined` for 0 positionals, `verified on Node ≥25` (was v26), add `dna.coerce.string()` to coercion list
  - Remove `(planned)` from Help in AGENTS.md (already implemented)
  - Remove `ROUTE_ID_KEY` and `CompiledParser` from public exports (internal only)
  - Add link back to README/api-reference/architecture from how-to guide
- Updated dependencies [ac6ddf2]
- Updated dependencies [ac6ddf2]
  - @ytrynot/dna@0.7.3

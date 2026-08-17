---
"@ytrynot/cli": patch
---

Documentation restructure and public API cleanup

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

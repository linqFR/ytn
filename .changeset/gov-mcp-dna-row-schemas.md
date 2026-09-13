---
"@ytrynot/gov-mcp": minor
---

DNA row schemas as single source of truth for DDL, TypeScript types, and MCP output validation

- All 16 database tables are now defined via `qb.defTable(name, dnaSchema)` from `shared/schemas/rows.ts`. The DNA object schemas carry database metadata (`.meta({ pk, pkauto, unique, fk, readonly })`) consumed by the qb introspector to generate DDL.
- TypeScript row types (`tsWriterRow`, `tsActionRow`, etc.) are now derived via `dna.infer<typeof rowSchema>` — the manual interfaces in `types/rows.ts` are removed.
- MCP output schemas in `tool-outputs.ts` use the real DNA row schemas instead of `dna.any()` placeholders. The MCP SDK now validates structured output rows at runtime.
- CHECK constraints are declared as table-level `options.checks` (the DNA introspector does not extract `check` from `.meta()`).
- `ROOT_SCOPE_ID` moved from `server/definitions/constants.ts` to `shared/enums.ts` so shared row schemas can import it without crossing the client/server boundary.

BREAKING CHANGE: `ts*Row` types are now inferred from DNA schemas via `dna.infer`. Code that manually declared compatible interfaces must use the exported types from `@ytrynot/gov-mcp/client` or `shared/schemas/rows.ts`. Nullable fields are typed as `string | null` (DNA `.nullable()`) rather than `string | undefined`.

---
"@ytrynot/gov-mcp": minor
---

Idea suspension, audience targeting, MCP client additions, and row type naming

- `suspended` is now a valid idea status. An idea can be suspended (temporarily paused) and later resumed, promoted, or abandoned. No `abandonReason` is required for suspension — use free fields for extra context.
- `audience` field semantics are now documented: `all` broadcasts to every writer, a specific writer ID targets that writer, and `all,writer-id` combines both. Writers sharing the same default scope may see entries, but explicit delivery requires the target writer ID in `audience`.
- `listDecisions` is now exposed in the MCP client (`@ytrynot/gov-mcp/client`) with `status`, `scope`, `withChildren`, and `limit` filters — matching the server-side tool.
- `./client` subpath is now declared in `package.json` exports, making `@ytrynot/gov-mcp/client` resolvable for consumers.
- Row type interfaces are renamed from `I*Row` to `ts*Row` (e.g. `IDecisionRow` → `tsDecisionRow`, `IActionRow` → `tsActionRow`). These are neutral static structures used as both query results and statement parameters, not input-only types.
- The writer cursor column is `last_read_at` (matching the production database), not `last_read_log_id`.
- `getDescription` is now exported from `@ytrynot/dna/introspect`, walking the wrapper chain to find the first non-undefined description on a schema.

BREAKING CHANGE: Row type names changed from `I*Row` to `ts*Row`. Any code importing `IDecisionRow`, `IActionRow`, `IWriterRow`, etc. from `@ytrynot/gov-mcp` must update to `tsDecisionRow`, `tsActionRow`, `tsWriterRow`, etc. The `OWriterRow` / `OLogEntryRow` / `OActionRow` / `OProblemRow` aliases are removed — import `tsWriterRow` / `tsLogEntryRow` / `tsActionRow` / `tsProblemRow` directly from `@ytrynot/gov-mcp/client`.

# AGENTS.md (Package: @ytrynot/gov-mcp)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to @ytrynot/gov-mcp.

---

## Architecture

`@ytrynot/gov-mcp` is a SQLite-centric governance MCP server. SQLite is the single source of truth; Markdown files are generated views.

### Directory layout

- `src/driver.ts` — SQLite driver abstraction (better-sqlite3 default, node:sqlite optional)
- `src/definitions/` — Domain definitions (schema, triggers, constants, enums, FTS5, cascade)
  - `constants.ts` — `ROOT_SCOPE_ID` ("workspace")
  - `enums.ts` — 14 `as const` enum arrays shared by DNA schemas and DB CHECK constraints
  - `schema.ts` — 16 tables via `qb.defTable`, 41 indexes via `qb.createIndex`, `generateSchemaSQL()` assembly
  - `triggers.ts` — 4 cascade + 1 supersession + 21 FTS5 sync triggers via `qb.createTrigger` (bodies/WHERE are raw SQL)
  - `cascade.ts` — `_cascade_disabled` flag table DDL
  - `fts5.ts` — FTS5 virtual table DDL (qb escape hatch)
- `src/types/` — Shared TypeScript types
  - `types.ts` — `IToolCtx`, `IToolResult`
  - `rows.ts` — 18 row interfaces for typed `IStatement<T>`
  - `queries.ts` — `IQueries` interface (all prepared statement signatures)
- `src/seed.ts` — Initial scope seeds
- `src/schemas/` — DNA input schemas for MCP tool validation
- `src/queries/` — Pre-compiled qb queries, split by table cluster:
  - `decisions.ts`, `actions.ts`, `ideas.ts`, `problems.ts`, `specs.ts` — per-table CRUD + reports
  - `scopes-writers.ts` — scopes (recursive CTE) + writers (cursor)
  - `log-entries.ts` — append-only journal + threads + reports
  - `status-history.ts` — append-only audit trail
  - `lifecycle.ts` — inter-table relations + 6 audit queries
  - `shared.ts` — FTS5 search + transverse UNION
  - `index.ts` — facade that assembles all `compileXxxQueries(db)` functions
- `src/tools/` — MCP tool implementations (read, write, reports, transverse)
- `src/helpers.ts` — Shared utilities (ID formatting, timestamps, scope resolution)
- `src/server.ts` — MCP server entry point (`@modelcontextprotocol/sdk`)
- `src/index.ts` — Public API facade
- `schema/` — Committed SQL artifacts (schema.sql, triggers.sql) — shared with future Python implementation
- `data/` — SQLite DB file (gitignored)
- `tests/integration/` — Shared JSON test cases for DB integration (language-agnostic)
- `tests/protocol/` — Shared JSON test cases for MCP protocol (language-agnostic)

### Key invariants

1. **SQLite is the source of truth** — Markdown is generated, never hand-edited post-migration.
2. **Append-only history** — `status_history` and `log_entries` are immutable. Corrections use `append_log_entry` with `type=correction`.
3. **Cascades are SQL triggers** — Atomic, unidirectional, impossible to bypass.
4. **Transactions for multi-table mutations** — All-or-nothing via `BEGIN/COMMIT`.
5. **DNA validates inputs, CHECK constraints validate at DB level** — Double validation.
6. **WAL mode + busy_timeout** — Required for concurrent access (future Node+Python).
7. **`correct` targets entities only** — `decision`, `action`, `idea`, `problem`, `spec`. Never `log_entries`.
8. **Free fields use soft delete** — `free_fields.status` is `active` or `deprecated`. `deprecate_free_field` marks as deprecated, never hard-deletes. Consistent with append-only philosophy.
9. **Free fields FTS is conditional** — Only `fts_indexed = 1 AND status = 'active'` fields are indexed in `search_index` as `entity_type = 'free_field'`. Scope is resolved from the parent entity via subquery.

### Dependencies

- `better-sqlite3` — Synchronous SQLite driver (default)
- `@modelcontextprotocol/sdk` — MCP server SDK
- `@ytrynot/dna` — Input validation
- `@ytrynot/qb` — SQL query builder (with raw SQL escape hatches for UNION, triggers, FTS5)
- `nanoid` — Writer token generation

### Escape hatches (raw SQL)

qb does not support CREATE TRIGGER, FTS5, recursive CTEs, UNION, or subqueries in WHERE. Raw SQL is isolated in:
- `src/definitions/triggers.ts` — All trigger DDL (trigger bodies and WHEN expressions are raw SQL; trigger structure is QB-generated via `createTrigger()`)
- `src/definitions/fts5.ts` — FTS5 virtual table DDL (`FTS5_DDL`)
- `src/definitions/cascade.ts` — `_cascade_disabled` flag table DDL
- `src/queries/shared.ts` — UNION queries (`mailboxLast24h`), FTS5 search (`fts5Search`, `fts5SearchByType`)
- `src/queries/scopes-writers.ts` — Recursive CTE (`scopeTree`), free_fields raw SQL (`getFreeFields`, `getFreeFieldsAll`, `deprecateFreeField` — status filter is simpler in raw SQL)
- `src/queries/lifecycle.ts` — Subquery in WHERE (`reportProblemsByDecisionActions`), correlated EXISTS (`auditActPendingStale`)

### DNA validation pattern

All MCP tool inputs are validated with `@ytrynot/dna` schemas. The pattern is:

1. **Schema definition** (`src/schemas/tool-inputs.ts`):
   - Each tool has a `xxxInput` DNA schema.
   - Enum values are imported from `src/definitions/enums.ts` (shared with DB CHECK constraints).
   - Write tools use `.transform(...)` for contextual validation and enrichment (writer lookup, entity lookup, scope resolution, sequence generation, collision checks, business rules).
   - Transforms that reference closure variables must pass them as DNA externals via `.transform(..., { externals })` and `.safeParse(input, { externals })`.

2. **Type inference** (compile-time only):
   - Tool function signatures use `input: dna.infer<typeof S.xxxInput>` — no manual type duplication.
   - `dna.infer<S>` is an alias for `dna.output<S>` (the schema output type).
   - For untransformed schemas, input and output types are equivalent.

3. **Runtime validation** (mandatory for direct calls):
   - MCP's `registerTool(..., { inputSchema })` validates protocol calls.
   - Direct calls from tests or imports bypass MCP validation.
   - Every input-bearing function must call its schema's `.safeParse(input)`:

   ```ts
   const res = S.xxxInput.safeParse(input);
   if (!res.success) {
     const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
     return err(`Validation failed:\n${messages.join("\n")}`);
   }
   ```

   - Do NOT use a generic `validate()` helper — direct `.safeParse()` is the established pattern.

4. **Write tool pattern**:
   - DNA transform validates + enriches input (generates IDs, looks up writer, checks collisions).
   - `safeTransaction` wraps the database mutations.
   - `id: null` for auto-generated SQLite primary keys when the query expects the ID parameter.
   - `null` for optional database values, never `undefined`.

### Report generation

7 report tools generate Markdown from the DB and write it to `mailbox/generated/` on disk:
- `generate_daily_report` — daily mailbox file
- `generate_decisions_report` — full decisions registry
- `generate_actions_report` — full actions registry
- `generate_ideas_report` — full ideas registry
- `generate_problems_report` — full problems registry
- `generate_decision_history_report` — single decision timeline
- `export_dump` — SQL text dump (returned as string, not written to disk)

All report queries use pre-compiled QB statements. Markdown is built with native JS template literals (no template engine dependency). The `mailbox/generated/` directory is created automatically if it does not exist.

**Return convention**: every report tool MUST return the absolute `filepath` of the generated file in its result payload, so callers (agents, MCP clients) can link to or open the produced document. The `filepath` field is required for all report tools that write to disk.

**Markdown field convention**: text fields (context, decision, consequences, body, evidence, blockers, description, root_cause, fix, short_desc, long_desc, abandon_reason, log body, etc.) are rendered as Markdown under `###`-level headings. The report structure is:
- `#` — report title
- `##` — entity titles (`## DEC-0006 — title`) and major sections (`## Index`, `## Actions`, etc.)
- `###` — field headings (`### Context`, `### Body`, `### Evidence`, etc.)
- `####`+ — user content within fields (any `#`/`##`/`###` in user text is promoted to `####` via `mdField()`)

Cross-entity references (DEC-NNNN, ACT-NNNN, IDEA-NNNN, PB-NNNN) are rendered as clickable links via `entityLink()`.

### Build

```bash
npm.cmd run build -w @ytrynot/gov-mcp
```

### Test

```bash
npm.cmd test -w @ytrynot/gov-mcp
```

### Start (dev)

```bash
npm.cmd run start -w @ytrynot/gov-mcp
```

# Architecture — @ytrynot/gov-mcp

## SQLite as Single Source of Truth

The governance system uses SQLite as the authoritative data store. Markdown files are generated views, produced on demand by MCP tools (`generate_daily_report`, `generate_decisions_report`, `generate_actions_report`, `generate_ideas_report`, `generate_problems_report`, `generate_decision_history_report`, `export_dump`). Report tools write Markdown to `mailbox/generated/` on disk. No hand-editing of Markdown is required post-migration.

### Why SQLite?

- **Atomic transactions** — multi-table mutations are all-or-nothing.
- **Triggers** — cascades are enforced at the DB level, impossible to bypass.
- **FTS5** — built-in full-text search without external services.
- **WAL mode** — concurrent readers + single writer, suitable for local multi-process access.
- **File-based** — no server process, easy backup (copy the `.db` file).
- **Cross-language** — Node and Python can share the same `.db` file.

## Driver Abstraction

The driver (`src/driver.ts`) wraps `better-sqlite3`:

- **Synchronous API** — no async overhead, simpler error handling.
- **Statement caching** — prepared statements are cached by SQL string.
- **Transaction wrapper** — `db.transaction(fn)` for atomic multi-statement operations.
- **Startup pragmas** — WAL, busy_timeout, foreign_keys, synchronous, encoding applied at open time.

### Why better-sqlite3 over node:sqlite?

- **Mature** — battle-tested in production.
- **Better file handling** — robust WAL + SHM file management.
- **Stable API** — no experimental flags needed.
- **Type definitions** — `@types/better-sqlite3` is well-maintained.

`node:sqlite` (available in Node 26 as `DatabaseSync`) is a future alternative for zero-dependency deployments, but is still marked experimental in some Node versions.

## Schema Layout

16 tables organized in three tiers:

### Tier 1: Scopes and Writers (metadata)
- `scopes` — hierarchical scope registry (parent/child).
- `writers` — access management with persistent nanoid tokens.

### Tier 2: Main registries (entities)
- `decisions` — DEC-NNNN
- `actions` — ACT-NNNN
- `ideas` — IDEA-NNNN
- `problems` — PB-NNNN
- `specs` — spec-YYYY-MM-DD-*

### Tier 3: Relations and history
- `action_dependencies` — N:N action → action
- `problem_actions` — N:N problem ↔ action (source of truth)
- `workstreams` — transverse groupings
- `action_workstreams` — N:N action ↔ workstream
- `decision_supersedes` — N:N decision supersession relationships
- `entity_scopes` — N:N additional scopes for any entity
- `free_fields` — free-form metadata fields (md/json/link/url/text)
- `log_entries` — narrative log (append-only, immutable)
- `status_history` — audit trail for all status changes

### FTS5
- `search_index` — virtual table indexing 7 tables (6 entity tables + free_fields).

## Query Construction

Standard queries use `@ytrynot/qb`:

- `defTable(name, columns)` — generates `createTable`, `getById`, `insert`, `update`, `delete`, `upsert`.
- `req.select().where().orderBy().limit().toSQL()` — fluent query building.

### Escape Hatches (raw SQL)

qb does not support:
- `UNION` / `UNION ALL` — used in `mailbox_last_24h`, `get_handoff`.
- `CREATE TRIGGER` — all 26 triggers are raw SQL.
- `FTS5` — virtual table DDL is raw SQL.
- `CHECK constraints` — tables with CHECK constraints use raw DDL.

Raw SQL is isolated in:
- `src/definitions/triggers.ts` — all trigger DDL.
- `src/queries/shared.ts` — UNION and FTS5 queries.
- `src/queries/scopes-writers.ts` — free_fields raw SQL (status filter).

## Validation Strategy

Double validation:

1. **DNA schemas** (`src/schemas/tool-inputs.ts`) — validate MCP tool inputs before any DB operation.
2. **CHECK constraints** — validate at the DB level as a safety net.

This ensures invalid data cannot enter the database even if a tool bypasses DNA validation.

## Transaction Boundaries

All multi-table mutations are wrapped in `db.transaction()`:

- `create_decision` — INSERT decision + INSERT status_history + INSERT log_entry.
- `update_action_status` — UPDATE action + INSERT status_history + INSERT log_entry (+ cascade via triggers).
- `correct` — UPDATE entity + INSERT log_entry (+ INSERT status_history if correcting status).

Transactions are atomic: if any statement fails, all changes are rolled back.

## Future Python Interoperability

The SQL artifacts in `schema/` are language-agnostic:

- `schema/schema.sql` — can be executed by Python's `sqlite3` module.
- `schema/triggers.sql` — same.

Only `workspace` is seeded at init. Other scopes are declared by the agent via the `create_scope` MCP tool.

A future Python implementation can:
1. Open the same `.db` file (WAL mode allows concurrent access).
2. Apply the same schema and triggers.
3. Implement the same MCP tools in Python.
4. Share test fixtures (JSON) for cross-language validation.

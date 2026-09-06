# Changelog

## 0.2.0

### Minor Changes

- 6381046: Initial public release of @ytrynot/gov-mcp — SQLite-centric governance MCP server.
  
  - 58 MCP tools (29 read-only, 21 mutations, 8 reports) exposed over stdio
  - SQLite as single source of truth — 16 tables, 32 indexes, FTS5 full-text search
  - 6 SQLite triggers for automatic status cascades (ACT done → PB partial, DEC cancelled → IDEA abandoned, SPEC superseded → PB reopened)
  - Governance entities: decisions, actions, ideas, problems, specs, scopes, writers, log entries, status history
  - Threaded discussions (reply_to, thread_id) with append-only corrections
  - Free-form metadata fields (md/json/link/url/text) with conditional FTS5 indexing
  - Persistent writer cursors for pull subscriptions (get_updates)
  - Report tools generate Markdown views from the DB (daily, decisions, actions, ideas, problems, history, dump)
  - list_docs and get_doc tools for agents to discover and read package documentation via MCP
  - Programmatic API exported from package main (GovDb, initDatabase, compileQueries, readTools, writeTools, reportTools, schemas, enums)
  - SQL schema artifacts (schema.sql, triggers.sql) included for future Python port
  - nanoid 6.0.1 (Node >=26 required)

### Patch Changes

- Updated dependencies [c66a4de]
  - @ytrynot/qb@1.2.0

## 0.0.1

- Initial package scaffold.
- SQLite driver abstraction (better-sqlite3).
- Schema: 13 tables, 36 indexes (3 partial), FTS5 search index.
- Triggers: 4 cascade triggers + 18 FTS5 sync triggers.
- MCP server with 30+ tools (read, write, transverse, reports, dump).
- DNA input validation schemas.
- Shared SQL artifacts committed (schema.sql, triggers.sql).

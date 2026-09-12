---
"@ytrynot/gov-mcp": minor
---

Centralized tool registry, standardized enum pattern, and get_updates UX improvements

- All MCP tools are registered in a single central registry (`definitions/tools.ts`). The server, help system, signature generator, and metadata all derive from this registry — adding a tool requires one entry instead of declarations across four files.
- All domain enums follow a single `defineEnum` pattern with structured entries (`{ key, value, desc }`). Each enum exposes `.items`, `.values`, `.descMap`, and `.byKey` for property-based access.
- New documentation: `docs/adding-a-tool.md` — step-by-step guide for adding a new MCP tool (schema, query, handler, registry entry).
- `get_updates` now supports three new modes alongside the default forward-cursor behavior:
  - `last: N` — returns the N most recent entries (DESC order), advances cursor to max entry ID. Use after a long absence to catch up immediately.
  - `since: int` — returns entries with id > since (DESC order), advances cursor to the highest returned entry. Use to paginate backwards from a known point.
  - `resetCursor: true` — advances cursor to max entry ID without returning entries. Use to start fresh after a long absence.
  - Default (no params) — unchanged: forward from cursor, ASC order, backward compatible.

BREAKING CHANGE: Enum objects no longer expose values as direct properties. Use `ENUM.byKey.valueName` instead of `ENUM.valueName` (e.g. `ACTION_STATUS.byKey.pending` instead of `ACTION_STATUS.pending`). Use `ENUM.values` instead of the old `ENUM_STATUSES` arrays (e.g. `ACTION_STATUS.values` instead of `ACTION_STATUSES`). Use `LOG_ENTRY_TYPE.descMap` instead of `LOG_ENTRY_TYPE_DESC`.

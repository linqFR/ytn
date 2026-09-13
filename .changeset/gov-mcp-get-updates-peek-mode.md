---
"@ytrynot/gov-mcp": major
---

BREAKING CHANGE: `get_updates` cursor semantics changed and input fields renamed.

## Default order changed to DESC

`get_updates` now returns entries in **DESC order** (most recent first) by default. Previously the default was ASC (oldest first). `lastN` no longer controls the order — it only overrides the limit. Use `list_entries` for ASC or filtered queries.

## Cursor semantics

The writer's read cursor (`writers.last_read_at`) now stores the **date of reading** (when the agent called the tool), not the timestamp of the last entry returned. This simplifies the logic: no more ASC/DESC branches for cursor calculation, no edge cases with entries sharing the same timestamp.

- `get_updates` (without `peek`): cursor = now
- `get_updates` with `peek: true`: cursor unchanged
- `get_updates` with `markAllRead: true`: cursor = now
- `list_entries` with `nanoid`: cursor = now

## Field renames

- `last` → `lastN`
- `limit` → `limitN`
- `resetCursor` → `markAllRead`

## Removed

- `since` — override the cursor with a custom timestamp. Use `list_entries` with date filtering instead.

## New

- `peek: boolean` (default false) — return entries WITHOUT advancing the cursor (read-only preview for hooks)
- `listLogEntriesInput`: optional `nanoid` field — if provided, advances the writer's read cursor to now
- `McpClient` interface updated: `getUpdates` signature aligned with new fields, `listLogEntries` method added (was missing), `OListLogEntriesResult` type exported, `OGetUpdatesResult` includes `max_entry_id`

Fixes the shared-nanoid bug where a hook calling `get_updates` on `UserPromptSubmit` would consume the agent's mailbox entries by advancing the cursor before the agent could read them.

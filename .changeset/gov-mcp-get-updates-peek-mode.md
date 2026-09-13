---
"@ytrynot/gov-mcp": major
---

BREAKING CHANGE: `get_updates` cursor semantics changed and input fields renamed.

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

Fixes the shared-nanoid bug where a hook calling `get_updates` on `UserPromptSubmit` would consume the agent's mailbox entries by advancing the cursor before the agent could read them.

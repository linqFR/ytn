# Cascades — @ytrynot/gov-mcp

## Overview

Cascades are SQL `AFTER UPDATE` triggers that automatically propagate status changes across related entities. They are:

- **Atomic** — execute within the same transaction as the triggering UPDATE.
- **Unidirectional** — cascades flow in one direction only; no inverse cascades.
- **Impossible to bypass** — unless explicitly disabled via the `_cascade_disabled` flag table.

## Cascade Triggers (4)

### 1. `trg_act_done_pb` — ACT done → PB partial

**When**: An action transitions to `done` (from any non-`done` status).

**Effect**: Related problems (via `problem_actions` or deprecated `linked_act`) that are not already `fixed`, `wontfix`, or `partial` become:
- `status = 'partial'`
- `tested = 'partially'`

**Status history**: A `status_history` row is inserted for each affected problem with `cascade_trigger = NEW.id`.

### 2. `trg_act_done_idea` — ACT done → IDEA implemented

**When**: An action with `source_type = 'decision'` transitions to `done`.

**Effect**: Ideas promoted to the source decision (`promoted_to = NEW.source`) become `implemented` + `tested = 'partially'`, but **only if** all other actions from the same decision are `done` or `cancelled`.

**Status history**: A `status_history` row is inserted for each affected idea.

### 3. `trg_dec_cancelled_idea` — DEC Cancelled → IDEA abandoned

**When**: A decision transitions to `Cancelled`.

**Effect**: Ideas promoted to that decision (`promoted_to = NEW.id`) that are not already `abandoned` or `implemented` become:
- `status = 'abandoned'`
- `abandon_reason = 'DEC <id> cancelled'`

### 4. `trg_spec_superseded_pb` — SPEC superseded → PB reopen

**When**: A spec transitions to `superseded`.

**Effect**: Problems linked to that spec (`linked_spec = NEW.id`) with `type = 'spec'` and `status = 'fixed'` become:
- `status = 'open'`
- `fix = NULL`
- `fixed_at = NULL`
- `tested = 'not_ready'`

## Disabling Cascades

The `update_action_status` tool accepts a `cascade` parameter (default: `true`). When set to `false`, cascades are disabled for that single update by setting a flag in the `_cascade_disabled` table:

```sql
UPDATE _cascade_disabled SET value = 1;
-- ... UPDATE actions SET status = 'done' ...
UPDATE _cascade_disabled SET value = 0;
```

All four cascade triggers check this flag:

```sql
WHEN ... AND NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)
```

This is safe because:
- The flag is set and cleared within the same transaction.
- FTS5 sync triggers are not affected (they always fire).
- FK constraints are not affected (they always enforce).

## FTS5 Sync Triggers (18)

In addition to cascade triggers, 18 FTS5 synchronization triggers keep the `search_index` virtual table up to date:

- 6 entity tables (`decisions`, `actions`, `ideas`, `problems`, `specs`, `log_entries`)
- 3 triggers per table (`AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE`)

**Pattern**:
- INSERT → insert into `search_index`
- UPDATE → delete old row from `search_index` + insert new
- DELETE → delete from `search_index`

**FTS5 rowid**: Auto-assigned INTEGER. Entity IDs (e.g., `DEC-0054`) are stored in `entity_id` (TEXT), never used as FTS5 rowid.

## Total Triggers: 22

- 4 cascade triggers
- 18 FTS5 sync triggers

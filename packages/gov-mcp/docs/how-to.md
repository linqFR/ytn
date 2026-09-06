# How-To Guide — @ytrynot/gov-mcp

Practical workflows for common governance tasks. Each section shows the sequence of MCP tool calls to accomplish a goal.

## Table of Contents

- [Register as a Writer](#register-as-a-writer)
- [Start a Discussion or Thread](#start-a-discussion-or-thread)
- [Follow and Close a Thread](#follow-and-close-a-thread)
- [Propose and Accept a Decision](#propose-and-accept-a-decision)
- [Create Actions from a Decision](#create-actions-from-a-decision)
- [Track and Close an Action](#track-and-close-an-action)
- [Report and Fix a Problem](#report-and-fix-a-problem)
- [Link Problems to Actions](#link-problems-to-actions)
- [Promote an Idea to a Decision](#promote-an-idea-to-a-decision)
- [Define and Track a Workstream](#define-and-track-a-workstream)
- [Register and Version a Spec](#register-and-version-a-spec)
- [Add Metadata with Free Fields](#add-metadata-with-free-fields)
- [Correct a Field on an Entity](#correct-a-field-on-an-entity)
- [Search Across All Entities](#search-across-all-entities)
- [Pull Unread Updates](#pull-unread-updates)
- [Generate Reports](#generate-reports)
- [Handoff Between Sessions](#handoff-between-sessions)

---

## Register as a Writer

Before any write operation, you need a writer account and a nanoid token.

```
register_me({
  id: "devin-cli",
  role: "agent",
  responsibility: "CLI package development",
  defaultScope: "cli",
  displayName: "Devin CLI Agent",
  objective: "Ship CLI features",
  expertise: ["TypeScript", "CLI design"],
  prohibitions: ["Do not touch DNA internals"]
})
```

**Save the returned `nanoid`** — it is required for all write operations and cannot be retrieved later without database access.

Verify your identity at any time:

```
whoami({ nanoid: "<your-nanoid>" })
```

## Start a Discussion or Thread

Discussions live in `log_entries` — the narrative journal. They don't require a decision, action, or any entity reference.

### Start a new discussion

```
append_log_entry({
  nanoid: "<token>",
  type: "question",
  scope: "ytn/gov-mcp",
  subject: "Should free_fields support arrays?",
  body: "Currently value is TEXT. What if we need multiple values for the same key?"
})
```

The response includes `thread_id` — this is the thread root. Save it.

### Reply to a discussion

```
append_log_entry({
  nanoid: "<token>",
  type: "answer",
  replyTo: <parent_entry_id>,
  body: "Use format=json with an array inside. Or add multiple rows with the same key."
})
```

The reply automatically joins the parent's thread (same `thread_id`).

### Log entry types

| Type | Use case |
|------|----------|
| `question` | Ask a question, start a discussion |
| `answer` | Answer a question |
| `discussion` | General discussion (no Q&A framing) |
| `status` | Status update |
| `handoff` | Session handoff note |
| `reflection` | Retrospective or analysis |
| `challenge` | Challenge an assumption or decision |
| `reminder` | Reminder for self or team |
| `objective` | State an objective |
| `action` | Note about an action |
| `decision` | Note about a decision |
| `idea` | Note about an idea |
| `pb` | Note about a problem |
| `spec` | Note about a spec |
| `architectural` | Architectural observation |
| `regularization` | Regularization note |
| `correction` | Correction to a previous entry |
| `intro` | Introduction (new writer) |

## Follow and Close a Thread

### Read a full thread

```
get_thread({ threadId: <thread_id> })
```

Returns all entries in the thread, ordered by `id ASC` (chronological).

### Search within discussions

```
search_mailbox({ query: "free_fields arrays" })
```

Full-text search across all indexed content, including log entries.

### Close a thread

Threads don't have an explicit "closed" status. To close a discussion:

1. Post a final entry with `type: "status"` or `type: "reflection"` summarizing the outcome.
2. If the discussion led to a decision, create a decision and reference the thread in the decision's `context` field.

```
append_log_entry({
  nanoid: "<token>",
  type: "status",
  replyTo: <thread_root_id>,
  body: "Decision: use format=json for array values. Thread closed."
})
```

## Propose and Accept a Decision

### 1. Create the decision

```
create_decision({
  nanoid: "<token>",
  title: "Adopt Maranget decision trees for CLI routing",
  decider: "ADMIN",
  scope: "cli",
  context: "Current routing is O(n) if-chain",
  decision: "Use Maranget algorithm for O(log n) dispatch",
  consequences: "Better performance, more complex codegen"
})
```

The decision is created with `status: "Proposed"` by default. The response returns `id` (e.g. `DEC-0001`).

### 2. Accept the decision

```
update_decision_status({
  nanoid: "<token>",
  id: "DEC-0001",
  newStatus: "Accepted",
  reason: "Validated via benchmark in sandbox"
})
```

### Decision statuses

| Status | Meaning |
|--------|---------|
| `Proposed` | Draft, open for discussion |
| `Accepted` | Approved and active |
| `Suspended` | Temporarily on hold |
| `Cancelled` | Cancelled (cascades to linked ideas → abandoned) |
| `Superseded` | Replaced by a newer decision |
| `Rejected` | Rejected |
| `Deprecated` | No longer relevant |

### Supersede a decision

```
create_decision({
  nanoid: "<token>",
  title: "Revised routing: use hash-based dispatch",
  decider: "ADMIN",
  supersedes: ["DEC-0001"],
  scope: "cli",
  decision: "Switch from Maranget to hash-based dispatch"
})
```

The old decision's `superseded_by` is updated automatically by a trigger.

## Create Actions from a Decision

```
create_action({
  nanoid: "<token>",
  title: "Implement Maranget codegen",
  source: "DEC-0001",
  source_type: "decision",
  scope: "cli",
  priority: "P0",
  owner: "devin-cli",
  body: "Generate decision tree from CLI route table"
})
```

The response returns `id` (e.g. `ACT-0001`).

### Action priorities

| Priority | Meaning |
|----------|---------|
| `P0` | Critical — blocks other work |
| `P1` | High — should be done soon |
| `P2` | Normal — standard priority |

### Add dependencies

```
create_action({
  nanoid: "<token>",
  title: "Write Maranget benchmarks",
  source: "DEC-0001",
  source_type: "decision",
  scope: "cli",
  dependencies: ["ACT-0001"]
})
```

This action won't be "done" until its dependency is also done (enforced by convention, not by DB constraint).

## Track and Close an Action

### Update status to in_progress

```
update_action_status({
  nanoid: "<token>",
  id: "ACT-0001",
  newStatus: "in_progress"
})
```

### Mark as blocked

```
update_action_status({
  nanoid: "<token>",
  id: "ACT-0001",
  newStatus: "blocked",
  blockers: "Waiting on DNA API for tree compilation"
})
```

### Mark as done (requires evidence)

```
update_action_status({
  nanoid: "<token>",
  id: "ACT-0001",
  newStatus: "done",
  evidence: "Benchmarks show 3.2x speedup over if-chain. See sandbox/bench-maranget.mjs"
})
```

**Evidence is required** for `done` status. The tool rejects empty evidence.

### Cascade behavior

When an action is marked `done`:
- Linked problems → `partial` + `tested = 'partially'` (if not already fixed/wontfix)
- If all actions of a decision are done → linked idea → `implemented` (if source_type = decision)

To disable cascades for a single update:

```
update_action_status({
  nanoid: "<token>",
  id: "ACT-0001",
  newStatus: "done",
  evidence: "Done but cascade not needed",
  cascade: false
})
```

### Action statuses

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `in_progress` | Actively being worked on |
| `blocked` | Blocked by a dependency or external factor |
| `done` | Completed (requires evidence) |
| `deferred` | Postponed |
| `cancelled` | Cancelled |

## Report and Fix a Problem

### 1. Create the problem

```
create_problem({
  nanoid: "<token>",
  title: "CLI routing crashes on empty args",
  severity: "HIGH",
  type: "code",
  scope: "cli",
  description: "Calling `cli run` with no arguments throws TypeError"
})
```

### Problem severities

| Severity | Meaning |
|----------|---------|
| `CRITICAL` | System down, data loss |
| `BLOCKING` | Blocks all work in a scope |
| `HIGH` | Major functionality broken |
| `MEDIUM` | Workaround exists |
| `LOW` | Minor issue, cosmetic |

### Problem types

| Type | Meaning |
|------|---------|
| `spec` | Spec drift or spec issue |
| `implementation` | Code bug |
| `doc` | Documentation issue |

### 2. Investigate and fix

```
update_problem_status({
  nanoid: "<token>",
  id: "PB-0001",
  newStatus: "in_progress",
  rootCause: "Missing null check in route matcher"
})

update_problem_status({
  nanoid: "<token>",
  id: "PB-0001",
  newStatus: "fixed",
  fix: "Added null guard in matchRoute(), returns help text on empty args"
})
```

### Problem statuses

| Status | Meaning |
|--------|---------|
| `open` | Reported, not yet investigated |
| `critical` | Escalated to critical |
| `in_progress` | Being investigated or fixed |
| `fixed` | Fixed |
| `wontfix` | Won't fix (requires `wontfixReason`) |
| `partial` | Partially fixed (auto-set when linked action is done) |
| `superseded` | Superseded by another problem |

## Link Problems to Actions

```
link_problem_action({
  nanoid: "<token>",
  problemId: "PB-0001",
  actionId: "ACT-0001",
  role: "primary"
})
```

### Link roles

| Role | Meaning |
|------|---------|
| `primary` | This action is the main fix |
| `contributing` | This action contributes to the fix |
| `verification` | This action verifies the fix |

When the primary action is marked `done`, the problem is automatically set to `partial` + `tested = 'partially'` via cascade trigger.

## Promote an Idea to a Decision

### 1. Create the idea

```
create_idea({
  nanoid: "<token>",
  title: "Add tab completion to CLI",
  scope: "cli",
  package: "cli",
  priority: "should",
  shortDesc: "Tab completion for commands and flags",
  longDesc: "Use readline or a custom completion engine..."
})
```

### Idea priorities

| Priority | Meaning |
|----------|---------|
| `must` | Must have |
| `should` | Should have |
| `could` | Could have |
| `might` | Might have (backlog) |

### 2. Explore the idea

```
update_idea_status({
  nanoid: "<token>",
  id: "IDEA-0001",
  newStatus: "explored"
})
```

### 3. Promote to decision

First create the decision, then link the idea:

```
create_decision({
  nanoid: "<token>",
  title: "Add tab completion using readline",
  decider: "ADMIN",
  scope: "cli"
})

update_idea_status({
  nanoid: "<token>",
  id: "IDEA-0001",
  newStatus: "promoted",
  promotedTo: "DEC-0001"
})
```

### Idea statuses

| Status | Meaning |
|--------|---------|
| `raw` | Just captured |
| `explored` | Investigated, feasibility assessed |
| `promoted` | Promoted to a decision (requires `promotedTo`) |
| `implemented` | Implemented (auto-set when all source actions are done) |
| `abandoned` | Abandoned (requires `abandonReason`) |

## Define and Track a Workstream

Workstreams are transverse groupings that cut across scopes. They group related actions for tracking.

### 1. Create a workstream

Workstreams are created via direct SQL or a future tool. Currently, the `workstreams` table supports:

| Field | Description |
|-------|-------------|
| `id` | Workstream ID (e.g. `ws-cli-v2`) |
| `label` | Human-readable label |
| `scope` | Primary scope |
| `sort_order` | Sort order for display |

### 2. Link actions to a workstream

```
link_action_workstream({
  nanoid: "<token>",
  actionId: "ACT-0001",
  workstreamId: "ws-cli-v2"
})
```

### 3. Track workstream progress

```
get_action_lineage({ id: "ACT-0001" })
```

Returns the action with its source decision, dependencies, problem links, and workstream links.

```
get_open_actions({ priority: "P0" })
```

Returns all open actions sorted by priority — filter by workstream in the calling agent.

## Register and Version a Spec

The MCP server tracks specs as governance entities (ID, status, links, scope). It does **not** create, write, or version the spec Markdown file — the file is authored by the team. Use `create_spec` to register an already-written spec file in the database, and `update_spec_status` to track its lifecycle.

See [spec-guide.md](spec-guide.md) for the spec writing template, versioning format, and drift handling checklist.

### 1. Register a spec

```
create_spec({
  nanoid: "<token>",
  id: "spec-2026-09-05-cli-routing",
  filename: "spec-2026-09-05-cli-routing.md",
  scope: "cli",
  package: "cli",
  version: 1
})
```

### 2. Update spec status

```
update_spec_status({
  nanoid: "<token>",
  id: "spec-2026-09-05-cli-routing",
  newStatus: "ready"
})
```

### Spec statuses

| Status | Meaning |
|--------|---------|
| `draft` | Being written |
| `ready` | Ready for implementation |
| `locked` | Locked — implementation must follow spec exactly |
| `implemented` | Implemented |
| `desync` | Implementation drifted from spec |
| `superseded` | Superseded by a newer version |
| `rejected` | Rejected |

### 3. Supersede a spec

```
create_spec({
  nanoid: "<token>",
  id: "spec-2026-09-10-cli-routing-v2",
  filename: "spec-2026-09-10-cli-routing-v2.md",
  scope: "cli",
  version: 2,
  supersedes: "spec-2026-09-05-cli-routing"
})

update_spec_status({
  nanoid: "<token>",
  id: "spec-2026-09-05-cli-routing",
  newStatus: "superseded",
  supersedes: "spec-2026-09-10-cli-routing-v2"
})
```

When a spec is superseded, problems of type `spec` that were `fixed` are automatically reopened to `open` via cascade trigger.

## Add Metadata with Free Fields

Free fields let you attach arbitrary metadata to any entity without schema migrations.

### Add instructions to an action

```
add_free_field({
  nanoid: "<token>",
  entityType: "action",
  entityId: "ACT-0001",
  key: "instructions",
  format: "md",
  value: "## Steps\n1. Read the spec\n2. Implement\n3. Test",
  ftsIndexed: true
})
```

### Add a required role to a decision

```
add_free_field({
  nanoid: "<token>",
  entityType: "decision",
  entityId: "DEC-0001",
  key: "required_role",
  format: "json",
  value: "{\"role\":\"devin-dna\",\"skills\":[\"codegen\",\"maranget\"]}"
})
```

### Add a sandbox reference

```
add_free_field({
  nanoid: "<token>",
  entityType: "action",
  entityId: "ACT-0001",
  key: "sandbox_ref",
  format: "link",
  value: "sandbox/bench-maranget.mjs"
})
```

### Add a PR link

```
add_free_field({
  nanoid: "<token>",
  entityType: "action",
  entityId: "ACT-0001",
  key: "pr",
  format: "url",
  value: "https://github.com/ytrynot/ytn/pull/42"
})
```

### Retrieve fields

```
get_free_fields({
  entityType: "action",
  entityId: "ACT-0001"
})
```

Returns only `active` fields. To include deprecated fields (useful for duplicating fields from past entities):

```
get_free_fields({
  entityType: "action",
  entityId: "ACT-0001",
  includeDeprecated: true
})
```

### Deprecate a field (soft delete)

```
deprecate_free_field({
  nanoid: "<token>",
  id: 42
})
```

The field remains in the database with `status: "deprecated"`. If it was FTS-indexed, it is removed from the search index.

See [docs/free-fields.md](free-fields.md) for the full reference.

## Correct a Field on an Entity

The `correct` tool appends a correction — it does not mutate history. The original value is logged in a `correction` log entry.

```
correct({
  nanoid: "<token>",
  entityType: "decision",
  entityId: "DEC-0001",
  field: "title",
  newValue: "Adopt Maranget decision trees for CLI routing (revised)",
  reason: "Original title was too vague"
})
```

### What can be corrected?

| Entity | Correctable fields |
|--------|--------------------|
| `decision` | `title`, `status`, `scope`, `decider`, `context`, `decision`, `consequences`, `source`, `spec_ref` |
| `action` | `title`, `status`, `scope`, `owner`, `priority`, `body`, `blockers`, `evidence`, `defer_reason`, `cancel_reason`, `spec_ref` |
| `idea` | `title`, `status`, `scope`, `package`, `priority`, `short_desc`, `long_desc`, `abandon_reason`, `promoted_to` |
| `problem` | `title`, `status`, `scope`, `severity`, `type`, `description`, `root_cause`, `fix`, `wontfix_reason`, `linked_spec`, `linked_act`, `fast_track` |
| `spec` | `filename`, `scope`, `package`, `version`, `status`, `supersedes` |

### Cannot correct `log_entries`

Log entries are immutable. To correct a log entry, append a new entry with `type: "correction"` and `replyTo` pointing to the original:

```
append_log_entry({
  nanoid: "<token>",
  type: "correction",
  replyTo: <original_entry_id>,
  body: "Correction: the actual value was X, not Y."
})
```

## Search Across All Entities

```
search_mailbox({ query: "Maranget routing" })
```

Full-text search across all indexed content (decisions, actions, ideas, problems, specs, log entries, and FTS-indexed free fields).

### Filter by entity type

```
search_mailbox({ query: "Maranget", entityType: "decision" })
```

### What is indexed?

| Source | title | body | scope |
|--------|-------|------|-------|
| decisions | title | context + decision + consequences | scope |
| actions | title | body + evidence + blockers | scope |
| ideas | title | short_desc + long_desc | scope |
| problems | title | description + root_cause + fix | scope |
| specs | filename | (empty) | scope |
| log_entries | subject | body | scope |
| free_fields | key | value | parent entity scope (only if `fts_indexed=1` and `status=active`) |

## Pull Unread Updates

Each writer has a persistent cursor (`last_read_log_id`). `get_updates` returns log entries since the cursor and advances it.

```
get_updates({
  nanoid: "<token>",
  limit: 50
})
```

### Filter by scope or type

```
get_updates({
  nanoid: "<token>",
  scope: "cli",
  withChildren: true,
  type: "decision",
  limit: 20
})
```

The response includes `has_more` — if true, call again to get the next batch. The cursor is only advanced for the entries returned.

## Generate Reports

Reports generate Markdown from the DB and write to `mailbox/generated/`.

### Daily report

```
generate_daily_report({ date: "2026-09-05" })
```

### Full registries

```
generate_decisions_report()
generate_actions_report()
generate_ideas_report()
generate_problems_report()
```

### Single decision timeline

```
generate_decision_history_report({ id: "DEC-0001" })
```

### Export the full database

```
export_dump()
```

Returns a SQL string (DDL + INSERTs). Not written to disk — the caller saves it.

## Handoff Between Sessions

```
get_handoff()
```

Returns a snapshot for inter-session handoff:

- `open_actions` — all pending/in_progress/blocked actions
- `pending_decisions` — all Proposed decisions
- `active_problems` — all open/in_progress/critical problems
- `raw_ideas` — all raw ideas
- `to_test` — entities with `tested NOT IN ('no_need', 'not_ready')`
- `architectural_items` — log entries of type `architectural`

Pair this with a `handoff` log entry:

```
append_log_entry({
  nanoid: "<token>",
  type: "handoff",
  body: "Session ending. ACT-0001 is in_progress, waiting on DNA API. PB-0001 is fixed but needs testing."
})
```

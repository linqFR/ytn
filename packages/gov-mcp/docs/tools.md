# MCP Tools — @ytrynot/gov-mcp

## Tool Inventory

**Total: 58 tools** (29 read-only + 21 mutation + 8 report)

### Read-Only Tools (29)

#### Entity CRUD Reads

| Tool | Required Params | Optional Filters | Returns |
|------|----------------|-----------------|---------|
| `list_decisions` | — | `status`, `scope`, `withChildren`, `limit` | `{ decisions, count }` |
| `get_decision` | `id` | — | `{ decision, history }` |
| `list_actions` | — | `status`, `owner`, `priority`, `scope`, `withChildren`, `limit` | `{ actions, count }` |
| `get_action` | `id` | — | `{ action, dependencies, problemLinks, workstreamLinks, history }` |
| `list_ideas` | — | `status`, `package`, `priority`, `scope`, `withChildren`, `limit` | `{ ideas, count }` |
| `get_idea` | `id` | — | `{ idea, promotedTo }` |
| `list_problems` | — | `status`, `severity`, `type`, `scope`, `withChildren`, `limit` | `{ problems, count }` |
| `get_problem` | `id` | — | `{ problem, actions, history }` |
| `list_specs` | — | `status`, `package`, `scope`, `withChildren`, `limit` | `{ specs, count }` |
| `get_spec` | `id` | — | `{ spec }` |
| `list_scopes` | — | `parent` | `{ scopes, count }` |
| `get_scope` | `id` | — | `{ scope, counts }` |

#### Log Entry Reads

| Tool | Required Params | Optional Filters | Returns |
|------|----------------|-----------------|---------|
| `list_log_entries` | — | `date`, `type`, `refId`, `scope`, `withChildren`, `limit` | `{ entries, count }` |
| `get_last_log_entry` | `refId` | — | `{ entry }` |
| `get_thread` | `threadId` | — | `{ thread_id, entries }` |
| `get_updates` | `nanoid` | `scope`, `withChildren`, `type`, `limit` | `{ entries, new_cursor, has_more }` |

#### Search and Transverse

| Tool | Required Params | Optional Filters | Returns |
|------|----------------|-----------------|---------|
| `search_mailbox` | `query` | `entityType` | `{ results, count }` |
| `mailbox_last_24h` | — | `hours` | `{ timeline, count }` |
| `get_decision_history` | `id` | — | `{ decision, actions, ideas, history }` |
| `get_action_lineage` | `id` | — | `{ action, sourceDecision, dependencies, problemLinks, history }` |
| `get_open_actions` | — | `priority` | `{ actions, count }` |
| `get_handoff` | — | — | `{ date, open_actions, pending_decisions, active_problems, raw_ideas, to_test, architectural_items }` |
| `audit_consistency` | — | `scope`, `withChildren` | `{ findings, summary }` |
| `get_free_fields` | `entityType`, `entityId` | `includeDeprecated` | `{ freeFields, count }` |

#### Documentation Reads

| Tool | Required Params | Optional Filters | Returns |
|------|----------------|-----------------|---------|
| `list_docs` | — | — | `{ docs, count }` |
| `get_doc` | `filename` | — | `{ filename, content, size }` |

#### `withChildren` option

When `withChildren: true` is passed alongside `scope`, the scope filter includes all descendant scopes via a recursive CTE on the `scopes` table (`parent` FK). Default: `false` (exact match only).

- `list_actions({scope: "workspace", withChildren: true})` → all actions across all scopes
- `list_actions({scope: "ytn", withChildren: true})` → actions from `ytn` + all child scopes
- `list_actions({scope: "dna"})` → only actions tagged `dna` (default behavior)

### Mutation Tools (21)

#### Writer Management

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `register_writer` | `id`, `role` | `responsibility`, `defaultScope`, `displayName`, `objective`, `expertise`, `prohibitions` | `{ id, nanoid, role }` |

#### Decision Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_decision` | `nanoid`, `title`, `decider` | `status`, `scope`, `supersedes`, `specRef`, `context`, `decision`, `consequences`, `source` | `{ id, created, seq, scope }` |
| `update_decision_status` | `nanoid`, `id`, `newStatus` | `supersedes`, `reason` | `{ id, updated, newStatus }` |

#### Action Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_action` | `nanoid`, `title` | `owner`, `priority`, `source`, `source_type`, `scope`, `specRef`, `body`, `dependencies` | `{ id, created, seq, scope }` |
| `update_action_status` | `nanoid`, `id`, `newStatus` | `evidence` (required for `done`), `blockers`, `reason`, `cascade` | `{ id, updated, newStatus, cascade }` |

#### Idea Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_idea` | `nanoid`, `title` | `scope`, `package`, `priority`, `shortDesc`, `longDesc` | `{ id, created, seq, scope }` |
| `update_idea_status` | `nanoid`, `id`, `newStatus` | `promotedTo`, `abandonReason` | `{ id, updated, newStatus }` |

#### Problem Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_problem` | `nanoid`, `title`, `severity`, `type` | `scope`, `description`, `linkedSpec`, `linkedAct` | `{ id, created, seq, scope }` |
| `update_problem_status` | `nanoid`, `id`, `newStatus` | `fix`, `rootCause`, `wontfixReason` | `{ id, updated, newStatus }` |

#### Link Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `link_problem_action` | `nanoid`, `problemId`, `actionId` | `role` | `{ problemId, actionId, role }` |
| `link_action_workstream` | `nanoid`, `actionId`, `workstreamId` | — | `{ actionId, workstreamId }` |

#### Spec Mutations

The MCP server tracks spec entities (ID, status, links). It does not create or edit the spec Markdown file — see [spec-guide.md](spec-guide.md) for the file authoring template.

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_spec` | `nanoid`, `id`, `filename`, `version` | `scope`, `package`, `status`, `supersedes` | `{ id, created, scope }` |
| `update_spec_status` | `nanoid`, `id`, `newStatus` | `supersedes` | `{ id, updated, newStatus }` |

#### Scope Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `create_scope` | `nanoid`, `id`, `label` | `description`, `parent`, `sortOrder` | `{ id, created }` |
| `update_scope` | `nanoid`, `id` | `label`, `description`, `parent`, `sortOrder` | `{ id, updated }` |

#### Log Entry Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `append_log_entry` | `nanoid`, `date`, `type` | `audience`, `subject`, `body`, `refId`, `scope`, `replyTo`, `threadId` | `{ id, created, thread_id }` |
| `correct` | `nanoid`, `entityType`, `entityId`, `field`, `newValue`, `reason` | — | `{ entityType, entityId, field, corrected }` |

#### Free Field Mutations

| Tool | Required Params | Optional Params | Returns |
|------|----------------|----------------|---------|
| `add_free_field` | `nanoid`, `entityType`, `entityId`, `key`, `format`, `value` | `ftsIndexed` | `{ id, created }` |
| `deprecate_free_field` | `nanoid`, `id` | — | `{ id, deprecated }` |

### Report Tools (8)

Report tools generate Markdown from the DB and write it to `mailbox/generated/` on disk. SQLite is the source of truth; these files are human-readable views. All queries use pre-compiled QB statements.

| Tool | Required Params | Optional Params | Returns | Output File |
|------|----------------|----------------|---------|-------------|
| `generate_daily_report` | `date` | — | `{ date, filename, filepath, markdown, counts }` | `mailbox/generated/mailbox-YYYY-MM-DD.md` |
| `generate_decisions_report` | — | — | `{ filename, filepath, markdown, count }` | `mailbox/generated/mailbox-decisions.md` |
| `generate_actions_report` | — | — | `{ filename, filepath, markdown, count }` | `mailbox/generated/mailbox-actions.md` |
| `generate_ideas_report` | — | — | `{ filename, filepath, markdown, count }` | `mailbox/generated/features-ideas.md` |
| `generate_problems_report` | — | — | `{ filename, filepath, markdown, count }` | `mailbox/generated/mailbox-problems.md` |
| `generate_decision_history_report` | `id` | — | `{ id, filename, filepath, markdown, counts }` | `mailbox/generated/decision-history-dec-NNNN.md` |
| `export_dump` | — | — | `{ sql, tables }` | — (returns SQL string only) |
| `generate_all_reports` | — | — | `{ reports: Array<{ report, filepath }> }` | Generates all 5 main reports at once |

#### Report file formats

Each report generates a self-contained Markdown file with:

- **Daily report**: all entities created/updated on the given date, plus all log entries for that date.
- **Registry reports** (decisions, actions, ideas, problems): a GFM index table (sortable) followed by one section per entity with a field table and optional long-form fields (context, body, description, etc.).
- **Decision history report**: the decision's fields, then linked actions, ideas, problems, status history, and log entries — a full timeline for a single DEC.
- **Export dump**: raw SQL DDL + INSERTs (not written to disk — returned as a string for the caller to save or pipe).

#### File writing

Reports are written to `<monorepo-root>/mailbox/generated/` via `writeFileSync`. The directory is created if it does not exist (`mkdirSync` with `recursive: true`). The monorepo root is resolved from the package location via `resolveMonorepoRoot()` (same logic as scope discovery).

The `filepath` field in the structured response contains the absolute path to the written file. The `markdown` field contains the full Markdown content (useful for previewing without reading the file).

## Response Format

All MCP tool responses follow this structure:

```typescript
{
  content: [{ type: "text", text: "Summary message" }],
  structuredContent: { /* tool-specific data */ },
  isError: false  // true for validation/runtime errors
}
```

## Error Handling

- **Validation errors**: `isError: true`, text describes the validation failure.
- **Not found**: `isError: true`, text says which entity was not found.
- **Invalid nanoid**: `isError: true`, text says the writer token is invalid.
- **Evidence required**: `update_action_status` with `newStatus="done"` requires non-empty `evidence`.
- **`correct` on `log_entry`**: Rejected — use `append_log_entry` with `type=correction` instead.

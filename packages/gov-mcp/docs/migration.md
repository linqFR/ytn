# Migration — @ytrynot/gov-mcp

## Overview

The migration from a Markdown-centric governance workflow to SQLite is a one-shot operation. It parses existing Markdown files and imports their content into the governance SQLite database.

The migration is **configurable and repo-agnostic**: the source file paths, registry formats, and workstream definitions are provided by the caller, not hardcoded in the package.

## Source Files

The migration reads from caller-provided paths. The expected Markdown structure is:

- **Decision registry** — a Markdown file with an index table and individual decision entries
- **Spec index** — a Markdown file listing specs with ID, title, status, scope
- **Problem registry** — a Markdown file with problem entries (title, severity, status, description, fix)
- **Idea registry** — a Markdown file with idea entries (title, status, scope, description)
- **Daily log files** — Markdown files with dated log entries (timestamp, type, author, subject, body)

The caller provides a migration config object:

```typescript
interface IMigrationConfig {
  decisionRegistryPath: string;
  specIndexPath: string;
  problemRegistryPath: string;
  ideaRegistryPath: string;
  dailyLogDir: string;          // directory containing daily log files
  dailyLogGlob: string;         // glob pattern, e.g. "mailbox-*.md"
  archiveDir?: string;          // where to move originals (optional)
  workstreams?: { id: string; label: string; description?: string }[];
}
```

## Migration Steps

1. **Parse registry index tables** — Extract ID, title, status, scope from the index tables at the top of each registry file.
2. **Parse registry entries** — Extract full details (context, decision, consequences, body, fix, etc.) from individual entry sections.
3. **Parse daily files** — Extract log entries (date, timestamp, type, author, audience, subject, body, ref_id).
4. **Insert into SQLite** — Insert all parsed entities into the appropriate tables.
5. **Create `problem_actions` rows** — From legacy `linked_act` fields, create N:N links in `problem_actions`.
6. **Set `tested` flags** — Migrated problems with `status = 'partial'` get `tested = 'partially'`. Actions/ideas already `done`/`implemented` get `tested = 'success'`. Others get `tested = 'not_ready'`.
7. **Null threading fields** — Migrated `log_entries` get `reply_to = NULL` and `thread_id = NULL` (threading is a post-migration feature).
8. **Create workstreams** — Insert workstream rows from the config's `workstreams` array. Action-workstream links are left for manual post-migration assignment.
9. **Archive originals** — If `archiveDir` is provided, move original Markdown files there.
10. **Generate report** — Produce a migration report with counts, anomalies, and manual follow-up items.

## Count Verification

Before and after migration, the script verifies:

- Number of decisions in Markdown vs. SQLite
- Number of actions in Markdown vs. SQLite
- Number of ideas in Markdown vs. SQLite
- Number of problems in Markdown vs. SQLite
- Number of log entries in Markdown vs. SQLite

Any discrepancy is reported as an anomaly.

## Anomaly Reporting

Non-parsable content is reported with:
- File name
- Line number (if available)
- Content snippet
- Reason for failure

## Post-Migration

After migration:

- **SQLite is the source of truth** — all future governance operations go through MCP tools.
- **Markdown files are generated** — use `generate_daily_report` to produce daily mailbox files.
- **Originals are archived** — if an archive directory was provided, originals are kept for reference.
- **Workstream links are manual** — assign actions to workstreams via `link_action_workstream`.

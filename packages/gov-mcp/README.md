# @ytrynot/gov-mcp

Inter-agent governance MCP server. Tracks decisions, actions, ideas, problems, specs, and a narrative log shared across multiple AI agents — all exposed via the Model Context Protocol (MCP).

<!-- badges:start -->
[![npm version](https://img.shields.io/npm/v/@ytrynot/gov-mcp.svg)](https://www.npmjs.com/package/@ytrynot/gov-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/linqFR/ytn/ci.yml?label=CI)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@ytrynot/gov-mcp)](./LICENSE)
[![types](https://img.shields.io/badge/types-TypeScript-blue)](./src/index.ts)
[![node](https://img.shields.io/badge/node-%3E%3D26.0.0-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-2.0.0-blue)](https://modelcontextprotocol.io)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-lightgrey)](https://github.com/WiseLibs/better-sqlite3)
<!-- badges:end -->

## Why

Teams and multiple AI agents collaborating on a project need a shared, queryable record of decisions, actions, problems, and ideas. Markdown files scattered across a repo are hard to search, prone to drift, and cannot enforce consistency. `@ytrynot/gov-mcp` solves this by providing a shared governance database that all agents read from and write to via MCP tools — enabling coordination, traceability, and audit across sessions and agents.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [MCP Tools](#mcp-tools)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Cascades](#cascades)
- [FTS5 Search](#fts5-search)
- [Free Fields](#free-fields)
- [Threading](#threading)
- [Migration](#migration)
- [Lifecycle](#lifecycle)
- [Testing](#testing)
- [SQL Artifacts](#sql-artifacts)
- [License](#license)
- **Docs**: [architecture](docs/architecture.md), [tools](docs/tools.md), [cascades](docs/cascades.md), [migration](docs/migration.md), [backup-restore](docs/backup-restore.md), [node-python-interop](docs/node-python-interop.md), [free-fields](docs/free-fields.md), [how-to](docs/how-to.md), [programmatic API](docs/api.md), [spec writing guide](docs/spec-guide.md)

## Overview

`@ytrynot/gov-mcp` replaces a Markdown-centric mailbox workflow with a database-backed governance system:

- **Database is the single source of truth** — all governance data lives in one file.
- **Markdown is generated on demand** — reports are produced by MCP tools, not hand-maintained.
- **MCP exposes data and mutations** — agents interact via standard MCP tool calls.
- **Automatic cascades** — SQL triggers handle status propagation (ACT done → PB partial, etc.).
- **Full-text search** — FTS5 index across all entities.
- **Threaded discussions** — peer-to-peer Q&A with `reply_to` and `thread_id`.
- **Persistent writer cursors** — MQTT-like pull subscriptions via `get_updates`.

## Installation

```bash
npm install @ytrynot/gov-mcp
```

In the ytrynot monorepo:

```bash
npm.cmd install
npm.cmd run build -w @ytrynot/gov-mcp
```

## Quick Start

### 1. Install and start the MCP server

```bash
# Install
npm install @ytrynot/gov-mcp

# Start the server (stdio transport)
npx gov-mcp
```

### 2. Configure in your MCP client

Add to your MCP client config (e.g., `.mcp.json` for Claude Code, `.devin/config.json` for Devin, `~/.cursor/mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "gov-mcp": {
      "command": "npx",
      "args": ["-y", "@ytrynot/gov-mcp"],
      "env": {
        "GOVERNANCE_DB_PATH": "./data/governance.db"
      }
    }
  }
}
```

On Windows, use `npx.cmd` instead of `npx`:

```json
{
  "mcpServers": {
    "gov-mcp": {
      "command": "npx.cmd",
      "args": ["-y", "@ytrynot/gov-mcp"],
      "env": {
        "GOVERNANCE_DB_PATH": "./data/governance.db"
      }
    }
  }
}
```

If `GOVERNANCE_DB_PATH` is not set, the database defaults to `data/governance.db` relative to the package installation directory.

### 3. Register a writer

```
register_me({
  "id": "devin-cli",
  "role": "agent",
  "responsibility": "CLI package development",
  "defaultScope": "cli"
})
```

The response contains your `nanoid` — store it securely. It is required for all write operations.

### 4. Create a decision

```
create_decision({
  "nanoid": "<your-nanoid>",
  "title": "Adopt Maranget decision trees",
  "decider": "ADMIN",
  "context": "Current routing is O(n) if-chain",
  "decision": "Use Maranget algorithm",
  "consequences": "Better performance, more complex codegen"
})
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GOVERNANCE_DB_PATH` | `data/governance.db` (relative to package install dir) | Path to the database file |

## MCP Tools

58 tools total: 29 read-only, 21 mutations, 8 reports. See [docs/tools.md](docs/tools.md) for the full reference with signatures, parameters, and examples.

## Architecture

The server is built around a database (source of truth), DNA-validated MCP tools, and automatic status cascades. See [docs/architecture.md](docs/architecture.md) for the full architecture, file layout, and design decisions.

## Database Schema

16 tables, 32 indexes, full-text search index. The database is the source of truth. See [docs/architecture.md](docs/architecture.md) for the full schema, and `schema/schema.sql` for the committed DDL.

## Cascades

6 SQL triggers handle automatic status propagation (ACT done → PB partial, DEC cancelled → IDEA abandoned, SPEC superseded → PB reopened, etc.). Cascades are atomic and can be disabled per-call. See [docs/cascades.md](docs/cascades.md) for the full trigger reference.

## FTS5 Search

`search_mailbox` provides full-text search across all entities with `porter unicode61` tokenization. 21 sync triggers keep the index up to date. See [docs/architecture.md](docs/architecture.md) for details.

## Free Fields

Free-form metadata fields (Markdown, JSON, links, URLs, text) attachable to any entity. Soft-deleted, conditionally FTS5-indexed. See [docs/free-fields.md](docs/free-fields.md) for the full reference.

## Threading

Log entries support peer-to-peer threading via `reply_to` and `thread_id`. Corrections use append-only `type=correction` entries — log entries are immutable. See [docs/how-to.md](docs/how-to.md#start-a-discussion-or-thread) for usage.

## Migration

One-shot migration from Markdown files to the database, configurable and repo-agnostic. See [docs/migration.md](docs/migration.md) for the full configuration reference.

## Lifecycle

Governance entities follow a directed hierarchy: ideas and problems flow into decisions, decisions spawn actions and specs, actions progress and cascade back upstream. The narrative log runs through the entire lifecycle as the discussion forum.

### Hierarchy

```
IDEA ─┐
      ├──→ DECISION ──→ ACTION 1 ──┐
ISSUE ┘         │                  ├──→ partial ──→ done
                │              ACTION 2 ──┘
                └──→ SPEC ──→ draft → ready → locked → implemented
```

1. An **idea** (pre-proposal) or a **problem** (bug/issue) is raised and discussed in the log.
2. A **decision** is created, resolving the idea or problem. The idea is promoted (`IDEA-NNNN → DEC-NNNN`).
3. The decision spawns **actions** (units of work) and a **spec** (specification annex).
4. Actions progress: `open → in_progress → done`. When an action is done, it cascades back upstream.
5. The **spec** tracks the specification: `draft → ready → locked → implemented` (or `desync`, `superseded`, `rejected`). Specs evolve through complete restatements (v0 → v1 → vN+1), not diffs. Each spec has a mandatory `## Invariants` section — constraints verifiable against the code. The MCP server tracks the spec entity (ID, status, links) but does not create or edit the spec Markdown file — that is authored by the team. See [docs/spec-guide.md](docs/spec-guide.md) for the spec writing template, versioning format, and drift handling checklist.

### Cascade flow

When an action is marked `done`:
- The action's linked **problem** becomes `partial` with `tested='partially'`.
- If all actions of the decision are done, the linked **idea** becomes `implemented`.
- The **decision** status reflects completion of its actions.

When a decision is `Cancelled`:
- Linked **ideas** are automatically abandoned.

When a spec is `superseded`:
- Linked `fixed` problems of type `spec` reopen, so the new spec can be applied.

### Problem lifecycle

```
open → partial → fixed
              ↘ wontfix
```

Problems use `fixed` or `wontfix` — never `closed`. The `tested` field tracks test status independently: `no_need`, `not_ready`, `partially`, `success`.

### Scopes

Scopes are hierarchical namespaces that partition governance data. The root scope is `workspace`. Sub-scopes (e.g. `cli`, `dna`, `gov-mcp`) are declared via the `create_scope` tool with an optional `parent` forming a tree. Every entity (decision, action, idea, problem, spec, log entry) belongs to a scope, and can have additional scopes via the `entity_scopes` N:N table.

Scope queries resolve the full subtree: filtering by `workspace` returns entities from all scopes, filtering by `cli` returns only `cli` entities. The `*` wildcard resolves to all scope IDs.

```
workspace
├── cli
├── dna
├── gov-mcp
└── query-builder
```

### Writers and roles

All write operations require a registered writer with a valid `nanoid` token. Writers are registered via `register_me` (or `register_writer`), which returns the nanoid to store and use for all subsequent writes.

| Role | Permissions |
|------|------------|
| `admin` | Full access — all tools, all scopes |
| `agent` | Write access within registered scope — must provide nanoid for every mutation |

Writers have a `default_scope` that determines where their entities are created unless explicitly overridden. The `whoami` tool returns the writer's profile and `last_read_log_id` cursor.

### Free fields

Free fields attach structured metadata to any entity (decision, action, idea, problem, spec). They support five formats:

| Format | Use case |
|--------|----------|
| `md` | Markdown instructions, development notes, expert requirements |
| `json` | Structured data (constraints, invariants, configuration) |
| `link` | Reference to another entity or external resource |
| `url` | External URL (documentation, issue tracker, PR) |
| `text` | Plain text |

Typical use: attach development instructions to an action (`key: "instructions"`, `format: "md"`), declare constraints on a spec (`key: "invariants"`, `format: "json"`), or link an expert profile to a problem (`key: "expert"`, `format: "json"`).

Free fields are soft-deleted (deprecated, not removed) and conditionally FTS5-indexed. See [docs/free-fields.md](docs/free-fields.md) for the full reference.

### Constraints and invariants

The governance model enforces these invariants at the database level:

- **Append-only history** — `status_history` and `log_entries` are immutable. Corrections use `type=correction` log entries, never edits.
- **No `closed` status for problems** — Problems use `fixed` or `wontfix`. The `closed` status is forbidden by CHECK constraint.
- **Idea priority ≠ problem severity** — Ideas have `priority` (LOW/MEDIUM/HIGH), problems have `severity` (LOW/MEDIUM/HIGH/CRITICAL). These are independent fields.
- **`tested` is independent from status** — The `tested` field (`no_need`/`not_ready`/`partially`/`success`) tracks test coverage separately from the problem's lifecycle status.
- **Cascades are atomic** — SQL triggers fire within the same transaction. If a cascade fails, the whole mutation rolls back.
- **Scope hierarchy is a tree** — `scopes.parent` is a FK to `scopes.id`. Recursive CTEs resolve the full subtree for scope-filtered queries.
- **DNA + CHECK double validation** — Tool inputs are validated by DNA schemas before reaching the DB; CHECK constraints validate again at the DB level.
- **All timestamps are UTC** — `created_at`, `updated_at`, and log entry dates are stored in ISO 8601 UTC (`new Date().toISOString()`). No local timezone conversion is performed.

### Narrative log

The log is the discussion forum that runs through the entire lifecycle. Entries support threading (`reply_to`, `thread_id`) for Q&A and discussions. Every entity creation, status change, and correction is traced in the log. Corrections are new entries with `type=correction` pointing to the original — log entries are never edited or deleted.

See [docs/how-to.md](docs/how-to.md) for practical workflows and [docs/cascades.md](docs/cascades.md) for the full trigger reference.

## Testing

```bash
# Run all tests
npm.cmd test -w @ytrynot/gov-mcp

# Run a specific test file
npx.cmd vitest run packages/gov-mcp/tests/integration.test.ts
```

Test levels:
- **Integration** — schema creation, triggers, cascades, FTS5, cursor.
- **Smoke** — basic lifecycle verification.
- **Protocol** (planned) — MCP protocol tests via JSON test cases.

## SQL Artifacts

Committed SQL files in `schema/` are shared with the future Python implementation:

- `schema/schema.sql` — Full DDL (tables, indexes, FTS5).
- `schema/triggers.sql` — All triggers (cascade + FTS5 sync).

Only `workspace` is seeded at init. Other scopes are declared by the agent via the `create_scope` MCP tool.

Regenerate after schema changes:

```bash
npx tsx packages/gov-mcp/scripts/generate-sql-artifacts.ts
```

## License

MIT — see [LICENSE](LICENSE).

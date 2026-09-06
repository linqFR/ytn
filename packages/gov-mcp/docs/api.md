# Programmatic API — @ytrynot/gov-mcp

How to use `@ytrynot/gov-mcp` as a TypeScript library instead of an MCP server. The public API is exported from the package main entry (`dist/index.js`).

## Table of Contents

- [When to Use the Programmatic API](#when-to-use-the-programmatic-api)
- [Open a Database](#open-a-database)
- [Initialize the Schema](#initialize-the-schema)
- [Compile Queries](#compile-queries)
- [Call Tools Directly](#call-tools-directly)
- [Transactions](#transactions)
- [Generate SQL Artifacts](#generate-sql-artifacts)
- [Available Exports](#available-exports)

---

## When to Use the Programmatic API

The MCP server (via `npx gov-mcp`) is the primary interface for AI agents and IDE integrations. The programmatic API is for:

- Custom migration scripts that need direct database access.
- Test harnesses that set up and tear down governance databases.
- Embedding governance tracking inside another Node.js application.
- Generating SQL artifacts (`schema.sql`, `triggers.sql`) without starting a server.

## Open a Database

`GovDb.open()` creates or opens a SQLite database file with the required pragmas (WAL, busy_timeout, foreign_keys, synchronous, encoding).

```ts
import { GovDb } from "@ytrynot/gov-mcp";

const db = GovDb.open({ dbPath: "./data/governance.db" });
```

If `dbPath` is omitted, the database defaults to `data/governance.db` relative to the package installation directory. You can also override it via the `GOVERNANCE_DB_PATH` environment variable.

## Initialize the Schema

`initDatabase()` creates all tables, indexes, FTS5 virtual tables, and triggers if they do not exist. It also seeds the root scope (`workspace`). Call it once after opening.

```ts
import { initDatabase } from "@ytrynot/gov-mcp";

initDatabase(db);
```

`initIfEmpty()` does the same but only if the database has no tables yet. It returns `true` if initialization ran, `false` if the database was already populated.

```ts
import { initIfEmpty } from "@ytrynot/gov-mcp";

const wasInitialized = initIfEmpty(db);
```

## Compile Queries

`compileQueries()` prepares all SQL statements and returns an `IQueries` object — a collection of typed prepared statements grouped by domain (decisions, actions, ideas, problems, specs, log_entries, scopes, writers, lifecycle, shared).

```ts
import { compileQueries } from "@ytrynot/gov-mcp";

const queries = compileQueries(db);
```

The `IQueries` interface is the contract between the query layer and the tool layer. Each statement is a pre-compiled `IStatement<T>` with `.all()`, `.get()`, `.run()` methods.

## Call Tools Directly

All MCP tools are exported as plain functions that take an `IToolCtx` and return an `IToolResult`. You can call them without an MCP server.

```ts
import { GovDb, initDatabase, compileQueries, writeTools, readTools } from "@ytrynot/gov-mcp";

const db = GovDb.open({ dbPath: "./data/governance.db" });
initDatabase(db);
const queries = compileQueries(db);
const ctx = { db, queries };

// Register a writer
const reg = writeTools.registerWriter(ctx, {
  id: "my-script",
  role: "agent",
  responsibility: "migration script",
  defaultScope: "workspace",
});

// Extract the nanoid from the structured content
const nanoid = reg.structuredContent?.nanoid as string;

// Create a decision
const dec = writeTools.createDecision(ctx, {
  nanoid,
  title: "Use SQLite for governance",
  decider: "ADMIN",
  context: "Markdown files drift",
  decision: "Adopt @ytrynot/gov-mcp",
  consequences: "Single .db file, MCP-exposed",
  scope: "workspace",
});

// List decisions
const list = readTools.listDecisions(ctx, {});
console.log(list.content[0].text);
```

Output:

```
register isError: false
nanoid: tPbkBYWmB8p2y3k0nfDW0
decision isError: false
list isError: false
```

Every tool function validates its input with a DNA schema via `.safeParse()`. If validation fails, the function returns an `IToolResult` with `isError: true` and the validation messages in the text content — it never throws.

### Tool namespaces

| Export | Tools |
|--------|-------|
| `readTools` | 27 read-only functions (list, get, search, audit, whoami, help, get_updates, etc.) |
| `writeTools` | 21 mutation functions (register, create, update, link, correct, append_log_entry, free fields) |
| `reportTools` | 8 report functions (daily, decisions, actions, ideas, problems, history, dump, all) |

## Transactions

`GovDb.transaction()` wraps a function in a SQLite transaction. If the function throws, the transaction rolls back.

```ts
import { GovDb, initDatabase, compileQueries, writeTools } from "@ytrynot/gov-mcp";

const db = GovDb.open({ dbPath: "./data/governance.db" });
initDatabase(db);
const queries = compileQueries(db);
const ctx = { db, queries };

const result = db.transaction(() => {
  writeTools.createDecision(ctx, { /* ... */ });
  writeTools.createAction(ctx, { /* ... */ });
  return "done";
});
```

Cascade triggers fire within the same transaction — if a cascade fails, the whole transaction rolls back.

## Generate SQL Artifacts

The schema and triggers SQL can be generated without opening a database:

```ts
import { generateSchemaSQL, generateTriggersSQL } from "@ytrynot/gov-mcp";

const schemaSQL = generateSchemaSQL();   // tables, indexes, FTS5
const triggersSQL = generateTriggersSQL(); // cascade + scope + supersession + FTS5 sync

// Write to files
import { writeFileSync } from "node:fs";
writeFileSync("schema.sql", schemaSQL, "utf8");
writeFileSync("triggers.sql", triggersSQL, "utf8");
```

This is how the committed `schema/schema.sql` and `schema/triggers.sql` artifacts are produced.

## Available Exports

### Driver & Database

| Export | Kind | Purpose |
|--------|------|---------|
| `GovDb` | class | SQLite driver (open, exec, prepare, transaction, close) |
| `IDriverOptions` | type | Options for `GovDb.open()` |
| `IStatement` | type | Prepared statement interface |
| `TxFn` | type | Transaction function signature |

### Initialization & Schema

| Export | Kind | Purpose |
|--------|------|---------|
| `initDatabase` | function | Create all tables, indexes, triggers, seed root scope |
| `initIfEmpty` | function | Same as above, only if DB is empty |
| `compileQueries` | function | Prepare all statements, return `IQueries` |
| `IQueries` | type | All prepared statements grouped by domain |
| `generateSchemaSQL` | function | Generate the full schema DDL as SQL text |
| `generateTriggersSQL` | function | Generate all triggers as SQL text |
| `generateIndexDDL` | function | Generate index DDL as SQL text |
| `tables` | object | Table definitions (via `@ytrynot/qb`) |
| `triggerDefinitions` | object | Trigger definitions |
| `FTS5_DDL` | string | FTS5 virtual table DDL |
| `ROOT_SCOPE_ID` | const | Root scope identifier (`"workspace"`) |

### Server

| Export | Kind | Purpose |
|--------|------|---------|
| `startServer` | function | Start the MCP server on stdio |
| `IServerOptions` | type | Options for `startServer()` |

### Tools (programmatic use)

| Export | Kind | Purpose |
|--------|------|---------|
| `readTools` | namespace | 27 read-only tool functions |
| `writeTools` | namespace | 21 mutation tool functions |
| `reportTools` | namespace | 8 report tool functions |
| `IToolCtx` | type | Tool context (`{ db, queries }`) |
| `IToolResult` | type | Tool result (`{ content, structuredContent?, isError }`) |
| `schemas` | namespace | DNA input schemas for all tools |
| `enums` | namespace | Shared enum arrays (status, severity, type, role, etc.) |

### Scopes & Seeding

| Export | Kind | Purpose |
|--------|------|---------|
| `discoverScopes` | function | Discover scopes from monorepo layout |
| `generateSeedSQL` | function | Generate seed SQL for discovered scopes |
| `resolveMonorepoRoot` | function | Resolve the monorepo root from package location |

### Helpers

| Export | Kind | Purpose |
|--------|------|---------|
| `currentDate` | function | Current date in `YYYY-MM-DD` format |
| `currentTimestamp` | function | Current timestamp in ISO 8601 |
| `formatId` | function | Format an entity ID (e.g. `DEC-0001`) |
| `generateWriterNanoid` | function | Generate a writer nanoid token |
| `resolveScopeWildcard` | function | Resolve `*` scope to all scope IDs |

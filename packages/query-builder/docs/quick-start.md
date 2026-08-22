# Quick Start — @ytrynot/qb

> **Tutorial** — Beginner, first contact. Step-by-step, end-to-end, every step runnable.
>
> Prerequisites: a Node.js project (Node.js >= 25.0.0), basic familiarity with TypeScript and SQLite.

This tutorial walks through installing `@ytrynot/qb`, building your first query, defining a table from a Zod v4 schema, defining the same table from a DNA schema, and executing the produced SQL with a driver. By the end you will have a complete, runnable example of schema-driven table creation and CRUD.

## Table of Contents

- [Step 1 — Install](#step-1--install)
- [Step 2 — Build your first query](#step-2--build-your-first-query)
- [Step 3 — Define a table from a Zod v4 schema](#step-3--define-a-table-from-a-zod-v4-schema)
- [Step 4 — Define the same table from a DNA schema](#step-4--define-the-same-table-from-a-dna-schema)
- [Step 5 — Use the auto-generated CRUD set](#step-5--use-the-auto-generated-crud-set)
- [Step 6 — Execute the SQL with a driver](#step-6--execute-the-sql-with-a-driver)
- [Where to go next](#where-to-go-next)

## Step 1 — Install

Install `@ytrynot/qb` in your project:

```bash
npm install @ytrynot/qb
```

`zod` and `@ytrynot/dna` are **optional peer dependencies**. Install the one(s) you use for schema introspection:

```bash
# For Zod v4 schema introspection
npm install zod

# For DNA schema introspection
npm install @ytrynot/dna
```

If you use only the fluent DML API (no schema-driven DDL), neither peer dependency is required.

`@ytrynot/qb` is a pure-ESM package. Import it with ESM syntax:

```typescript
// Standard version (with full JSDoc support)
import { QueryBuilder } from "@ytrynot/qb";

// Minified version (optimized for production)
import { QueryBuilder } from "@ytrynot/qb/min";
```

## Step 2 — Build your first query

`QueryBuilder.table(name)` starts a fluent DML chain. Each method returns the builder, so you chain calls and terminate with `.toSQL()`, which compiles the chain into a SQL string with named parameters.

```typescript
import { QueryBuilder } from "@ytrynot/qb";

const sql = QueryBuilder.table("users")
  .select(["id", "name"])
  .where(["id"])
  .toSQL();

console.log(sql);
```

Output (verified):

```
SELECT id, name FROM users WHERE id = @id
```

The `.where(["id"])` call produces `WHERE id = @id` — the parameter name matches the column name. You pass the value at execution time: `{ id: 123 }`.

## Step 3 — Define a table from a Zod v4 schema

`QueryBuilder.defTable(name, schema)` introspects a Zod v4 object schema and returns a `TableDef` — an object containing the `CREATE TABLE` DDL string and a full set of pre-built CRUD SQL strings.

Database-specific constraints (primary key, unique, default value, foreign key) are declared through Zod's `.meta()` API on each field:

```typescript
import { z } from "zod";
import { QueryBuilder } from "@ytrynot/qb";

const UserSchema = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  name: z.string(),
  age: z.number().int(),
  created_at: z.date().optional(),
});

const users = QueryBuilder.defTable("users", UserSchema);

console.log(users.createTable);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  created_at DATETIME
);
```

How it works: the Zod introspector reads each field of the object schema, maps the Zod type to a SQLite type (`z.string()` → `TEXT`, `z.number().int()` → `INTEGER`, `z.date()` → `DATETIME`), and reads the `.meta()` bag for constraints. Optional fields (`z.date().optional()`) omit `NOT NULL`. The result is a neutral `qbColumn[]` that the DDL engine turns into the `CREATE TABLE` statement.

## Step 4 — Define the same table from a DNA schema

`@ytrynot/dna` is a Zod-like API with serializable, bytecode-based schemas. `defTable` accepts DNA schemas through the same entry point — no separate call is needed. The same `.meta()` keys are supported.

```typescript
import { dna } from "@ytrynot/dna";
import { QueryBuilder } from "@ytrynot/qb";

const UserSchema = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  name: dna.string(),
  age: dna.int(),
  created_at: dna.date().optional(),
});

const users = QueryBuilder.defTable("users", UserSchema);

console.log(users.createTable);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  created_at DATETIME
);
```

The DNA introspector uses the `@ytrynot/dna/introspect` public API (`isOptional`, `isObject`, `unwrap`, `unwrapDeep`, `defaultValue`) to produce the same neutral `qbColumn[]` as the Zod introspector. Both paths feed into the same DDL engine, so equivalent schemas produce identical SQL.

## Step 5 — Use the auto-generated CRUD set

The `TableDef` returned by `defTable` contains pre-built SQL strings for the common CRUD operations, plus a `req` (alias `q`) getter that returns a fresh `Builder` for custom queries.

```typescript
const users = QueryBuilder.defTable("users", UserSchema);

users.createTable;  // CREATE TABLE IF NOT EXISTS users (...)
users.getAll;       // SELECT * FROM users
users.getById;      // SELECT * FROM users WHERE id = @id
users.insert;       // INSERT INTO users (id, email, name, age, created_at) VALUES (@id, @email, @name, @age, @created_at)
users.update;       // UPDATE users SET email = @email, name = @name, age = @age, created_at = @created_at WHERE id = @id
users.delete;       // DELETE FROM users WHERE id = @id
users.upsert;       // INSERT INTO users (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...

// Custom fluent queries via .req (or .q alias)
users.req.select("id", "name").where("id").toSQL();
// SELECT id, name FROM users WHERE id = @id

// Upsert with auto-deduced unique keys (from schema metadata: pk + unique)
users.req.upsert("email", "name").toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name)
// ON CONFLICT(id, email) DO UPDATE SET name = excluded.name
```

The `req` getter returns a `Builder` pre-configured with the table name and all unique keys detected from the schema (columns with `meta.pk`, `meta.unique`, or `pkauto`). This lets `.upsert()` auto-deduce its conflict targets without you passing them explicitly.

## Step 6 — Execute the SQL with a driver

`@ytrynot/qb` produces SQL strings and named parameters. You execute them with your own driver.

### With `node:sqlite` (Node.js 22+)

```typescript
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("app.db");

// Enable foreign key enforcement (SQLite disables it by default)
db.exec(QueryBuilder.enableForeignKeys());

// Create the table
db.exec(users.createTable);

// Insert a row
const insertStmt = db.prepare(users.insert);
insertStmt.run({
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "alice@example.com",
  name: "Alice",
  age: 30,
  created_at: null,
});

// Select by id
const selectStmt = db.prepare(users.getById);
const row = selectStmt.get({ id: "550e8400-e29b-41d4-a716-446655440000" });
console.log(row);
```

### With `better-sqlite3`

```typescript
import Database from "better-sqlite3";

const db = new Database("app.db");

db.exec(QueryBuilder.enableForeignKeys());
db.exec(users.createTable);

const insertStmt = db.prepare(users.insert);
insertStmt.run({
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "alice@example.com",
  name: "Alice",
  age: 30,
  created_at: null,
});

const selectStmt = db.prepare(users.getById);
const row = selectStmt.get({ id: "550e8400-e29b-41d4-a716-446655440000" });
console.log(row);
```

> [!CAUTION]
> **Foreign key enforcement**: SQLite does **not** enforce foreign key constraints by default. Run `PRAGMA foreign_keys = ON;` (or `QueryBuilder.enableForeignKeys()`) when opening your connection. Without this, the database ignores FK constraints and allows orphaned rows.

## Where to go next

- **[How-to: DDL & schema generation](./how-to-ddl.md)** — all three schema sources (Zod, DNA, manual), metadata keys, foreign keys, unique keys, indexes, composite primary keys.
- **[How-to: Queries](./how-to-queries.md)** — SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE variants, JOINs, ordering, limits, cloning, text search, GROUP BY, pagination.
- **[How-to: Advanced patterns](./how-to-advanced.md)** — EXISTS, CASE WHEN, correlated subqueries, WHERE IN subqueries, window functions, PragmaBuilder.
- **[Feature reference](./feature-reference.md)** — complete method-by-method inventory, type system, SQLite version matrix.
- **[README](../README.md)** — overview, installation, feature list.

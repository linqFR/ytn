[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ytrynot/qb.svg)](https://www.npmjs.com/package/@ytrynot/qb)
[![Bundle size](https://packagephobia.com/badge?p=@ytrynot/qb)](https://packagephobia.com/result?p=@ytrynot/qb)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# @ytrynot/qb — Fluent SQLite Query Builder with Zod & DNA integration

`@ytrynot/qb` is a lightweight, type-safe, pure-ESM SQL string builder for SQLite. It generates SQL strings and named parameters but does **not** execute them — you run the produced SQL with your own driver (`node:sqlite`, `better-sqlite3`, etc.).

It can define a table and generate full CRUD directly from a **Zod v4** schema, a **@ytrynot/dna** schema, or manual column definitions. The fluent DML API (`.select()`, `.insert()`, `.where()`, `.joinInner()`, etc.) works independently of any schema library.

> [!IMPORTANT]
> **Schema support is strictly limited to Zod v4 and @ytrynot/dna.** No other schema library is supported for DDL generation or CRUD helpers. Zod v3 is **not** supported — the introspection layer relies on the v4 `._zod` protocol exclusively.
>
> For use cases that do not involve schema introspection, the `QueryBuilder` fluent API (`.select()`, `.insert()`, `.where()`, etc.) works independently of any schema library.

> [!NOTE]
> **Terminology**:
> - **DDL** (Data Definition Language): statements that define the database schema — `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`.
> - **DML** (Data Manipulation Language): statements that read and modify data — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `UPSERT`.

## Why

Writing SQLite SQL by hand is error-prone: identifier quoting, named-parameter binding, `ON CONFLICT` targets, and `FOREIGN KEY` clauses are easy to get wrong. `@ytrynot/qb` gives you a fluent, chainable API that produces predictable, parameterized SQL strings, and — when you have a Zod or DNA schema — derives the `CREATE TABLE` statement and a full CRUD set from that schema in one call. No ORM, no runtime dependency on a database driver, no hidden execution.

## Installation

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

## Agent Skills

Install the [ytn agent skill](../../skills/ytn/SKILL.md) so your AI coding agent knows how to use this package:

```bash
npx skills add linqFR/ytn
```

## Quick start

The smallest example: build a `SELECT` query and get the SQL string with named parameters.

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

Pass the produced SQL and a parameters object to your driver:

```typescript
// node:sqlite
const stmt = db.prepare(sql);
const row = stmt.get({ id: 123 });

// better-sqlite3
const stmt = db.prepare(sql);
const row = stmt.get({ id: 123 });
```

### Define a table from a Zod v4 schema

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
console.log(users.getById);
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
SELECT * FROM users WHERE id = @id
```

### Define a table from a DNA schema

The same table, defined with `@ytrynot/dna` — identical SQL output:

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

## Features

- **Fluent DML**: SELECT, INSERT, UPDATE, DELETE, UPSERT with method chaining and safe named parameters.
- **Schema-First DDL**: Generate `CREATE TABLE` and a full CRUD set from **Zod v4** or **@ytrynot/dna** schemas — or use the fluent API standalone.
- **Three schema sources, one API**: `defTable(name, def)` accepts Zod, DNA, or manual `qbColumn[]` and returns the same `TableDef` shape.
- **Advanced Queries**: JOINs (INNER, LEFT, RIGHT), subqueries, `EXISTS`, `CASE WHEN`, window functions (with frame specs), `DISTINCT`, `HAVING`, `RETURNING`.
- **Compound SELECT**: `UNION`, `UNION ALL`, `INTERSECT`, `EXCEPT` via instance methods (`.union()`, `.unionAll()`, etc.) and static factories (`QueryBuilder.unionAll(...)`).
- **CTE**: `.with(name, query)` and `.withRecursive(name, query)` for `WITH` / `WITH RECURSIVE` clauses.
- **Raw escape hatches**: `whereRaw()`, `selectRaw()`, `orderByRaw()`, `updateRaw()` for expressions the fluent API can't express.
- **ON CONFLICT**: `.onConflict(cols).doNothing()/.doUpdate()/.doUpdateRaw()` for fine-grained upsert control.
- **INSERT OR**: `.insert(...).or("REPLACE"|"IGNORE"|"ROLLBACK"|"ABORT"|"FAIL")` for conflict resolution.
- **UPDATE FROM**: `.update(fields).from(table)` for cross-table updates (SQLite 3.33+).
- **Multi-row INSERT**: `.insertMulti(fields, rowCount)` with indexed placeholders.
- **DDL Constraints**: Composite UNIQUE, CHECK (column + table level), FK actions (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION), generated columns (`GENERATED ALWAYS AS ... STORED|VIRTUAL`).
- **TEMP tables**: `options.temporary: true` for `CREATE TEMP TABLE`.
- **CREATE TABLE AS SELECT**: `QueryBuilder.createTableAs(name, builder)`.
- **CREATE TRIGGER**: `QueryBuilder.createTrigger(name, def)` — typed structure (timing, event, table, WHEN, FOR EACH ROW), raw body.
- **EXPLAIN**: `.explain()` and `.explainQueryPlan()` for query analysis.
- **Index Management**: `createIndex()` with partial WHERE and expression columns, `dropIndex()`.
- **SQLite Pragmas**: Fluent `PragmaBuilder` for `foreign_keys`, `journal_mode`, `synchronous`, and more.

> [!NOTE]
> For the complete feature inventory (all supported/unsupported capabilities per category, type system, and out-of-scope decisions), see [`docs/feature-reference.md`](./docs/feature-reference.md).

## Table of Contents

- [Why](#why)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Features](#features)
- [SQLite version requirements](#sqlite-version-requirements)
- [Documentation](#documentation)
- [Testing](#testing)
- [License](#license)

### Documentation

| Document | Type | Audience | Covers |
| :--- | :--- | :--- | :--- |
| [`docs/quick-start.md`](./docs/quick-start.md) | Tutorial | Beginner, first contact | End-to-end: install, first query, first table from Zod/DNA, run with a driver |
| [`docs/how-to-ddl.md`](./docs/how-to-ddl.md) | How-to | Knows the basics, wants DDL | `defTable`, `reqCreateTable`, `createTable`, Zod/DNA/manual schemas, metadata keys, foreign keys, unique keys, indexes |
| [`docs/how-to-queries.md`](./docs/how-to-queries.md) | How-to | Knows the basics, wants DML | SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE variants, JOINs, ordering, limits, cloning, text search, GROUP BY, pagination |
| [`docs/how-to-advanced.md`](./docs/how-to-advanced.md) | How-to | Wants advanced patterns | EXISTS, CASE WHEN, correlated subqueries, WHERE IN subqueries, window functions, PragmaBuilder |
| [`docs/feature-reference.md`](./docs/feature-reference.md) | Reference | Needs exact detail | Complete method-by-method inventory, type system, SQLite version matrix, out-of-scope decisions |

## SQLite version requirements

`@ytrynot/qb` generates SQL that depends on specific SQLite versions. The builder does **not** validate the runtime SQLite version — consumers must ensure their driver meets the minimum requirement for each feature they use.

| Feature | Min SQLite | qb API |
|---------|-----------|-------|
| RETURNING | 3.35.0 | `.returning()` |
| UPSERT / ON CONFLICT | 3.24.0 | `.onConflict()`, `.upsert()` |
| RIGHT JOIN | 3.39.0 | `.joinRight()` |
| Window functions | 3.25.0 | `.selectWindow()` |
| Window frames (ROWS BETWEEN) | 3.25.0 | `.selectWindow(alias, { frame })` |
| UPDATE FROM | 3.33.0 | `.update(fields).from(table)` |
| CTE (WITH RECURSIVE) | 3.8.3 | `.withRecursive(name, query)` |
| Generated columns | 3.31.0 | `qbColumn.generated: { expr, type }` |

**Runtime notes**:
- `node:sqlite` (Node.js 22+) ships SQLite 3.46+ — all features available.
- `better-sqlite3` bundles its own SQLite — check the bundled version.
- Features used without guard produce runtime errors from the driver on older SQLite, not from `@ytrynot/qb`.

You must read the documentation of your SQLite database and check which parameters are effective and allowed by the version of SQLite your database is using. **`QueryBuilder` is a tool to write SQLite requests; it does not execute the request.**

## Testing

The package includes a comprehensive suite of 396 tests covering source logic, Zod v4 and DNA compliance, distribution bundles, and minification.

```bash
# Run the full suite
npm test

# Run for this package only (from the monorepo root)
npm.cmd test -w @ytrynot/qb

# Typecheck tests
npm.cmd test -w @ytrynot/qb -- --typecheck
```

### Build & development

The project uses `tsup` for bundling.

- **Build**: `npm run build` (generates `dist/`, including a minified `index.min.js`)
- **Watch**: `npm run dev`

## License

[MIT](./LICENSE) — © linqFR

# Fluent Query Builder Documentation

> **Looking for testers!** This package is actively seeking early users and feedback. If you try it out, please share your experience — issues, suggestions, or ideas are all welcome.
>
> GitHub: https://github.com/linqFR/ytn/tree/main/packages/query-builder

The `QueryBuilder` is a lightweight, database-agnostic SQL string generator designed to create secure, localized, and predictable SQL queries.

It generates SQL strings and named parameters but does not execute them.

It can create a table directly from [**Zod v4**](https://zod.dev/) or [**@ytrynot/dna**](https://github.com/linqFR/ytn/tree/main/packages/dna) schemas.



> [!IMPORTANT]
> **Schema support is strictly limited to Zod v4 and @ytrynot/dna.** No other schema library is supported for DDL generation or CRUD helpers. Zod v3 is **not** supported — the introspection layer relies on the v4 `._zod` protocol exclusively.
>
> For use cases that don't involve schema introspection, the `QueryBuilder` fluent API (`.select()`, `.insert()`, `.where()`, etc.) works independently of any schema library.

> [!NOTE]
> **Terminology**:
> - **DDL** (Data Definition Language): statements that define the database schema — `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`.
> - **DML** (Data Manipulation Language): statements that read and modify data — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `UPSERT`.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Basic Selection](#basic-selection)
- [Joins (Inner, Left, Right)](#joins-inner-left-right)
- [Inserting Data](#inserting-data)
- [Updating Data](#updating-data)
- [Deleting Data](#deleting-data)
- [RETURNING Clause](#returning-clause)
- [SQLite Configuration (Pragmas)](#sqlite-configuration-pragmas)
- [Ordering & Limits](#ordering--limits)
- [Cloning Queries](#cloning-queries)
- [Text Search](#text-search)
- [Complex Logic (Subqueries & Case)](#complex-logic-subqueries--case)
- [DDL & Schema Generation](#ddl--schema-generation)
  - [defTable — Unified API](#deftable--unified-api)
  - [Unique Keys & Upsert](#unique-keys--upsert)
  - [Table Aliases](#table-aliases)
  - [Zod v4 Schema](#zod-v4-schema)
  - [DNA Schema](#dna-schema)
  - [QB (No Schema)](#qb-no-schema)
  - [Manual DDL (No Schema)](#manual-ddl-no-schema)
  - [Supported Metadata Keys](#supported-metadata-keys)
  - [Foreign Keys](#foreign-keys)
- [End-to-End Lifecycle Example](#end-to-end-lifecycle-example)
- [API Reference](#api-reference)
- [Testing](#testing)

## WARNING

You must read documentation of your SQLite database and check out which parameters are effective and allowed by the version of SQLite your DataBase is using.

**`QueryBuilder` is only a tool to write SQLite request; it will not execute the request.**

> [!NOTE]
> Some features require a minimum SQLite version (e.g. `RETURNING` requires 3.35+, `RIGHT JOIN` requires 3.39+).
> See the [SQLite Version Requirements](docs/feature-reference.md#sqlite-version-requirements) in the feature reference for the full compatibility matrix.

## Features

- **Fluent DML**: SELECT, INSERT, UPDATE, DELETE, UPSERT with method chaining and safe named parameters.
- **Schema-First DDL**: Generate `CREATE TABLE` and CRUD from **Zod v4** or **@ytrynot/dna** schemas — or use the fluent API standalone.
- **Advanced Queries**: JOINs, subqueries, `EXISTS`, `CASE WHEN`, window functions, `DISTINCT`, `HAVING`, `RETURNING`.
- **ON CONFLICT**: `.onConflict(cols).doNothing()/.doUpdate()/.doUpdateRaw()` for fine-grained upsert control.
- **Multi-row INSERT**: `.insertMulti(fields, rowCount)` with indexed placeholders.
- **DDL Constraints**: Composite UNIQUE, CHECK (column + table level), FK actions (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION).
- **Index Management**: `createIndex()` with partial WHERE and expression columns, `dropIndex()`.

> [!NOTE]
> For the complete feature inventory (all supported/unsupported capabilities per category, type system, and out-of-scope decisions), see [`docs/feature-reference.md`](./docs/feature-reference.md).

## Getting Started

Import the builder from the package. It is a **Pure ESM** package.

```typescript
// Standard version (with full JSDoc support)
import { QueryBuilder } from "@ytrynot/qb";

// Minified version (optimized for production)
import { QueryBuilder } from "@ytrynot/qb/min";
```

### Basic Selection

```typescript
// SELECT id, name FROM users WHERE id = @id
const sql = QueryBuilder.table("users")
  .select(["id", "name"])
  .where(["id"])
  .toSQL();

// db.prepare(sql).get({ id: 123 });
```

### Joins (Inner, Left, Right)

`QueryBuilder` supports three explicit join methods. Each method can take either a **Table Name** or another **QueryBuilder Instance** (for subquery joins).

#### Standard Table Joins

Provide the table name (with optional alias) and the `ON` condition.

```typescript
// SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id
const sql = QueryBuilder.table("users")
  .as("u")
  .select(["u.name", "p.title"])
  .joinInner("posts p", "u.id = p.user_id") // p as an alias of posts
  .toSQL();
```

#### Subquery Joins

Provide a `QueryBuilder` instance, an alias for the result set, and the `ON` condition.

```typescript
// SELECT t.name, latest.version FROM tools t
// LEFT JOIN (SELECT tool_uuid, version FROM tool_versions ORDER BY created_at DESC LIMIT 1) latest
// ON t.uuid = latest.tool_uuid
const latestVersion = QueryBuilder.table("tool_versions")
  .select(["tool_uuid", "version"])
  .orderBy("created_at", "DESC")
  .limit(1);

const sql = QueryBuilder.table("tools")
  .as("t")
  .select(["t.name", "latest.version"])
  .joinLeft(latestVersion, "latest", "t.uuid = latest.tool_uuid")
  .toSQL();
```

#### Choose your Join Type

The join methods support two different signatures depending on whether you are joining a physical table or a subquery:

#### 1. Joining physical tables (2 arguments)

- `.joinInner(tableName, onCondition)`
- `.joinLeft(tableName, onCondition)`
- `.joinRight(tableName, onCondition)`

#### 2. Joining subquery builders (3 arguments)**

- `.joinInner(subquery, alias, onCondition)`
- `.joinLeft(subquery, alias, onCondition)`
- `.joinRight(subquery, alias, onCondition)`

### Inserting Data

Fields provided to `.insert()` are automatically mapped to `@field` placeholders.

```typescript
// INSERT INTO logs (level, message, timestamp) VALUES (@level, @message, @timestamp)
const sql = QueryBuilder.table("logs")
  .insert(["level", "message", "timestamp"])
  .toSQL();
```

### Updating Data

Combine `.update()` (fields to set) with `.where()` (conditions). All advanced `WHERE` filters (like `.whereIn()`) are supported.

```typescript
// UPDATE tools SET name = @name WHERE uuid = @uuid AND status IN ('draft', 'pending')
const sql = QueryBuilder.table("tools")
  .update(["name"])
  .where(["uuid"])
  .whereIn("status", ["draft", "pending"])
  .toSQL();
```

### Deleting Data

```typescript
// DELETE FROM logs WHERE created_at < @threshold
const sql = QueryBuilder.table("logs")
  .delete()
  .where([{ col: "created_at", param: "threshold" }])
  .toSQL();
```

### RETURNING Clause

SQLite 3.35+ supports returning modified rows immediately. This works with `INSERT`, `UPDATE`, `DELETE`, and `UPSERT`.

```typescript
// INSERT INTO users (name) VALUES (@name) RETURNING id, created_at
const sql = QueryBuilder.table("users")
  .insert(["name"])
  .returning(["id", "created_at"])
  .toSQL();
```

### SQLite Configuration (Pragmas)

Fine-tune your SQLite database performance and safety using the fluent `PragmaBuilder`.

```typescript
// PRAGMA foreign_keys = ON;
// PRAGMA journal_mode = WAL;
// PRAGMA synchronous = NORMAL;
const sql = QueryBuilder.pragma()
  .foreignKeys(true)
  .journalMode("WAL")
  .synchronous("NORMAL")
  .cacheSize(-32000) // 32MB cache (negative value = kilobytes)
  .toSQL();

// Execute the generated script with your driver (e.g., better-sqlite3)
db.exec(sql);
```

#### Supported Pragma Methods

| Method                | Parameters                  | Description                                                             |
| :-------------------- | :-------------------------- | :---------------------------------------------------------------------- |
| `.foreignKeys(on)`    | `boolean`                   | Enables or disables foreign key enforcement.                            |
| `.journalMode(mode)`  | `'WAL' \| 'DELETE' \| ...`  | Sets the journaling mode (`WAL` is highly recommended for performance). |
| `.synchronous(level)` | `'NORMAL' \| 'FULL' \| ...` | Controls disk sync safety vs speed.                                     |
| `.cacheSize(size)`    | `number`                    | Sets cache size. Negative values = KB, positive = pages.                |
| `.busyTimeout(ms)`    | `number`                    | Time to wait (ms) when database is locked before throwing an error.     |
| `.mmap_size(bytes)`   | `number`                    | Sets the memory-mapped I/O limit.                                       |
| `.tempStore(loc)`     | `'MEMORY' \| 'FILE'`        | Where to store temporary tables and indices.                            |
| `.autoVacuum(mode)`   | `'NONE' \| 'FULL' \| ...`   | Sets the database auto-vacuum strategy.                                 |
| `.pageSize(bytes)`    | `number`                    | Sets the database page size (512 to 65536).                             |
| `.optimize()`         | _none_                      | Runs SQLite query planner optimizations.                                |
| `.raw(key, value)`    | `string, string \| number`  | Inject any other custom SQLite `PRAGMA`.                                |

### Ordering & Limits

```typescript
// SELECT * FROM events ORDER BY created_at DESC LIMIT 10
const sql = QueryBuilder.table("events")
  .select()
  .orderBy("created_at", "DESC")
  .limit(10)
  .toSQL();
```

### Cloning Queries

The `.clone()` method creates an independent copy of the current builder instance. This is highly useful for deriving multiple queries (like pagination and counting rows) from a shared base query without mutating the original state.

```typescript
const baseQuery = QueryBuilder.table("users").where(["is_active"]);

// Clone to get the total count
const totalSql = baseQuery.clone().count().toSQL();
// Result: SELECT COUNT(*) as count FROM users WHERE is_active = @is_active

// Clone to get the current page of results
const pageSql = baseQuery.clone().limit(10).offset(20).toSQL();
// Result: SELECT * FROM users WHERE is_active = @is_active LIMIT 10 OFFSET 20
```

### Text Search

Helper for `LIKE` queries combined with strict filters.

```typescript
// SELECT * FROM docs WHERE (title LIKE @search_term OR content LIKE @search_term) AND type = @type
const sql = QueryBuilder.table("docs")
  .search(["title", "content"], ["type"])
  .toSQL();

// Usage: db.prepare(sql).all({ search_term: '%term%', type: 'md' });
```

### Complex Logic (Subqueries & Case)

The `QueryBuilder` supports advanced SQL constructs like nested subqueries and conditional logic block while maintaining a fluent interface.

#### Existence Predicates (EXISTS)

The `.asExists()` and `.asNotExists()` methods are **terminators** (like `.toSQL()`). They compile the builder into a string fragment suitable for use as a boolean condition.

- **Purpose**: To check for row existence in a related table without the overhead of counting rows or fetching full records.
- **Usage**: Typically passed into `.whereRaw()` or used inside `.selectCase()`.
- **Performance**: In SQL, `EXISTS` is highly efficient because the query engine stops searching as soon as it finds the first matching row.

```typescript
// Checking if a user has at least one order
const hasOrders = QueryBuilder.table("orders") // "o" is an alias for orders
  .as("o")
  .whereColumn("o.user_id", "u.id") // "u" is the alias of the outer query
  .asExists();

const sql = QueryBuilder.table("users") // Define "u" as the alias for users
  .as("u")
  .select(["name"])
  .whereRaw(hasOrders) // WhereRaw used here because asExists is already compiled
  .toSQL();
// Result: SELECT name FROM users u WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)
```

#### Declarative CASE Statements

The `.selectCase()` method allows building complex conditional columns without string concatenation.

```typescript
const sql = QueryBuilder.table("tools")
  .as("t")
  .select(["name"])
  .selectCase(
    "status",
    [
      {
        when: QueryBuilder.table("prompt_tools")
          .as("pt")
          .whereColumn("pt.tool_uuid", "t.uuid")
          .asNotExists(),
        then: "'unused'",
      },
      {
        when: hasPublishedPrompts, // Pre-built subquery string
        then: "'locked'",
      },
    ],
    "'linked'",
  ) // Optional ELSE value
  .toSQL();
```

#### Fine-Grained Filtering (Raw & Literals)

Use these methods when you need to compare columns between tables or inject specific SQL literals without parameter binding.

In this example, we build a **correlated subquery** where the inner table `tool_versions` (aliased as `tv`) is filtered by a column from the outer table `tools` (aliased as `t`):

```typescript
// Subquery for correlated filtering (NOT compiled yet)
const recentVersion = QueryBuilder.table("tool_versions")
  .as("tv")
  .whereColumn("tv.tool_uuid", "t.uuid") // Links "tv" to outer alias "t"
  .whereLiteral("tv.version", "'1.0.0'") // String literal (no @ binding)
  .limit(1);

// Parent query using the subquery
const sql = QueryBuilder.table("tools") // Outer alias "t" defined here
  .as("t")
  .whereIn("uuid", recentVersion)
  .toSQL();
```

#### WHERE IN (Values and Subqueries)

Support for filtering against a list of literal values or the result of a subquery.

When using a subquery, pass the `Builder` instance directly (without calling `.toSQL()`). The inner query is compiled automatically during the parent's `toSQL()` process.

```typescript
// Filtering with a list of values
const sqlValues = QueryBuilder.table("tools")
  .whereIn("uuid", ["value1", "value2"])
  .toSQL();

// Filtering with a subquery (Subquery relation)
// We select 'uuid' from 'tool_versions' to filter the main 'tools' table.
const sub = QueryBuilder.table("tool_versions").select(["uuid"]).limit(5);

// PASS the 'sub' builder instance directly without calling .toSQL()
const sqlSub = QueryBuilder.table("tools").whereIn("uuid", sub).toSQL();
```

#### Grouping & Pagination

Methods for `GROUP BY` and `OFFSET`.

```typescript
// SELECT type, COUNT(*) FROM events GROUP BY type ORDER BY type ASC LIMIT 10 OFFSET 20
const sql = QueryBuilder.table("events")
  .select(["type"])
  .selectRaw("COUNT(*) as cnt")
  .groupBy(["type"])
  .orderBy("type", "ASC")
  .limit(10)
  .offset(20)
  .toSQL();
```

---

### DDL & Schema Generation

`QueryBuilder` provides three entry points:
- **`defTable(name, def)`** — defines a table from any schema source (Zod, DNA, or manual `qbColumn[]`) and generates all SQL statements (DDL + DML). Returns a `TableDef` directly (throws on invalid schema).
- **`reqCreateTable(name, def)`** — shortcut for `defTable(name, def).createTable` — returns only the DDL string.
- **`table(name)`** — fluent DML-only chain for ad-hoc queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).

#### defTable — Unified API

`defTable` accepts any of the 3 schema sources and returns a `TableDef` directly (throws on invalid schema). It contains `createTable`, `getAll`, `getById`, `insert`, `update`, `delete`, `upsert` (pre-built SQL strings) plus a `req`/`q` getter for custom fluent queries:

| Schema Source | `def` type | Use When |
| :--- | :--- | :--- |
| **Zod v4** | `z.ZodTypeAny` | You already use Zod v4 for validation |
| **DNA** | `DnaType` | You use DNA schemas (serializable, bytecode-based) |
| **Manual** | `qbColumn[]` | You want raw column definitions — no schema library needed |

```typescript
import { z } from "zod";
import { QueryBuilder } from "@ytrynot/qb";

const UserSchema = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  name: z.string(),
});

const users = QueryBuilder.defTable("users", UserSchema);
users.createTable;  // CREATE TABLE IF NOT EXISTS users (...)
users.getAll;       // SELECT * FROM users
users.getById;      // SELECT * FROM users WHERE id = @id
users.insert;       // INSERT INTO users (id, email, name) VALUES (@id, @email, @name)
users.update;       // UPDATE users SET email = @email, name = @name WHERE id = @id
users.delete;       // DELETE FROM users WHERE id = @id
users.upsert;       // INSERT INTO users (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...

// Custom fluent queries via .req (or .q alias)
users.req.select("id", "name").where("id").toSQL();
// SELECT id, name FROM users WHERE id = @id

// upsert with auto-deduced uniqueKeys (from schema metadata)
users.req.upsert("email", "name").toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name)
// ON CONFLICT(id, email) DO UPDATE SET name = @name
```

**`table()` is the DML-only chain** — no schema, no DDL, just fluent SQL building:

```typescript
QueryBuilder.table("users").select("id", "email").where("id").toSQL();
// SELECT id, email FROM users WHERE id = @id
```

> [!NOTE]
> `defTable` is the unified entry point for all schema sources. For DDL-only, use `reqCreateTable(name, def)` (shortcut for `defTable(name, def).createTable`). For manual `qbColumn[]` DDL, `createTable(name, columns)` is also available.

#### Unique Keys & Upsert

`upsert()` requires unique keys (conflict targets). They can be provided in three ways:

```typescript
// 1. Auto-deduced from defTable (schema metadata: pk, unique, pkauto)
const users = QueryBuilder.defTable("users", UserSchema);
users.req.upsert("email", "name").toSQL();  // uniqueKeys auto

// 2. Via table() 2nd arg
QueryBuilder.table("users", ["email"]).upsert("email", "name").toSQL();

// 3. Via .uniqueKeys() chain
QueryBuilder.table("users").uniqueKeys("email").upsert("email", "name").toSQL();
```

For more control (partial index WHERE, raw expressions, DO NOTHING), use `.insert().onConflict()`:

```typescript
QueryBuilder.table("users", ["email"])
  .insert(["email", "name"])
  .onConflict("email")
  .doUpdate(["name"])
  .toSQL();
```

#### Table Aliases

Use `.as()` to set a table alias:

```typescript
QueryBuilder.table("users").as("u").select("u.name").toSQL();
// SELECT u.name FROM users u
```

#### Zod v4 Schema

Uses the **Zod v4 `.meta()` API** to define database-specific constraints. The introspector reads `._zod.def` (v4 protocol) — no v3 `_def` access.

```typescript
import { z } from "zod";
import { QueryBuilder } from "@ytrynot/qb";

const UserSchema = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  role: z.string().meta({ defaultValue: "'user'" }),
  age: z.number().int(),
  created_at: z.date().optional(),
});

const ddl = QueryBuilder.reqCreateTable("users", UserSchema);
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   role TEXT DEFAULT 'user',
//   age INTEGER NOT NULL,
//   created_at DATETIME
// )
```

#### DNA Schema

Uses [`@ytrynot/dna`](https://github.com/linqFR/ytn/tree/main/packages/dna) — a Zod-like API with serializable bytecode schemas. The same `.meta()` keys are supported. The introspector uses the `@ytrynot/dna/introspect` public API (`isOptional`, `isObject`, `unwrap`, `unwrapDeep`, `defaultValue`).

```typescript
import { dna } from "@ytrynot/dna";
import { qb } from "@ytrynot/qb";

const UserSchema = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  role: dna.string().meta({ defaultValue: "'user'" }),
  age: dna.number().int(),
  created_at: dna.date().optional(),
});

const ddl = qb.reqCreateTable("users", UserSchema);
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   role TEXT DEFAULT 'user',
//   age INTEGER NOT NULL,
//   created_at DATETIME
// )
```

#### QB (No Schema)

No schema library required. QB is a light, chainable query builder — `QueryBuilder.table().select().where().toSQL()` produces SQL strings directly. Queries are chainable, reusable, and transformable to string. This is the core of the QueryBuilder.

```typescript
import { QueryBuilder } from "@ytrynot/qb";

// DML — no schema needed, just write SQL fluently
const selectSql = QueryBuilder
  .table("users")
  .select("id", "email", "age")
  .where("id")
  .toSQL();
// SELECT id, email, age FROM users WHERE id = @id

const insertSql = QueryBuilder
  .table("users")
  .insert("id", "email", "age")
  .toSQL();
// INSERT INTO users (id, email, age) VALUES (@id, @email, @age)
```

#### Manual DDL (No Schema)

For DDL only, `QueryBuilder.createTable()` accepts a `qbTable` (array of `qbColumn`). This is the 4th path — not chainable, not reusable like QB, just a direct way to generate a `CREATE TABLE` statement without a schema library.

```typescript
import { QueryBuilder, type qbTable } from "@ytrynot/qb";

const columns: qbTable = [
  { name: "id", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { pk: true } },
  { name: "email", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { unique: true } },
  { name: "role", sqliteType: "TEXT", optional: false, hasDefault: true, defaultValue: "'user'", meta: {} },
  { name: "age", sqliteType: "INTEGER", optional: false, hasDefault: false, meta: {} },
  { name: "created_at", sqliteType: "DATETIME", optional: true, hasDefault: false, meta: {} },
];

const ddl = QueryBuilder.createTable("users", columns);
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   role TEXT DEFAULT 'user',
//   age INTEGER NOT NULL,
//   created_at DATETIME
// )
```

#### Supported Metadata Keys

The `.meta()` API (Zod v4 and DNA) supports the following keys:

| Key            | Type                 | Description                                                                                         |
| :------------- | :------------------- | :-------------------------------------------------------------------------------------------------- |
| `pk`           | `boolean`            | If `true`, the column is marked as `PRIMARY KEY`.                                                   |
| `pkauto`       | `boolean`            | If `true`, adds `PRIMARY KEY AUTOINCREMENT`. **Note**: In SQLite, this is only valid for `INTEGER`. |
| `fk`           | `string` \| `object` | Defines a `FOREIGN KEY`. Can be a string `"table(col)"` or an object `{ table, col, onDelete? }`.   |
| `unique`       | `boolean`            | If `true`, adds a `UNIQUE` constraint to the column.                                                |
| `default`      | `string`             | Sets the SQL `DEFAULT` value (e.g., `"'active'"` or `"(CURRENT_TIMESTAMP)"`).                       |
| `defaultValue` | `any`                | Alias for `default`.                                                                                |

#### Why `.meta()`?

`QueryBuilder` strictly uses the official Zod v4 `.meta()` API for defining database constraints. This approach is preferred over legacy patterns because:

- **Registry Integration**: Ensures compatibility with Zod's internal global registry.
- **Strong Typing**: Metadata values are matched against the intended schema.

#### Foreign Keys

> [!CAUTION] > **SQLite Enforcement**: By default, SQLite **does not enforce** foreign key constraints. To enable the rules defined below (`CASCADE`, `RESTRICT`, etc.), you **must** execute the following command when opening your database connection:
>
> ```sql
> PRAGMA foreign_keys = ON;
> ```
>
> You can generate this command using the builder:
>
> ```typescript
> const sql = QueryBuilder.enableForeignKeys();
> ```
>
> Without this, your database will ignore these constraints and allow orphaned rows.

You can define foreign keys directly in the metadata (Zod v4 and DNA both support this):

```typescript
// Zod v4
const PostSchema = z.object({
  id: z.number().int().meta({ pkauto: true }),
  user_id: z.string().uuid().meta({
    fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
  }),
});

// DNA — same metadata keys
const PostSchemaDna = dna.object({
  id: dna.number().int().meta({ pkauto: true }),
  user_id: dna.string().uuid().meta({
    fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
  }),
});
```

##### Foreign Key Integrity Actions

When defining a foreign key via an object, you can specify `onDelete` and `onUpdate`.

| Action          | Description                                                                                                                                                                                                         |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`CASCADE`**   | **Automated cleanup.** If a parent row is deleted or updated, all related child rows are automatically deleted or updated. Ideal for "strictly owned" relationships (e.g., a post and its comments).                |
| **`SET NULL`**  | **Soft disconnection.** If a parent is deleted, the child's reference is set to `NULL`. Use this when the child can exist without the parent (requires the column to be nullable).                                  |
| **`RESTRICT`**  | **Safety Lock.** Prevents any modification or deletion of the parent as long as children exist. You are forced to handle the children manually before the parent can be removed. Enforcement is strictly immediate. |
| **`NO ACTION`** | **Passive check.** Similar to `RESTRICT`, but in some databases, the check might be deferred until the end of the transaction. Use `RESTRICT` if you want immediate failure.                                        |

> [!TIP] > **Example Scenario (RESTRICT)**: If you attempt to delete a `User` who still has active `Orders`, the database will throw a SQL error and block the operation. You must first delete or reassign the `Orders` before the `User` can be removed.

---

## End-to-End Lifecycle Example

This example shows the **complete lifecycle of a table and its data** — from creation to deletion — using all 4 approaches. Each block produces SQL strings that you execute on your database driver.

### 1. DDL — Create the table (4 ways)

The same `users` table, defined 4 ways. All produce identical SQL.

```typescript
import { z } from "zod";
import { dna } from "@ytrynot/dna";
import { QueryBuilder, type qbTable } from "@ytrynot/qb";

// ── Way 1: Zod v4 ──
const userSchemaZod = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  name: z.string(),
  age: z.number().int(),
  created_at: z.date().optional(),
});
const ddlZod = QueryBuilder.reqCreateTable("users", userSchemaZod);

// ── Way 2: DNA ──
const userSchemaDna = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  name: dna.string(),
  age: dna.int(),
  created_at: dna.date().optional(),
});
const ddlDna = QueryBuilder.reqCreateTable("users", userSchemaDna);

// ── Way 3: Manual DDL ──
const columns: qbTable = [
  { name: "id", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { pk: true } },
  { name: "email", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { unique: true } },
  { name: "name", sqliteType: "TEXT", optional: false, hasDefault: false, meta: {} },
  { name: "age", sqliteType: "INTEGER", optional: false, hasDefault: false, meta: {} },
  { name: "created_at", sqliteType: "DATETIME", optional: true, hasDefault: false, meta: {} },
];
const ddlManual = QueryBuilder.createTable("users", columns);

// All 3 DDL strings are identical:
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   name TEXT NOT NULL,
//   age INTEGER NOT NULL,
//   created_at DATETIME
// )
```

### 2. DML — Insert, Select, Update, Delete (QB)

All DML is QB — `QueryBuilder.table()` chain. This is the same whether you defined the table via Zod, DNA, or manual DDL.

```typescript
// ── INSERT ──
const insertSql = QueryBuilder
  .table("users")
  .insert(["id", "email", "name", "age"])
  .toSQL();
// INSERT INTO users (id, email, name, age) VALUES (@id, @email, @name, @age)

// ── SELECT all ──
const selectAllSql = QueryBuilder
  .table("users")
  .select()
  .toSQL();
// SELECT * FROM users

// ── SELECT by id ──
const selectByIdSql = QueryBuilder
  .table("users")
  .select("id", "email", "name", "age")
  .where(["id"])
  .toSQL();
// SELECT id, email, name, age FROM users WHERE id = @id

// ── UPDATE ──
const updateSql = QueryBuilder
  .table("users")
  .update(["name", "age"])
  .where(["id"])
  .toSQL();
// UPDATE users SET name = @name, age = @age WHERE id = @id

// ── DELETE ──
const deleteSql = QueryBuilder
  .table("users")
  .delete()
  .where(["id"])
  .toSQL();
// DELETE FROM users WHERE id = @id
```

### 3. CRUD — Auto-generated from schema (Zod, DNA, or manual)

`defTable()` generates the full CRUD set in one call — from any schema source.

```typescript
// ── From Zod ──
const crudZod = QueryBuilder.defTable("users", userSchemaZod);
// crudZod.createTable  → CREATE TABLE IF NOT EXISTS users (...)
// crudZod.getAll       → SELECT * FROM users
// crudZod.getById      → SELECT * FROM users WHERE id = @id
// crudZod.insert       → INSERT INTO users (id, email, name, age) VALUES (@id, @email, @name, @age)
// crudZod.update       → UPDATE users SET email = @email, name = @name, age = @age WHERE id = @id
// crudZod.delete       → DELETE FROM users WHERE id = @id
// crudZod.upsert       → INSERT INTO users (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...

// ── From DNA ──
const crudDna = QueryBuilder.defTable("users", userSchemaDna);
// Same keys, same SQL strings as crudZod

// ── From manual qbColumn[] ──
const crudManual = QueryBuilder.defTable("users", userColumnsManual);
// Same keys, same SQL strings
```

### 4. DDL — Drop the table

```typescript
const dropSql = QueryBuilder.dropTable("users");
// DROP TABLE IF EXISTS users
```

---

## API Reference

> [!NOTE]
> For the complete method-by-method inventory (all query modes, filtering, joins, modifiers, compilation, DDL capabilities, and unsupported features), see [`docs/feature-reference.md`](./docs/feature-reference.md).

### Initialization

- `QueryBuilder.table(name: string, uniqueKeys?: string[])`: Start a new query. Use `.as()` for table aliases.
- `QueryBuilder.pragma()`: Returns a `PragmaBuilder` for SQLite configuration.
- `QueryBuilder.enableForeignKeys()`: Shortcut for `PRAGMA foreign_keys = ON;`.

### Static Helpers

- `defTable(tableName, def, options)`: Defines a table from any schema source (Zod, DNA, or `qbColumn[]`). Returns a `TableDef` with `createTable`, `getAll`, `getById`, `insert`, `update`, `delete`, `upsert`, and `req`/`q` getter. Throws on invalid schema.
- `reqCreateTable(tableName, def, options)`: Shortcut for `defTable(name, def).createTable` — returns only the DDL string.
- `createTable(tableName, columns, options)`: Generates `CREATE TABLE` DDL from a `qbTable` (array of `qbColumn`). No schema library required.

## Testing

The package includes a comprehensive suite of tests covering:

- **Source Logic**: Verification of the core modular components in `src/`.
- **Zod v4 Compliance**: Testing recursive unwrapping and official meta APIs.
- **Distribution (dist)**: Verification of the bundled ESM output.
- **Minification (min)**: Verification of the high-performance production bundle.

### Running Tests

Run the full suite:

```bash
npm test
```

### Build & Development

The project uses `tsup` for bundling.

- **Build**: `npm run build` (generates `dist/`)
- **Watch**: `npm run dev`

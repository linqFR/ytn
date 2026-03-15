# Fluent Query Builder Documentation

The `QueryBuilder` is a lightweight, database-agnostic SQL string generator designed to create secure, localized, and predictable SQL queries.

It generates SQL strings and named parameters but does not execute them.

It can create a table directly from [**Zod v4**](https://zod.dev/).

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
- [Text Search](#text-search)
- [Complex Logic (Subqueries & Case)](#complex-logic-subqueries--case)
- [DDL & Schema Generation (Zod 4)](#ddl--schema-generation-zod-4)
- [API Reference](#api-reference)
- [Testing](#testing)

## WARNING

You must read documentation of your SQLite database and check out which parameters are effective and allowed by the version of SQLite your DataBase is using.

**`QueryBuilder` is only a tool to write SQLite request; it will not execute the request.**

## Features

- **Fluent API**: Method chaining for readable query construction.
- **Safe Parameter Injection**: Automatically generates named parameters (e.g., `@id`) to prevent SQL injection.
- **Join Support**: `INNER`, `LEFT`, and `RIGHT` joins with alias support.
- **Subqueries & Exists**: Helpers for `EXISTS` and `NOT EXISTS` conditions.
- **Logic Blocks**: Declarative `CASE WHEN` support.
- **Schema & CRUD**: Helpers to generate DDL (`CREATE TABLE`) and standard CRUD queries from **Zod V4** schemas.

## Getting Started

Import the builder from the package. It is a **Pure ESM** package.

```typescript
// Standard version (with full JSDoc support)
import { QueryBuilder } from "@ytn/qb";

// Minified version (optimized for production)
import { QueryBuilder } from "@ytn/qb/min";
```

### Basic Selection

```typescript
// SELECT id, name FROM users WHERE id = @id
const sql = QueryBuilder.table("users")
  .select(["id", "name"])
  .where(["id"])
  .build();

// db.prepare(sql).get({ id: 123 });
```

### Joins (Inner, Left, Right)

`QueryBuilder` supports three explicit join methods. Each method can take either a **Table Name** or another **QueryBuilder Instance** (for subquery joins).

#### Standard Table Joins

Provide the table name (with optional alias) and the `ON` condition.

```typescript
// SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id
const sql = QueryBuilder.table("users", "u")
  .select(["u.name", "p.title"])
  .joinInner("posts p", "u.id = p.user_id") // p as an alias of posts
  .build();
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

const sql = QueryBuilder.table("tools", "t")
  .select(["t.name", "latest.version"])
  .joinLeft(latestVersion, "latest", "t.uuid = latest.tool_uuid")
  .build();
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
  .build();
```

### Updating Data

Combine `.update()` (fields to set) with `.where()` (conditions). All advanced `WHERE` filters (like `.whereIn()`) are supported.

```typescript
// UPDATE tools SET name = @name WHERE uuid = @uuid AND status IN ('draft', 'pending')
const sql = QueryBuilder.table("tools")
  .update(["name"])
  .where(["uuid"])
  .whereIn("status", ["draft", "pending"])
  .build();
```

### Deleting Data

```typescript
// DELETE FROM logs WHERE created_at < @threshold
const sql = QueryBuilder.table("logs")
  .delete()
  .where([{ col: "created_at", param: "threshold" }])
  .build();
```

### RETURNING Clause

SQLite 3.35+ supports returning modified rows immediately. This works with `INSERT`, `UPDATE`, `DELETE`, and `UPSERT`.

```typescript
// INSERT INTO users (name) VALUES (@name) RETURNING id, created_at
const sql = QueryBuilder.table("users")
  .insert(["name"])
  .returning(["id", "created_at"])
  .build();
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
  .build();

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
  .build();
```

### Text Search

Helper for `LIKE` queries combined with strict filters.

```typescript
// SELECT * FROM docs WHERE (title LIKE ? OR content LIKE ?) AND type = @type
const sql = QueryBuilder.table("docs")
  .search(["title", "content"], ["type"])
  .build();

// Usage: db.prepare(sql).all('%term%', '%term%', { type: 'md' });
```

### Complex Logic (Subqueries & Case)

The `QueryBuilder` supports advanced SQL constructs like nested subqueries and conditional logic block while maintaining a fluent interface.

#### Existence Predicates (EXISTS)

The `.asExists()` and `.asNotExists()` methods are **terminators** (like `.build()`). They compile the builder into a string fragment suitable for use as a boolean condition.

- **Purpose**: To check for row existence in a related table without the overhead of counting rows or fetching full records.
- **Usage**: Typically passed into `.whereRaw()` or used inside `.selectCase()`.
- **Performance**: In SQL, `EXISTS` is highly efficient because the query engine stops searching as soon as it finds the first matching row.

```typescript
// Checking if a user has at least one order
const hasOrders = QueryBuilder.table("orders", "o") // "o" is an alias for orders
  .whereColumn("o.user_id", "u.id") // "u" is the alias of the outer query
  .asExists();

const sql = QueryBuilder.table("users", "u") // Define "u" as the alias for users
  .select(["name"])
  .whereRaw(hasOrders) // WhereRaw used here because asExists is already compiled
  .build();
// Result: SELECT name FROM users u WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)
```

#### Declarative CASE Statements

The `.selectCase()` method allows building complex conditional columns without string concatenation.

```typescript
const sql = QueryBuilder.table("tools", "t")
  .select(["name"])
  .selectCase(
    "status",
    [
      {
        when: QueryBuilder.table("prompt_tools", "pt")
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
  .build();
```

#### Fine-Grained Filtering (Raw & Literals)

Use these methods when you need to compare columns between tables or inject specific SQL literals without parameter binding.

In this example, we build a **correlated subquery** where the inner table `tool_versions` (aliased as `tv`) is filtered by a column from the outer table `tools` (aliased as `t`):

```typescript
// Subquery for correlated filtering (NOT compiled yet)
const recentVersion = QueryBuilder.table("tool_versions", "tv")
  .whereColumn("tv.tool_uuid", "t.uuid") // Links "tv" to outer alias "t"
  .whereLiteral("tv.version", "'1.0.0'") // String literal (no @ binding)
  .limit(1);

// Parent query using the subquery
const sql = QueryBuilder.table("tools", "t") // Outer alias "t" defined here
  .whereIn("uuid", recentVersion)
  .build();
```

#### WHERE IN (Values and Subqueries)

Support for filtering against a list of literal values or the result of a subquery.

When using a subquery, pass the `Builder` instance directly (without calling `.build()`). The inner query is compiled automatically during the parent's `build()` process.

```typescript
// Filtering with a list of values
const sqlValues = QueryBuilder.table("tools")
  .whereIn("uuid", ["value1", "value2"])
  .build();

// Filtering with a subquery (Subquery relation)
// We select 'uuid' from 'tool_versions' to filter the main 'tools' table.
const sub = QueryBuilder.table("tool_versions").select(["uuid"]).limit(5);

// PASS the 'sub' builder instance directly without calling .build()
const sqlSub = QueryBuilder.table("tools").whereIn("uuid", sub).build();
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
  .build();
```

---

### DDL & Schema Generation (Zod 4)

`QueryBuilder` can generate `CREATE TABLE` statements directly from Zod schemas. It uses the **Zod 4 Metadata system** (`.meta()`) to define database-specific constraints.

#### Defining Constraints with `.meta()`

```typescript
import { z } from "zod";
import { QueryBuilder } from "@ytn/qb";

const UserSchema = z.object({
  id: z.string().uuid().meta({ pk: true }), // Primary Key
  email: z.string().email().meta({ unique: true }), // Unique
  role: z.string().meta({ defaultValue: "'user'" }), // Default
  created_at: z.date().optional(), // Map to NULLABLE
});

// Generate DDL
const ddl = QueryBuilder.createTableFromZod("users", UserSchema);
// Result: CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, role TEXT DEFAULT 'user', created_at DATETIME)
```

##### Supported Metadata Keys

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

You can define foreign keys directly in the metadata:

```typescript
const PostSchema = z.object({
  id: z.number().int().meta({ pkauto: true }),
  user_id: z
    .string()
    .uuid()
    .meta({
      fk: {
        table: "users",
        col: "id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
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

## API Reference

### Initialization

- `QueryBuilder.table(name: string, alias?: string)`: Start a new query.
- `QueryBuilder.pragma()`: Returns a `PragmaBuilder` for SQLite configuration.
- `QueryBuilder.enableForeignKeys()`: Shortcut for `PRAGMA foreign_keys = ON;`.

### Methods

#### Query Modes

- `.select(fields?: string[])`: Select specific columns (default `*`).
- `.insert(fields: string[])`: Insert rows into the table.
- `.update(fields: string[])`: Update existing rows.
- `.delete()`: Delete rows from the table.
- `.upsert(fields, conflictTargets)`: INSERT or UPDATE on conflict.
- `.count()`: Specialized mode for `SELECT COUNT(*)`.

#### Field Definitions

- `.selectCase(alias, branches, elseVal)`: Adds a conditional `CASE WHEN` column.
- `.selectRaw(sql)`: Injects a raw SQL expression as a column.
- `.selectWindow(alias, def)`: Defines a window function (e.g. `ROW_NUMBER()`).
- `.returning(fields)`: Adds a `RETURNING` clause (for DML operations).

#### Filtering (WHERE)

- `.where(fields)`: Add `AND field = @field` (uses parameter binding).
- `.whereIn(col, valuesOrSubQuery)`: Add `AND col IN (...)` (supports arrays or QueryBuilders).
- `.whereColumn(col1, col2)`: Compares two columns directly (no params).
- `.whereLiteral(col, val)`: Compares a column to a fixed literal (no params).
- `.whereRaw(sql)`: Adds a raw SQL filtering condition.

#### Joins

- `.joinInner(target, on)`: `INNER JOIN` (Table or SubQuery).
- `.joinLeft(target, on)`: `LEFT JOIN` (Table or SubQuery).
- `.joinRight(target, on)`: `RIGHT JOIN` (Table or SubQuery).

#### Modifiers

- `.orderBy(field, dir?)`: Adds an `ORDER BY` clause.
- `.groupBy(fields)`: Adds a `GROUP BY` clause.
- `.limit(n)`: Limits the number of returned rows.
- `.offset(n)`: Skips the first N rows.

#### Compilation & Wrappers

- `.asExists()`: Wraps and compiles the entire query in an `EXISTS (...)` block.
- `.asNotExists()`: Wraps and compiles the entire query in a `NOT EXISTS (...)` block.
- `.build()`: Compiles the builder into a final SQL string.

### Static Helpers

- `createTableFromZod(tableName, schema, options)`: Generates `CREATE TABLE` DDL.
  - **Compatibility**: Strictly designed for **Zod v4** (using official `.meta()` API).
- `generateCRUD(tableName, schema)`: Returns an object with standard `getAll`, `getById`, `insert`, etc.

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

Or use the provided batch file for detailed console output:

```bash
run_tests.bat
```

### Build & Development

The project uses `tsup` for bundling.

- **Build**: `npm run build` (generates `dist/`)
- **Watch**: `npm run dev`

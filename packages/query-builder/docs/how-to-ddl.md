# How-to: DDL & Schema Generation — @ytrynot/qb

> **How-to guide** — Knows the basics, wants to define tables and generate DDL.
>
> Prerequisites: `@ytrynot/qb` installed. For schema introspection, install `zod` (v4) and/or `@ytrynot/dna`.

This guide covers the three ways to define a table and generate `CREATE TABLE` DDL with `@ytrynot/qb`: from a **Zod v4** schema, from a **@ytrynot/dna** schema, and from **manual column definitions**. It also covers metadata keys, foreign keys, unique keys, composite primary keys, and index management.

All three paths produce identical SQL when given equivalent schemas.

## Table of Contents

- [Entry points](#entry-points)
- [Define a table from a Zod v4 schema](#define-a-table-from-a-zod-v4-schema)
- [Define a table from a DNA schema](#define-a-table-from-a-dna-schema)
- [Define a table from manual columns](#define-a-table-from-manual-columns)
- [Generate only the DDL string](#generate-only-the-ddl-string)
- [Use the auto-generated CRUD set](#use-the-auto-generated-crud-set)
- [Supported metadata keys](#supported-metadata-keys)
- [Foreign keys](#foreign-keys)
- [Unique keys & upsert](#unique-keys--upsert)
- [Composite primary key](#composite-primary-key)
- [Table-level constraints](#table-level-constraints)
- [Index management](#index-management)
- [Drop a table](#drop-a-table)
- [Where to go next](#where-to-go-next)

## Entry points

`@ytrynot/qb` provides three entry points for DDL:

| Method | Returns | Use when |
| :--- | :--- | :--- |
| `QueryBuilder.defTable(name, def, options?)` | `TableDef` | You want the full CRUD set + a `req` getter for custom queries. Accepts Zod, DNA, or manual `qbColumn[]`. |
| `QueryBuilder.reqCreateTable(name, def, options?)` | `string` | You want only the `CREATE TABLE` DDL string. Shortcut for `defTable(name, def).createTable`. |
| `QueryBuilder.createTable(name, columns, options?)` | `string` | You want DDL from manual `qbColumn[]` without a schema library. |

`defTable` automatically detects the schema type:
- `z.ZodTypeAny` → uses the Zod v4 introspector
- `DnaType` → uses the DNA introspector
- `qbColumn[]` → uses the columns directly (manual)

## Define a table from a Zod v4 schema

Database-specific constraints are declared through Zod v4's `.meta()` API on each field. The introspector reads the v4 `._zod` protocol (no v3 `_def` access) and maps Zod types to SQLite types.

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
console.log(ddl);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  age INTEGER NOT NULL,
  created_at DATETIME
);
```

### Zod type to SQLite type mapping

| Zod type | SQLite type |
| :--- | :--- |
| `z.string()` | `TEXT` |
| `z.number().int()` | `INTEGER` |
| `z.number()` | `REAL` |
| `z.boolean()` | `BOOLEAN` |
| `z.date()` | `DATETIME` |
| `z.instanceof(Uint8Array)` / binary | `BLOB` |

Optional fields (`z.string().optional()`, `z.date().optional()`) omit `NOT NULL`.

## Define a table from a DNA schema

`@ytrynot/dna` provides a Zod-like API with serializable, bytecode-based schemas. `defTable` and `reqCreateTable` accept DNA schemas through the same entry point. The same `.meta()` keys are supported.

```typescript
import { dna } from "@ytrynot/dna";
import { QueryBuilder } from "@ytrynot/qb";

const UserSchema = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  role: dna.string().meta({ defaultValue: "'user'" }),
  age: dna.int(),
  created_at: dna.date().optional(),
});

const ddl = QueryBuilder.reqCreateTable("users", UserSchema);
console.log(ddl);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  age INTEGER NOT NULL,
  created_at DATETIME
);
```

The DNA introspector uses the `@ytrynot/dna/introspect` public API (`isOptional`, `isObject`, `unwrap`, `unwrapDeep`, `defaultValue`) to produce the same neutral `qbColumn[]` as the Zod introspector. Both feed into the same DDL engine, so equivalent schemas produce identical SQL.

## Define a table from manual columns

When you do not have a Zod or DNA schema, pass a `qbColumn[]` array directly. Each `qbColumn` declares the column name, SQLite type, optionality, default, and constraints.

```typescript
import { QueryBuilder, type qbTable } from "@ytrynot/qb";

const columns: qbTable = [
  { name: "id", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { pk: true } },
  { name: "email", sqliteType: "TEXT", optional: false, hasDefault: false, unique: true, meta: {} },
  { name: "role", sqliteType: "TEXT", optional: false, hasDefault: true, defaultValue: "'user'", meta: {} },
  { name: "age", sqliteType: "INTEGER", optional: false, hasDefault: false, meta: {} },
  { name: "created_at", sqliteType: "DATETIME", optional: true, hasDefault: false, meta: {} },
];

const ddl = QueryBuilder.createTable("users", columns);
console.log(ddl);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  age INTEGER NOT NULL,
  created_at DATETIME
);
```

> [!IMPORTANT]
> For manual `qbColumn[]`, the `UNIQUE` constraint is read from the **top-level `unique` field** (`{ name: "email", unique: true, ... }`), not from `meta.unique`. The `meta` bag is reserved for schema-introspector metadata. The `pk` and `pkauto` keys are read from `meta` because they are the convention shared across all three schema sources.

### `qbColumn` fields

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | yes | Column name. |
| `sqliteType` | `tsSqliteType` | yes | SQLite type: `"TEXT"`, `"INTEGER"`, `"REAL"`, `"BOOLEAN"`, `"DATETIME"`, `"BLOB"`. |
| `optional` | `boolean` | yes | If `false`, `NOT NULL` is emitted (unless the column has a default). |
| `hasDefault` | `boolean` | yes | If `true`, the `DEFAULT` clause is emitted from `defaultValue`. |
| `defaultValue` | `unknown` | no | SQL literal for the `DEFAULT` clause (e.g. `"'user'"`, `"(CURRENT_TIMESTAMP)"`). |
| `unique` | `boolean` | no | If `true`, adds a `UNIQUE` constraint. |
| `pkauto` | `boolean` | no | If `true`, adds `PRIMARY KEY AUTOINCREMENT` (valid only for `INTEGER` columns in SQLite). |
| `fk` | `string \| IForeignKeyDefinition` | no | Foreign key reference. |
| `check` | `string` | no | Column-level CHECK constraint expression (e.g. `"age >= 0"`). |
| `meta` | `Record<string, unknown>` | yes | Metadata bag. For manual columns, set `meta: { pk: true }` to mark the primary key. |

## Generate only the DDL string

`reqCreateTable(name, def)` is a shortcut for `defTable(name, def).createTable` — it returns only the DDL string, without the rest of the CRUD set. It accepts the same three schema sources (Zod, DNA, manual `qbColumn[]`).

```typescript
const ddl = QueryBuilder.reqCreateTable("users", UserSchema);
// → "CREATE TABLE IF NOT EXISTS users (...);"
```

## Use the auto-generated CRUD set

`defTable(name, def)` returns a `TableDef` with pre-built SQL strings and a `req`/`q` getter for custom fluent queries:

```typescript
const users = QueryBuilder.defTable("users", UserSchema);

users.createTable;  // CREATE TABLE IF NOT EXISTS users (...)
users.getAll;       // SELECT * FROM users
users.getById;      // SELECT * FROM users WHERE id = @id
users.insert;       // INSERT INTO users (id, email, role, age, created_at) VALUES (@id, @email, @role, @age, @created_at)
users.update;       // UPDATE users SET email = @email, role = @role, age = @age, created_at = @created_at WHERE id = @id
users.delete;       // DELETE FROM users WHERE id = @id
users.upsert;       // INSERT INTO users (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...

// Custom fluent queries via .req (or .q alias)
users.req.select("id", "name").where("id").toSQL();
// SELECT id, name FROM users WHERE id = @id
```

The `req` getter returns a fresh `Builder` pre-configured with the table name and all unique keys detected from the schema (columns with `meta.pk`, `meta.unique`, or `pkauto`). This lets `.upsert()` auto-deduce its conflict targets.

## Supported metadata keys

The `.meta()` API (Zod v4 and DNA) supports the following keys:

| Key | Type | Description |
| :--- | :--- | :--- |
| `pk` | `boolean` | If `true`, the column is marked as `PRIMARY KEY`. |
| `pkauto` | `boolean` | If `true`, adds `PRIMARY KEY AUTOINCREMENT`. In SQLite, valid only for `INTEGER` columns. |
| `fk` | `string \| object` | Defines a `FOREIGN KEY`. String `"table(col)"` or object `{ table, col, onDelete?, onUpdate? }`. |
| `unique` | `boolean` | If `true`, adds a `UNIQUE` constraint to the column. |
| `default` | `string` | Sets the SQL `DEFAULT` value (e.g. `"'active'"` or `"(CURRENT_TIMESTAMP)"`). |
| `defaultValue` | `any` | Alias for `default`. |

### Why `.meta()`?

`@ytrynot/qb` uses the official Zod v4 `.meta()` API for defining database constraints. This approach is preferred over legacy patterns because it ensures compatibility with Zod's internal global registry and keeps metadata values matched against the intended schema.

## Foreign keys

You can define foreign keys directly in the metadata. Both Zod v4 and DNA support the same `fk` shape.

```typescript
// Zod v4
const PostSchema = z.object({
  id: z.number().int().meta({ pkauto: true }),
  user_id: z.string().uuid().meta({
    fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
  }),
});

const ddl = QueryBuilder.reqCreateTable("posts", PostSchema);
console.log(ddl);
```

Output (verified):

```
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
```

```typescript
// DNA — same metadata keys
const PostSchemaDna = dna.object({
  id: dna.number().int().meta({ pkauto: true }),
  user_id: dna.string().uuid().meta({
    fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
  }),
});
```

The `fk` value can be a string `"table(col)"` (shorthand, no actions) or an object `{ table, col, onDelete?, onUpdate? }` (full control).

> [!CAUTION]
> **SQLite enforcement**: SQLite does **not** enforce foreign key constraints by default. Run `PRAGMA foreign_keys = ON;` when opening your connection:
>
> ```typescript
> const sql = QueryBuilder.enableForeignKeys();
> // → "PRAGMA foreign_keys = ON;"
> ```
>
> Without this, the database ignores FK constraints and allows orphaned rows.

### Foreign key integrity actions

| Action | Description |
| :--- | :--- |
| **`CASCADE`** | If a parent row is deleted or updated, all related child rows are automatically deleted or updated. Ideal for strictly owned relationships (a post and its comments). |
| **`SET NULL`** | If a parent is deleted, the child's reference is set to `NULL`. Use when the child can exist without the parent (requires the column to be nullable). |
| **`SET DEFAULT`** | If a parent is deleted, the child's reference is set to its `DEFAULT` value (the column must have a default). |
| **`RESTRICT`** | Prevents modification or deletion of the parent as long as children exist. Enforcement is immediate. |
| **`NO ACTION`** | Similar to `RESTRICT`, but the check may be deferred until the end of the transaction in some databases. Use `RESTRICT` for immediate failure. |

## Unique keys & upsert

`upsert()` requires unique keys (conflict targets). They can be provided in three ways:

```typescript
// 1. Auto-deduced from defTable (schema metadata: pk, unique, pkauto)
const users = QueryBuilder.defTable("users", UserSchema);
users.req.upsert("email", "name").toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name)
// ON CONFLICT(id, email) DO UPDATE SET name = @name

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
// INSERT INTO users (email, name) VALUES (@email, @name) ON CONFLICT(email) DO UPDATE SET name = excluded.name
```

See [How-to: Queries](./how-to-queries.md) for the full UPSERT and ON CONFLICT coverage.

## Composite primary key

Pass `primaryKey: string[]` in the `options` argument to `defTable` or `createTable` for a composite primary key. The PK is emitted as a table-level `PRIMARY KEY (col1, col2)` clause.

```typescript
const members = QueryBuilder.defTable("members", memberColumns, {
  primaryKey: ["tenant_id", "user_id"],
});
members.getById;
// SELECT * FROM members WHERE tenant_id = @tenant_id AND user_id = @user_id
```

Without this option, only the first column with `meta.pk: true` is used as the PK for the pre-built queries (`getById`, `update`, `delete`, `upsert`).

## Table-level constraints

Pass table-level constraints through the `options` argument (`qbTableOptions`):

| Option | Type | Description |
| :--- | :--- | :--- |
| `primaryKey` | `string \| string[]` | Override the primary key. Use an array for composite PK. |
| `foreignKeys` | `Record<string, string \| IForeignKeyDefinition>` | Map of column to FK definition. |
| `defaults` | `Record<string, string>` | Map of column to SQL default value. |
| `unique` | `string[]` | List of columns with a single-column UNIQUE constraint. |
| `uniqueConstraints` | `IUniqueConstraint[]` | Composite UNIQUE constraints: `{ columns: string[], name?: string }`. |
| `checks` | `string[]` | Table-level CHECK constraints (e.g. `["age >= 18", "status IN ('active', 'inactive')"]`). |

## Index management

Create indexes with `.createIndex(name, columns, options?)` on a `Builder` instance. Drop indexes with `QueryBuilder.dropIndex(name)`.

```typescript
// Basic index
const idx = QueryBuilder.table("users").createIndex("idx_users_email", ["email"]).toSQL();
console.log(idx);
// CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)

// Partial index (WHERE clause)
const partialIdx = QueryBuilder.table("users")
  .createIndex("idx_active_users", ["email"], { where: "is_active = 1" })
  .toSQL();
console.log(partialIdx);
// CREATE INDEX IF NOT EXISTS idx_active_users ON users(email) WHERE is_active = 1

// Expression index
const exprIdx = QueryBuilder.table("users")
  .createIndex("idx_users_name_lower", ["LOWER(name)"])
  .toSQL();
// CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(name))

// Drop an index
QueryBuilder.dropIndex("idx_users_email");
// DROP INDEX IF EXISTS idx_users_email;
```

## Drop a table

```typescript
const dropSql = QueryBuilder.dropTable("users");
console.log(dropSql);
// DROP TABLE IF EXISTS users;
```

## Where to go next

- **[How-to: Queries](./how-to-queries.md)** — SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE variants, JOINs, ordering, limits, cloning, text search.
- **[How-to: Advanced patterns](./how-to-advanced.md)** — EXISTS, CASE WHEN, correlated subqueries, window functions, PragmaBuilder.
- **[Quick start](./quick-start.md)** — end-to-end tutorial from install to execution.
- **[Feature reference](./feature-reference.md)** — complete method-by-method inventory, type system, SQLite version matrix.
- **[README](../README.md)** — overview, installation, feature list.

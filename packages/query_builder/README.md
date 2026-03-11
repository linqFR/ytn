# Fluent Query Builder Documentation

The `QueryBuilder` is a lightweight, database-agnostic SQL string generator designed to create secure, localized, and predictable SQL queries compatible with `better-sqlite3`.

It adheres to the **"No Magic"** principle: it generates SQL strings and named parameters but does not execute them.

## 🚀 Features

- **Fluent API**: Method chaining for readable query construction.
- **Safe Parameter Injection**: Automatically generates named parameters (e.g., `@id`) to prevent SQL injection.
- **Join Support**: `INNER`, `LEFT`, and `RIGHT` joins with alias support.
- **Subqueries & Exists**: Helpers for `EXISTS` and `NOT EXISTS` conditions.
- **Logic Blocks**: Declarative `CASE WHEN` support.
- **Schema & CRUD**: Helpers to generate DDL (`CREATE TABLE`) and standard CRUD queries from Zod schemas.

Import the builder from the package. It is a **Pure ESM** package.

```typescript
// Standard version (with full JSDoc support)
import { QueryBuilder } from "@ytn/qb";

// Minified version (optimized for production)
import { QueryBuilder } from "@ytn/qb/min";
```

### 1. Basic Selection

```typescript
// SELECT id, name FROM users WHERE id = @id
const sql = QueryBuilder.table("users")
  .select(["id", "name"])
  .where(["id"])
  .build();

// db.prepare(sql).get({ id: 123 });
```

### 2. Joins (Inner, Left, Right)

`QueryBuilder` supports three explicit join methods. Each method can take either a **Table Name** or another **QueryBuilder Instance** (for subquery joins).

#### Standard Table Joins

Provide the table name (with optional alias) and the `ON` condition.

```typescript
// SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id
const sql = QueryBuilder.table("users", "u")
  .select(["u.name", "p.title"])
  .joinInner("posts p", "u.id = p.user_id")
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

- `.joinInner(target, on)`: Match in both tables.
- `.joinLeft(target, on)`: All rows from left table.
- `.joinRight(target, on)`: All rows from right table.

### 3. Inserting Data

Fields provided to `.insert()` are automatically mapped to `@field` placeholders.

```typescript
// INSERT INTO logs (level, message, timestamp) VALUES (@level, @message, @timestamp)
const sql = QueryBuilder.table("logs")
  .insert(["level", "message", "timestamp"])
  .build();
```

### 4. Updating Data

Combine `.update()` (fields to set) with `.where()` (conditions).

```typescript
// UPDATE tools SET name = @name, updated_at = @updated_at WHERE uuid = @uuid
const sql = QueryBuilder.table("tools")
  .update(["name", "updated_at"])
  .where(["uuid"])
  .build();
```

### 5. Ordering & Limits

```typescript
// SELECT * FROM events ORDER BY created_at DESC LIMIT 10
const sql = QueryBuilder.table("events")
  .select()
  .orderBy("created_at", "DESC")
  .limit(10)
  .build();
```

### 6. Text Search

Helper for `LIKE` queries combined with strict filters.

```typescript
// SELECT * FROM docs WHERE (title LIKE ? OR content LIKE ?) AND type = @type
const sql = QueryBuilder.table("docs")
  .search(["title", "content"], ["type"])
  .build();

// Usage: db.prepare(sql).all('%term%', '%term%', { type: 'md' });
```

### 7. Complex Logic (Subqueries & Case)

The `QueryBuilder` supports advanced SQL constructs like nested subqueries and conditional logic block while maintaining a fluent interface.

#### Existence Predicates (EXISTS)

The `.asExists()` and `.asNotExists()` methods are **terminators** (like `.build()`). They compile the builder into a string fragment suitable for use as a boolean condition.

- **Purpose**: To check for row existence in a related table without the overhead of counting rows or fetching full records.
- **Usage**: Typically passed into `.whereRaw()` or used inside `.selectCase()`.
- **Performance**: In SQL, `EXISTS` is highly efficient because the query engine stops searching as soon as it finds the first matching row.

```typescript
// Checking if a user has at least one order
const hasOrders = QueryBuilder.table("orders", "o")
  .whereColumn("o.user_id", "u.id")
  .asExists();

const sql = QueryBuilder.table("users", "u")
  .select(["name"])
  .whereRaw(hasOrders)
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

```typescript
const sql = QueryBuilder.table("tool_versions", "tv")
  .select()
  .whereColumn("tv.tool_uuid", "t.uuid") // No @ binding
  .whereLiteral("tv.version", "'1.0.0'") // String literal
  .build();
```

#### WHERE IN (Values and Subqueries)

Support for filtering against lists or subquery results.

```typescript
// WHERE id IN ('v1', 'v2')
const sqlValues = QueryBuilder.table("tools")
  .whereIn("uuid", ["v1", "v2"])
  .build();

// WHERE id IN (SELECT ...)
const sub = QueryBuilder.table("tool_versions").select(["uuid"]).limit(5);
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

### 8. DDL & Schema Generation (Zod 4)

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

#### Why `.meta()`?

`QueryBuilder` strictly uses the official Zod v4 `.meta()` API for defining database constraints. This approach is preferred over legacy patterns because:

- **Registry Integration**: Ensures compatibility with Zod's internal global registry.
- **Strong Typing**: Metadata values are matched against the intended schema.
- **Future-Proofing**: Direct access to `_def` is deprecated in Zod v4.

#### Foreign Keys

You can define foreign keys directly in the metadata:

```typescript
const PostSchema = z.object({
  id: z.number().int().meta({ pk: true }),
  user_id: z
    .string()
    .uuid()
    .meta({
      fk: { table: "users", col: "id", onDelete: "CASCADE" },
    }),
});
```

---

## 🛠 API Reference

### Initialization

- `QueryBuilder.table(name: string, alias?: string)`: Start a new query.

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

- `.asExists()`: Wraps the entire query in an `EXISTS (...)` block.
- `.asNotExists()`: Wraps the entire query in a `NOT EXISTS (...)` block.
- `.build()`: Compiles the builder into a final SQL string.

### Static Helpers

- `createTableFromZod(tableName, schema, options)`: Generates `CREATE TABLE` DDL.
  - **Compatibility**: Strictly designed for **Zod v4** (using official `.meta()` API).
- `generateCRUD(tableName, schema)`: Returns an object with standard `getAll`, `getById`, `insert`, etc.

## 🧪 Testing

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

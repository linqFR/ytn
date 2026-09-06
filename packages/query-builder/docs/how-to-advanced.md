# How-to: Advanced Patterns — @ytrynot/qb

> **How-to guide** — Wants advanced SQL patterns: EXISTS, CASE WHEN, correlated subqueries, window functions, and SQLite pragmas.
>
> Prerequisites: `@ytrynot/qb` installed. Familiarity with the fluent DML API (see [How-to: Queries](./how-to-queries.md)).

This guide covers SQL constructs that go beyond basic CRUD: existence predicates, declarative CASE statements, correlated subqueries, window functions, and database configuration via the PragmaBuilder.

## Table of Contents

- [Existence predicates (EXISTS)](#existence-predicates-exists)
- [Declarative CASE statements](#declarative-case-statements)
- [Correlated subqueries](#correlated-subqueries)
- [Window functions](#window-functions)
- [SQLite configuration (Pragmas)](#sqlite-configuration-pragmas)
- [Where to go next](#where-to-go-next)

## Existence predicates (EXISTS)

`.asExists()` and `.asNotExists()` are **terminators** — like `.toSQL()`, they compile the builder into a string fragment suitable for use as a boolean condition. They do not return a `Builder`; they return a string.

- **Purpose**: Check for row existence in a related table without counting rows or fetching full records.
- **Usage**: Pass the result into `.whereRaw()`, or use it inside `.selectCase()`.
- **Performance**: In SQL, `EXISTS` is efficient because the query engine stops searching as soon as it finds the first matching row.

```typescript
import { QueryBuilder } from "@ytrynot/qb";

// Build the EXISTS fragment
const hasOrders = QueryBuilder.table("orders")
  .as("o")
  .whereColumn("o.user_id", "u.id") // "u" is the alias of the outer query
  .asExists();

// Use it in the outer query
const sql = QueryBuilder.table("users")
  .as("u")
  .select(["name"])
  .whereRaw(hasOrders)
  .toSQL();

console.log(sql);
// SELECT name FROM users u WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)
```

`.asNotExists()` produces `NOT EXISTS (...)`:

```typescript
const noOrders = QueryBuilder.table("orders")
  .as("o")
  .whereColumn("o.user_id", "u.id")
  .asNotExists();
// → "NOT EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)"
```

## Declarative CASE statements

`.selectCase(alias, branches, else?)` builds a `CASE WHEN ... THEN ... [ELSE ...] END as alias` column without string concatenation. Each branch is an `ICaseBranch`: `{ when: string, then: string }`.

The `when` value can be a raw SQL string or the result of `.asExists()` / `.asNotExists()`. The `then` value is a SQL literal (quote string literals: `"'unused'"`).

```typescript
const hasPublishedPrompts =
  "EXISTS (SELECT * FROM prompts p WHERE p.tool_uuid = t.uuid AND p.status = 'published')";

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
        when: hasPublishedPrompts,
        then: "'locked'",
      },
    ],
    "'linked'", // optional ELSE value
  )
  .toSQL();

console.log(sql);
// SELECT name, CASE WHEN NOT EXISTS (SELECT * FROM prompt_tools pt WHERE pt.tool_uuid = t.uuid)
//   THEN 'unused' WHEN EXISTS (SELECT * FROM prompts p WHERE p.tool_uuid = t.uuid AND p.status = 'published')
//   THEN 'locked' ELSE 'linked' END as status FROM tools t
```

## Correlated subqueries

A correlated subquery references a column from the outer query. Build the inner query with `.whereColumn(innerCol, outerAlias.col)` to link the two, then pass the `Builder` instance (without `.toSQL()`) into `.whereIn()` on the outer query.

```typescript
// Inner subquery — references outer alias "t"
const recentVersion = QueryBuilder.table("tool_versions")
  .as("tv")
  .whereColumn("tv.tool_uuid", "t.uuid") // links "tv" to outer alias "t"
  .whereLiteral("tv.version", "'1.0.0'") // string literal (no @ binding)
  .limit(1);

// Outer query — defines alias "t"
const sql = QueryBuilder.table("tools")
  .as("t")
  .whereIn("uuid", recentVersion)
  .toSQL();

console.log(sql);
// SELECT * FROM tools t WHERE uuid IN (SELECT * FROM tool_versions tv WHERE tv.tool_uuid = t.uuid AND tv.version = '1.0.0' LIMIT 1)
```

The inner `Builder` is compiled automatically when the outer query calls `.toSQL()`. Do not call `.toSQL()` on the inner builder when passing it to `.whereIn()`.

## Window functions

`.selectWindow(alias, definition)` adds a window function expression (`OVER (...)`). The `IWindowDefinition` accepts a function call, optional `PARTITION BY`, optional `ORDER BY`, and an optional `frame` specification.

> [!NOTE]
> Window functions require SQLite 3.25+. Window frames (`ROWS BETWEEN ...`) are supported via the `frame` option.

```typescript
const sql = QueryBuilder.table("events")
  .select(["type"])
  .selectWindow("rn", {
    func: "ROW_NUMBER()",
    partitionBy: ["type"],
    orderBy: [{ field: "created_at", dir: "DESC" }],
  })
  .toSQL();

console.log(sql);
// SELECT type, ROW_NUMBER() OVER(PARTITION BY type ORDER BY created_at DESC) as rn FROM events
```

### Window frames (ROWS / RANGE / GROUPS BETWEEN)

Use the `frame` option to specify a window frame:

```typescript
const sql = QueryBuilder.table("sales")
  .select(["month", "amount"])
  .selectWindow("moving_avg", {
    func: "AVG(amount)",
    orderBy: [{ field: "month", dir: "ASC" }],
    frame: { type: "ROWS", start: "1 PRECEDING", end: "1 FOLLOWING" },
  })
  .toSQL();

console.log(sql);
// SELECT month, amount, AVG(amount) OVER(ORDER BY month ASC ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as moving_avg FROM sales
```

Supported frame types: `ROWS`, `RANGE`, `GROUPS`. Boundaries: `UNBOUNDED PRECEDING`, `CURRENT ROW`, `N PRECEDING`, `N FOLLOWING`, `UNBOUNDED FOLLOWING`. Optional `exclude`: `CURRENT ROW`, `GROUP`, `TIES`, `NO OTHERS`.

## SQLite configuration (Pragmas)

`QueryBuilder.pragma()` returns a `PragmaBuilder` — a fluent chain for SQLite `PRAGMA` statements. Each method adds a pragma; `.toSQL()` compiles all of them into a single script separated by newlines. Execute the script with your driver's `exec` method.

```typescript
const sql = QueryBuilder.pragma()
  .foreignKeys(true)
  .journalMode("WAL")
  .synchronous("NORMAL")
  .cacheSize(-32000) // 32MB cache (negative value = kilobytes)
  .toSQL();

console.log(sql);
// PRAGMA foreign_keys = ON;
// PRAGMA journal_mode = WAL;
// PRAGMA synchronous = NORMAL;
// PRAGMA cache_size = -32000;

// Execute with your driver
db.exec(sql);
```

### Supported PragmaBuilder methods

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `.foreignKeys(on)` | `boolean` | Enables or disables foreign key enforcement. |
| `.journalMode(mode)` | `'WAL' \| 'DELETE' \| ...` | Sets the journaling mode (`WAL` is recommended for performance). |
| `.synchronous(level)` | `'NORMAL' \| 'FULL' \| ...` | Controls disk sync safety vs speed. |
| `.cacheSize(size)` | `number` | Sets cache size. Negative = KB, positive = pages. |
| `.busyTimeout(ms)` | `number` | Time to wait (ms) when the database is locked before throwing. |
| `.mmap_size(bytes)` | `number` | Sets the memory-mapped I/O limit. |
| `.tempStore(loc)` | `'MEMORY' \| 'FILE'` | Where to store temporary tables and indices. |
| `.autoVacuum(mode)` | `'NONE' \| 'FULL' \| ...` | Sets the auto-vacuum strategy. |
| `.pageSize(bytes)` | `number` | Sets the database page size (512 to 65536). |
| `.optimize()` | _none_ | Runs SQLite query planner optimizations. |
| `.raw(key, value)` | `string, string \| number` | Injects any other custom SQLite `PRAGMA`. |

### Enable foreign keys (shortcut)

`QueryBuilder.enableForeignKeys()` returns the single statement `PRAGMA foreign_keys = ON;` — a shortcut for the most common pragma:

```typescript
const sql = QueryBuilder.enableForeignKeys();
console.log(sql);
// PRAGMA foreign_keys = ON;
```

> [!CAUTION]
> SQLite does **not** enforce foreign key constraints by default. Run `PRAGMA foreign_keys = ON;` when opening your connection, or foreign key actions (`CASCADE`, `RESTRICT`, etc.) defined in your schema will be ignored.

## Where to go next

- **[How-to: Queries](./how-to-queries.md)** — SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE variants, JOINs, ordering, limits, cloning, text search.
- **[How-to: DDL & schema generation](./how-to-ddl.md)** — `defTable`, Zod/DNA/manual schemas, metadata keys, foreign keys, indexes.
- **[Quick start](./quick-start.md)** — end-to-end tutorial from install to execution.
- **[Feature reference](./feature-reference.md)** — complete method-by-method inventory, type system, SQLite version matrix.
- **[README](../README.md)** — overview, installation, feature list.

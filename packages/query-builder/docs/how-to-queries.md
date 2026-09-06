# How-to: Queries — @ytrynot/qb

> **How-to guide** — Knows the basics, wants to build DML queries (SELECT, INSERT, UPDATE, DELETE, UPSERT).
>
> Prerequisites: `@ytrynot/qb` installed. No schema library required for the fluent DML API.

This guide covers building data-manipulation SQL strings with the fluent `Builder` chain. Every example terminates with `.toSQL()`, which compiles the chain into a SQL string with named parameters. Pass the string and a parameters object to your driver.

## Table of Contents

- [Start a query](#start-a-query)
- [SELECT](#select)
- [WHERE conditions](#where-conditions)
- [INSERT](#insert)
- [UPDATE](#update)
- [DELETE](#delete)
- [UPSERT & ON CONFLICT](#upsert--on-conflict)
- [RETURNING](#returning)
- [JOINs](#joins)
- [Ordering & limits](#ordering--limits)
- [GROUP BY & HAVING](#group-by--having)
- [DISTINCT](#distinct)
- [Text search](#text-search)
- [Cloning queries](#cloning-queries)
- [Table aliases](#table-aliases)
- [Compound SELECT (UNION)](#compound-select-union)
- [CTE (WITH)](#cte-with)
- [Raw escape hatches](#raw-escape-hatches)
- [INSERT OR (conflict resolution)](#insert-or-conflict-resolution)
- [UPDATE FROM](#update-from)
- [Subquery in SET (updateRaw)](#subquery-in-set-updateraw)
- [EXPLAIN](#explain)
- [Where to go next](#where-to-go-next)

## Start a query

`QueryBuilder.table(name)` starts a fluent DML chain. An optional second argument sets unique keys for upsert auto-deduction:

```typescript
import { QueryBuilder } from "@ytrynot/qb";

const builder = QueryBuilder.table("users");
// or with unique keys pre-configured
const builderWithKeys = QueryBuilder.table("users", ["email"]);
```

## SELECT

`.select(fields)` selects specific columns. `.select()` with no arguments selects `*`.

```typescript
const sql = QueryBuilder.table("users")
  .select(["id", "name"])
  .where(["id"])
  .toSQL();
console.log(sql);
// SELECT id, name FROM users WHERE id = @id
```

`.select()` also accepts variadic string arguments:

```typescript
QueryBuilder.table("users").select("id", "email", "age").toSQL();
// SELECT id, email, age FROM users
```

### COUNT

`.count()` produces `SELECT COUNT(*) as count`:

```typescript
const sql = QueryBuilder.table("users").where(["is_active"]).count().toSQL();
console.log(sql);
// SELECT COUNT(*) as count FROM users WHERE is_active = @is_active
```

### Raw SELECT expression

`.selectRaw(sql)` injects a raw SQL expression as a selected column:

```typescript
const sql = QueryBuilder.table("events")
  .select(["type"])
  .selectRaw("COUNT(*) as cnt")
  .groupBy(["type"])
  .toSQL();
console.log(sql);
// SELECT type, COUNT(*) as cnt FROM events GROUP BY type
```

## WHERE conditions

### Basic WHERE (column = @param)

`.where(fields)` produces `WHERE col = @col` for each field. The parameter name matches the column name:

```typescript
QueryBuilder.table("users").select().where(["id"]).toSQL();
// SELECT * FROM users WHERE id = @id
```

### WHERE with custom parameter name

Pass an object `{ col, param }` to map a column to a different parameter name:

```typescript
QueryBuilder.table("logs")
  .delete()
  .where([{ col: "created_at", param: "threshold" }])
  .toSQL();
// DELETE FROM logs WHERE created_at = @threshold
```

### WHERE column = column

`.whereColumn(col1, col2)` compares two columns (used in correlated subqueries and joins):

```typescript
QueryBuilder.table("orders")
  .as("o")
  .whereColumn("o.user_id", "u.id")
  .toSQL();
// SELECT * FROM orders o WHERE o.user_id = u.id
```

### WHERE literal value

`.whereLiteral(col, value)` injects a SQL literal without parameter binding:

```typescript
QueryBuilder.table("tool_versions")
  .as("tv")
  .whereLiteral("tv.version", "'1.0.0'")
  .toSQL();
// SELECT * FROM tool_versions tv WHERE tv.version = '1.0.0'
```

### WHERE IN (values)

`.whereIn(col, [...values])` filters against a list of literal values:

```typescript
QueryBuilder.table("tools").whereIn("uuid", ["value1", "value2"]).toSQL();
// SELECT * FROM tools WHERE uuid IN ('value1', 'value2')
```

### WHERE IN (subquery)

Pass a `Builder` instance (without calling `.toSQL()`) to filter against a subquery. The inner query is compiled automatically during the parent's `toSQL()`:

```typescript
const sub = QueryBuilder.table("tool_versions").select(["uuid"]).limit(5);
QueryBuilder.table("tools").whereIn("uuid", sub).toSQL();
// SELECT * FROM tools WHERE uuid IN (SELECT uuid FROM tool_versions LIMIT 5)
```

### WHERE raw SQL

`.whereRaw(condition)` injects a raw SQL condition string. Use this for `EXISTS` fragments and custom predicates:

```typescript
const hasOrders = QueryBuilder.table("orders")
  .as("o")
  .whereColumn("o.user_id", "u.id")
  .asExists();

QueryBuilder.table("users")
  .as("u")
  .select(["name"])
  .whereRaw(hasOrders)
  .toSQL();
// SELECT name FROM users u WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)
```

## INSERT

`.insert(fields)` maps each field to a `@field` placeholder:

```typescript
QueryBuilder.table("logs")
  .insert(["level", "message", "timestamp"])
  .toSQL();
// INSERT INTO logs (level, message, timestamp) VALUES (@level, @message, @timestamp)
```

### Multi-row INSERT

`.insertMulti(fields, rowCount)` produces indexed placeholders for multiple rows:

```typescript
QueryBuilder.table("logs")
  .insertMulti(["level", "message"], 3)
  .toSQL();
// INSERT INTO logs (level, message) VALUES (@level_0, @message_0), (@level_1, @message_1), (@level_2, @message_2)
```

### INSERT DEFAULT VALUES

```typescript
QueryBuilder.table("logs").insertDefaultValues().toSQL();
// INSERT INTO logs DEFAULT VALUES
```

## UPDATE

`.update(fields)` sets the listed columns. Combine with `.where()` for conditions. All WHERE variants (`.whereIn()`, `.whereRaw()`, etc.) are supported:

```typescript
QueryBuilder.table("tools")
  .update(["name"])
  .where(["uuid"])
  .whereIn("status", ["draft", "pending"])
  .toSQL();
// UPDATE tools SET name = @name WHERE uuid = @uuid AND status IN ('draft', 'pending')
```

## DELETE

```typescript
QueryBuilder.table("logs")
  .delete()
  .where(["id"])
  .toSQL();
// DELETE FROM logs WHERE id = @id
```

`.delete()` without `.where()` deletes all rows:

```typescript
QueryBuilder.table("logs").delete().toSQL();
// DELETE FROM logs
```

## UPSERT & ON CONFLICT

### Quick upsert with unique keys

`.upsert(fields)` produces `INSERT ... ON CONFLICT(uniqueKeys) DO UPDATE SET ...`. Unique keys (conflict targets) must be provided via `defTable`, `table(name, uniqueKeys)`, or `.uniqueKeys()`:

```typescript
QueryBuilder.table("users", ["email"]).upsert("email", "name").toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name) ON CONFLICT(email) DO UPDATE SET name = excluded.name
```

> **Note**: `excluded` is a special table in SQLite's upsert syntax that contains the values that would have been inserted. Using `excluded.field` references the new value from the INSERT, while the unqualified column name references the existing row value.

### ON CONFLICT sub-builder

For fine-grained control, use `.insert().onConflict(cols)`:

```typescript
// DO UPDATE
QueryBuilder.table("users", ["email"])
  .insert(["email", "name"])
  .onConflict("email")
  .doUpdate(["name"])
  .toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name) ON CONFLICT(email) DO UPDATE SET name = excluded.name

// DO NOTHING
QueryBuilder.table("users", ["email"])
  .insert(["email", "name"])
  .onConflict("email")
  .doNothing()
  .toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name) ON CONFLICT(email) DO NOTHING
```

The `OnConflictBuilder` supports:
- `.doNothing()` — `ON CONFLICT(cols) DO NOTHING`
- `.doUpdate(fields)` — `ON CONFLICT(cols) DO UPDATE SET field = excluded.field` for each field
- `.doUpdateRaw({ col: 'expr' })` — manual SET expressions: `col = expr`
- Partial index WHERE: `.onConflict(cols, { where: '...' })`
- WHERE on DO UPDATE: `.doUpdate(fields, where)` or `.doUpdateRaw(sets, where)`

See [How-to: DDL & schema generation](./how-to-ddl.md#unique-keys--upsert) for auto-deduction of unique keys from schema metadata.

## RETURNING

SQLite 3.35+ supports returning modified rows. `.returning(fields)` works with `INSERT`, `UPDATE`, `DELETE`, and `UPSERT`:

```typescript
QueryBuilder.table("users")
  .insert(["name"])
  .returning(["id", "created_at"])
  .toSQL();
// INSERT INTO users (name) VALUES (@name) RETURNING id, created_at
```

## JOINs

Three join methods are available: `.joinInner()`, `.joinLeft()`, `.joinRight()`. Each accepts either a table name (with optional alias) or a `Builder` instance (for subquery joins).

### Physical table joins

Provide the table name (with optional alias) and the `ON` condition:

```typescript
QueryBuilder.table("users")
  .as("u")
  .select(["u.name", "p.title"])
  .joinInner("posts p", "u.id = p.user_id")
  .toSQL();
// SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id
```

### Subquery joins

Provide a `Builder` instance, an alias for the result set, and the `ON` condition:

```typescript
const latestVersion = QueryBuilder.table("tool_versions")
  .select(["tool_uuid", "version"])
  .orderBy("created_at", "DESC")
  .limit(1);

QueryBuilder.table("tools")
  .as("t")
  .select(["t.name", "latest.version"])
  .joinLeft(latestVersion, "latest", "t.uuid = latest.tool_uuid")
  .toSQL();
// SELECT t.name, latest.version FROM tools t
// LEFT JOIN (SELECT tool_uuid, version FROM tool_versions ORDER BY created_at DESC LIMIT 1) latest
// ON t.uuid = latest.tool_uuid
```

### Join signatures

| Target | Signature |
| :--- | :--- |
| Physical table | `.joinInner(tableName, onCondition)` |
| Subquery builder | `.joinInner(subquery, alias, onCondition)` |

The same signature pattern applies to `.joinLeft()` and `.joinRight()`.

## Ordering & limits

```typescript
QueryBuilder.table("events")
  .select()
  .orderBy("created_at", "DESC")
  .limit(10)
  .toSQL();
// SELECT * FROM events ORDER BY created_at DESC LIMIT 10
```

`.offset(n)` adds an `OFFSET` clause for pagination:

```typescript
QueryBuilder.table("events")
  .select()
  .orderBy("created_at", "DESC")
  .limit(10)
  .offset(20)
  .toSQL();
// SELECT * FROM events ORDER BY created_at DESC LIMIT 10 OFFSET 20
```

## GROUP BY & HAVING

```typescript
QueryBuilder.table("events")
  .select(["type"])
  .selectRaw("COUNT(*) as cnt")
  .groupBy(["type"])
  .having("COUNT(*) > 5")
  .orderBy("type", "ASC")
  .toSQL();
// SELECT type, COUNT(*) as cnt FROM events GROUP BY type HAVING COUNT(*) > 5 ORDER BY type ASC
```

## DISTINCT

```typescript
QueryBuilder.table("events").select(["type"]).distinct().toSQL();
// SELECT DISTINCT type FROM events
```

## Text search

`.search(columnsToSearch, columnsToFilter)` searches a text pattern across `columnsToSearch` (via `LIKE @search_term`) and filters exact values on `columnsToFilter` (via `col = @col`):

```typescript
QueryBuilder.table("docs")
  .search(["title", "content"], ["type"])
  .toSQL();
// SELECT * FROM docs WHERE (title LIKE @search_term OR content LIKE @search_term) AND type = @type
```

The `@search_term` parameter receives the wildcard pattern (e.g. `'%term%'`), and `@type` receives the strict value.

## Cloning queries

`.clone()` creates an independent copy of the current builder. Use it to derive multiple queries (pagination + count) from a shared base without mutating the original:

```typescript
const baseQuery = QueryBuilder.table("users").where(["is_active"]);

const totalSql = baseQuery.clone().count().toSQL();
console.log(totalSql);
// SELECT COUNT(*) as count FROM users WHERE is_active = @is_active

const pageSql = baseQuery.clone().limit(10).offset(20).toSQL();
console.log(pageSql);
// SELECT * FROM users WHERE is_active = @is_active LIMIT 10 OFFSET 20
```

## Table aliases

`.as(alias)` sets a table alias:

```typescript
QueryBuilder.table("users").as("u").select("u.name").toSQL();
// SELECT u.name FROM users u
```

## Compound SELECT (UNION)

Combine multiple queries with `UNION`, `UNION ALL`, `INTERSECT`, or `EXCEPT`. Use instance methods or static factories:

```typescript
// Instance method
const sql = QueryBuilder.table("actions").select("id", "title")
  .unionAll(QueryBuilder.table("problems").select("id", "title"))
  .toSQL();
// SELECT id, title FROM actions
// UNION ALL
// SELECT id, title FROM problems

// Static factory (3+ queries)
const sql = QueryBuilder.unionAll(
  QueryBuilder.table("actions").select("id", "type").whereRaw("to_test = 1"),
  QueryBuilder.table("problems").select("id", "type").whereRaw("to_test = 1"),
  QueryBuilder.table("ideas").select("id", "type").whereRaw("to_test = 1"),
).orderBy("type", "ASC").limit(50).toSQL();
// SELECT id, type FROM actions WHERE to_test = 1
// UNION ALL
// SELECT id, type FROM problems WHERE to_test = 1
// UNION ALL
// SELECT id, type FROM ideas WHERE to_test = 1
// ORDER BY type ASC
// LIMIT 50
```

`orderBy`, `orderByRaw`, `limit`, and `offset` apply to the compound as a whole. Methods like `where()`, `joinInner()`, `insert()` throw on compound queries — build each sub-query before combining.

## CTE (WITH)

Add Common Table Expressions with `.with(name, query)` (non-recursive) or `.withRecursive(name, query)` (recursive):

```typescript
// Non-recursive CTE
const cte = QueryBuilder.table("users").select("id", "name").whereRaw("active = 1");
const sql = QueryBuilder.table("active_users")
  .with("active_users", cte)
  .select("*")
  .toSQL();
// WITH active_users AS (SELECT id, name FROM users WHERE active = 1)
// SELECT * FROM active_users

// Recursive CTE
const seed = QueryBuilder.table("nodes").select("id", "parent").whereRaw("parent IS NULL");
const recur = QueryBuilder.table("nodes n").select("n.id", "n.parent").joinInner("tree", "n.parent = tree.id");
const sql = QueryBuilder.table("tree")
  .withRecursive("tree", seed.unionAll(recur))
  .select("*")
  .toSQL();
// WITH RECURSIVE tree AS (SELECT id, parent FROM nodes WHERE parent IS NULL
// UNION ALL
// SELECT n.id, n.parent FROM nodes n INNER JOIN tree ON n.parent = tree.id)
// SELECT * FROM tree
```

Multiple CTEs can be chained. `WITH RECURSIVE` is emitted if any CTE uses `.withRecursive()`.

## Raw escape hatches

For expressions the fluent API can't express, use the raw methods:

- `.whereRaw(condition)` — injects into WHERE clause
- `.selectRaw(sql)` — injects as a selected column
- `.orderByRaw(expression)` — injects into ORDER BY (e.g. `CASE`, function calls)
- `.updateRaw({ col: 'expr' })` — injects into UPDATE SET (see below)

```typescript
const sql = QueryBuilder.table("actions")
  .select("id", "title")
  .orderByRaw("CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END, seq ASC")
  .toSQL();
// SELECT id, title FROM actions ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END, seq ASC
```

## INSERT OR (conflict resolution)

Use `.or(action)` after `.insert()` to generate `INSERT OR <action> INTO`:

```typescript
const sql = QueryBuilder.table("users")
  .insert("id", "name")
  .or("REPLACE")
  .toSQL();
// INSERT OR REPLACE INTO users (id, name) VALUES (@id, @name)

const sql2 = QueryBuilder.table("users")
  .insert("id", "name")
  .or("IGNORE")
  .toSQL();
// INSERT OR IGNORE INTO users (id, name) VALUES (@id, @name)
```

Supported actions: `ROLLBACK`, `ABORT`, `FAIL`, `IGNORE`, `REPLACE`. Works with `insert()`, `insertMulti()`, and `insertDefaultValues()`.

## UPDATE FROM

Add a `FROM` clause to an `UPDATE` statement (SQLite 3.33+):

```typescript
const sql = QueryBuilder.table("users")
  .update("status")
  .from("orders")
  .whereRaw("users.id = orders.user_id AND orders.total > 100")
  .toSQL();
// UPDATE users SET status = @status FROM orders WHERE users.id = orders.user_id AND orders.total > 100
```

## Subquery in SET (updateRaw)

Use `.updateRaw({ col: 'expr' })` for subqueries, arithmetic, or function calls in the SET clause:

```typescript
const sql = QueryBuilder.table("orders")
  .updateRaw({
    total: "(SELECT SUM(amount) FROM items WHERE items.order_id = orders.id)",
    updated_at: "CURRENT_TIMESTAMP",
  })
  .where(["id"])
  .toSQL();
// UPDATE orders SET total = (SELECT SUM(amount) FROM items WHERE items.order_id = orders.id), updated_at = CURRENT_TIMESTAMP WHERE id = @id
```

## EXPLAIN

Prefix a query with `EXPLAIN` or `EXPLAIN QUERY PLAN` for analysis:

```typescript
const sql = QueryBuilder.table("users").select("id", "name").where(["status"]).explain();
// EXPLAIN SELECT id, name FROM users WHERE status = @status

const sql2 = QueryBuilder.table("users").select("id").explainQueryPlan();
// EXPLAIN QUERY PLAN SELECT id FROM users
```

## Where to go next

- **[How-to: Advanced patterns](./how-to-advanced.md)** — EXISTS, CASE WHEN, correlated subqueries, window functions, window frames, PragmaBuilder.
- **[How-to: DDL & schema generation](./how-to-ddl.md)** — `defTable`, Zod/DNA/manual schemas, metadata keys, foreign keys, indexes, generated columns, triggers.
- **[Quick start](./quick-start.md)** — end-to-end tutorial from install to execution.
- **[Feature reference](./feature-reference.md)** — complete method-by-method inventory, type system, SQLite version matrix.
- **[README](../README.md)** — overview, installation, feature list.

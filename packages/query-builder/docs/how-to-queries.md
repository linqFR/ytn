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

`.search(searchFields, strictFields)` builds a `LIKE` query combined with strict equality filters:

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

## Where to go next

- **[How-to: Advanced patterns](./how-to-advanced.md)** — EXISTS, CASE WHEN, correlated subqueries, window functions, PragmaBuilder.
- **[How-to: DDL & schema generation](./how-to-ddl.md)** — `defTable`, Zod/DNA/manual schemas, metadata keys, foreign keys, indexes.
- **[Quick start](./quick-start.md)** — end-to-end tutorial from install to execution.
- **[Feature reference](./feature-reference.md)** — complete method-by-method inventory, type system, SQLite version matrix.
- **[README](../README.md)** — overview, installation, feature list.

# @ytrynot/qb — Feature Reference

> Authoritative inventory of what `@ytrynot/qb` supports.
> Update this file when features are added or changed.

---

## Package Identity

- **Name**: `@ytrynot/qb`
- **Path**: `packages/query-builder/`
- **Purpose**: Fluent SQLite query builder with Zod/DNA schema introspection
- **Philosophy**: Schema-first â†’ SQL derived. Strict TS 6.0. SQLite-first. Zero-dep. String builder (not a runtime).

---

## SQLite Version Requirements

qb does not validate the runtime SQLite version — consumers must ensure their
driver meets the minimum requirement for each feature they use.

| Feature | Min SQLite | Release date | qb API | Notes |
|---------|-----------|-------------|-------|-------|
| RETURNING (INSERT/UPDATE/DELETE) | 3.35.0 | 2021-03-12 | `.returning()` | Used without guard |
| UPSERT / ON CONFLICT | 3.24.0 | 2018-06-04 | `.onConflict()`, `.upsert()` | |
| RIGHT JOIN | 3.39.0 | 2022-06-25 | `.joinRight()` | Used without guard |
| Window functions | 3.25.0 | 2018-09-15 | `.selectWindow()` | Partial — no frames |

**Runtime notes**:
- `node:sqlite` (Node.js 22+) ships SQLite 3.46+ — all features available.
- `better-sqlite3` bundles its own SQLite — check the bundled version.
- Features marked "Used without guard" will produce runtime errors from the driver on older SQLite, not from qb.

---

## Entry Points (facade in `src/index.ts`)

| Method | Returns | Description |
|--------|---------|-------------|
| `qb.table(name, uniqueKeys?)` | `Builder` | Fluent DML chain (SELECT/INSERT/UPDATE/DELETE/UPSERT) |
| `qb.defTable(name, def, options?)` | `TableDef` | Table from any schema source. Returns `createTable`, `getAll`, `getById`, `insert`, `update`, `delete`, `upsert`, `req`, `q`, `cols`, `names` |
| `qb.reqCreateTable(name, def, options?)` | `string` | Shortcut for `defTable(name, def).createTable` |
| `qb.createTable(name, columns, options?)` | `string` | `CREATE TABLE` DDL from manual `qbColumn[]` |
| `qb.dropTable(name)` | `string` | `DROP TABLE IF EXISTS` |
| `qb.dropIndex(name)` | `string` | `DROP INDEX IF EXISTS` |
| `qb.pragma()` | `PragmaBuilder` | Fluent PRAGMA chain |
| `qb.enableForeignKeys()` | `string` | `PRAGMA foreign_keys = ON;` |

---

## Schema Sources (Introspection)

| Source | Introspector | Location |
|--------|-------------|----------|
| **Zod v4** | `ZodIntrospector` | `src/zod/introspector.ts` — uses `@ytrynot/shared/zod/zod-reflection.js` |
| **DNA** | `DnaIntrospector` | `src/dna/introspector.ts` — uses `@ytrynot/dna/introspect` public API |
| **Manual** | None | Direct `qbColumn[]` array |

All 3 produce identical DDL when given equivalent schemas (verified by e2e tests).

---

## TableDef — Runtime Metadata (`defTable` return)

`defTable()` returns a `TableDef` with pre-built SQL strings and runtime metadata for raw SQL construction.

### Pre-built SQL (strings, computed once)

| Field | Description |
|-------|-------------|
| `createTable` | `CREATE TABLE IF NOT EXISTS ...` DDL |
| `getAll` | `SELECT * FROM <table>` |
| `getById` | `SELECT * FROM <table> WHERE <pk> = @<pk>` |
| `insert` | `INSERT INTO <table> (...) VALUES (...)` |
| `update` | `UPDATE <table> SET ... WHERE <pk> = @<pk>` |
| `delete` | `DELETE FROM <table> WHERE <pk> = @<pk>` |
| `upsert` | `INSERT ... ON CONFLICT(<uniqueKeys>) DO UPDATE SET ...` |

### Runtime metadata (`names: ITableNames`)

All values are plain strings/booleans computed once at `defTable` time — no getters, no recompute.

| Field | Type | Description |
|-------|------|-------------|
| `names.table` | `string` | Table name |
| `names.col` | `Record<string, string>` | Column name lookup: `col.seq` â†’ `"seq"` |
| `names.pk` | `string \| string[]` | Primary key column name(s) |
| `names.isPk` | `Record<string, boolean>` | Per-column PK flag: `isPk.id` â†’ `true` |
| `names.isUnique` | `Record<string, boolean>` | Per-column unique flag: `isUnique.email` â†’ `true` |
| `names.readonly` | `string[]` | Readonly column names (PK, seq, timestamps, trigger-managed) |
| `names.updatable` | `string[]` | Non-readonly column names |

### Builder access

| Field | Type | Description |
|-------|------|-------------|
| `req` | `Builder` | Fresh builder pre-configured with table name + uniqueKeys (getter — new instance each access) |
| `q` | `Builder` | Alias for `req` |

### Readonly detection

| Source | Mechanism |
|--------|-----------|
| **Zod** | `.readonly()` â†’ `z.ZodReadonly` wrapper detected by introspector |
| **DNA** | `.readonly()` â†’ `meta.readonly = true` read by introspector |
| **Manual** | `qbColumn.readonly: true` direct field |

---

## DDL — CREATE TABLE (`src/ddl.ts`)

### Column-level features
| Feature | Support | How |
|---------|---------|-----|
| SQLite types (TEXT, INTEGER, REAL, BOOLEAN, DATETIME, BLOB) | âœ… | `qbColumn.sqliteType` |
| PRIMARY KEY | âœ… | `pk: true` (direct), `meta.pk` (Zod/DNA chain), or `pkauto` |
| AUTOINCREMENT | âœ… | `pkauto: true` â†’ `PRIMARY KEY AUTOINCREMENT` |
| NOT NULL | âœ… | Inferred from `optional: false`. Independent of `DEFAULT` — both can appear together. |
| UNIQUE (single column) | âœ… | `unique: true` or `options.unique` |
| DEFAULT | âœ… | `.default()` (Zod/DNA) or `defaultValue` (manual columns) or `options.defaults` |
| IF NOT EXISTS | âœ… | Always generated |
| Column-level CHECK | âœ… | `qbColumn.check: "expr"` |
| Readonly flag | âœ… | `qbColumn.readonly: true` (direct), `.readonly()` (Zod/DNA) â†’ propagates to `names.readonly` / `names.updatable` |
| COLLATE | âŒ | Out of scope (niche) |
| Generated columns (STORED/VIRTUAL) | âœ… | `qbColumn.generated: { expr, type }` |

### Table-level features
| Feature | Support | How |
|---------|---------|-----|
| Composite PRIMARY KEY | âœ… | `primaryKey: string[]` in options |
| Composite UNIQUE | âœ… | `options.uniqueConstraints: IUniqueConstraint[]` |
| Table-level CHECK | âœ… | `options.checks: string[]` |
| FOREIGN KEY | âœ… | `qbColumn.fk` or `options.foreignKeys` |
| FK ON DELETE (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION) | âœ… | `IForeignKeyDefinition.onDelete` |
| FK ON UPDATE (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION) | âœ… | `IForeignKeyDefinition.onUpdate` |
| WITHOUT ROWID | âŒ | Out of scope (niche) |
| STRICT tables | âŒ | Out of scope (complex + niche) |
| CREATE TEMP TABLE | âœ… | `options.temporary: true` â†’ `CREATE TEMP TABLE` |
| CREATE TABLE AS SELECT | âœ… | `qb.createTableAs(name, builder)` |

### DROP TABLE / DROP INDEX
- `DROP TABLE IF EXISTS` — `qb.dropTable(name)`
- `DROP INDEX IF EXISTS` — `qb.dropIndex(name)`

### Triggers
| Feature | Support | Method |
|---------|---------|--------|
| CREATE TRIGGER | âœ… | `qb.createTrigger(name, def)` — typed structure (timing, event, table, OF, WHEN, FOR EACH ROW), raw body |
| Timing (BEFORE/AFTER/INSTEAD OF) | âœ… | `def.timing` |
| Event (INSERT/UPDATE/DELETE) | âœ… | `def.event` |
| UPDATE OF columns | âœ… | `def.of: string[]` |
| WHEN clause | âœ… | `def.when: string` (raw SQL, NEW/OLD refs) |
| FOR EACH ROW | âœ… | `def.forEachRow` (default: true) |
| Multi-statement body | âœ… | `def.body: string` (raw SQL between BEGIN...END) |

---

## DML — SELECT (`src/builder.ts`)

| Feature | Support | Method |
|---------|---------|--------|
| Basic SELECT | âœ… | `.select(fields)` |
| SELECT * | âœ… | `.select()` (default) |
| SELECT COUNT(*) | âœ… | `.count()` |
| Table alias | âœ… | `.as(alias)` |
| JOIN (INNER, LEFT, RIGHT) | âœ… | `.joinInner()`, `.joinLeft()`, `.joinRight()` |
| Subquery JOIN | âœ… | Pass `Builder` as join target |
| WHERE (column = @param) | âœ… | `.where(fields)` |
| WHERE column = column | âœ… | `.whereColumn(col1, col2)` |
| WHERE literal value | âœ… | `.whereLiteral(col, value)` |
| WHERE IN (values) | âœ… | `.whereIn(col, [...])` |
| WHERE IN (subquery) | âœ… | `.whereIn(col, Builder)` |
| WHERE raw SQL | âœ… | `.whereRaw(condition)` |
| Search (LIKE) | âœ… | `.search(fields)` â†’ `LIKE @search_term` |
| EXISTS / NOT EXISTS | âœ… | `.asExists()`, `.asNotExists()` |
| GROUP BY | âœ… | `.groupBy(fields)` |
| HAVING | âœ… | `.having(conditions)` |
| ORDER BY | âœ… | `.orderBy(field, dir)` |
| ORDER BY (raw expression) | âœ… | `.orderByRaw(expression)` — `CASE`, function calls, mixed-direction |
| LIMIT / OFFSET | âœ… | `.limit(n)`, `.offset(n)` |
| DISTINCT | âœ… | `.distinct()` |
| CASE WHEN | âœ… | `.selectCase(alias, branches, else?)` |
| Window functions (OVER) | âœ… | `.selectWindow(alias, def)` |
| Window frames (ROWS/RANGE/GROUPS BETWEEN) | âœ… | `.selectWindow(alias, { frame: { type, start, end?, exclude? } })` |
| Raw SELECT expression | âœ… | `.selectRaw(sql)` |
| CTE (WITH) | âœ… | `.with(name, builderOrSql)` — non-recursive CTE prefix |
| CTE (WITH RECURSIVE) | âœ… | `.withRecursive(name, builderOrSql)` — recursive CTE prefix |
| Compound SELECT (UNION) | âœ… | `.union(other)`, `qb.union(...builders)` |
| Compound SELECT (UNION ALL) | âœ… | `.unionAll(other)`, `qb.unionAll(...builders)` |
| Compound SELECT (INTERSECT) | âœ… | `.intersect(other)`, `qb.intersect(...builders)` |
| Compound SELECT (EXCEPT) | âœ… | `.except(other)`, `qb.except(...builders)` |
| Window frames (ROWS BETWEEN) | âŒ | Out of scope (niche) |
| EXPLAIN | âœ… | `.explain()` â†’ `EXPLAIN SELECT ...` |
| EXPLAIN QUERY PLAN | âœ… | `.explainQueryPlan()` â†’ `EXPLAIN QUERY PLAN SELECT ...` |

---

## DML — INSERT

| Feature | Support | Method |
|---------|---------|--------|
| Single-row INSERT | âœ… | `.insert(fields)` â†’ `INSERT INTO t (cols) VALUES (@cols)` |
| Multi-row INSERT | âœ… | `.insertMulti(fields, rowCount)` â†’ `VALUES (@col_0, ...), (@col_1, ...)` |
| INSERT DEFAULT VALUES | âœ… | `.insertDefaultValues()` â†’ `INSERT INTO t DEFAULT VALUES` |
| INSERT OR ROLLBACK/ABORT/FAIL/IGNORE/REPLACE | âœ… | `.insert(...).or('REPLACE')` — conflict resolution |
| RETURNING | âœ… | `.returning(fields)` (SQLite 3.35+) |

---

## DML — UPSERT / ON CONFLICT

| Feature | Support | Method |
|---------|---------|--------|
| UPSERT (uniqueKeys-based) | âœ… | `.upsert(fields)` — requires `.uniqueKeys()` or `defTable()` pre-configured |
| ON CONFLICT sub-builder | âœ… | `.onConflict(cols).doNothing()/.doUpdate(fields)/.doUpdateRaw(sets)` |
| ON CONFLICT DO NOTHING | âœ… | `.onConflict(cols).doNothing()` |
| DO UPDATE SET (auto excluded.*) | âœ… | `.onConflict(cols).doUpdate(fields)` |
| DO UPDATE SET (manual expressions) | âœ… | `.onConflict(cols).doUpdateRaw({ col: 'expr' })` |
| Partial index WHERE on conflict target | âœ… | `.onConflict(cols, { where: '...' })` |
| WHERE on DO UPDATE | âœ… | `.doUpdate(fields, where)` or `.doUpdateRaw(sets, where)` |
| RETURNING on UPSERT | âœ… | `.returning()` works with onConflict |

---

## DML — UPDATE / DELETE

| Feature | Support | Method |
|---------|---------|--------|
| Basic UPDATE SET WHERE | âœ… | `.update(fields).where(conditions)` |
| Basic DELETE WHERE | âœ… | `.delete().where(conditions)` |
| DELETE without WHERE | âœ… | `.delete()` |
| RETURNING | âœ… | `.returning(fields)` |
| UPDATE FROM (SQLite 3.33+) | âœ… | `.update(fields).from(table).where(conditions)` |
| Subquery / raw expression in SET | âœ… | `.updateRaw({ col: 'expr' }).where(conditions)` |

---

## DDL — Indexes

| Feature | Support | Method |
|---------|---------|--------|
| CREATE INDEX | âœ… | `.createIndex(name, columns, options?)` |
| Partial index (WHERE) | âœ… | `.createIndex(name, cols, { where: '...' })` |
| Expression index | âœ… | `.createIndex(name, ['LOWER(name)'])` |
| DROP INDEX | âœ… | `qb.dropIndex(name)` |

---

## PRAGMA (`src/pragma.ts`)

| Feature | Support | Method |
|---------|---------|--------|
| PragmaBuilder | âœ… | `qb.pragma()` â†’ fluent chain, `.toSQL()` compiles all |
| enableForeignKeys | âœ… | `qb.enableForeignKeys()` |
| `foreignKeys(on?)` | âœ… | `PRAGMA foreign_keys = ON/OFF;` |
| `journalMode(mode)` | âœ… | `PRAGMA journal_mode = WAL/DELETE/MEMORY/TRUNCATE/PERSIST/OFF;` |
| `synchronous(level)` | âœ… | `PRAGMA synchronous = OFF/NORMAL/FULL/EXTRA;` |
| `cacheSize(size)` | âœ… | `PRAGMA cache_size = N;` (positive=pages, negative=KB) |
| `tempStore(location)` | âœ… | `PRAGMA temp_store = DEFAULT/FILE/MEMORY;` |
| `busyTimeout(ms)` | âœ… | `PRAGMA busy_timeout = N;` |
| `mmap_size(bytes)` | âœ… | `PRAGMA mmap_size = N;` |
| `pageSize(bytes)` | âœ… | `PRAGMA page_size = N;` (power of 2, 512—65536) |
| `autoVacuum(mode)` | âœ… | `PRAGMA auto_vacuum = NONE/FULL/INCREMENTAL;` |
| `optimize()` | âœ… | `PRAGMA optimize;` |
| `raw(key, value)` | âœ… | `PRAGMA key = value;` (arbitrary pragma) |

---

## Builder Utilities

| Method | Returns | Description |
|--------|---------|-------------|
| `.toSQL()` | `string` | Compiles builder state into SQL string |
| `.clone()` | `Builder` | Independent deep copy of current state |
| `.asExists()` | `string` | `EXISTS (this.toSQL())` |
| `.asNotExists()` | `string` | `NOT EXISTS (this.toSQL())` |
| `.buildUpsertStatement()` | — | Removed — use `.upsert()` or `.onConflict()` |
| `.uniqueKeys(...keys)` | `this` | Pre-set conflict targets for upsert auto-deduction |

---

## Type System (`src/types.ts`)

- `qbColumn` — column definition (name, sqliteType, optional, hasDefault, defaultValue, pk, pkauto, unique, fk, check, generated, meta)
- `qbTableOptions` — table-level options (primaryKey, foreignKeys, defaults, unique, uniqueConstraints, checks, temporary)
- `IForeignKeyDefinition` — `{ table, col, onDelete?, onUpdate? }` (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION)
- `IUniqueConstraint` — `{ columns: string[], name?: string }`
- `IOnConflictConfig` — `{ target, targetWhere?, action, updateFields?, updateRaw?, updateWhere? }`
- `tsSqliteType` — `"TEXT" | "INTEGER" | "REAL" | "BOOLEAN" | "DATETIME" | "BLOB"`
- `tsQueryMode` — `"SELECT" | "INSERT" | "INSERT_MULTI" | "INSERT_DEFAULT" | "UPDATE" | "DELETE" | "UPSERT" | "COUNT" | "CREATE_INDEX" | "COMPOUND"`
- `tsCompoundOp` — `"UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT"`
- `tsInsertOrAction` — `"ROLLBACK" | "ABORT" | "FAIL" | "IGNORE" | "REPLACE"`
- `tsWhereDefinition` — `string | { col: string, param: string }`
- `ICteDefinition` — `{ name: string, query: string }`
- `ITriggerDefinition` — `{ timing, event, of?, table, when?, body, forEachRow? }`
- `IJoinDefinition`, `IOrderByDefinition`, `IWhereInDefinition`, `IWindowDefinition`, `ICaseBranch`

---

## Testing

- **Framework**: Vitest 4 (pure ESM)
- **Total tests**: 410
- **Run**: `npm.cmd test -w @ytrynot/qb`
- **Typecheck**: `npm.cmd test -- --typecheck`

| Test file | Count | Coverage |
|-----------|-------|----------|
| `tests/builder.test.ts` | 135 | Core Builder API: SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE, JOINs, cloning, onConflict sub-builder, insertMulti, insertDefaultValues, having, distinct, DDL additions (composite UNIQUE, CHECK), INDEX partial WHERE + expression, dropIndex, runtime guards, PragmaBuilder full coverage, PK detection via `pk`/`meta.pk`/`pkauto`, NOT NULL + DEFAULT independence, direct properties without `meta`, `names` metadata (table, col, pk, isPk, isUnique, readonly, updatable) |
| `tests/readme-examples.test.ts` | 17 | README examples produce documented SQL |
| `tests/e2e-lifecycle.test.ts` | 48 | CRUD lifecycle across drivers + schema sources |
| `tests/e2e-ddl.test.ts` | 36 | DDL generation + execution + PRAGMA e2e (both drivers) |
| `tests/sqlite-integration.test.ts` | 15 | node:sqlite integration |
| `tests/zod-introspector.test.ts` | 19 | Zod introspector — PK detection, type mapping, metadata, readonly via `.readonly()` |
| `tests/dna-introspector.test.ts` | 19 | DNA introspector — PK detection, type mapping, metadata, readonly via `.readonly()` |
| `tests/zod-compliance.test.ts` | 11 | Zod unwrapping patterns |
| `tests/dna-compliance.test.ts` | 10 | DNA unwrapping patterns |
| `tests/query-construction.test.ts` | 4 | Basic queries + UPSERT |
| `tests/advanced-query.test.ts` | 4 | CASE, EXISTS, correlated subqueries |
| `tests/dist.test.ts` | 2 | Dist bundle operational |
| `tests/min.test.ts` | 2 | Minified bundle operational |
| `tests/bundle-smoke.test.ts` | 1 | Exports exist |
| `tests/compound-cte.test.ts` | 35 | Compound SELECT (UNION/UNION ALL/INTERSECT/EXCEPT), CTE (WITH/WITH RECURSIVE), guards, clone |
| `tests/advanced-features.test.ts` | 28 | Generated columns, TEMP tables, CREATE TABLE AS SELECT, EXPLAIN, INSERT OR, UPDATE FROM, subquery in SET |
| `tests/trigger.test.ts` | 13 | CREATE TRIGGER (BEFORE/AFTER/INSTEAD OF, UPDATE OF, WHEN, multi-statement body), TableDef.cols/name |
| `tests/window-frames.test.ts` | 11 | Window frames (ROWS/RANGE/GROUPS BETWEEN, EXCLUDE, offsets, backward compat) |

---

## Out of Scope (owner decision)

qb is a simple string builder for common SQLite operations. These features are **not** planned:

**Niche DDL optimizations**:
- **WITHOUT ROWID** — storage optimization, users can append manually to DDL
- **STRICT tables** — requires type mapping (`BOOLEAN â†’ INTEGER`, `DATETIME â†’ TEXT`), complex + niche
- **COLLATE on columns** — very niche (`NOCASE` is the only realistic use case)
- **CREATE/DROP VIEW** — users create views via migrations, not via qb

**Validation (out of scope for a string builder)**:
- SQL injection sanitizing — string builder design, documentation warnings suffice
- CHECK parentheses validation — SQLite validates at runtime
- FK SET DEFAULT without column default — no schema introspection

---

## Future Ideas (not prioritized)

- Schema-aware generics (`Builder<TTable, TColumns>`) — Phase 2
- Expression DSL for `excluded.*` validation
- ALTER TABLE (RENAME, ADD/DROP COLUMN)

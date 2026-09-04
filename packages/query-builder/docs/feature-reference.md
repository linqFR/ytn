# @ytrynot/qb — Feature Reference

> Authoritative inventory of what `@ytrynot/qb` supports.
> Update this file when features are added or changed.

---

## Package Identity

- **Name**: `@ytrynot/qb`
- **Path**: `packages/query-builder/`
- **Purpose**: Fluent SQLite query builder with Zod/DNA schema introspection
- **Philosophy**: Schema-first → SQL derived. Strict TS 6.0. SQLite-first. Zero-dep. String builder (not a runtime).

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
| `QueryBuilder.table(name, uniqueKeys?)` | `Builder` | Fluent DML chain (SELECT/INSERT/UPDATE/DELETE/UPSERT) |
| `QueryBuilder.defTable(name, def, options?)` | `TableDef` | Table from any schema source. Returns `createTable`, `getAll`, `getById`, `insert`, `update`, `delete`, `upsert`, `req`, `q` |
| `QueryBuilder.reqCreateTable(name, def, options?)` | `string` | Shortcut for `defTable(name, def).createTable` |
| `QueryBuilder.createTable(name, columns, options?)` | `string` | `CREATE TABLE` DDL from manual `qbColumn[]` |
| `QueryBuilder.dropTable(name)` | `string` | `DROP TABLE IF EXISTS` |
| `QueryBuilder.dropIndex(name)` | `string` | `DROP INDEX IF EXISTS` |
| `QueryBuilder.pragma()` | `PragmaBuilder` | Fluent PRAGMA chain |
| `QueryBuilder.enableForeignKeys()` | `string` | `PRAGMA foreign_keys = ON;` |

---

## Schema Sources (Introspection)

| Source | Introspector | Location |
|--------|-------------|----------|
| **Zod v4** | `ZodIntrospector` | `src/zod/introspector.ts` — uses `@ytrynot/shared/zod/zod-reflection.js` |
| **DNA** | `DnaIntrospector` | `src/dna/introspector.ts` — uses `@ytrynot/dna/introspect` public API |
| **Manual** | None | Direct `qbColumn[]` array |

All 3 produce identical DDL when given equivalent schemas (verified by e2e tests).

---

## DDL — CREATE TABLE (`src/ddl.ts`)

### Column-level features
| Feature | Support | How |
|---------|---------|-----|
| SQLite types (TEXT, INTEGER, REAL, BOOLEAN, DATETIME, BLOB) | ✅ | `qbColumn.sqliteType` |
| PRIMARY KEY | ✅ | `meta.pk` or `pkauto` |
| AUTOINCREMENT | ✅ | `pkauto: true` → `PRIMARY KEY AUTOINCREMENT` |
| NOT NULL | ✅ | Inferred from `optional: false` |
| UNIQUE (single column) | ✅ | `unique: true` or `options.unique` |
| DEFAULT | ✅ | `.default()` (Zod/DNA) or `defaultValue` (manual columns) or `options.defaults` |
| IF NOT EXISTS | ✅ | Always generated |
| Column-level CHECK | ✅ | `qbColumn.check: "expr"` |
| COLLATE | ❌ | Out of scope (niche) |
| Generated columns (STORED/VIRTUAL) | ✅ | `qbColumn.generated: { expr, type }` |

### Table-level features
| Feature | Support | How |
|---------|---------|-----|
| Composite PRIMARY KEY | ✅ | `primaryKey: string[]` in options |
| Composite UNIQUE | ✅ | `options.uniqueConstraints: IUniqueConstraint[]` |
| Table-level CHECK | ✅ | `options.checks: string[]` |
| FOREIGN KEY | ✅ | `qbColumn.fk` or `options.foreignKeys` |
| FK ON DELETE (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION) | ✅ | `IForeignKeyDefinition.onDelete` |
| FK ON UPDATE (CASCADE/SET NULL/SET DEFAULT/RESTRICT/NO ACTION) | ✅ | `IForeignKeyDefinition.onUpdate` |
| WITHOUT ROWID | ❌ | Out of scope (niche) |
| STRICT tables | ❌ | Out of scope (complex + niche) |
| CREATE TEMP TABLE | ✅ | `options.temporary: true` → `CREATE TEMP TABLE` |
| CREATE TABLE AS SELECT | ✅ | `QueryBuilder.createTableAs(name, builder)` |

### DROP TABLE / DROP INDEX
- `DROP TABLE IF EXISTS` — `QueryBuilder.dropTable(name)`
- `DROP INDEX IF EXISTS` — `QueryBuilder.dropIndex(name)`

### Triggers
| Feature | Support | Method |
|---------|---------|--------|
| CREATE TRIGGER | ✅ | `QueryBuilder.createTrigger(name, def)` — typed structure (timing, event, table, OF, WHEN, FOR EACH ROW), raw body |
| Timing (BEFORE/AFTER/INSTEAD OF) | ✅ | `def.timing` |
| Event (INSERT/UPDATE/DELETE) | ✅ | `def.event` |
| UPDATE OF columns | ✅ | `def.of: string[]` |
| WHEN clause | ✅ | `def.when: string` (raw SQL, NEW/OLD refs) |
| FOR EACH ROW | ✅ | `def.forEachRow` (default: true) |
| Multi-statement body | ✅ | `def.body: string` (raw SQL between BEGIN...END) |

---

## DML — SELECT (`src/builder.ts`)

| Feature | Support | Method |
|---------|---------|--------|
| Basic SELECT | ✅ | `.select(fields)` |
| SELECT * | ✅ | `.select()` (default) |
| SELECT COUNT(*) | ✅ | `.count()` |
| Table alias | ✅ | `.as(alias)` |
| JOIN (INNER, LEFT, RIGHT) | ✅ | `.joinInner()`, `.joinLeft()`, `.joinRight()` |
| Subquery JOIN | ✅ | Pass `Builder` as join target |
| WHERE (column = @param) | ✅ | `.where(fields)` |
| WHERE column = column | ✅ | `.whereColumn(col1, col2)` |
| WHERE literal value | ✅ | `.whereLiteral(col, value)` |
| WHERE IN (values) | ✅ | `.whereIn(col, [...])` |
| WHERE IN (subquery) | ✅ | `.whereIn(col, Builder)` |
| WHERE raw SQL | ✅ | `.whereRaw(condition)` |
| Search (LIKE) | ✅ | `.search(fields)` → `LIKE @search_term` |
| EXISTS / NOT EXISTS | ✅ | `.asExists()`, `.asNotExists()` |
| GROUP BY | ✅ | `.groupBy(fields)` |
| HAVING | ✅ | `.having(conditions)` |
| ORDER BY | ✅ | `.orderBy(field, dir)` |
| ORDER BY (raw expression) | ✅ | `.orderByRaw(expression)` — `CASE`, function calls, mixed-direction |
| LIMIT / OFFSET | ✅ | `.limit(n)`, `.offset(n)` |
| DISTINCT | ✅ | `.distinct()` |
| CASE WHEN | ✅ | `.selectCase(alias, branches, else?)` |
| Window functions (OVER) | ✅ | `.selectWindow(alias, def)` |
| Window frames (ROWS/RANGE/GROUPS BETWEEN) | ✅ | `.selectWindow(alias, { frame: { type, start, end?, exclude? } })` |
| Raw SELECT expression | ✅ | `.selectRaw(sql)` |
| CTE (WITH) | ✅ | `.with(name, builderOrSql)` — non-recursive CTE prefix |
| CTE (WITH RECURSIVE) | ✅ | `.withRecursive(name, builderOrSql)` — recursive CTE prefix |
| Compound SELECT (UNION) | ✅ | `.union(other)`, `QueryBuilder.union(...builders)` |
| Compound SELECT (UNION ALL) | ✅ | `.unionAll(other)`, `QueryBuilder.unionAll(...builders)` |
| Compound SELECT (INTERSECT) | ✅ | `.intersect(other)`, `QueryBuilder.intersect(...builders)` |
| Compound SELECT (EXCEPT) | ✅ | `.except(other)`, `QueryBuilder.except(...builders)` |
| Window frames (ROWS BETWEEN) | ❌ | Out of scope (niche) |
| EXPLAIN | ✅ | `.explain()` → `EXPLAIN SELECT ...` |
| EXPLAIN QUERY PLAN | ✅ | `.explainQueryPlan()` → `EXPLAIN QUERY PLAN SELECT ...` |

---

## DML — INSERT

| Feature | Support | Method |
|---------|---------|--------|
| Single-row INSERT | ✅ | `.insert(fields)` → `INSERT INTO t (cols) VALUES (@cols)` |
| Multi-row INSERT | ✅ | `.insertMulti(fields, rowCount)` → `VALUES (@col_0, ...), (@col_1, ...)` |
| INSERT DEFAULT VALUES | ✅ | `.insertDefaultValues()` → `INSERT INTO t DEFAULT VALUES` |
| INSERT OR ROLLBACK/ABORT/FAIL/IGNORE/REPLACE | ✅ | `.insert(...).or('REPLACE')` — conflict resolution |
| RETURNING | ✅ | `.returning(fields)` (SQLite 3.35+) |

---

## DML — UPSERT / ON CONFLICT

| Feature | Support | Method |
|---------|---------|--------|
| UPSERT (uniqueKeys-based) | ✅ | `.upsert(fields)` — requires `.uniqueKeys()` or `defTable()` pre-configured |
| ON CONFLICT sub-builder | ✅ | `.onConflict(cols).doNothing()/.doUpdate(fields)/.doUpdateRaw(sets)` |
| ON CONFLICT DO NOTHING | ✅ | `.onConflict(cols).doNothing()` |
| DO UPDATE SET (auto excluded.*) | ✅ | `.onConflict(cols).doUpdate(fields)` |
| DO UPDATE SET (manual expressions) | ✅ | `.onConflict(cols).doUpdateRaw({ col: 'expr' })` |
| Partial index WHERE on conflict target | ✅ | `.onConflict(cols, { where: '...' })` |
| WHERE on DO UPDATE | ✅ | `.doUpdate(fields, where)` or `.doUpdateRaw(sets, where)` |
| RETURNING on UPSERT | ✅ | `.returning()` works with onConflict |

---

## DML — UPDATE / DELETE

| Feature | Support | Method |
|---------|---------|--------|
| Basic UPDATE SET WHERE | ✅ | `.update(fields).where(conditions)` |
| Basic DELETE WHERE | ✅ | `.delete().where(conditions)` |
| DELETE without WHERE | ✅ | `.delete()` |
| RETURNING | ✅ | `.returning(fields)` |
| UPDATE FROM (SQLite 3.33+) | ✅ | `.update(fields).from(table).where(conditions)` |
| Subquery / raw expression in SET | ✅ | `.updateRaw({ col: 'expr' }).where(conditions)` |

---

## DDL — Indexes

| Feature | Support | Method |
|---------|---------|--------|
| CREATE INDEX | ✅ | `.createIndex(name, columns, options?)` |
| Partial index (WHERE) | ✅ | `.createIndex(name, cols, { where: '...' })` |
| Expression index | ✅ | `.createIndex(name, ['LOWER(name)'])` |
| DROP INDEX | ✅ | `QueryBuilder.dropIndex(name)` |

---

## PRAGMA (`src/pragma.ts`)

| Feature | Support | Method |
|---------|---------|--------|
| PragmaBuilder | ✅ | `QueryBuilder.pragma()` → fluent chain, `.toSQL()` compiles all |
| enableForeignKeys | ✅ | `QueryBuilder.enableForeignKeys()` |
| `foreignKeys(on?)` | ✅ | `PRAGMA foreign_keys = ON/OFF;` |
| `journalMode(mode)` | ✅ | `PRAGMA journal_mode = WAL/DELETE/MEMORY/TRUNCATE/PERSIST/OFF;` |
| `synchronous(level)` | ✅ | `PRAGMA synchronous = OFF/NORMAL/FULL/EXTRA;` |
| `cacheSize(size)` | ✅ | `PRAGMA cache_size = N;` (positive=pages, negative=KB) |
| `tempStore(location)` | ✅ | `PRAGMA temp_store = DEFAULT/FILE/MEMORY;` |
| `busyTimeout(ms)` | ✅ | `PRAGMA busy_timeout = N;` |
| `mmap_size(bytes)` | ✅ | `PRAGMA mmap_size = N;` |
| `pageSize(bytes)` | ✅ | `PRAGMA page_size = N;` (power of 2, 512–65536) |
| `autoVacuum(mode)` | ✅ | `PRAGMA auto_vacuum = NONE/FULL/INCREMENTAL;` |
| `optimize()` | ✅ | `PRAGMA optimize;` |
| `raw(key, value)` | ✅ | `PRAGMA key = value;` (arbitrary pragma) |

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

- `qbColumn` — column definition (name, sqliteType, optional, hasDefault, defaultValue, pkauto, unique, fk, check, generated, meta)
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
- **Total tests**: 396
- **Run**: `npm.cmd test -w @ytrynot/qb`
- **Typecheck**: `npm.cmd test -- --typecheck`

| Test file | Count | Coverage |
|-----------|-------|----------|
| `tests/builder.test.ts` | 108 | Core Builder API: SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE, JOINs, cloning, onConflict sub-builder, insertMulti, insertDefaultValues, having, distinct, DDL additions (composite UNIQUE, CHECK), INDEX partial WHERE + expression, dropIndex, runtime guards, PragmaBuilder full coverage |
| `tests/readme-examples.test.ts` | 17 | README examples produce documented SQL |
| `tests/e2e-lifecycle.test.ts` | 48 | CRUD lifecycle across drivers + schema sources |
| `tests/e2e-ddl.test.ts` | 36 | DDL generation + execution + PRAGMA e2e (both drivers) |
| `tests/sqlite-integration.test.ts` | 15 | node:sqlite integration |
| `tests/zod-introspector.test.ts` | 18 | Zod introspector |
| `tests/dna-introspector.test.ts` | 18 | DNA introspector |
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
- **STRICT tables** — requires type mapping (`BOOLEAN → INTEGER`, `DATETIME → TEXT`), complex + niche
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

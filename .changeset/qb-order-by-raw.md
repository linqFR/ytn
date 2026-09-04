---
"@ytrynot/qb": minor
---

Add compound SELECT, CTE, `orderByRaw`, generated columns, TEMP tables, CREATE TABLE AS SELECT, EXPLAIN, INSERT OR, UPDATE FROM, and subquery in SET to the fluent Builder.

- `orderByRaw(expression)`: raw ORDER BY escape hatch for `CASE`, function calls, mixed-direction sorts. Mirrors `whereRaw`, `selectRaw`, `doUpdateRaw`.
- Compound SELECT: `.union()`, `.unionAll()`, `.intersect()`, `.except()` instance methods + `QueryBuilder.union()`, `QueryBuilder.unionAll()`, `QueryBuilder.intersect()`, `QueryBuilder.except()` static factories. `orderBy`, `orderByRaw`, `limit`, and `offset` apply to the compound as a whole. Guards throw on invalid operations (WHERE, JOIN, INSERT, etc.) in compound mode.
- CTE: `.with(name, builderOrSql)` and `.withRecursive(name, builderOrSql)` prepend `WITH [RECURSIVE]` clauses. Multiple CTEs can be chained. `WITH RECURSIVE` is emitted if any CTE is recursive.
- Generated columns: `qbColumn.generated: { expr, type: "STORED" | "VIRTUAL" }` emits `GENERATED ALWAYS AS (expr) STORED|VIRTUAL`. Skips NOT NULL and DEFAULT for generated columns.
- CREATE TEMP TABLE: `qbTableOptions.temporary: true` emits `CREATE TEMP TABLE`.
- CREATE TABLE AS SELECT: `QueryBuilder.createTableAs(name, builder)` emits `CREATE TABLE name AS SELECT ...`.
- EXPLAIN: `.explain()` and `.explainQueryPlan()` prefix the query with `EXPLAIN` / `EXPLAIN QUERY PLAN`.
- INSERT OR: `.insert(...).or("REPLACE"|"IGNORE"|"ROLLBACK"|"ABORT"|"FAIL")` emits `INSERT OR <action> INTO`. Works with `insert`, `insertMulti`, and `insertDefaultValues`.
- UPDATE FROM (SQLite 3.33+): `.update(fields).from(table)` emits `UPDATE t SET ... FROM other WHERE ...`.
- Subquery in SET: `.updateRaw({ col: 'expr' })` emits `UPDATE t SET col = expr WHERE ...`. Supports subqueries, arithmetic, and function calls.
- `clone()` preserves all new state.
- 63 new tests (compound-cte.test.ts + advanced-features.test.ts). 372 total tests pass.
- CREATE TRIGGER: `QueryBuilder.createTrigger(name, def)` — typed structure (timing, event, table, OF columns, WHEN, FOR EACH ROW), raw body. Follows the Drizzle ORM pattern: typed declaration, raw body (SQLite trigger bodies contain imperative multi-statement logic with NEW/OLD refs that cannot be expressed by the fluent Builder).
- TableDef now exposes `name: string` and `cols: string[]` for programmatic access to table metadata. Enables refactor-safe trigger definitions: `of: [t.cols[1]], table: t.name`.
- 13 new tests (trigger.test.ts). 385 total tests pass.
- Window frames: `.selectWindow(alias, { frame: { type: "ROWS"|"RANGE"|"GROUPS", start, end?, exclude? } })` emits `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING` etc. Supports EXCLUDE CURRENT ROW/GROUP/TIES/NO OTHERS. Backward compatible — no frame produces standard OVER clause.
- 11 new tests (window-frames.test.ts). 396 total tests pass.

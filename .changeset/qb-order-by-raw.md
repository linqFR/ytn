---
"@ytrynot/qb": minor
---

Compound SELECT, CTE, advanced DDL/DML, window frames, triggers, and DDL improvements

- `orderByRaw(expression)`: raw ORDER BY escape hatch for `CASE`, function calls, mixed-direction sorts.
- Compound SELECT: `.union()`, `.unionAll()`, `.intersect()`, `.except()` instance methods + `QueryBuilder.union()`, `QueryBuilder.unionAll()`, `QueryBuilder.intersect()`, `QueryBuilder.except()` static factories. `orderBy`, `orderByRaw`, `limit`, and `offset` apply to the compound as a whole. Guards throw on invalid operations in compound mode.
- CTE: `.with(name, builderOrSql)` and `.withRecursive(name, builderOrSql)` prepend `WITH [RECURSIVE]` clauses. Multiple CTEs can be chained.
- Generated columns: `qbColumn.generated: { expr, type: "STORED" | "VIRTUAL" }` emits `GENERATED ALWAYS AS (expr) STORED|VIRTUAL`.
- CREATE TEMP TABLE: `qbTableOptions.temporary: true` emits `CREATE TEMP TABLE`.
- CREATE TABLE AS SELECT: `QueryBuilder.createTableAs(name, builder)` emits `CREATE TABLE name AS SELECT ...`.
- EXPLAIN: `.explain()` and `.explainQueryPlan()` prefix the query with `EXPLAIN` / `EXPLAIN QUERY PLAN`.
- INSERT OR: `.insert(...).or("REPLACE"|"IGNORE"|"ROLLBACK"|"ABORT"|"FAIL")` emits `INSERT OR <action> INTO`.
- UPDATE FROM (SQLite 3.33+): `.update(fields).from(table)` emits `UPDATE t SET ... FROM other WHERE ...`.
- Subquery in SET: `.updateRaw({ col: 'expr' })` emits `UPDATE t SET col = expr WHERE ...`.
- Window frames: `.selectWindow(alias, { frame: { type, start, end?, exclude? } })` emits `ROWS BETWEEN ... AND ...` etc.
- CREATE TRIGGER: `QueryBuilder.createTrigger(name, def)` — typed structure, raw body.
- `TableDef` exposes `name: string`, `cols: string[]`, and `names: ITableNames` for programmatic access. `names` provides `table`, `col` (lookup by name), `pk`, `isPk` (per-column boolean), `isUnique` (per-column boolean), `readonly` (list of readonly column names), and `updatable` (list of non-readonly column names) — all computed once at `defTable` time for raw SQL construction without hardcoding identifiers.
- `qbColumn.readonly: boolean` is now a direct field. The Zod introspector detects `z.ZodReadonly` (via `.readonly()`); the DNA introspector reads `meta.readonly` (set by DNA's `.readonly()`). Both propagate to `names.readonly` / `names.updatable`.
- `clone()` preserves all new state.
- `qbColumn.optional`, `qbColumn.hasDefault`, and `qbColumn.meta` are now optional in the interface (natural defaults `false`, `false`, `{}`).
- `qbColumn.pk: true` is now a direct primary key marker, alongside `meta.pk` and `pkauto`.
- `NOT NULL` and `DEFAULT` are now independent constraints — both can appear together (e.g. `scope TEXT NOT NULL DEFAULT 'repo-wide'`). `NOT NULL` is emitted before `DEFAULT`, matching standard SQLite DDL conventions.
- 410 total tests pass.

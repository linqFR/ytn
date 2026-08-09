# @ytrynot/qb

## 1.0.0

### Patch Changes

- 7ebacf3: Initial public release — fluent SQLite query builder with Zod v4 and DNA schema introspection

  First publication of `@ytrynot/qb`. The package generates SQL strings and named
  parameters (`@param`) for SQLite — it does not execute queries.

  ### API consolidation

  - **`defTable(name, def, options?)`** — unified entry point. Accepts Zod v4
    schemas, DNA schemas, or manual `qbColumn[]`. Returns a `TableDef` directly
    (throws on invalid schema — no more `{ success, data?, errors? }` wrapper).
    Pre-builds `createTable`, `getAll`, `getById`, `insert`, `update`, `delete`,
    `upsert`, plus `req`/`q` getters returning a fresh `Builder` with
    `uniqueKeys` pre-configured.
  - **`reqCreateTable(name, def, options?)`** — shortcut for
    `defTable(name, def, options).createTable`. Replaces the removed
    `createTableFromZod` / `createTableFromDna`.
  - **`table(name, uniqueKeys?)`** — fluent DML builder (unchanged entry point).
  - Removed: `createTableFromZod`, `createTableFromDna`, `generateCRUDFromZod`,
    `generateCRUDFromDna`, `ODefTable` interface.

  ### Breaking changes

  - **`.build()` → `.toSQL()`** — renamed for idiomatic consistency with
    `toString()` / `toJSON()`.
  - **`defTable()` throws** on invalid schema instead of returning a safe result.
  - **`.upsert()` requires `uniqueKeys`** — throws if none configured (via
    `.uniqueKeys()` or `defTable()`).

  ### New features

  - **`.onConflict(cols, opts?)`** — sub-builder for full ON CONFLICT control:
    `.doNothing()`, `.doUpdate(fields, where?)`, `.doUpdateRaw({ col: expr })`.
    Supports partial-index WHERE on conflict target and WHERE on DO UPDATE SET.
  - **`.having(conditions)`** — HAVING clause for GROUP BY filtering.
  - **`.distinct()`** — SELECT DISTINCT.
  - **`.insertMulti(fields, rowCount)`** — multi-row INSERT with indexed
    placeholders (`@col_0`, `@col_1`, ...).
  - **`.insertDefaultValues()`** — `INSERT INTO t DEFAULT VALUES`.
  - **Composite PK support** — `defTable(name, cols, { primaryKey: ['a', 'b'] })`
    now correctly generates composite WHERE clauses for all pre-built queries.
  - **DDL additions**: composite UNIQUE constraints (`uniqueConstraints`),
    table-level and column-level CHECK constraints, expanded FK actions
    (`SET DEFAULT`, `NO ACTION`).
  - **Index management**: partial WHERE on CREATE INDEX, expression indexes,
    `QueryBuilder.dropIndex(name)`.
  - **Identifier validation** — `validateIdentifier()` guards `dropTable`,
    `dropIndex`, `createIndex` against SQL injection via identifiers.
  - **PragmaBuilder** — full coverage of SQLite PRAGMA statements.

  ### Schema introspection

  - **Zod v4 introspector** — uses `@ytrynot/shared/zod/zod-reflection` for
    deep-unwrapping. No `_def` access (V3 forbidden), uses `._zod` and public
    `.unwrap()` / `.meta()` APIs.
  - **DNA introspector** — uses `@ytrynot/dna/introspect` public API
    (`isOptional`, `isNullable`, `unwrap`, `unwrapDeep`, `defaultValue`).
  - Both produce neutral `qbColumn[]` consumed by `DDLEngine`.

  ### Tests

  - 305 tests across 14 files: builder API, readme examples, e2e lifecycle
    (node:sqlite + better-sqlite3), e2e DDL, SQLite integration, Zod/DNA
    introspectors, Zod/DNA compliance, dist/min bundles, smoke test.

- Updated dependencies [90f4dde]
  - @ytrynot/dna@0.5.0

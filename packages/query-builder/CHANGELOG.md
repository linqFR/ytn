# @ytrynot/qb

## 1.1.0

### Minor Changes

- 4c73440: DEFAULT values: native `.default()` with automatic SQL quoting
  
  - Use Zod/DNA native `.default()` to declare column defaults — the introspector quotes the value into a SQL literal automatically.
  - Strings → single-quoted with `'` escaped as `''` (e.g. `.default("user")` → `DEFAULT 'user'`).
  - Numbers → unquoted (e.g. `.default(42)` → `DEFAULT 42`).
  - Booleans → `TRUE`/`FALSE` (e.g. `.default(true)` → `DEFAULT TRUE`).
  - Dates → ISO 8601 quoted (e.g. `.default(() => new Date("2024-01-01"))` → `DEFAULT '2024-01-01T00:00:00.000Z'`).
  - Manual `qbColumn.defaultValue` accepts two signatures: tagged `{ string: "user" }` (auto-quoted) or direct `"CURRENT_TIMESTAMP"` (raw SQL via `.toString()`).
  - New export: `resolveDefault()` from `@ytrynot/qb` for manual SQL literal quoting.
  - New type: `tsDefaultValue` for the `qbColumn.defaultValue` field.
  
  BREAKING CHANGE: `meta.default` and `meta.defaultValue` are no longer read by the introspectors or DDL engine. Use native `.default()` on Zod/DNA schemas instead. `qbColumn.defaultValue` type changed from `unknown` to `tsDefaultValue` — manual columns using `defaultValue: "'user'"` (raw SQL string) still work via the direct form but produce unquoted output; migrate to `defaultValue: { string: "user" }` for automatic quoting.

### Patch Changes

- Updated dependencies [7b4bcf0]
- Updated dependencies [5cf7ad9]
- Updated dependencies [45711eb]
  - @ytrynot/dna@0.7.6

## 1.0.3

### Patch Changes

- 5f8cdfd: Documentation restructure and description update
  
  - Update `package.json` description to mention both Zod and DNA schema integration (was Zod-only): "Fluent SQLite Query Builder with Zod and DNA schema integration"
  - Add `"dna"` to keywords
  - Restructure README from 825-line single file to 222-line front-door per Diátaxis framework: title with "SQLite" + "Zod & DNA", Why section, Installation, Quick start with verified output (Zod + DNA examples), Features, ToC, Documentation table linking to sub-docs, License
  - Create `docs/quick-start.md` (Tutorial): end-to-end from install to driver execution
  - Create `docs/how-to-ddl.md` (How-to): all 3 schema sources (Zod, DNA, manual `qbColumn[]`), metadata keys, foreign keys, unique keys, composite PK, indexes
  - Create `docs/how-to-queries.md` (How-to): SELECT, WHERE variants, INSERT, UPDATE, DELETE, UPSERT/ON CONFLICT, JOINs, ordering, GROUP BY/HAVING, DISTINCT, text search, cloning
  - Create `docs/how-to-advanced.md` (How-to): EXISTS, CASE WHEN, correlated subqueries, window functions, PragmaBuilder
  - Fix documentation bug in manual DDL example: `unique` is read from the top-level `qbColumn.unique` field, not `meta.unique` (the old example produced `email TEXT NOT NULL` instead of the documented `email TEXT UNIQUE NOT NULL`)
  - All runnable examples verified with `exec` against actual source

## 1.0.2

### Patch Changes

- Updated dependencies
  - @ytrynot/dna@0.7.0

## 1.0.1

### Patch Changes

- Updated dependencies
  - @ytrynot/dna@0.6.0

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

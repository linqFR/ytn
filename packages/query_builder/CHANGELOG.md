# @ytn/qb

## 1.3.0

### Minor Changes

- feat(ddl): add `pkauto` for explicit AUTOINCREMENT and refine `NOT NULL` logic.
  docs: overhaul README with detailed aliasing and correlated subquery examples.
  test: unify test suite with TS-based reporting infrastructure.

### Patch Changes

- aaf0f2d: build: expose minified bundles and improve documentation

## 1.2.1

### Patch Changes

- aaf0f2d: build: expose minified bundles and improve documentation

## 1.2.0

### Minor Changes <!-- v1.2.0 -->

- Added PragmaBuilder for fluent SQLite configuration, DML Returning clause support (SQLite 3.35+), and deep Zod v4 introspection with referential integrity (ON DELETE/UPDATE) via metadata.

## 1.1.0

### Minor Changes <!-- v1.1.0 -->

- Unify WHERE clauses across all DML statements and add SQLite RETURNING support.

## 1.0.0

### Major Changes

- a07b302: First Release of [query_builder](../packages/query_builder/README.md) an SQLite builder based on Zod v4.

### Patch Changes

- Documentation update

# AGENTS.md (Package: @ytrynot/qb)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the Query Builder.

---

## 🏛️ Core Architecture

The codebase is strictly modularized under `src/`. Avoid re-merging logic into single files.

- **`src/types.ts`**: Unified interfaces and internal definitions (JoinDefinition, WhereDefinition, qbColumn, ISchemaIntrospector, etc.). Use these to keep the API clear and maintainable.
- **`src/zod/introspector.ts`**: Zod v4 introspector implementing `ISchemaIntrospector<z.ZodType>`. Uses the shared reflection layer (`@ytrynot/shared/zod/zod-reflection.js`) to extract neutral `qbColumn[]` from Zod schemas. No direct `_zod` access — all reflection logic goes through the shared layer.
- **`src/dna/introspector.ts`**: DNA introspector implementing `ISchemaIntrospector<DnaType>`. Uses `@ytrynot/dna/introspect` public API (`isOptional`, `isNullable`, `isObject`, `unwrap`, `unwrapDeep`, `defaultValue`) to extract neutral `qbColumn[]` from DNA schemas. No dependency on Zod.
- **`src/ddl.ts`**: Translates schema shapes into SQL table structures.
- **`src/builder.ts`**: The Fluent DML Builder. Focuses on SQL string construction with strict preservation of validated syntax.
- **`src/index.ts`**: The public entry point (facade).

---

## 📖 Documentation

- **`README.md`**: Public-facing usage, installation, and general overview.

---

## 🗄️ SQLite Version Requirements

qb generates SQL that depends on specific SQLite versions. The builder does **not**
validate the runtime SQLite version — consumers must ensure their driver meets the
minimum requirement. When adding a new feature, **always document the min SQLite
version** in the method's JSDoc and in the table below.

| Feature | Min SQLite | Release date | qb API |
|---------|-----------|-------------|-------|
| RETURNING | 3.35.0 | 2021-03-12 | `.returning()` |
| UPSERT / ON CONFLICT | 3.24.0 | 2018-06-04 | `.onConflict()`, `.upsert()` |
| RIGHT JOIN | 3.39.0 | 2022-06-25 | `.joinRight()` |
| Window functions | 3.25.0 | 2018-09-15 | `.selectWindow()` |

**Runtime notes**:
- `node:sqlite` (Node.js 22+) ships SQLite 3.46+ — all features available.
- `better-sqlite3` bundles its own SQLite — check the bundled version.
- Features used without guard will produce runtime errors from the driver on older SQLite.

---

## 🌐 Source of Truth (Zod v4)

If you have a doubt about a Zod type, do not guess and do not look at Zod 3 legacy tutorials.

1. **Official Docs**: [zod.dev](https://zod.dev) (The definitive reference).
2. **Local Types**: Check `node_modules/zod/lib/index.d.ts`. This is the absolute truth for the current version.
3. **Official GitHub**: [colinhacks/zod](https://github.com/colinhacks/zod) (Switch to v4/main branches).
4. **Recursive Engine**: Study `src/zod/introspector.ts` and `@ytrynot/shared/zod/zod-reflection.js` in this project. They are the reference implementations for deep-unwrapping and schema introspection.

---

## Build & Distribution Details

In addition to global build rules, this package requires:

- **Minification**: Keep a separate minified bundle (`index.min.js`) for production environments.
- **JSDoc Preservation**: Ensure JSDoc comments are preserved in the generated `.d.ts` declarations.
- **Source Maps**: Enable `sourceMap` and `declarationMap` for public packages, in line with the global AGENTS.
- **Automated DTS**: Type declarations (`.d.ts`) must be automatically generated.

---

## 🧪 Testing Workflow

Always run the full suite before submitting changes. "It builds" is not enough. 300 tests total.

- **`tests/builder.test.ts`** (108): Core `Builder` fluent API — SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE, JOINs, cloning, `defTable` + `req`/`q` + `uniqueKeys` + `ddl` shortcut, `onConflict` sub-builder, `insertMulti`, `insertDefaultValues`, `having`, `distinct`, DDL additions (composite UNIQUE, CHECK), INDEX partial WHERE + expression, `dropIndex`, runtime guards, PragmaBuilder full coverage.
- **`tests/readme-examples.test.ts`** (17): Verifies that every code example in `README.md` produces the documented SQL output.
- **`tests/e2e-lifecycle.test.ts`** (48): End-to-end CRUD lifecycle across SQLite drivers (`node:sqlite`, `better-sqlite3`) and schema sources (Zod, DNA, Manual).
- **`tests/e2e-ddl.test.ts`** (36): DDL generation + execution across drivers and schema sources, including `qbTableOptions` overrides + PRAGMA e2e (both drivers).
- **`tests/sqlite-integration.test.ts`** (15): Integration tests with `node:sqlite` — parent/child relationships, FK constraints, Zod + DNA schemas.
- **`tests/zod-introspector.test.ts`** (18): Zod v4 introspector — PK detection, type mapping, metadata extraction, throws on non-object schemas.
- **`tests/dna-introspector.test.ts`** (18): DNA introspector — same coverage as Zod introspector, using DNA schemas.
- **`tests/zod-compliance.test.ts`** (11): Verifies that the recursive engine correctly unwraps diverse Zod v4 patterns (optional, nullable, default, pipe, lazy).
- **`tests/dna-compliance.test.ts`** (10): Same compliance coverage for DNA schemas.
- **`tests/query-construction.test.ts`** (4): Basic SELECT/WHERE, joins, subqueries, UPSERT.
- **`tests/advanced-query.test.ts`** (4): Advanced patterns — CASE, EXISTS, correlated subqueries.
- **`tests/dist.test.ts`** (2): Verifies that the compiled JS artifact (`dist/index.js`) is functionally operational.
- **`tests/min.test.ts`** (2): Verifies that the minified bundle (`dist/index.min.js`) is functionally operational.
- **`tests/bundle-smoke.test.ts`** (1): Smoke test — imports the package and checks key exports exist.
- **Run tests**: `npm.cmd test -w @ytrynot/qb`

---

## 📋 Feature Reference

The authoritative feature inventory — including supported features, SQLite version
requirements, type system, out-of-scope decisions, and future ideas — is maintained
in **[docs/feature-reference.md](docs/feature-reference.md)**.

When adding a new feature, **always update `docs/feature-reference.md`** and the
method's JSDoc.

---

> “Maintain the engine, respect the schema, and never choose the easy path over the right one.”

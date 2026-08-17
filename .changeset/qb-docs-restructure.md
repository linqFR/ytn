---
"@ytrynot/qb": patch
---

Documentation restructure and description update

- Update `package.json` description to mention both Zod and DNA schema integration (was Zod-only): "Fluent SQLite Query Builder with Zod and DNA schema integration"
- Add `"dna"` to keywords
- Restructure README from 825-line single file to 222-line front-door per Diátaxis framework: title with "SQLite" + "Zod & DNA", Why section, Installation, Quick start with verified output (Zod + DNA examples), Features, ToC, Documentation table linking to sub-docs, License
- Create `docs/quick-start.md` (Tutorial): end-to-end from install to driver execution
- Create `docs/how-to-ddl.md` (How-to): all 3 schema sources (Zod, DNA, manual `qbColumn[]`), metadata keys, foreign keys, unique keys, composite PK, indexes
- Create `docs/how-to-queries.md` (How-to): SELECT, WHERE variants, INSERT, UPDATE, DELETE, UPSERT/ON CONFLICT, JOINs, ordering, GROUP BY/HAVING, DISTINCT, text search, cloning
- Create `docs/how-to-advanced.md` (How-to): EXISTS, CASE WHEN, correlated subqueries, window functions, PragmaBuilder
- Fix documentation bug in manual DDL example: `unique` is read from the top-level `qbColumn.unique` field, not `meta.unique` (the old example produced `email TEXT NOT NULL` instead of the documented `email TEXT UNIQUE NOT NULL`)
- All runnable examples verified with `exec` against actual source

---
"@ytrynot/qb": patch
---

Make `qbColumn.optional`, `qbColumn.hasDefault`, and `qbColumn.meta` optional in the interface. These fields were required but had natural defaults (`false`, `false`, `{}`) that the DDL engine already assumed via falsy-checks. Making them optional removes friction for manual `qbColumn[]` definitions without changing any introspector output or generated SQL. Three internal read sites (`ddl.ts`, `index.ts` x2) now use optional chaining (`?.`) when reading `col.meta`.

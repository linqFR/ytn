---
"@ytrynot/qb": patch
---

Fix declaration build failure with `@ytrynot/dna` schemas

- `defTable` and `reqCreateTable` accept DNA schemas — their published type declarations now resolve correctly.
- No runtime or API change.

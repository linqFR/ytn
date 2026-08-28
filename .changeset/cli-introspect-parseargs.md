---
"@ytrynot/cli": patch
---

Adapt to DNA introspect API for parseArgs config

- `createContract` and help generation use `introspect.toParseArgsConfig(schema, { positionals })` from `@ytrynot/dna/introspect` instead of the schema method.

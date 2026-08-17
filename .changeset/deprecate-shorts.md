---
"@ytrynot/dna": patch
---

Deprecate `shorts` in `cliUnion.toParseArgsConfig()`

Short alias generation (auto-generation from first letter and `opts.shorts`
override) is deprecated. Short aliases are a `node:util.parseArgs` concern,
not a `cliUnion` schema concern (ADMIN decision 2026-08-15). The
`opts.shorts` parameter and the `short` field in the returned `options`
will be removed in a future release. Consumers should generate their own
shorts at the `parseArgs` config level.

`toParseArgsConfig()` itself, `opts.strict`, and all other fields
(`allowPositionals`, `strict`, `type`, `multiple`) remain fully supported.

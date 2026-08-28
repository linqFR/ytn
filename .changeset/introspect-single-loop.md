---
"@ytrynot/dna": patch
---

Introspect `toParseArgsConfig`: single-pass option collection

- `toParseArgsConfig` now collects declared keys and option metadata in a single loop over branches instead of two separate passes.
- No behavior change — output is identical for all positional/strict configurations.

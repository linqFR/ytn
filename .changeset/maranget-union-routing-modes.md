---
"@ytrynot/dna": minor
---

Maranget union: canonical name and routing modes

- `dna.marangetUnion(schemas, config)` is the canonical name for discriminated unions with wildcard branches. `dna.cliUnion` remains available as a CLI convenience that sets `mode: "cli"` automatically.
- `config.mode` selects routing semantics when a catch-all branch overlaps a constructor branch:
  - `"constructor-priority"` (default): constructor rows win over catch-all on the same column; catch-all acts as fallback.
  - `"source-order"`: first matching branch in declaration order wins (strict decision-tree semantics).
  - `"cli"`: constructor-priority routing with discriminator columns sorted by positional priority for CLI usage.
- `introspect.toParseArgsConfig(schema, { positionals })` accepts a CLI-level positional override.

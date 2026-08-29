---
"@ytrynot/cli": minor
---

Migrate to named-route API

- **Breaking**: `IContract.targets` (tuple) and `IContract.fallbacks` replaced by `IContract.routes` (Record<string, DnaObject>). Route IDs are derived from record keys.
- **Breaking**: `ICliMeta.routeId` removed — route IDs come from the `routes` record key.
- `createContract()` now builds a clean `cliUnion` (no `\x00ID`) for `toParseArgsConfig`, then injects `\x00ID` via `DnaObject.apply()` for routing.
- `toParseArgsConfig` is now standalone (from `@ytrynot/dna/introspect`), not a method on `DnaCliUnion`.
- Positionals override goes into `toParseArgsConfig({ positionals })`, not `dna.cliUnion({ positionals })`.
- `positionalMeta` computed from effective positionals (override or detected) with `positionals: []` config for `multiple` detection.
- `help.ts` uses `processed.parseArgsConfig` instead of `cliUnion.toParseArgsConfig()`.
- `help.ts` iterates `Object.values(processed.routes)` instead of `processed.routes` (array).

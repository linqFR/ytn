---
"@ytrynot/dna": minor
---

Add `@ytrynot/dna/core` entry point — single source of truth for runtime classes and registry

Introduces a new `./core` subpath export mirroring the `zod/v4/core` pattern.
All runtime classes (`DnaType`, `DnaObject`, `DnaString`, ...), the instance
factory (`initDna`, `BaseCore`), the compiler (`toJS`, `validator`, `parser`,
`validatorBuilder`, `parserBuilder`), error types (`DnaError`, `DnaIssueCodes`),
and the constructor registry (`registerExternal`, `getRegisteredExternals`) are
now re-exported from a single `dist/core.js` bundle.

All other entry points (`@ytrynot/dna`, `@ytrynot/dna/introspect`,
`@ytrynot/dna/toJs`) import from `@ytrynot/dna/core` instead of bundling
internal modules directly. This ensures:

- **Single class identity**: `instanceof DnaType` / `instanceof DnaObject` works
  across bundles (fixes the duplicated-class bug when `introspect` was a
  separate entry point).
- **Registry singleton**: the `externalRegistry` Map is shared across all
  bundles, so `registerExternal` calls are visible everywhere.
- **Smaller bundles**: `dist/index.js` dropped from 136 KB to 21 KB,
  `dist/toJs.js` from 111 KB to 126 bytes. The full runtime lives in
  `dist/core.js` (220 KB), loaded once.

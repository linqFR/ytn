---
"@ytrynot/dna": patch
"@ytrynot/schvalid": patch
"@ytrynot/qb": patch
"@ytrynot/cli": patch
---

Migrate test framework from Vitest 4 to Vitest 5

- All packages now run on Vitest 5.0.0 (dev dependency bump).
- Package-local `vitest.config.ts` files added for `@ytrynot/dna` and `@ytrynot/cli` to inherit the root config via `mergeConfig` (Vitest 5 no longer resolves configs from parent directories).
- No runtime behavior change — test results identical before and after migration.

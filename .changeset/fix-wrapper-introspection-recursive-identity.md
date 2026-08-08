---
"@ytrynot/dna": patch
---

Fix `isOptional()`/`isNullable()`/`isNullish()` introspection and preserve wrapper object identity in `fromDna` for recursive types.

- `DnaType.isOptional()`, `isNullable()`, and `isNullish()` now traverse the wrapper chain (unwrapping `DnaLazy` first) instead of reading a single `meta` flag. `isOptional()` returns `false` when a `nonoptional` wrapper is encountered and `true` for absent-tolerant wrappers; `isNullable()`/`isNullish()` detect `nullable`/`nullish` wrappers respectively.
- `DnaOptional`, `DnaNullable`, and `DnaNullish` now seed their `_core` with the corresponding `rawMeta` (`optional`, `nullable`, `nullish`) so the wrapper flags remain discoverable.
- `fromDna` no longer calls `wrapped.meta(cleanMeta)` (which clones the wrapper and its inner, breaking object identity for recursive types whose cycle detection keys on `this._core`). It mutates the freshly-created wrapper's `_core` via `rawMeta` in place, preserving identity while still applying the reconstructed metadata.

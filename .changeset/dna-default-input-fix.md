---
"@ytrynot/dna": patch
---

Fix `DnaDefault._input` silently typed as `any` and deduplicate type helpers.

- Add `declare readonly _input: $Input<Inner> | undefined` on `DnaDefault`
  (was inherited as `any` from the deferred parent, breaking type inference
  for `.default()` consumers)
- Re-export type helpers (`$IsAny`, `$ReadonlyValue`, `$RemoveUndefined`,
  `$Flatten`, `$UnionToIntersection`, `$EnumKeys`, `$MaybeAsync`, etc.) from
  `@ytrynot/shared/types` instead of duplicating them in `helpers.types.ts`
- Add `expectTypeOf` regression tests for `_input` on all wrappers
  (DnaDefault, DnaOptional, DnaNullable, DnaNullish, DnaNonOptional)
  and for missing output types (nullish, prefault, exactOptional)

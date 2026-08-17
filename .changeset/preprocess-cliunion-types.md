---
"@ytrynot/dna": patch
---

Fix `dna.preprocess` and `dna.cliUnion` type inference

- `dna.preprocess(fn, target)` now returns `DnaPipe<DnaTransform<unknown, R>, T>` — the target schema type `T` and the `fn` return type `R` are preserved in the return type.
- `dna.cliUnion(schemas)` accepts `readonly` tuples and arrays (e.g. `as const` tuples, `.map()` results) without requiring a manual cast.

---
"@ytrynot/dna": minor
---

Object output: preserve explicitly-present `undefined` values (Zod v4 alignment)

- `dna.object()`, `dna.strictObject()`, and `dna.looseObject()` now preserve optional keys with `undefined` value when the key is present in the input, matching Zod v4. Previously, standard mode stripped these keys.
- Object parser performance: ~3.4x faster on simple objects, ~3.7x faster on nested objects. DNA parser is now faster than Zod on all object benchmarks.
- `discriminatedUnion` with optional discriminator keys no longer adds an artificial `undefined` key to the output when the discriminator is absent from the input.

BREAKING CHANGE: `safeParse().data` on standard objects now includes keys with `undefined` values when those keys were present in the input. Code that relied on `undefined`-valued optional keys being stripped must check key presence rather than value truthiness.

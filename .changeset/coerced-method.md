---
"@ytrynot/dna": patch
---

Add public `.coerced()` method on DnaType

- New `.coerced()` instance method clones a schema and enables coercion on its leaf, walking through wrappers and pipes.
- Pipe handling is asymmetric (same logic as `isCoercible`): regular pipe coerces the first step (input), preprocess coerces the last step (target).
- Silently no-ops on types without `coerceCode` (e.g. `dna.date()`).
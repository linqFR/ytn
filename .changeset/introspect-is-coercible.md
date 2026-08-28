---
"@ytrynot/dna": patch
---

Introspect: add `isCoercible` utility

- New `isCoercible(schema)` function in `@ytrynot/dna/introspect` checks whether a schema has coercion enabled at its leaf.
- Walks wrapper chains (optional, nullable, default, ...) to find the leaf, unlike a flat `_coerce` check.
- Handles pipes asymmetrically: regular pipe checks the first step (input), preprocess checks the last step (target).

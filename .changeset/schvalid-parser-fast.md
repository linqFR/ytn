---
"@ytn/schvalid": minor
"@ytn/dna": patch
---

@ytn/schvalid: Add `parserFast` hybrid parser (validate-then-parse) exposed via `schvalid("fast")` and `schvalid("all").compile(schema).parseFast`. Rename `schvalid("both")` mode to `schvalid("all")`, which now also returns `parseFast` alongside `validate`/`parse`, all compiled once and sharing the same `validate`/`parse` instances (see `combineFast`).

@ytn/dna: Optimize object parser codegen (`dna-js-json.ts`) to skip the redundant `keepOnly` scratch object and filter-copy loop when there are no dynamic properties (no `patternProperties`/`propertyNames`/schema-based `additionalProperties`). Per-key writes are already scoped to the declared key set and conditionally guarded, so writing directly into the output variable is safe and equivalent — measured ~2.9x speedup on the parser's happy path for typical object schemas.

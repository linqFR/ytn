---
"@ytn/dna": minor
---

Expose `toJSONSchema()` top-level and export `validatorBuilder`/`parserBuilder` from `@ytn/dna`.

- `dna.toJSONSchema()` is now available as a top-level function (previously only accessible as `schema.toJSONSchema()` instance method). Matches Zod's `z.toJSONSchema()` API.
- `validatorBuilder` and `parserBuilder` are now exported from `@ytn/dna` (previously only accessible via internal import from `./toJs/dna-to-js.ts`). These are low-level APIs that recompile on every call — prefer `schema.validate()`/`schema.safeParse()` for cached compilation.

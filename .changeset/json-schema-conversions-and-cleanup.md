---
"@ytrynot/dna": minor
---

JSON Schema conversion: proper `const`, `enum`, `not`, and `ifThenElse` output

- `schema.toJSONSchema()` now emits correct JSON Schema for `const` (`c`/`cD`), `enum` (`eD`), `not`, and `ifThenElse` opcodes. Previously these fell back to a generic `{ type: "object", description: "DNA opcode: ..." }` placeholder.
- `dna.promise()` is now formally deprecated (JSDoc), mirroring `z.promise()` deprecation in Zod v4. Kept for compatibility; prefer `await`-ing the value before parsing.
- New type export: `tsCompiledParts` (the `string[]` parts passed to `new Function(...parts)`) is now available from `@ytrynot/dna/core`.
- Compiler internals: `Set`-based body collections replaced with `Record<string, boolean>` to preserve insertion order and produce deterministic generated code across runs.
- Internal type rename: `tsLaberlId` → `tsLabelId` (typo fix, compiler-internal only).
- Removed unused `isDNA` placeholder function (never part of the public API, was a no-op returning `true`) and deleted duplicate `shared/inference.types.ts`.
- Cast cleanups in `fromDna`: unjustified `as any` replaced with documented `as unknown as T` casts.

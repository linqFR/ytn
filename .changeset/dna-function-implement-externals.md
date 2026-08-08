---
"@ytn/dna": minor
---

`DnaFunction` serialization, `fromDna` reconstruction, and `.implement()` externals support.

- `DnaFunction._emitSelf` now serializes input and output schemas as DNA children: `["function", [inputDnaId, outputDnaId], meta?]` (previously emitted a generic `["T", {}]` that lost all schema information).
- `fromDna` reconstructs `DnaFunction` via `case "function"` in `buildNode`, rebuilding both input tuple and output schema from the DNA graph.
- `.implement(fn, externals?)` and `.implementAsync(fn, externals?)` now build a single closure via `toJS` instead of inlining parser source: input and output parsers are inlined as IIFEs that destructure externals from a shared argument (same codegen pattern as `transform`/`refine` — names are in scope, not accessed via `externals.name`).
- `.implement()` is sync-only: detects async input/output schemas and async `fn` at construction time and throws a clear error directing to `.implementAsync()`. The generated function body is clean (no runtime `instanceof Promise` checks).
- `DnaError` is inlined as `dnaErrorSource` (exported from `error.types.ts`) in `new Function` bodies — generated functions have no access to module imports.
- `dna.function()` without `.input()` now defaults to a tuple with `rest: dna.unknown()` (pass-through, matching Zod). Explicit `.input([])` remains a strict empty tuple.
- The returned function exposes `requiredExternals: string[]` (union of input and output parser externals), matching `parserBuilder`/`validatorBuilder`.
- Externals are merged from `getRegisteredExternals()` and the explicit `externals` parameter, enabling both registered and ad-hoc externals patterns.
- Adds `tests/from-dna-function.test.ts` (28 tests): basic roundtrip, implement/implementAsync, rest args, no input/output, registered and explicit externals, nested objects, DNA structure assertions, and error cases (wrong types, arity, refine, enum, async validation).

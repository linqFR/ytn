---
"@ytrynot/dna": patch
---

Parser and codec return types: fix to use precise output/input types instead of `any`

- `safeParse()`, `safeParseAsync()`, `spa()`, `safeDecode()`, and `safeDecodeAsync()` now return `tsDnaParserResult<this["_output"]>` instead of unparameterized `tsDnaParserResult` (which defaulted to `any`).
- `safeEncode()` and `safeEncodeAsync()` now correctly return `tsDnaParserResult<this["_input"]>` (input type) instead of `tsDnaParserResult<this["_output"]>` (output type), matching Zod v4's `ZodSafeParseResult<core.input<this>>`.
- `encode()` and `encodeAsync()` now correctly return `this["_input"]` instead of `this["_output"]`.
- Added type-regression tests for codec encode/decode return types covering sync, async, identity codec, union types, error branch, and Zod v4 parity.

---
"@ytn/dna": minor
---

Type-system cleanup, `fromDna` template support, and documentation accuracy pass.

- Renames `BaseCore` constructor parameter `type` to `kind` (hybrid label: opcode or descriptive name).
- Makes `_core` field public on `DnaType` and all subclasses; removes the `SymCore` symbol indirection.
- Adds per-class `.type` getter overrides returning Zod-aligned descriptive names (e.g. `"number"`, `"union"`, `"optional"`) instead of raw DNA opcodes.
- Marks `.format()` as internal (`_format` with `@internal` JSDoc); not part of the public API.
- Adds `template` opcode support in `fromDna` via internal `DnaTemplateReconstructed` subclass (bypasses irreversible regex re-escaping).
- Expands `fromDna` roundtrip test coverage from 2350 to 2550 tests (0 skipped, was 200 skipped).
- Adds high-level schema methods (`.validate()`, `.safeParse()`, `.parse()`, async variants, `.spa()`) as primary API in README; relegates `toJs`/`validator`/`parser` to advanced section.
- Fixes documentation: corrects `DnaUUID` casing, removes non-existent `z.deno()`/`z.node()`/`deepPartial()` from Zod v4 comparison, fixes `dna.coerce.int()` → `dna.int({ coerce: true })`, removes `dna.not()` references.
- Marks `performance-technical-notes.md` as historical (patterns don't match current codegen).
- Deletes `zod-test-evaluation.md` (porting tracking complete: 77/79 files ported).

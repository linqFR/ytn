---
"@ytrynot/dna": patch
---

Documentation consistency audit — fix inaccuracies across DNA docs.

- `docs/technical.md`: Fix `tsDnaOpcode` type definition to use short opcodes (`"s"`, `"n"`, etc.) matching `core.types.ts`. Remove false `format: "safeint"` reference. Complete opcode list with all 34 opcodes from `core.types.ts`.
- `docs/performance-technical-notes.md`: Reposition as a performance guide for AI agents (remove historical warning banner). Correct instanceof implementation examples to use `STEP.OUT_CONST`/`STEP.OUT_ARG` instead of outdated `preBody`/`getConstructor` pattern. Remove contradictory Key Takeaways bullet.
- `docs/zod-comparison.md`: Remove incorrect numerical claims (11 missing, 15 advantages). Correct missing features list to match the table (error formatting functions only). Mark `z.refine()` and `z.check()` top-level as ✅ (DNA has `dna.refine()`/`dna.check()`). Remove incomplete trailing note.
- `docs/externals.md`: Fix misleading "per-call" externals description — clarify that `ctx` is used at compile time only (function is cached). Add note recommending `schema.validate()`/`safeParse()` over low-level `validatorBuilder`/`parserBuilder`.
- `docs/opcode-patterns.md`: Replace incorrect `STEP.CONST` with `STEP.OUT_CONST` for helper functions and regex patterns. Add 3-mechanism distinction table (`STEP.OUT_CONST` / `preDecls` → `STEP.BODY` / `STEP.CONST`). Shorten `fCount`/`dEq` examples with reference to `inline-func.ts`. Fix `oLen` conditional logic. Add `STEP.CONST` vs `STEP.OUT_CONST` subsection.
- `docs/type-inventory.md`: Remove duplicate `.min()`/`.max()` entries in `dna.string()` key methods.

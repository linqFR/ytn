---
"@ytn/schvalid": patch
---

Documentation consistency audit — fix inaccuracies across schvalid docs.

- `docs/ajv-comparison.md`: Fix test runner description — `discoverJsonFiles()` IS recursive, optional/ files are filtered by `shouldSkipFile()`. Correct format count from 18 to 19 (matching `JSONFORMAT` in `string-formats.ts`). Qualify "~4x faster" compilation claim with reference to `tests/bench/`. Remove line counts from Source References. Fix test counts to 1243 passing per mode / 44 skipped (was 1201).
- `AGENTS.md`: Update JSON Schema Test Suite count from 1160/1201 to 1243 passing per mode, 44 skipped.
- `README.md`: Update test coverage count from 1201 to 1243 passing per mode, 44 skipped.

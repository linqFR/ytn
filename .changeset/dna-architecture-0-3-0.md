---
"@ytn/dna": minor
"@ytn/schvalid": patch
---

"@ytn/dna": Major architecture hardening and feature expansion for the DNA bytecode engine.

- Reworks the builder internals (`api-primitives.ts`, `api-enhanced.ts`, `dna-interfaces.ts`) for a clearer Zod-like fluent API.
- Adds `fromDna` reconstruction to rebuild fluent schemas from DNA bytecode.
- Renames the `chk` opcode to `chkSeq` and introduces `chkList` for `allOf` semantics.
- Renames the `seq` pipeline to `pipe`.
- Improves object `keepOnly` output handling and function tuple input support.
- Reorganizes shared types and metadata: `base.types.ts`, `error-codes.ts`, `standard-schema.types.ts`, `runtime.types.ts`.
- Adds `toJSONSchema` conversion support and handling for JWT, URL and `instanceOf` constraints.
- Removes the `fastFail` option in favor of a cleaner compiler architecture.
- Corrects `toJs` type declaration export paths.

"@ytn/schvalid": JSON Schema conversion and testing improvements.

- Integrates the official JSON Schema Test Suite as a git submodule.
- Reorganizes tests under `tests/schemas/` with parser-fast, discriminator and edge-cases suites.
- Improves `jschema-to-dna.ts` converter stability for edge-cases and discriminator handling.
- Adds performance bundle and comparative benchmark harness.

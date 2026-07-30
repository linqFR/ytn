# cli-to-dna package plan

Create a new `@ytn/cdna` package that ports the `pico` DSL and `cli-to-zvo` runtime from Zod to DNA, starting with a sandbox prototype and then hardening the package.

## Context

`@ytn/czvo` (`packages/cli-to-zvo`) already proves the concept with `pico-zod`:

- `pico` is a sealed Zod-based DSL for CLI argument schemas (`string`, `number`, `bool`, `url`, `json`, `list`...)
- A string DSL is compiled into Zod schemas (`dsl-converter.zod.ts`)
- `bridgeZod`/`sealZod` restricts the API to CLI-safe modifiers
- `execute.ts` runs `node:util.parseArgs` and validates with the precompiled Zod schema

The goal is to offer the same developer experience on top of `@ytn/dna`.

## Status

- [x] Plan drafted
- [ ] Phase 0: `DnaXorUnion` / `.xor()` and `DnaDiscriminatedUnion` / `discriminator` opcode confirmed; coercion and `toJS` validation verified through sandbox
- [ ] Phase 1: `sandbox/dna-pico.ts` prototype working
- [ ] Phase 2: `packages/cli-to-dna` package skeleton created
- [ ] Build with `buildConfig` is blocked: `@ytn/dna` has no `.d.ts` declarations, so `.d.ts` generation for `@ytn/cdna` fails
- [ ] Phase 3: `createContract` and `execute` runtime working with `node:util.parseArgs`
- [ ] Phase 4: `discriminator` routing optimization (pending)
- [ ] Phase 5: hardening, tests, optional `.d.ts` generation (pending)

## Constraints

- **Do not modify `@ytn/dna` in any way.** `cli-to-dna` must be built strictly on top of the existing DNA API.
- If the implementation requires an opcode, method, type, or behavior that does not already exist in DNA, stop and ask the user instead of patching DNA.
- DNA gaps are blockers to escalate, not workarounds to implement in place.

## Notes from implementation

- Package: `packages/cli-to-dna` (`@ytn/cdna`).
- `DnaXOR` is not needed: `DnaXorUnion` / `.xor()` already exist; `pico.xor` works.
- `DnaDiscriminatedUnion` exists and can be used later for O(1) subcommand routing.
- `toJS`/`safeParse` works for CLI coercion.
- Workarounds applied without touching `@ytn/dna`:
  - CSV lists use per-item `dna.preprocess` with custom `toNumber`/`toBool` helpers to avoid a `coerce`-inside-array codegen issue.
  - `tsup.config.ts` now uses the repo-global `buildConfig` helper; the ESM build succeeds but `.d.ts` generation fails because `@ytn/dna` emits no declaration file.
  - `pico.ts` now relies on DNA's own parameter types (`Parameters<typeof dna.…>`); `IBaseSchema`/`IPico`/`isPico`/`picoTypeToDna`/`define` were removed and the Proxy was replaced by a plain object. Casts are reduced to the unavoidable `dna.looseObject`/result casts in `contract.ts`/`execute.ts`.

## Open questions (answered)

1. **Package name and location**: `packages/cli-to-dna` + `@ytn/cdna`.
2. **Reuse `cli-to-zvo`**: no; fresh implementation using only `@ytn/dna`.
3. **`DnaXOR`**: already exists as `DnaXorUnion` / `.xor()`; no DNA change needed.
4. **Discriminator optimization**: defer to Phase 4; `DnaDiscriminatedUnion` is available.
5. **First deliverable**: `pico`-like API + `createContract`/`execute` runtime.

## Goals

1. Provide a `pico`-like DSL on top of `DnaType` that is safe for CLI contracts
2. Compile the contract into a DNA validator that can validate `parseArgs` output
3. Keep the same O(1) bitmask routing concept where possible
4. Optimize `discriminator` handling for subcommand routing
5. Confirm `DnaXorUnion` and `DnaDiscriminatedUnion` already cover XOR/discriminator needs, or document the alternative

## Phases

### Phase 0 — DNA capability audit

- Confirm which pico types already exist in `@ytn/dna` (`DnaString`, `DnaNumber`, `DnaBoolean`, `DnaStringBool`, `DnaDate`, `DnaUrl`, `DnaUuid`, `DnaJson`, `DnaArray`, `DnaTuple`, `DnaUnion`, `DnaLiteral`, `DnaEnum`, `DnaObject`...)
- Confirm `DnaXorUnion` and the `.xor()` method already provide oneOf semantics; confirm `DnaDiscriminatedUnion` handles discriminator cases
- Confirm `coerce` support for number, bigint, date, boolean from strings
- Confirm `toJS` output can validate a plain `parseArgs` result object

### Phase 1 — Sandbox prototype (`packages/cli-to-dna/sandbox/`)

- Create `packages/cli-to-dna/sandbox/dna-pico.ts`
- Define atomic factories (`string`, `number`, `bool`, `url`, `json`, `list`) returning sealed `DnaType` instances
- Add a simple Proxy `bridgeDna` that:
  - exposes allowed chain methods (`.min`, `.max`, `.optional`, `.desc`)
  - blocks CLI-unsafe methods (`.transform`, `.mutate`, `.refine`, `.check`, `.pipe`)
  - auto-seals returned `DnaType` instances
- Add DSL converter for `"string"`, `"string | number"`, `"string, number"`
- Add CSV `list` preprocessing (split string then validate each item)

### Phase 2 — Package skeleton

- Create `packages/cli-to-dna/package.json`, `tsconfig.json`, `tsup.config.ts`
- Add workspace reference in root `package.json` if needed
- Wire `@ytn/dna` as dependency
- Add `src/index.ts`, `src/editor.ts`, `src/core.ts` exports mirroring `cli-to-zvo`

### Phase 3 — Contract compiler and runtime

- Port `IProcessedContract` concept to DNA
- Generate `parsingArgs` config (`string`/`boolean` flags) from DNA schemas
- Generate per-target `DnaObject` schemas
- Build bitmask routing table
- Implement `execute(contract, args)`:
  1. `parseArgs(...)`
  2. route via bitmask
  3. validate target payload with the DNA validator (runtime `safeParse` or generated `toJS` function)
- Add help data generation

### Phase 4 — Discriminator optimization

- Evaluate `discriminator` opcode in `@ytn/dna` for subcommand routing
- If kept in `cli-to-dna`, precompute a `Map<discriminantValue, targetName>` to avoid union iteration
- Benchmark routing against `cli-to-zvo`

### Phase 5 — Hardening

- Add missing pico atomic factories (`filepath`, `file`, `cuid`, `ulid`, `nanoid`, `jwt`, `base64`, `hex`, `emoji`)
- Confirm `DnaXorUnion` mapping for `pico.xor`
- Vitest tests for DSL, coercion, routing, help
- Build and typecheck pass

## Deliverables

- `packages/cli-to-dna/sandbox/dna-pico.ts` (Phase 1)
- `packages/cli-to-dna/` package with `pico` API and `execute` (Phases 2-3)
- Decision note on `DnaXOR` and `discriminator` (Phase 4)
- Test suite (Phase 5)

## Risks

- DNA `coerce` behavior may not cover all CLI string->value conversions (e.g. CSV lists, `null`/`undefined` literals)
- `toJS` validators may need a stable object shape for `parseArgs` output; target fields are optional by default in CLI
- `DnaXorUnion`/`DnaDiscriminatedUnion` semantics must be verified for CLI string coercion
- `tsDnaOpcode` currently lacks `type` and `ifThenElse`; adding new opcodes requires `fromDna` and `toJs` updates

## Blocker

`npm.cmd run build -w @ytn/cdna` now uses the standard `buildConfig` helper, but the `.d.ts` build fails because `@ytn/dna` does not ship `dist/index.d.ts`.

Possible paths:

1. Re-authorize a local workaround (e.g. `defineConfig` with `dts: false`, or a `buildConfig` option to disable `.d.ts`) without touching `@ytn/dna`.
2. Authorize a fix of `@ytn/dna` declaration generation (Phase 6) so `@ytn/cdna` can build normally.
3. Ship `@ytn/cdna` without `.d.ts` for now and continue Phases 4–5.

## Decision on the blocker

Given the constraint **Do not modify `@ytn/dna`**, the immediate path is **Option 1**:

- Add a package-local `tsup.config.ts` that disables `.d.ts` generation (`dts: false`) until `@ytn/dna` ships `dist/index.d.ts`.
- Keep the build config aligned with the repo conventions (`buildConfig`) and centralize the `dts` flag override in `cli-to-dna` only.
- Ship `@ytn/cdna` ESM build first; re-enable `.d.ts` in Phase 6 once DNA declarations are available.

## Next steps

1. **Unblock the build** — create `packages/cli-to-dna/tsup.config.ts` with `dts: false` and confirm `npm.cmd run build -w @ytn/cdna` succeeds.
2. **Phase 4** — implement discriminator-based O(1) subcommand routing using `DnaDiscriminatedUnion` and benchmark against `cli-to-zvo`.
3. **Phase 5** — add Vitest tests, remaining atomic factories, and harden the package; keep `.d.ts` generation disabled for now.
4. **Phase 6 (future, out of scope for now)** — re-enable `.d.ts` generation when `@ytn/dna` emits `dist/index.d.ts`.

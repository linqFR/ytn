---
"@ytn/dna": minor
"@ytn/schvalid": patch
"@ytn/qb": patch
"@ytn/czvo": patch
---

"@ytn/dna": Type-system refactor, new combinators, and validator performance improvements since the architecture changeset.

- **Breaking**: Renames exported interface `IDnaType` → `DnaSomeType` to comply with naming conventions (`I*` is reserved for Input/Config data).
- **Breaking**: Removes the `infer<T>` helper type alias from `helpers.types.ts` (use `$Output<T>` instead).
- Adds `xor` combinator API (`dna.xor(...)`) and simplifies `DnaXorUnion` to a single type parameter.
- Refactors `readonly()` return type to use `$ReadonlyReturnType<this>` for cleaner type inference instead of the previous explicit `DnaType<$ReadonlyValue<T>, ...> & Omit<this, ...>` intersection.
- Refactors `default()` and `prefault()` method signatures to use `this["_output"]` / `this["_input"]` instead of the class-level `T` / `I` generics.
- Refactors wrapper classes (`DnaOptional`, `DnaNullable`, `DnaNullish`, `DnaNonOptional`, `DnaDefault`, `DnaPrefault`, `DnaCatch`, `DnaExactOptional`) to use `declare readonly _output` / `declare readonly _input` instead of passing output/input types through `_DnaWrapper` generics.
- Improves `DnaLazy` type inference with explicit `$Output<S>` / `$Input<S>` generic parameters.
- Hoists regex constants to `OUT_CONST` steps in string validators (pattern + format) and object pattern-property validators, reducing per-call regex compilation and GC pressure.
- Cleans up `toJs/todo.ts` backlog (205 lines removed) after the builder/`WrapperImpl` refactor.
- Adds hybrid POC for Zod-like recursive type architecture in `sandbox/zod-like-type-architecture/`.
- Adds comprehensive `docs/dnatype-inventory.md` (2186 lines) documenting the full DnaType architecture and type-system.
- Bumps `jose` to ^6.2.7, adds `tsconfig.diag.json` for focused diagnostics, centralizes tsconfig include patterns.

"@ytn/schvalid": Performance tooling and testing infrastructure.

- Adds `perf/runtime-function-analyzer.ts` (258 lines) for inspecting generated validator/parser function characteristics.
- Clarifies benchmark results documentation in README.
- Adds JSON Schema Test Suite as git submodule for testing.
- Migrates build back to tsup and cleans up imports.

"@ytn/qb": Build infrastructure and configuration.

- Migrates build from tsup to tsdown and back to tsup.
- Centralizes tsconfig include patterns in `tsconfig.base.json`.

"@ytn/czvo": Codec refactor and build infrastructure.

- Refactors `makeEmptyTo` in `zod-codecs.ts`: removes the `z.coerce.string().pipe(...)` wrapper in favor of a direct `z.preprocess(...)` with explicit return type annotation. Non-string inputs are no longer coerced to string before preprocessing — they fall through to the `""` branch (same as before for non-string `typeof` checks).
- Reorganizes performance tests from `tests/performance/` to `perf/` (standalone tsx scripts).
- Migrates build from tsup to tsdown and back to tsup.
- Centralizes tsconfig include patterns in `tsconfig.base.json`.

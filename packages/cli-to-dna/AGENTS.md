# AGENTS.md (Package: @ytrynot/cdna)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**.

## Naming Standards Enforcement

This package follows the global naming standards. Refer to the examples below for specific implementations within this codebase.

### 1. Input Data Structures (`I*`)

- **Examples**: `IContract` (the declarative contract definition), `ICliFlag` (a single CLI flag config), `IProcessedContract` (the compiled output of `createContract`), `IParsingArgs` (internal parsing arguments for `node:util.parseArgs`).

### 2. Output Data Structures (`O*`)

- No `O*` types are currently exported. The runtime result shape (`IResult`) is defined in `pico.ts` and re-exported via the `BasePico.safeParse` return type.

### 3. Type Aliases & Internal Types

- **`DnaSchema`**: Type alias derived from `@ytrynot/dna`'s `union` parameters — represents a compiled DNA schema.
- **`BasePico`**: The sealed, immutable validator interface returned by all `pico.*` methods.
- **`Pico`**: The top-level API interface describing the `pico` namespace.
- **`LiteralInput`**: Internal union for `pico.literal()` input values.
- **`PicoMethod`**: Internal union of chainable method names.

---

## Architectural Context

- **Role**: `@ytrynot/cdna` is a CLI tool that compiles a declarative JSON Schema-style contract into standalone JS CLI validators and parsers using **DNA bytecodes**. It is a thin wrapper around `@ytrynot/dna`.
- **Compilation Flow**:
  1. `createContract()` receives an `IContract` (name, description, CLI flags/positionals, and typed targets).
  2. Each target field value is converted to a DNA schema via `picoToDna()`.
  3. Targets are combined into a single `dna.union` validator (`pico.or(...)`).
  4. The result (`IProcessedContract`) holds the validator and the `node:util.parseArgs` configuration.
- **Execution Flow**: `execute()` calls `node:util.parseArgs` with the compiled parsing arguments, merges positionals into the values object, then runs `validator.safeParse(input)`.
- **pico API**: A sealed, immutable validator surface (`pico.ts`) that wraps `@ytrynot/dna` primitives with CLI-optimized coercions:
  - `pico.number()` uses `dna.coerce.number()` for string-to-number coercion.
  - `pico.bool()` uses `dna.stringbool()` to accept `"true"/"yes"` and `"false"/"no"`.
  - `pico.numList()`, `pico.stringList()`, `pico.boolList()` use `dna.preprocess(split, ...)` to parse comma-separated strings into arrays. Per-item preprocess avoids the `coerce`-inside-array codegen bug in DNA.
  - `pico.or()`, `pico.xor()`, `pico.tuple()` compose multiple schemas.
- **Wrapper Unwrapping**: `BasePico` instances are tracked in a `WeakMap` (`wrapperMap`) so that `picoToDna()` can unwrap them back to the underlying DNA schema. This keeps the public API sealed while allowing internal access to raw schemas.

### Dependencies

- **`@ytrynot/dna`** (devDependencies): The bytecode schema engine. Declared in `devDependencies` and inlined at build time via `tsup` (consistent with the monorepo's private-toolbox inlining convention). This package cannot function without it.

---

## Conventions

- **Sealed API**: The `pico` API is intentionally sealed — chainable methods (`.min()`, `.max()`, `.optional()`, etc.) return new `BasePico` instances but do not expose the underlying DNA schema. Use `picoToDna()` to unwrap when raw schema access is needed.
- **No Routing Engine**: Unlike `@ytrynot/czvo`, this package does **not** implement bitmask-based routing or discriminant-based command dispatch. It compiles all targets into a single `dna.union` and validates the parsed input against it.
- **parseArgs Configuration**: `createContract` always sets `allowPositionals: true`, `allowNegative: false`, and `strict: false` in the parsing arguments. These are not currently configurable.
- **Private Package**: This package is private (`"private": true` in `package.json`, listed in `.changeset/config.json` `ignore`). It is never published to npm. Changes do NOT require a changeset.

---

## TS 6.0 Specifics

- **Pure ESM**: All imports use explicit `.js` extensions (e.g., `./pico.js`, `./contract.js`) per `NodeNext` + `verbatimModuleSyntax` requirements.
- **Type-Only Imports**: `import type` is used for type-only imports (`IProcessedContract`, `BasePico`, `DnaSchema`) to comply with `verbatimModuleSyntax`.

---

## Testing Standards

- **Framework**: Vitest (Pure ESM).
- **Coverage**: Tests should cover contract compilation, the `pico` API coercions (especially list parsing and stringbool), and `execute()` end-to-end behavior.

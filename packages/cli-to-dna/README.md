# @ytrynot/cdna

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Private](https://img.shields.io/badge/Package-Private-red.svg)](#license)

> Compile JSON Schema-style contracts into standalone JS CLI validators and parsers using **DNA bytecodes**.

`@ytrynot/cdna` is a command-line tool that transforms a declarative contract (positionals, flags, and typed targets) into a validated CLI parser backed by the [`@ytrynot/dna`](https://github.com/linqFR/ytn/tree/main/packages/dna) bytecode engine. It bridges the gap between a simple CLI definition and runtime-validated, type-safe command execution — without the overhead of a full schema library at runtime.

> [!NOTE]
> This is a **private** package. It is not published to the npm registry and is intended for internal use within the `ytrynot` monorepo only.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [createContract](#createcontract)
  - [execute](#execute)
  - [pico](#pico)
  - [picoToDna](#picotodna)
- [License](#license)

## Introduction

`@ytrynot/cdna` lets you define a CLI contract — positional arguments, flags, and one or more typed target objects — and compiles it into a standalone validator powered by DNA bytecodes. At runtime, `execute()` parses `process.argv` (or a custom argument list) through Node's native `node:util.parseArgs`, then validates the resulting input against the compiled DNA schemas.

This package is a thin wrapper around `@ytrynot/dna`, exposing a `pico` API that provides CLI-optimized coercions (string-to-number, comma-separated lists, stringbool, etc.) while remaining sealed and immutable.

## Features

- **DNA-Backed Validation**: Targets are compiled into `@ytrynot/dna` bytecode schemas for fast, standalone validation.
- **pico API**: A sealed, immutable validator surface optimized for CLI coercion (`string`, `number`, `bool`, `numList`, `stringList`, `filepath`, `url`, `json`, and more).
- **Native parseArgs Integration**: Leverages `node:util.parseArgs` for argument parsing — no external CLI parser dependency.
- **Union Targets**: Multiple targets are combined into a single `dna.union`, allowing flexible routing across command shapes.
- **Composable**: `pico.or()`, `pico.xor()`, and `pico.tuple()` allow building complex validation logic from primitives.

## Installation

This package is private and not available on npm. Within the `ytrynot` monorepo (npm workspaces):

```bash
npm install @ytrynot/cdna
```

## Usage

```typescript
import { createContract, execute, pico } from "@ytrynot/cdna";

// 1. Define the contract
const contract = createContract({
  name: "mycli",
  description: "A sample CLI tool",
  cli: {
    positionals: ["input"],
    flags: {
      output: { short: "o", type: "string" },
      verbose: { short: "v", type: "boolean" },
    },
  },
  targets: {
    run: {
      input: pico.string(),
      output: pico.string().optional(),
      verbose: pico.boolean().optional(),
    },
  },
});

// 2. Parse and validate (defaults to process.argv.slice(2))
const result = execute(contract, ["my-file.txt", "--output", "out.txt", "--verbose"]);

if (result.success) {
  const data = result.data as Record<string, unknown>;
  console.log("Input:", data.input);
  console.log("Output:", data.output);
  console.log("Verbose:", data.verbose);
} else {
  console.error("Validation failed:", result.errors);
}
```

## API Reference

### `createContract`

```typescript
function createContract(contract: IContract): IProcessedContract;
```

Compiles a declarative contract into a processed object containing a DNA-backed validator and parsing arguments.

- **`contract`** *(IContract)*: The contract definition.
  - `name` *(string)*: The CLI tool name.
  - `description` *(string)*: A short description.
  - `cli` *(object)*: The CLI interface definition.
    - `positionals` *(string[])*: Ordered names for positional arguments.
    - `flags` *(Record<string, ICliFlag>)*: Flag definitions (`short`, `type`).
  - `targets` *(Record<string, Record<string, unknown>>)*: Typed target objects. Each field value is converted via `picoToDna`.
- **Returns**: An `IProcessedContract` with `validator` (a `BasePico`) and `parsingArgs` (for `node:util.parseArgs`).

### `execute`

```typescript
function execute(processed: IProcessedContract, args?: string[]): unknown;
```

Parses command-line arguments and validates them against the compiled contract.

- **`processed`** *(IProcessedContract)*: The output of `createContract`.
- **`args`** *(string[])*: Optional argument list. Defaults to `process.argv.slice(2)`.
- **Returns**: The result of `validator.safeParse(input)` — an `IResult` with `success`, `data`, and `errors`.

### `pico`

A sealed, immutable validator API optimized for CLI coercion. Each method returns a `BasePico` supporting chainable modifiers (`.min()`, `.max()`, `.optional()`, `.describe()`, etc.).

| Method | Description |
| :--- | :--- |
| `pico.string()` | String primitive (supports `.min()`, `.max()`, `.email()`, `.url()`, `.uuid()`, `.regex()`). |
| `pico.number()` | Coerced number (supports `.min()`, `.max()`, `.int()`, `.positive()`, `.negative()`). |
| `pico.boolean()` | Strict boolean. |
| `pico.bool()` | Stringbool — accepts `"true"/"yes"` and `"false"/"no"`. |
| `pico.url()` | URL string validator. |
| `pico.json()` | JSON string validator. |
| `pico.filepath()` | File path validator. |
| `pico.numList()` | Comma-separated list coerced to `number[]`. |
| `pico.stringList()` | Comma-separated list coerced to `string[]`. |
| `pico.boolList()` | Comma-separated list of stringbools. |
| `pico.literal(value)` | Literal value validator. |
| `pico.or(...items)` | Union of schemas. |
| `pico.xor(...items)` | Exclusive-or of schemas. |
| `pico.tuple(...items)` | Ordered tuple of schemas. |

### `picoToDna`

```typescript
function picoToDna(pico: unknown): DnaSchema;
```

Unwraps a `BasePico` wrapper to its underlying `@ytrynot/dna` schema. Used internally by `createContract` to convert target field values into DNA schemas.

## License

MIT — See [LICENSE](./LICENSE) for details.

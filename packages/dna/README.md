[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-TOUPDATE%2FTOUPDATE%20Passed-brightgreen.svg)](#tests)

# @ytn/dna

DNA bytecode Builder and Validation/Parsing engine.

**Motivation**: Zod is powerful but makes it difficult to serialize schemas and to build optimal and autonomous JS functions. Hence the creation of this package.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Using the DNA Builder API](#using-the-dna-builder-api)
  - [Compiling DNA to JavaScript Validators](#compiling-dna-to-javascript-validators)
  - [Using the Low-Level toJS Compiler](#using-the-low-level-tojs-compiler)
- [Development](#development)
- [Technical Documentation](#technical-documentation)

## Overview

`@ytn/dna` is the core validation engine that compiles DNA bytecode into high-performance JavaScript validators. The DNA format uses opcodes and numeric sentinels for optimal V8 performance.

This package provides the runtime validation engine only. For JSON Schema to DNA conversion, use `@ytn/schvalid`.

DNA Schema provides two validation modes:

- **Validator Mode**: Ultra-fast boolean validation (fail-fast). ~1.5-2x faster than AJV Minimal for valid data.
- **Parser Mode**: First blocking error collection with data transformation. Comparable or faster than AJV Minimal.

**DNA to JS produces a standalone JS function.**

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

## Installation

```bash
npm install @ytn/dna
```

## Usage

### Using the DNA Builder API

The DNA builder provides a Zod-like fluent API for constructing DNA bytecode schemas directly:

```typescript
import { dna } from "@ytn/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
  email: dna.string().email()
});

// Get the DNA bytecode
const dnaBytecode = schema.toDna();
```

Supported builder methods:
- **Primitives**: `dna.string()`, `dna.number()`, `dna.integer()`, `dna.boolean()`, `dna.null()`
- **Constraints**: `.min()`, `.max()`, `.length()`, `.pattern()`, `.email()`, `.uuid()`, `.url()`
- **Compound**: `dna.object()`, `dna.array()`, `dna.optional()`, `dna.nullable()`
- **Logic**: `dna.anyOf()`, `dna.allOf()`, `dna.oneOf()`, `dna.not()`

### Compiling DNA to JavaScript Validators

```typescript
import { validator, parser, toJS } from "@ytn/dna";

// DNA bytecode (typically obtained from @ytn/schvalid)
const dna = /* DNA bytecode array */;

// Fast boolean validator (fail-fast, no error collection)
const validate = validator(dna);
const isValid = validate({ name: "John", age: 30 }); // true

// Full parser with error collection and data transformation
const parse = parser(dna);
const result = parse({ name: "John", age: 30 });
// Returns: { success: true, data: { name: "John", age: 30 } }

const invalidResult = parse({ name: "Jo", age: -1 });
// Returns: { success: false, errors: [...] }
```

### Using the Low-Level toJS Compiler

```typescript
import { toJS } from "@ytn/dna";

// FALSE : to rewrite

const dna = /* DNA bytecode array */;

// Compile in validation mode (fail-fast)
const validateCode = toJS(true)(dna);
const validateFn = new Function(validateCode[0], validateCode.slice(1).join('\n'));

// Compile in parser mode (error collection)
const parseCode = toJS(false)(dna);
const parseFn = new Function(parseCode[0], parseCode.slice(1).join('\n'));
```

## Development

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## License

MIT

## Author

linqFR

## Technical Documentation

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

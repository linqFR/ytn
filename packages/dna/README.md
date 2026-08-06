[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-438%2F581%20Passed-brightgreen.svg)](#tests)

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
  - [Round-trip DNA Reconstruction](#round-trip-dna-reconstruction)
- [Development](#development)
- [Technical Documentation](#technical-documentation)

## Overview

`@ytn/dna` is the core validation engine that compiles DNA bytecode into high-performance JavaScript validators. The DNA format uses opcodes and numeric sentinels for optimal V8 performance.

This package provides the runtime validation engine only. For JSON Schema to DNA conversion, use `@ytn/schvalid`.

DNA Schema provides two validation modes:

- **Validator Mode**: Ultra-fast boolean validation (fail-fast). About as fast as AJV Minimal for valid data on the reference benchmark.
- **Parser Mode**: First blocking error collection with data transformation. Slower than AJV Minimal for simple valid data because it builds a fresh output object; the generated function is notably smaller than AJV.

### Parser vs Validator

`validator()` is a plain boolean validator, comparable to AJV. It only checks that the input satisfies the schema and returns `true` or `false`.

`parser()` is a `parse`+`transform` operation, comparable to Zod `parse()`. It does three things:

1. **Validates** the input and collects the first blocking error set.
2. **Reconstructs** the data into a fresh `Object.create(null)` output object.
3. **Returns** `{ success: true, data }` on success or `{ success: false, errors }` on failure.

Reconstruction means the parser:

- creates a new object with no prototype (`Object.create(null)`),
- copies the input's own properties with `Object.assign` so unknown properties allowed by `additionalProperties`/`unevaluatedProperties` are preserved,
- rebuilds arrays into new arrays,
- keeps arbitrary property names (including `__proto__`, `constructor`, `toString`) as ordinary own keys instead of inherited or magic properties.

Because of this transformation, `parser()` is necessarily slower than `validator()` — it does strictly more work than a boolean validator. Use `validator()` when you only need a true/false answer. Use `parser()` when you need a guaranteed fresh, isolated output object with detailed errors on failure.

Note that class instances and prototype chains are not preserved by `parser()`. If the input must remain an instance of a specific class, use `dna.instanceof()` or keep the object outside of the parser path.

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

const dna = /* DNA bytecode array */;

// Compile in validation mode (fail-fast) for canonical JSON-Schema DNA opcodes
const validateCode = toJS(true, false)(dna) as string[];
const validateFn = new Function(validateCode[0], validateCode.slice(1).join('\n'))();

// Compile in parser mode (error collection)
const parseCode = toJS(false, false)(dna) as string[];
const parseFn = new Function(parseCode[0], parseCode.slice(1).join('\n'))();
```

Use the second argument `enhancedMapper: true` when compiling DNA produced by the fluent `dna.*` builder API:

```typescript
import { toJS } from "@ytn/dna";

const dna = /* DNA bytecode array from dna builder */;
const result = toJS(true, true)(dna) as { code: string[]; requiredExternals: string[] };
const fn = new Function(...result.code)({ /* required externals */ });
```

### Round-trip DNA Reconstruction

`@ytn/dna` can rebuild a fluent builder schema from its own DNA bytecode. This is used by the `fromDna` roundtrip tests and lets you serialize, transfer, and restore a schema without touching JSON Schema:

```typescript
import { dna, fromDna } from "@ytn/dna";

const original = dna.object({
  name: dna.string().min(2),
  tags: dna.array(dna.string()),
});

const bytecode = original.toDna();
const rebuilt = fromDna(bytecode);

// The rebuilt schema produces the same validation/parse results.
// The canonical DNA is structurally equivalent; exact numeric IDs may differ.
const input = { name: "John", tags: ["a"] };
const originalResult = original.safeParse(input);
const rebuiltResult = rebuilt.safeParse(input);
console.log(originalResult.success === rebuiltResult.success);
if (originalResult.success && rebuiltResult.success) {
  // The roundtrip tests compare these with toEqual (deep equality, order-agnostic).
  console.log(rebuiltResult.data); // same parsed value as originalResult.data
}
```

Supported roundtrip families:

- **Primitives**: `string`, `number`, `integer`, `bigint`, `boolean`, `null`, `undefined`, `NaN`, `literal`, `enum`, `any`, `never`, `unknown`.
- **Wrappers**: `optional`, `nullable`, `nullish`, `nonoptional`, `default`, `prefault`, `catch`.
- **Collections**: `object` (`$o`), `array`/`tuple`, `record` (`rcd`), `Map`/`Set` reconstructed from `seq`.
- **Logic**: `anyOf`, `allOf`, `not`, `discriminator`.
- **Refinements**: `property` checks (min/max/size), `func` checks (`.refine`, `.superRefine`, `.check`), `jwt`.
- **External / special types**: `instanceOf` (registered constructors), `url` (protocol/hostname regex).
- **Pipelines**: `seq`, `transform`, `pipe` (sync and async), `codec` when the encode/decode functions are serializable.
- **Metadata**: `readonly`, `description`, `~inner` constraints are preserved.

Limitations:

- `.transform`, `.preprocess`, `.coerce` and custom codecs can be reconstructed only when their function source is serializable (the builder keeps `fn.toString()`).
- Fully arbitrary JavaScript functions or closures with captured external variables may not roundtrip.
- Async `transform` / `pipe` / `codec` roundtrip parity is verified with `safeParseAsync` / `parseAsync`.
- `safeParse`/`validate` parity for the rebuilt schema still depends on the `toJs` codegen supporting the same opcodes.

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

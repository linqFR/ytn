[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-1160%2F1160%20Passed-brightgreen.svg)](#tests)

# @ytn/schvalid

DNA JSON Schema processing and validation.

> **Important**: This package only supports and validates JSON Schema 2020-12 with internal references. External `$ref` (HTTP URIs, URNs, or external files) are not supported.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Limitations](#limitations)
- [Usage](#usage)
  - [Converting JSON Schema to DNA](#converting-json-schema-to-dna)
  - [Converting DNA back to JSON Schema](#converting-dna-back-to-json-schema)
  - [Validation with DNA](#validation-with-dna)
  - [Compile Once, Validate Many](#compile-once-validate-many)
  - [Discriminator Support](#discriminator-support)
- [Performance](#performance)
- [Development](#development)
- [Peer Dependencies](#peer-dependencies)
- [Dependencies](#dependencies)

## Overview

`@ytn/schvalid` provides JSON Schema to DNA bytecode conversion and validation using the high-performance DNA engine from `@ytn/dna`. It serves as the primary interface for JSON Schema validation in the YTN ecosystem.

## Installation

```bash
npm install @ytn/schvalid
```

## Limitations

**External URIs:** This package does not currently handle external JSON Schema references (`$ref` pointing to external files or HTTP URIs). Only internal references within the same schema document are supported.

## Usage

### Converting JSON Schema to DNA

```typescript
import { jschemaToDna } from "@ytn/schvalid";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 0 },
  },
};

const dna = jschemaToDna(schema);
// Returns DNA bytecode array
```

### Converting DNA back to JSON Schema

```typescript
import { dnaToJSchema } from "@ytn/schvalid";

const schema = dnaToJSchema(dna);
// Returns original JSON Schema
```

### Validation with DNA

`@ytn/schvalid` provides convenience functions that combine JSON Schema conversion and validation in a single call:

```typescript
import { validate, parse } from "@ytn/schvalid";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 0 },
  },
};

// Fast boolean validator (fail-fast, no error collection)
const isValid = validate(schema, { name: "John", age: 30 }); // true

// Full parser with error collection and data transformation
const result = parse(schema, { name: "John", age: 30 });
// Returns: { success: true, data: { name: "John", age: 30 } }

const invalidResult = parse(schema, { name: "Jo", age: -1 });
// Returns: { success: false, errors: [...] }
```

For advanced use cases, you can also convert to DNA first and then use the `@ytn/dna` validation engine directly:

```typescript
import { jschemaToDna } from "@ytn/schvalid";
import { validator, parser } from "@ytn/dna";

const dna = jschemaToDna(schema);
const validateFn = validator(dna);
const parseFn = parser(dna);
```

### Compile Once, Validate Many

For performance-critical scenarios, use the `schvalid()` builder API to compile a schema once and reuse the validation function:

```typescript
import { schvalid } from "@ytn/schvalid";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 0 },
  },
};

// Compile once
const compiler = schvalid("validation");
const validate = compiler.compile(schema);

// Validate many times efficiently
validate({ name: "John", age: 30 }); // true
validate({ name: "Jo", age: -1 }); // false
```

The `schvalid()` function accepts three modes:

- **"validation"**: Returns a boolean validator function (fail-fast)
- **"parser"**: Returns a parser function with error collection
- **"both"**: Returns an object with both `validate` and `parse` functions

```typescript
import { schvalid } from "@ytn/schvalid";

// Get both validator and parser
const compiler = schvalid("both");
const { validate, parse } = compiler.compile(schema);

validate(data); // boolean
parse(data); // { success: true, data: ... } | { success: false, errors: [...] }
```

### Discriminator Support

DNA Schema supports the OpenAPI 3.1 `discriminator` keyword for optimized validation of polymorphic schemas:

```typescript
import { jschemaToDna } from "@ytn/schvalid";
import { validator, parser } from "@ytn/dna";

const schema = {
  type: "object",
  discriminator: {
    propertyName: "type",
  },
  required: ["type", "name"],
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "cat" },
        name: { type: "string" },
        meows: { type: "boolean" },
      },
    },
    {
      type: "object",
      properties: {
        type: { const: "dog" },
        name: { type: "string" },
        barks: { type: "boolean" },
      },
    },
  ],
};

const dna = jschemaToDna(schema);
const validate = validator(dna);
const parse = parser(dna);

validate({ type: "cat", name: "Whiskers", meows: true }); // true
validate({ type: "bird", name: "Tweety" }); // false

const result = parse({ type: "cat", name: "Whiskers", meows: true });
// Returns: { success: true, data: { type: "cat", name: "Whiskers", meows: true } }
```

The discriminator is optimized with a `switch` statement in the generated JavaScript code for efficient dispatching to the correct sub-schema based on the discriminator property value.

## Performance

**Benchmark Results** (vs AJV 2020):

- Compilation: **~20-25x faster** than AJV Minimal
- Validation (valid data): **~1.5-2x faster** than AJV Minimal
- Generated code size: **4x smaller** than AJV (1295 bytes vs 5293 bytes)
- Parser mode: Collects first blocking error with **~35% smaller** standalone code than AJV validation function with **comparable or faster** validation performance.

## Development

### Build

```bash
npm run build
```

### Testing

```bash
# Run JSON Schema test suite only (1192 tests)
npm test

# Run all tests including discriminator and performance benchmarks
npm run test:full

# Run performance benchmarks only
npm run test:performance
```

**Test Coverage**: 1160 passing, 44 skipped.

- The 44 skipped tests are from the JSON Schema Test Suite and involve external references (`$ref` to HTTP URIs, URNs, or external files), which are explicitly out of scope for DNA Schema (only internal references are supported).

The test suite includes:

- **JSON Schema Test Suite**: Comprehensive validation against official JSON Schema 2020-12 test cases. For more information, read [JSON Schema Validation Suite](tests/json-schema-suite/README.md). Skipped: `refRemote.json`, `dynamicRef.json`, `content.json`, `vocabulary.json`.
- **Discriminator Tests**: Full coverage of OpenAPI 3.1 discriminator keyword with validator and parser modes.
- **Performance Benchmarks**: Comparative benchmarks against AJV for compilation and validation speed.

## Peer Dependencies

- `zod`: ^4.4.3

## Dependencies

- `@ytn/dna`: \* (workspace dependency)

## License

MIT

## Author

linqFR

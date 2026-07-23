[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-2472%2F2472%20Passed-brightgreen.svg)](#tests)

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

### Converting DNA back to JSON Schema (soon)

```typescript
import { dnaToJSchema } from "@ytn/schvalid";

const schema = dnaToJSchema(dna);
// Returns original JSON Schema
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
import { schvalid } from "@ytn/schvalid";

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

const { validate, parse } = schvalid("both").compile(schema);

validate({ type: "cat", name: "Whiskers", meows: true }); // true
validate({ type: "bird", name: "Tweety" }); // false

const result = parse({ type: "cat", name: "Whiskers", meows: true });
// Returns: { success: true, data: { type: "cat", name: "Whiskers", meows: true } }
```

The discriminator is optimized with a `switch` statement in the generated JavaScript code for efficient dispatching to the correct sub-schema based on the discriminator property value.

`additionalProperties` (and especially `additionalProperties: false`) defined on the root schema is inherited by each `oneOf` branch so that unknown properties are rejected while the discriminator property itself is still allowed.

## Performance

**Benchmark Results** (vs AJV 2020):

- Compilation: **~5x faster** than AJV Minimal
- Validation (valid data): **~1.10 faster** than AJV Minimal
- Parser mode: Collects first blocking error with **~20% smaller** standalone code than AJV validation function with **comparable or faster** validation performance.

## Development

### Build

```bash
npm run build
```

### Testing

```bash
# Run JSON Schema test suite plus discriminator and edge-cases tests
npm test

# Run all tests including performance benchmarks
npm run test:full

# Run performance benchmarks only
npm run test:perf
```

**Test Coverage of JSON validation Suite**: 1201 passing, 44 skipped.

- The 44 skipped tests are from the JSON Schema Test Suite and involve external references (`$ref` to HTTP URIs, URNs, or external files), which are explicitly out of scope for DNA Schema (only internal references are supported).

The full test suite includes:

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

[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ytn/schvalid.svg)](https://www.npmjs.com/package/@ytn/schvalid)
[![Bundle size](https://packagephobia.com/badge?p=@ytn/schvalid)](https://packagephobia.com/result?p=@ytn/schvalid)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
  - [Fast Hybrid Parsing](#fast-hybrid-parsing)
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

## Comparison with AJV

@ytn/schvalid covers all core JSON Schema 2020-12 keywords with full parity — types,
object/array constraints, const/enum, allOf/anyOf/oneOf, if/then/else, not,
patternProperties, dependentRequired/Schemas, internal $ref, $id, $defs, discriminator.
It does not aim to replace AJV in all use cases. Key differences:

- **schvalid adds**: DNA bytecode intermediate representation (IR), `parseFast` hybrid mode,
  three-mode compilation API, parser output construction, standalone JS via `toJS()`,
  ~4x faster compilation.
- **schvalid lacks**: external $ref, custom formats, user-defined keywords, async
  validation, $data, type coercion, default injection, removeAdditional, vocabularies,
  schema registry, multi-draft support.

Full feature-by-feature comparison: [docs/ajv-comparison.md](docs/ajv-comparison.md).

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

The `schvalid()` function accepts four modes:

- **"validation"**: Returns a boolean validator function (fail-fast)
- **"parser"**: Returns a parser function with error collection
- **"fast"**: Returns a hybrid parser — validates first, only re-runs the full parser on failure (see trade-offs below)
- **"all"**: Returns an object with `validate`, `parse`, and `parseFast` functions (compiled once, shared instances)

```typescript
import { schvalid } from "@ytn/schvalid";

// Get validator, parser, and the fast hybrid parser
const compiler = schvalid("all");
const { validate, parse, parseFast } = compiler.compile(schema);

validate(data); // boolean
parse(data); // { success: true, data: ... } | { success: false, errors: [...] }
parseFast(data); // same shape as parse(), but data===input on the happy path (no fresh copy)
```

### Fast Hybrid Parsing

`schvalid("fast")` (and `parseFast` from `schvalid("all")`) provides a hybrid parser that
validates first (cheap, fail-fast) and only re-runs the full parser if validation fails:

```typescript
import { schvalid } from "@ytn/schvalid";

const parseFast = schvalid("fast").compile(schema);

const result = parseFast({ name: "John", age: 30 });
// { success: true, data: { name: "John", age: 30 } }
```

**Trade-off**: on success, `parseFast`'s `data` is the **same reference** as the input
(`data === input`) — no fresh copy is built, unlike `schvalid("parser")`'s `parse()`, which
always returns a newly constructed output object. Both agree on validity (constraints like
`additionalProperties: false` are checked identically), so there's no discrepancy in
pass/fail decisions — only in whether `data` is a fresh object or the original reference.

Use `parseFast` for validation-heavy workloads where a fresh, isolated `data` object isn't
required on the happy path. Use the regular `parser()` when downstream code needs its own
copy of the validated data.

```typescript
// Get validate + parse + parseFast in one compile pass (single validate/parse compilation,
// shared between parse() and parseFast() — see @ytn/schvalid AGENTS.md for the invariant)
const { validate, parse, parseFast } = schvalid("all").compile(schema);
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

const { validate, parse } = schvalid("all").compile(schema);

validate({ type: "cat", name: "Whiskers", meows: true }); // true
validate({ type: "bird", name: "Tweety" }); // false

const result = parse({ type: "cat", name: "Whiskers", meows: true });
// Returns: { success: true, data: { type: "cat", name: "Whiskers", meows: true } }
```

The discriminator is optimized with a `switch` statement in the generated JavaScript code for efficient dispatching to the correct sub-schema based on the discriminator property value.

`additionalProperties` (and especially `additionalProperties: false`) defined on the root schema is inherited by each `oneOf` branch so that unknown properties are rejected while the discriminator property itself is still allowed.

## Performance

**Benchmark Results** (vs AJV 2020 — not a correctness test, run via `npm run bench`):

- Compilation: ~4x faster than AJV Minimal.
- Validation (valid data): about as fast as AJV Minimal.
- Parser mode: produces a standalone function ~30% smaller than AJV, but is ~3x slower than AJV for simple valid data because it builds a fresh output object. It is also ~3x slower than AJV AllErrors on the reference benchmark.
- `parseFast` (valid data, no error): about as fast as AJV Minimal and `validation`. On invalid data it is ~3x slower than AJV AllErrors because it runs the cheap validator first, then the full parser to collect errors — a deliberate trade-off.

**Which mode should I use?**

- Use `validation` for plain fail-fast boolean checks.
- Use `parseFast` when you need detailed errors on failure but don’t need a fresh output object on success. `parseFast` runs the cheap fail-fast validator first; if the input is invalid, it falls back to the full parser to collect all errors. It is the fastest rich-error path and the one most users want.
- Use `parser` only when you explicitly need a fresh, `Object.create(null)` output object with the original unknown properties preserved (the same contract as Zod `parse()`). It is slower than all above, because it is a `parse`+`transform` operation, not just a validator: it allocates an `Object.create(null)` object, copies the input, rebuilds arrays, and returns `{ success, data }`. That reconstruction is why it is slower than AJV on the reference benchmark.

## Development

### Build

```bash
npm run build
```

### Testing

```bash
# Run JSON Schema test suite plus discriminator and edge-cases tests
npm test

# Run all correctness tests
npm run test:full

# Run all benchmarks (standalone tsx, not vitest; `bench` is an alias of `perf`)
npm run bench
# or
npm run perf
```

**Test Coverage of JSON validation Suite**: 1243 passing per mode, 44 skipped.

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

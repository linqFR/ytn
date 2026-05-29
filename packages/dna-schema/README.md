[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-1157%2F1157%20Passed-brightgreen.svg)](#tests)

# @ytn/dna

DNA JSON Schema processing and validation.

> **Important**: This package only supports and validates JSON Schema 2020-12 and following specific schemas or keywords. Other JSON Schema versions are not supported.

## Overview

`@ytn/dna` converts JSON Schema into a compact DNA bytecode format for high-performance validation. The DNA format uses opcodes and numeric sentinels for optimal V8 performance.

DNA Schema provides two validation modes:

- **Validator Mode**: Ultra-fast boolean validation (fail-fast). >1.15x faster than AJV for valid data.
- **Parser Mode**: First blocking error collection with data transformation. Parity with minimal AJV (e.g. in mode `AllErrors = false`.).

**DNA to JS produces a standalone JS function.**

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

## Installation

```bash
npm install @ytn/dna
```

## Limitations

**External URIs:** This package does not currently handle external JSON Schema references (`$ref` pointing to external files or HTTP URIs). Only internal references within the same schema document are supported.

## Usage

### Converting JSON Schema to DNA

```typescript
import { jschemaToDna } from "@ytn/dna";

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
import { dnaToJSchema } from "@ytn/dna";

const schema = dnaToJSchema(dna);
// Returns original JSON Schema
```

### Converting DNA to Zod

```typescript
import { dnaToZod } from "@ytn/dna";
import { z } from "zod";

const zodSchema = dnaToZod(dna);
// Returns Zod schema
```

### Converting Zod to DNA

```typescript
import { zodToDna } from "@ytn/dna";
import { z } from "zod";

const schema = z.object({
	name: z.string().min(3),
	age: z.number().min(0),
});

const dna = zodToDna(schema);
// Returns DNA bytecode array
```

### Validation with DNA

DNA can be compiled to high-performance JavaScript validators:

```typescript
import { jschemaToDna, validator, parser } from "@ytn/dna";

const schema = {
	type: "object",
	properties: {
		name: { type: "string", minLength: 3 },
		age: { type: "number", minimum: 0 },
	},
};

const dna = jschemaToDna(schema);

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

### Discriminator Support

DNA Schema supports the OpenAPI 3.1 `discriminator` keyword for optimized validation of polymorphic schemas:

```typescript
import { jschemaToDna, validator, parser } from "@ytn/dna";

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

#### Performance

**Benchmark Results** (vs AJV 2020):

- Compilation: **14x faster** than AJV
- Validation (valid data): **more than 1.15x faster** than AJV Minimal
- Generated code size: **4x smaller** than AJV
- Parser mode: Collects first blocking error with **30-40% smaller** standalone code than AJV validation function with **performance close** to AJV minimal.

## Development

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

**Test Coverage**: 1157 passing, 44 skipped.

- The 44 skipped tests are from the JSON Schema Test Suite and involve external references (`$ref` to HTTP URIs, URNs, or external files), which are explicitly out of scope for DNA Schema (only internal references are supported).

The test suite includes:

- **JSON Schema Test Suite**: Comprehensive validation against official JSON Schema 2020-12 test cases. For more information, read [JSON Schema Validation Suite](tests/json-schema-suite/README.md). Are skipped : `refRemote.json`, `dynamicRef.json`, `content.json`, `vocabulary.json`.
- **Discriminator Tests**: Full coverage of OpenAPI 3.1 discriminator keyword with validator and parser modes.
- **Performance Benchmarks**: Comparative benchmarks against AJV for compilation and validation speed.

Some legacy/deprecated test files are excluded from the main test suite.

## Peer Dependencies

- `zod`: ^4.4.3

## License

MIT

## Author

linqFR

## Technical Documentation

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

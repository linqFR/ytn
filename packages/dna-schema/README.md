# @ytn/dna-schema

DNA JSON Schema processing and validation.

> **Important**: This package only supports and validates JSON Schema 2020-12 and following specific schemas or keywords. Other JSON Schema versions are not supported.

## Overview

`@ytn/dna-schema` converts JSON Schema into a compact DNA bytecode format for high-performance validation. The DNA format uses opcodes and numeric sentinels for optimal V8 performance.

DNA Schema provides two validation modes:

- **Validator Mode**: Ultra-fast boolean validation (fail-fast). >1.15x faster than AJV for valid data.
- **Parser Mode**: First blocking error collection with data transformation. Parity with minimal AJV (e.g. in mode `AllErrors = false`.).

**DNA to JS produces a standalone JS function.**

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

## Installation

```bash
npm install @ytn/dna-schema
```

## Limitations

**External URIs:** This package does not currently handle external JSON Schema references (`$ref` pointing to external files or HTTP URIs). Only internal references within the same schema document are supported.

## Usage

### Converting JSON Schema to DNA

```typescript
import { jschemaToDna } from "@ytn/dna-schema";

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
import { dnaToJSchema } from "@ytn/dna-schema";

const schema = dnaToJSchema(dna);
// Returns original JSON Schema
```

### Converting DNA to Zod

```typescript
import { dnaToZod } from "@ytn/dna-schema";
import { z } from "zod";

const zodSchema = dnaToZod(dna);
// Returns Zod schema
```

### Converting Zod to DNA

```typescript
import { zodToDna } from "@ytn/dna-schema";
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
import { jschemaToDna, validator, parser } from "@ytn/dna-schema";

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
import { jschemaToDna, validator, parser } from "@ytn/dna-schema";

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

## Peer Dependencies

- `zod`: ^4.4.3

## License

MIT

## Author

linqFR

## Technical Documentation

For detailed information about DNA opcodes, architecture, and implementation details, see [docs/technical.md](docs/technical.md).

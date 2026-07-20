# AGENTS.md (Package: @ytn/schvalid)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the JSON Schema to DNA conversion package.

> [!WARNING]
> **CRITICAL DEPENDENCY**: This package depends on `@ytn/dna` for DNA bytecode types and the `toJS` compiler. The DNA to JavaScript compilation logic lives in `@ytn/dna/src/toJs/`. Changes to DNA opcodes or toJS in @ytn/dna can break schvalid. Always test both packages together.

---

## Core Architecture

This package provides JSON Schema 2020-12 to DNA bytecode conversion. It is the schema parser layer that sits above the DNA runtime engine.

### Core Modules

- **`src/jschema-to-dna.ts`**: Primary JSON Schema to DNA converter using stack-based traversal. This is the heart of the package.
- **`src/dna-helpers.ts`**: Utility functions for DNA manipulation and inspection.
- **`src/string-formats.ts`**: String format validation utilities (email, uuid, uri, etc.).
- **`src/utils.ts`**: General utility functions.
- **`src/index.ts`**: Public API exports, convenience functions (`validate`, `parse`), and the `schvalid()` builder API.

### What This Package Does NOT Do

- **DNA to JavaScript compilation**: This is handled by `@ytn/dna/src/toJs/`
- **DNA runtime validation**: This is handled by `@ytn/dna`'s `validator()` and `parser()` functions
- **DNA schema builder**: This is handled by `@ytn/dna`'s `dna` fluent API
- **Zod conversion**: Zod ↔ DNA conversion is NOT in scope for this package

---

## JSON Schema to DNA Conversion

### Conversion Process

The `jschemaToDna()` function converts JSON Schema 2020-12 schemas into DNA bytecode:

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

### Supported JSON Schema Features

- **Primitive Types**: string, number, integer, boolean, null
- **Compound Types**: object, array
- **Keywords**: properties, required, items, additionalProperties, minItems, maxItems, minLength, maxLength, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, pattern, format, const, enum
- **Logic Keywords**: anyOf, allOf, oneOf, if/then/else, not
- **OpenAPI 3.1**: discriminator keyword for polymorphic schemas
- **References**: Internal `$ref` within the same document only

### Unsupported Features

- **External References**: No support for `$ref` pointing to HTTP URIs, URNs, or external files
- **Custom Formats**: Limited support for JSON Schema `format` keyword (only standard formats)
- **Schema Extensions**: Does not handle vendor-specific extensions
- **Remote Schemas**: No support for loading schemas from remote URLs

---

## Public API

### Two-Step Conversion + Validation for debugging

There is no one-shot `validate(schema, data)` / `parse(schema, data)` function. Convert the
schema to DNA once, then use `@ytn/schvalid`'s `validator`/`parser` (re-exported from
`@ytn/dna/toJs`) on the result:

```typescript
import { jschemaToDna, validator, parser } from "@ytn/schvalid";

const dna = jschemaToDna(schema);

// Fast boolean validation (fail-fast)
const isValid = validator(dna)(data); // returns boolean

// Full parsing with error collection
const result = parser(dna)(data); // returns { success: true, data: ... } | { success: false, errors: [...] }
```

### Public API

The `schvalid()` builder API allows compiling a schema once and reusing the validation function:

```typescript
import { schvalid } from "@ytn/schvalid";

const compiler = schvalid("validation");
const validate = compiler.compile(schema);

validate(data); // boolean
```

Modes:
- **"validation"**: Returns boolean validator (fail-fast)
- **"parser"**: Returns parser with error collection
- **"both"**: Returns object with both `validate` and `parse` functions

---

## Development Guidelines

### Testing

- **JSON Schema Test Suite**: The package includes the official JSON Schema 2020-12 test suite (1160 passing, 44 skipped)
- **Skipped Tests**: The 44 skipped tests involve external references (refRemote.json, dynamicRef.json, content.json, vocabulary.json) which are out of scope
- **Discriminator Tests**: Full coverage of OpenAPI 3.1 discriminator keyword
- **Performance Benchmarks**: Comparative benchmarks against AJV

### Code Style

- **Stack-Based Traversal**: The converter uses a stack-based approach for handling nested schemas
- **Reference Resolution**: Internal `$ref` pointers are resolved within the same document
- **Numeric Sentinels**: Use `-1` and `null` for absent constraints to minimize memory

### Common Pitfalls

1. **External References**: Attempting to use external `$ref` will fail
   - **Solution**: Only use internal references within the same schema document

2. **Format Validation**: Not all JSON Schema formats are supported
   - **Solution**: Check `src/string-formats.ts` for supported formats

3. **Circular References**: Circular `$ref` chains can cause stack overflow
   - **Solution**: The converter handles basic circular references, but deeply nested cycles may need manual schema restructuring

---

## Debugging

When debugging conversion issues:

```typescript
import { jschemaToDna } from "@ytn/schvalid";

const dna = jschemaToDna(schema);
console.dir(dna, { depth: null }); // Inspect DNA bytecode
```

**IMPORTANT**: Use `console.dir(obj, { depth: null })` instead of `JSON.stringify(obj, null, 2)` for debugging objects.

---

## Limitations & Constraints

### Current Limitations

- **External References**: No support for external `$ref` URIs (HTTP/remote files)
- **Custom Formats**: Limited support for JSON Schema `format` keyword
- **Schema Extensions**: Does not handle vendor-specific extensions

### Design Constraints

- **Memory Efficiency**: Prioritize compact DNA representation
- **Conversion Speed**: Optimize for fast schema compilation
- **Type Safety**: Maintain strict TypeScript compliance throughout

---

## Testing Workflow

### Test Commands

```bash
# Run JSON Schema test suite only
npm test

# Run all tests including discriminator and performance benchmarks
npm run test:full

# Run performance benchmarks only
npm run test:performance
```

### Test Coverage

- **JSON Schema Test Suite**: 1160 passing, 44 skipped (external references)
- **Discriminator Tests**: Full coverage of OpenAPI 3.1 discriminator
- **Performance Benchmarks**: Comparative benchmarks against AJV

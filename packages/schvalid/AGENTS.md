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
- **"fast"**: Returns `parserFast` — a hybrid validate-then-parse function (see below)
- **"all"**: Returns `{ validate, parse, parseFast }` — all three, compiled once and shared (see `combineFast` internals)

### `parserFast` / `combineFast` — hybrid validate-then-parse

**Source**: `src/index.ts` — `combineFast(validate, parse)` and `parserFast(dna)`.

`parserFast` runs the (cheaper, fail-fast) `validator` first. On success, it returns
`{ success: true, data: value }` WITHOUT ever invoking the full parser — no output object
construction happens at all. On failure, it falls back to the full `parser` to collect
detailed errors.

**KEY TRADE-OFF** (schvalid-only — NOT offered on `@ytn/dna` builder schemas, where output
construction is a core part of the parse contract, not an optional side-effect):
- `parser()` on success always returns a **fresh** output object (its own copy, built via
  `Object.assign(Object.create(null), value)` or similar in the generated code).
- `parserFast()` on success returns `data === value` — the **exact same reference** as the
  input, no copy at all.
- Both still **agree on validity** — constraints like `additionalProperties: false` are
  checked identically by `validator()`, so there is no discrepancy in pass/fail decisions,
  only in whether `data` is a fresh object or the original reference.

**PERFORMANCE INVARIANT (do not regress this)**: `validator(dna)`/`parser(dna)` are each a
`new Function(...)` compilation — expensive relative to a single validation call. They MUST
be compiled exactly ONCE per `schvalid(...).compile(schema)` call. `combineFast` takes
ALREADY-compiled `validate`/`parse` instances (never re-invokes `validator`/`parser` inside
the returned closure), and `schvalid("all").compile(schema)` compiles `validate`/`parse`
ONCE and passes the SAME instances to `combineFast` for `parseFast` — it must never compile
a third, separate pair for the fast path.

**When to use**: validation-heavy workloads where the shape/freshness of `data` on the
success path doesn't matter to the caller (e.g. the caller already owns/controls the input
object and doesn't need an isolated copy). Do NOT use it if downstream code relies on
`parse()`'s fresh-object guarantee (e.g. mutating `data` should not be observed on the
original `value`).

See `tests/schemas/parser-fast.test.ts` for the full test matrix (simple/common/complex
cases + consistency checks against `validator`/`parser`), and
`tests/bench/full-comparative-benchmark.test.ts` for measured numbers vs AJV/Zod.

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

4. **`parseFast` reference identity**: Assuming `parseFast(data).data` is a fresh, isolated
   object like `parser(data).data` will break code that relies on the parser's copy contract.
   - **Solution**: Use `"parser"`/`"all".parse` when a fresh output object is required; use
     `"fast"`/`"all".parseFast` only when `data === input` on success is acceptable.

---

## Debugging

### Quick inspection

```typescript
import { jschemaToDna } from "@ytn/schvalid";

const dna = jschemaToDna(schema);
console.dir(dna, { depth: null }); // Inspect DNA bytecode
```

**IMPORTANT**: Use `console.dir(obj, { depth: null })` instead of `JSON.stringify(obj, null, 2)` for debugging objects.

### Working with generated JavaScript

For a single schema, generate the source of the validator/parser with `@ytn/dna/toJS`:

```typescript
import { jschemaToDna } from "@ytn/schvalid";
import { toJS } from "@ytn/dna/toJs";

const dna = jschemaToDna(schema, "#");
const validateCode = toJS(true, false)(dna) as string[];
const parseCode = toJS(false, false)(dna) as string[];

// Generated strings can be joined and logged/inspected
console.log(validateCode.join("\n"));
console.log(parseCode.join("\n"));
```

### Sandbox scripts

The `sandbox/` folder contains helper scripts for failure analysis:

- `sandbox/collect-schema-adn-functions.ts` - regenerates `sandbox/schema-adn-functions.log` with the schema, compact DNA, generated validator and parser for every test group in the JSON Schema Test Suite plus the `discriminator` and `edge-cases` test files.
- `sandbox/collect-failures-full.ts` - produces `sandbox/failure-report-full*.log` containing the failing data, schema, DNA and generated JS for every parser/validator mismatch.

Typical workflow:

```bash
# 1. Rebuild the log after any jschemaToDna or toJS change
npx.cmd tsx sandbox/collect-schema-adn-functions.ts

# 2. Run the full suite to locate failures
npm.cmd test -- --run

# 3. Inspect sandbox/schema-adn-functions.log or sandbox/failure-report-full*.log
```

### Discriminator-specific debugging

- The conversion in `src/jschema-to-dna.ts` removes the discriminator property from each `oneOf` branch to avoid re-validation, then re-injects it as `true` so `additionalProperties: false` still allows it.
- Branch schemas inherit `additionalProperties` from the root schema when they do not define it themselves. If `additionalProperties` behavior differs per branch, verify the `_sch.properties` construction in the discriminator loop.

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
# Run JSON Schema test suite plus discriminator and edge-cases tests
npm test

# Run all correctness tests
npm run test:full

# Run all benchmarks (standalone tsx, not vitest; `bench` is an alias of `perf`)
npm run bench
# or
npm run perf
```

### Test Coverage

- **JSON Schema Test Suite**: 1201 passing, 44 skipped (external references)
- **Discriminator Tests**: 10 passing in `tests/schemas/discriminator.test.ts`
- **Edge-Cases Tests**: 148 passing in `tests/schemas/edge-cases.test.ts`
- **Performance Benchmarks**: Comparative benchmarks against AJV

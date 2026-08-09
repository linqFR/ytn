[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ytrynot/dna.svg)](https://www.npmjs.com/package/@ytrynot/dna)
[![Bundle size](https://packagephobia.com/badge?p=@ytrynot/dna)](https://packagephobia.com/result?p=@ytrynot/dna)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# @ytrynot/dna

> **Looking for testers!** This package is actively seeking early users and feedback. If you try it out, please share your experience — issues, suggestions, or ideas are all welcome.
>
> npm: https://www.npmjs.com/package/@ytrynot/dna · GitHub: https://github.com/linqFR/ytn/tree/main/packages/dna

Zod-like schema API with serializable DNA bytecode and standalone compiled validators.

**Motivation**: Zod is powerful but makes it difficult to serialize schemas and to build optimal and autonomous JS functions. Hence the creation of this package.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Package Exports](#package-exports)
- [Usage](#usage)
  - [Using the DNA Builder API](#using-the-dna-builder-api)
  - [Validating and Parsing with Schema Methods](#validating-and-parsing-with-schema-methods)
  - [Compiling DNA to JavaScript Validators (Advanced)](#compiling-dna-to-javascript-validators-advanced)
  - [Using the Low-Level toJS Compiler](#using-the-low-level-tojs-compiler)
  - [Round-trip DNA Reconstruction](#round-trip-dna-reconstruction)
- [Externals Mechanism](#externals-mechanism)
- [Development](#development)
- [Technical Documentation](#technical-documentation)

## Overview

`@ytrynot/dna` is the core validation engine that compiles DNA bytecode into high-performance JavaScript validators. The DNA format uses opcodes and numeric sentinels for optimal V8 performance.

This package provides the runtime validation engine only. For JSON Schema to DNA conversion, use `@ytrynot/schvalid`.

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
npm install @ytrynot/dna
```

## Package Exports

`@ytrynot/dna` ships multiple entry points. All non-core entry points import runtime classes from `@ytrynot/dna/core`, ensuring a single class identity for `instanceof` checks and a shared registry Map across bundles (mirrors the `zod/v4/core` pattern).

| Entry point | Import | Description |
|-------------|--------|-------------|
| `@ytrynot/dna` | `import { dna } from "@ytrynot/dna"` | Main API: builder factory, types, `registerConstructor` |
| `@ytrynot/dna/core` | `import { DnaType } from "@ytrynot/dna/core"` | Runtime classes (`DnaType`, `DnaObject`, ...), `initDna`, `toJS`, `DnaError`, registry |
| `@ytrynot/dna/toJs` | `import { toJS } from "@ytrynot/dna/toJs"` | Low-level compiler (`toJS`, `validator`, `parser`) |
| `@ytrynot/dna/introspect` | `import * as introspect from "@ytrynot/dna/introspect"` | Schema introspection utilities (`isOptional`, `isObject`, `unwrap`, ...) |

**When to use `@ytrynot/dna/core`**: when you need `instanceof DnaType` / `instanceof DnaObject` to work across bundles, or direct access to `initDna`, `BaseCore`, `DnaError`, or the registry. The main `@ytrynot/dna` entry point re-exports everything for everyday usage — you only need `core` for cross-bundle class identity or low-level internals.

## Usage

### Using the DNA Builder API

The DNA builder provides a Zod-like fluent API for constructing DNA bytecode schemas directly:

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
  email: dna.email()
});

// Get the DNA bytecode
const dnaBytecode = schema.toDna();
```

Supported builder methods:
- **Primitives**: `dna.string()`, `dna.number()`, `dna.int()`, `dna.boolean()`, `dna.null()`
- **Constraints**: `.min()`, `.max()`, `.length()`, `.pattern()`
- **Formats**: `dna.email()`, `dna.uuid()`, `dna.url()` (top-level functions; the `.email()`, `.uuid()`, `.url()` string constraints are deprecated)
- **Compound**: `dna.object()`, `dna.array()`, `dna.optional()`, `dna.nullable()`
- **Logic**: `dna.union()`, `dna.intersection()`, `dna.xor()`

### Validating and Parsing with Schema Methods

Every schema instance built with the `dna.*` builder exposes high-level validation and parsing methods. These are the **primary API** for most use cases — you do not need to compile DNA bytecode manually.

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
});

// --- Boolean validation (fail-fast, no error collection) ---
const isValid: boolean = schema.validate({ name: "John", age: 30 });
const isAsync: Promise<boolean> = schema.validateAsync({ name: "John", age: 30 });

// --- Safe parse (returns a result object, never throws) ---
const result = schema.safeParse({ name: "Jo", age: -1 });
// { success: false, errors: [...] }

const ok = schema.safeParse({ name: "John", age: 30 });
// { success: true, data: { name: "John", age: 30 } }

// Async safe parse (alias: .spa())
const asyncResult = await schema.safeParseAsync({ name: "John", age: 30 });
const aliasResult = await schema.spa({ name: "John", age: 30 });

// --- Throwing parse (throws on invalid input) ---
const data = schema.parse({ name: "John", age: 30 });
const asyncData = await schema.parseAsync({ name: "John", age: 30 });
```

| Method | Returns | Description |
|--------|---------|-------------|
| `.validate(value)` | `boolean` | Synchronous boolean validation (fail-fast) |
| `.validateAsync(value)` | `Promise<boolean>` | Async boolean validation |
| `.safeParse(value)` | `{ success, data } \| { success, errors }` | Synchronous safe parse (never throws) |
| `.safeParseAsync(value)` | `Promise<...>` | Async safe parse |
| `.spa(value)` | `Promise<...>` | Alias for `.safeParseAsync()` |
| `.parse(value)` | `T` (throws on error) | Synchronous parse (throws on invalid input) |
| `.parseAsync(value)` | `Promise<T>` | Async parse (throws on invalid input) |

### Compiling DNA to JavaScript Validators (Advanced)

> **Note**: The `validator()`, `parser()`, and `toJS()` functions are low-level compilation utilities for exceptional use cases (e.g. pre-compiling DNA bytecode from `@ytrynot/schvalid`, serializing validators, or performance-critical paths). For everyday schema validation, prefer the [high-level schema methods](#validating-and-parsing-with-schema-methods) (`.validate()`, `.safeParse()`, `.parse()`).

```typescript
import { validator, parser, toJS } from "@ytrynot/dna/toJs";

// DNA bytecode (typically obtained from @ytrynot/schvalid)
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
import { toJS } from "@ytrynot/dna/toJs";

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
import { toJS } from "@ytrynot/dna/toJs";

const dna = /* DNA bytecode array from dna builder */;
const result = toJS(true, true)(dna) as { code: string[]; requiredExternals: string[] };
const fn = new Function(...result.code)({ /* required externals */ });
```

### Round-trip DNA Reconstruction

`@ytrynot/dna` can rebuild a fluent builder schema from its own DNA bytecode. This is used by the `fromDna` roundtrip tests and lets you serialize, transfer, and restore a schema without touching JSON Schema:

```typescript
import { dna } from "@ytrynot/dna";
// fromDna is an internal roundtrip utility (not part of the public package exports).

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

- **Primitives**: `string`, `number`, `integer`, `bigint`, `boolean`, `null`, `undefined`, `NaN`, `literal`, `enum`, `any`, `never`, `unknown`, `symbol`, `date`.
- **Wrappers**: `optional`, `nullable`, `nullish`, `nonoptional`, `default`, `prefault`, `catch`.
- **Collections**: `object` (`$o`/`o`), `array`/`tuple`, `record` (`rcd`), `Map`/`Set` reconstructed from `pipe`.
- **Logic**: `anyOf`, `allOf`, `oneOf`, `discriminator`.
- **Refinements**: `property` checks, `func` checks (`.refine`, `.superRefine`, `.check`), `chkSeq`, `chkList`.
- **Templates**: `templateLiteral` and `templateLiteralMutate` (via internal `DnaTemplateReconstructed` that bypasses re-escaping).
- **External / special types**: `instanceOf` (registered constructors), `url` (protocol/hostname regex), `jwt`, `promise`, `cidrv6`.
- **Pipelines**: `pipe`, `transform`, `coerce`, `codec` when the encode/decode functions are serializable.
- **Recursion**: `ref` nodes (including `DnaLazy` reconstruction with double-ref collapsing).
- **Metadata**: `readonly`, `description`, `~inner` constraints are preserved.

Limitations:

- `.transform`, `.preprocess`, `.coerce` and custom codecs can be reconstructed only when their function source is serializable (the builder keeps `fn.toString()`).
- Fully arbitrary JavaScript functions or closures with captured external variables may not roundtrip.
- Async `transform` / `pipe` / `codec` roundtrip parity is verified with `safeParseAsync` / `parseAsync`.
- `safeParse`/`validate` parity for the rebuilt schema still depends on the `toJs` codegen supporting the same opcodes.

### Typing `fromDna` — Type parameter

A `tsDnaSeq` is a flat array of opcodes with no compile-time type information. By default, `fromDna` returns `DnaSomeType<any, any>` — a fully functional schema (`safeParse`, `validate`, `toDna` all work) but with `_output` typed as `any`.

Pass an explicit type argument to get full type safety, including `dna.infer` resolution and schema-specific methods:

```typescript
// Default: works but _output is any
const rebuilt = fromDna(bytecode);
type Out = dna.infer<typeof rebuilt>;           // any
rebuilt.safeParse(input);                        // ✓

// Typed: full inference
const rebuiltStr = fromDna<dna.DnaString>(bytecode);
type OutStr = dna.infer<typeof rebuiltStr>;     // string

const objSchema = dna.object({ name: dna.string(), age: dna.number() });
const rebuiltObj = fromDna<typeof objSchema>(objSchema.toDna());
type OutObj = dna.infer<typeof rebuiltObj>;     // { name: string, age: number }

const fnSchema = dna.function().input([dna.string()]).output(dna.number());
const rebuiltFn = fromDna<ReturnType<typeof dna.function>>(fnSchema.toDna());
const impl = rebuiltFn.implement((s: string) => s.length);  // ✓ typed
```

**Available type arguments**: Any class extending `DnaTypeWithWrappers` (`dna.DnaString`, `dna.DnaNumber`, `dna.DnaObject<...>`, `dna.DnaArray<...>`, `dna.DnaFunction<...>`, etc.). For complex generics, prefer `typeof originalSchema` or `ReturnType<typeof dna.<factory>>`.

## Comparison with Zod

@ytrynot/dna covers ~95% of the Zod v4 API with full parity — all primitives, string formats,
coercions, transforms, refinements, unions, objects, arrays, tuples, records, maps, sets,
functions, lazy, wrappers, brand, readonly, stringbool, template literals, and JSON Schema
export. Key differences:

- **DNA adds**: compiled standalone functions (`validator()`, `parser()`, `toJS()`), DNA
  bytecode serialization (`.toDna()` / `fromDna()`), boolean validation (`.validate()`),
  `dna.templateLiteralMutate()`, `.eq()` on date, `.register()`.
- **DNA lacks**: `.deepPartial()`, `z.flattenError()` / `z.formatError()` / `z.treeifyError()`,
  `z.deno()` / `z.node()`, some introspection getters (`.options`, `.discriminator`).

Full feature-by-feature comparison: [docs/zod-comparison.md](docs/zod-comparison.md).

## Externals Mechanism

DNA compiles schemas into standalone JavaScript functions. Any value referenced inside `.transform()`, `.refine()`, `.catch()`, or `dna.jwt()` that is not a parameter or a global must be declared as an **external** so it can be injected at compile time.

```typescript
import { dna } from "@ytrynot/dna";

const myHelper = (v: string) => v.toUpperCase();

const schema = dna.string().transform(
  (v) => myHelper(v),
  [myHelper]  // ← declare myHelper as an external
);

schema.safeParse("hello");  // { success: true, data: "HELLO" }
```

For the full specification — contract, registry, built-in externals (`dna`, `jwtFn`, constructors), user externals (transform, refine, catch), declaration forms, and portability rules — see [docs/externals.md](docs/externals.md).

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

- [Type Inventory](docs/type-inventory.md) — Complete catalog of all DNA schema types, factory functions, and opcodes
- [Technical Reference](docs/technical.md) — DNA opcodes, architecture, and implementation details
- [Opcode Patterns](docs/opcode-patterns.md) — DNA opcode patterns and usage
- [Zod Comparison](docs/zod-comparison.md) — Side-by-side comparison with Zod v4
- [Externals](docs/externals.md) — Externals mechanism for transforms and refines

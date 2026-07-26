# AGENTS.md (Package: @ytn/dna)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the DNA bytecode engine.

> [!WARNING]
> **CRITICAL DEPENDENCY**: This package is intimately linked to `@ytn/schvalid`. The `toJs` module (especially `dna-to-js.ts`, `dna-js-builder.ts`, and `dna-js-json.ts`) is imported and used by `@ytn/schvalid` for DNA → JavaScript compilation. **ANY changes to toJS can have direct repercussions on schvalid**. Always test both packages together when modifying toJS code.

---

## Core Architecture

This package provides the DNA bytecode runtime engine. It is NOT the JSON Schema converter (that's `@ytn/schvalid`). This package focuses on:

- **DNA Schema Builder**: Zod-like API for constructing DNA bytecode schemas
- **DNA → JavaScript Compilation**: High-performance code generation from DNA opcodes
- **Runtime Validation**: Ultra-fast boolean validators and parsers

### Core Modules

- **`src/builder/index.ts`**: DNA schema factory with Zod-like fluent API (`dna.string()`, `dna.object()`, etc.)
- **`src/fromDna/index.ts`**: DNA → fluent-schema reconstruction (`fromDna`). Rebuilds a builder schema from a DNA bytecode sequence produced by the builder.
- **`src/toJs/dna-to-js.ts`**: Main compiler entry point, orchestrates DNA → JavaScript conversion
- **`src/toJs/dna-js-json.ts`**: Opcode-to-JavaScript mapper for JSON Schema-derived opcodes (`object`, `array`, `string`, `number`, `anyOf`, `oneOf`, `discriminator`, etc.)
- **`src/toJs/dna-js-builder.ts`**: Opcode-to-JavaScript mapper for the fluent builder API (`o`, `a`, `s`, `n`, `or`, `and`, etc.)
- **`src/toJs/utils.ts`**: Code generation helpers, inline function registry, and shared validators
- **`src/types/`**: DNA bytecode type definitions and inference types
- **`src/shared/`**: Shared utilities (stack steps, constants)

### Documentation

- **`docs/technical.md`**: Detailed technical documentation about DNA opcodes, architecture, and implementation details.

---

## DNA Bytecode Format

DNA is a compact opcode-based format for validation:

```typescript
type tsDna = [tsDnaOpcode, ...any[], tsDnaInnerMeta];
type tsDnaSeq = [...tsDna[], number[]];
```

The last element of a `tsDnaSeq` is the `refList` (`number[]`) that collects the node IDs used as forward references for circular (`ref`) schemas.

- **Array-Based Instructions**: Each instruction is a tuple with opcode first
- **Reference-Based**: Complex structures use numeric references to avoid duplication
- **Stack Processing**: The compiler uses iterative stack-based traversal

---

## Code Generation Architecture

### Two Execution Modes

1. **Validator Mode** (`validateMode: true`):
   - Ultra-fast boolean validation (fail-fast)
   - No error collection
   - Returns `true`/`false`
   - Uses `isCond: true` context for expression generation

2. **Parser Mode** (`validateMode: false`):
   - Full error collection with data transformation
   - Returns `{ success: true, data: any }` or `{ success: false, errors: tsParserError[] }`
   - Uses output variable assignment pattern

### Step-Based Compilation

The compiler uses a step-based system (`tsStackFrame`):

- **`STEP.BODY`**: Direct JavaScript code concatenation
- **`STEP.CONST`/`STEP.LET`**: Variable declarations
- **`STEP.START_REF`/`STEP.END_REF`**: Reference function generation for circular schemas
- **Opcode handlers**: Builder opcodes map to `dna-js-builder.ts`; JSON Schema-derived opcodes map to `dna-js-json.ts`

### Reference Handling

Circular schemas are handled via reference functions:
- Each referenced schema gets a dedicated function (`L0000`, `L0001`, etc.)
- Functions include memoization via `.visit` Map to prevent infinite loops
- Functions accept `_ea`/`_eo` parameters for unevaluated properties propagation

---

## Builder API

The builder provides a Zod-like fluent API:

```typescript
import { dna } from "@ytn/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
  email: dna.string().email()
});
```

All builder methods produce DNA bytecode directly, no intermediate JSON Schema.

---

## Naming Standards

This package follows global naming standards:

### 1. DNA Types (`ts*`)

- **Examples**: `tsDna`, `tsDnaOpcode`, `tsDnaSeq`, `tsValidatorFn`, `tsParserFn`

### 2. Runtime Types (no I/O prefix)

- DNA types are internal bytecode representations, not input/output structures
- Use `ts*` prefix for all DNA-related types

### 3. Opcodes

- Opcodes are defined in `dna-core.types.ts`
- Use descriptive names: `"string"`, `"number"`, `"object"`, `"array"`, etc.

---

## Development Guidelines

### Testing

- **Unit Tests**: Test individual opcode handlers in `toJs/dna-js-builder.ts` (fluent builder opcodes) and `toJs/dna-js-json.ts` (JSON Schema-derived opcodes)
- **Integration Tests**: Test end-to-end builder → DNA → JavaScript → validation
- **Performance Tests**: Benchmark validator vs parser modes
- **Type Tests**: Use `expectTypeOf` for complex type inference

### Code Generation

- **No AST**: Generate JavaScript strings directly, no intermediate AST
- **Numeric Sentinels**: Use `-1` and `null` for absent constraints
- **Stack Safety**: Always handle stack reversal when pushing steps

### Common Pitfalls

1. **Stack Reversal**: Steps are pushed in reverse order (LIFO)
   - **Solution**: Use `while (i--) stack[j++] = steps[i]` pattern

2. **Context Propagation**: Not passing `parentCtx` correctly
   - **Solution**: Always propagate `parentCtx` to child schema calls

3. **Reference Memoization**: Forgetting `.visit` Map in ref functions
   - **Solution**: Always include memoization prelude in reference functions

4. **Mode Confusion**: Mixing validator and parser patterns
   - **Solution**: Check `parentCtx.isCond` before generating code

---

## Debugging

### Inspect generated JavaScript

```typescript
import { validator, parser } from "@ytn/dna";

const validateFn = validator(dna);
const parseFn = parser(dna);

console.log(validateFn.toString());  // single string in validation mode
console.log(parseFn.toString());     // joined array in parser mode
```

For the raw string array before joining:

```typescript
import { toJS } from "@ytn/dna/toJs";

const validateCode = toJS(true, false)(dna) as string[];
const parseCode = toJS(false, false)(dna) as string[];

console.log(validateCode.join("\n"));
console.log(parseCode.join("\n"));
```

**IMPORTANT**: Use `console.dir(obj, { depth: null })` instead of `JSON.stringify(obj, null, 2)` for debugging objects.

### Common places to look

- **`src/toJs/dna-js-json.ts`**: object/array parser init (`parserOutInit`), `oneOf`/`anyOf`/`allOf` combinators, `discriminator` switch dispatch, `unevaluatedProperties` / `unevaluatedItems` evaluation sets.
- **`src/toJs/dna-js-builder.ts`**: builder opcodes (`o`, `a`, `or`, `and`, etc.) when the schema is built with the fluent API.
- **`src/toJs/utils.ts`**: helper functions such as `tojsStr`, `_err`, inline function registry (`L0000` references).
- **`src/toJs/registry.ts`**: opcode name ↔ handler mapping.

### Key invariants

- `parserOutInit` for arrays copies the full input only when `parentCtx.unEvalArr` is active; otherwise the reconstructing loop (`items`/`contains`) fills the output or the input array is reused when no loop is needed.
- `parserOutInit` for objects uses `outVar = { ...inVar };` so that the schema (via DNA opcodes) is the sole source of output fields.
- `unevaluatedProperties` and `unevaluatedItems` rely on evaluation sets (`unEvalObj` / `unEvalArr`) propagated through `parentCtx`; missing propagation usually manifests as wrongly rejected properties/items.

---

## fromDna (DNA → Schema reconstruction)

`fromDna` in `src/fromDna/index.ts` rebuilds a fluent `@ytn/dna` schema from a DNA bytecode sequence produced by `toDna()`. It is primarily used by the roundtrip tests, but it also proves that the DNA format is self-describing for supported schemas.

### Entry point

```typescript
import { fromDna } from "@ytn/dna";
const schema = fromDna(dnaSeq);
```

The input `dnaSeq` is the same tuple returned by `schema.toDna()` (a flat array of DNA nodes followed by `refList` and `externals`).

### Core reconstruction helpers

- **`getMeta` / `getParams`**: DNA tuples may end with a `{meta}` object and an optional `{meta}` object can also appear as the only argument (e.g. `["b", {readonly: true}]`). These helpers normalize extraction so every opcode receives its `params` and `meta` consistently.
- **`build(id)`**: A recursive index-based builder with a cache (`Map<number, DnaTypeWithWrappers>`). Handles forward references by returning the cached skeleton before it is fully built.
- **`buildNode`**: Opcode-specific factory. Delegates to `initDna(..., meta)` so reconstructed nodes carry the same metadata as the original.

### Notable implementation points

- **Metadata preservation**: `initDna(Class, seed, meta)` is called with the trailing `meta` object for every node, preserving `readonly`, `description`, `~inner` constraints, etc.
- **Recursive objects (`$o`)**: A `DnaObject` skeleton is pre-cached before its children are built. A `ref` opcode that points to a node currently under construction returns this skeleton instead of recursing, so `fromDna` emits the same single `ref` node as the original builder.
- **`wrp` (wrappers)**: Reconstructs `optional`, `nullable`, `nullish`, `nonoptional`, `exactOptional`, `default`, `prefault`, and `catch` by wrapping the inner schema with `dna.<wrapper>(...)`.
- **`seq` / `transform`**: Generic `seq` DNA is reconstructed as a `DnaPipe` whose `steps` are the rebuilt children. `transform` opcodes create `DnaTransform` instances from `["transform", [fnStr, arity], meta]`.
- **Records (`rcd`)**: Distinguishes `standard`, `loose`, and `partial` records based on the presence of `required` and finite `keys` constraints.
- **Map / Set**: `extractMapSet` scans a `seq` for `instanceOf`, `chk` (size constraints), `rcd` / `a`, and `transform` steps, reconstructing `DnaMap` / `DnaSet` with their key/value/item schemas. `readonly` metadata is taken from the `instanceOf` step, not the `seq` node.
- **Refinement checks (`chk`)**: `property` checks rebuild `min`/`max`/`size` constraints. `func` entries are pushed directly into `refinerList` as `["func", fnStr, arity, errorOpt?]` so the rebuilt `toDna()` matches the original layout.
- **JWT / discriminator / URL / instanceOf**: Directly instantiated via `DnaJwt`, `DnaDiscriminatedUnion`, `DnaUrl`, and `DnaInstanceOf` with the decoded parameters. `url` rehydrates protocol/hostname regexes from their string form; `instanceOf` resolves the constructor from the registered externals map.

### Testing

- **`tests/from-dna-extended.test.ts`**: Dynamically loads every `zod-test-suite` case and verifies that `fromDna(schema.toDna()).toDna()` matches the original and that `safeParse` / `validate` results are identical.
- Be careful: `toDna()` equality is a strong signal, but `safeParse` parity also depends on `toJs` codegen supporting the same opcodes. Failures after `fromDna` is correct usually indicate a `toJs` issue, not a reconstruction issue.

### Limitations

- `.transform`, `.preprocess`, `.coerce`, and custom codecs roundtrip only when their function source is serializable (`fn.toString()`). Closures or captured variables are lost.
- `z.function()`, `z.promise()`, and some `oneOf` / `xor` unions are not supported yet.
- `toJs` codegen may lag behind the builder; a correct `toDna()` roundtrip does not guarantee `safeParse` parity for newly-added opcodes.

## Build & Distribution

- **tsup Configuration**: Standard build with JSDoc preservation
- **No Minification**: This package is a library, not a production bundle
- **Type Declarations**: Automatically generated via tsup

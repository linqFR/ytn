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

- **`src/builder/api-primitives.ts`** + **`src/builder/api-enhanced.ts`**: DNA schema factory with Zod-like fluent API (`dna.string()`, `dna.object()`, etc.), re-exported via `src/dna-namespace.ts`
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
- **`STEP.CONST`/`STEP.LET`**: Variable declarations inside the validator/parser function
- **`STEP.OUT_CONST`/`STEP.OUT_ARG`**: Variables / arguments hoisted into the outer closure (e.g. compiled-once regexes)
- **`STEP.START_REF`/`STEP.END_REF`**: Reference function generation for circular schemas
- **Opcode handlers**: Builder opcodes map to `dna-js-builder.ts`; JSON Schema-derived opcodes map to `dna-js-json.ts`

### Object Output: `keepOnly` vs JSON-Schema modes

DNA `standard` objects (the Zod-like default, i.e. no `strict()` and no `loose()`) use the `keepOnly` mechanism when no `additionalProperties` schema is declared.

1. The builder emits a `keepOnly` constraint listing every declared property name.
2. The parser writes validated properties into a temporary `outReal` object.
3. It then copies only the keys in `keepOnly` into the final `outVar`.
4. Values equal to `undefined` are **not** copied, so omitted or explicitly `undefined` optional properties do **not** appear as own keys in the parsed output.

Objects in `strict`/`loose` mode or JSON-Schema-style objects (with `additionalProperties: true`/schema or `unevaluatedProperties`) do **not** use `keepOnly`; they rely on `Object.assign`/`Object.create(null)` pre-copying to preserve unknown/evaluated properties.

This distinction is why the `f3` optional-undefined equivalence test works with `keepOnly` and why `Object.assign` must not be blindly replaced by a global `undefined`-filtering loop.

### Reference Handling

Circular schemas are handled via reference functions:
- Each referenced schema gets a dedicated function (`L0000`, `L0001`, etc.)
- Functions include memoization via `.visit` Map to prevent infinite loops
- Functions accept `_ea`/`_eo` parameters for unevaluated properties propagation

### Promise Type Behavior

`DnaPromise` overrides the synchronous `parse` and `safeParse` methods because a `Promise` cannot be resolved inside the synchronous generated validator. `safeParse` and `parse` reject with a dedicated error for non-Promise input, or with the message `Promise cannot be resolved synchronously`. `safeParseAsync` and `parseAsync` await the input and delegate to the inner schema.

This mirrors Zod's `z.promise()` behavior and keeps the `toJS` code generation free of `await`.

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

- Opcodes are defined in `src/types/core.types.ts`
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

5. **Sentinel collision with DNA index `0`**: Using `0` as a "no constraint" sentinel for a numeric field that also holds a DNA index. DNA index `0` is a valid target (e.g. a recursive `$ref` pointing back to the root node at index 0), so a `0` sentinel is indistinguishable from a real index-0 reference. This previously caused the `array` handler's `items` loop to emit an empty body, silently accepting invalid items in recursive schemas.
   - **Solution**: Use `-1` (the project's standard absent-constraint sentinel) instead of `0`. Always test with `itemsIndex >= 0` rather than truthiness (`&& itemsIndex`) or explicit exclusion (`!== 0`). Regression tests: `packages/schvalid/tests/schemas/regression-failles.test.ts`.

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

### Typing `fromDna` — Type parameter and inference

`fromDna` accepts an optional type parameter `S extends DnaSomeType<any, any>`:

```typescript
function fromDna<S extends DnaSomeType<any, any> = DnaSomeType<any, any>>(seq: tsDnaSeq): S
```

**Why a type parameter is needed**: A `tsDnaSeq` is a flat array of opcodes (`[...tsDna[], number[]]`). The opcode at index 0 determines the root schema class, but this is a runtime string — TypeScript cannot infer the concrete schema type from the bytecode. This is the same limitation as `JSON.parse()` returning `any`: the data format carries no compile-time type information.

**Default (no type argument)**: `fromDna(seq)` returns `DnaSomeType<any, any>`. This is a fully functional schema — `safeParse`, `validate`, `toDna`, `meta` are all available — but `_output` is `any`, so `dna.infer<typeof rebuilt>` resolves to `any`.

```typescript
const rebuilt = fromDna(bytecode);              // DnaSomeType<any, any>
type Out = dna.infer<typeof rebuilt>;           // any
rebuilt.safeParse(input);                        // ✓ works
rebuilt.validate(input);                         // ✓ works
```

**With explicit type argument**: Pass the expected schema class to get full type safety, including `_output` inference and schema-specific methods like `.implement()` on `DnaFunction`.

```typescript
// Primitive — pass the DNA class directly
const rebuiltStr = fromDna<dna.DnaString>(bytecode);
type OutStr = dna.infer<typeof rebuiltStr>;     // string

// Object — pass the DNA class with its shape generic
const rebuiltObj = fromDna<dna.DnaObject<{ name: dna.DnaString; age: dna.DnaNumber }>>(bytecode);
type OutObj = dna.infer<typeof rebuiltObj>;     // { name: string, age: number }

// Function — pass the DNA class with its input/output generics to unlock .implement()
const rebuiltFn = fromDna<dna.DnaFunction<readonly [dna.DnaString], dna.DnaNumber>>(bytecode);
const impl = rebuiltFn.implement((s: string) => s.length);  // ✓ typed
```

**Available DNA classes for type arguments**: All exported classes that extend `DnaTypeWithWrappers` can be used: `dna.DnaString`, `dna.DnaNumber`, `dna.DnaBoolean`, `dna.DnaObject<...>`, `dna.DnaArray<...>`, `dna.DnaTuple<...>`, `dna.DnaEnum<...>`, `dna.DnaLiteral<...>`, `dna.DnaOptional<...>`, `dna.DnaNullable<...>`, `dna.DnaFunction<...>`, `dna.DnaPipe<...>`, `dna.DnaRecord<...>`, `dna.DnaMap<...>`, `dna.DnaSet<...>`, etc. For complex generics, instantiate the DNA class directly with its type parameters (e.g. `dna.DnaObject<{ name: dna.DnaString }>`, `dna.DnaFunction<readonly [dna.DnaString], dna.DnaNumber>`).

### Core reconstruction helpers

- **`getMeta` / `getParams`**: DNA tuples may end with a `{meta}` object and an optional `{meta}` object can also appear as the only argument (e.g. `["b", {readonly: true}]`). These helpers normalize extraction so every opcode receives its `params` and `meta` consistently.
- **`build(id)`**: A recursive index-based builder with a cache (`Map<number, DnaTypeWithWrappers>`). Handles forward references by returning the cached skeleton before it is fully built.
- **`buildNode`**: Opcode-specific factory. Delegates to `initDna(..., meta)` so reconstructed nodes carry the same metadata as the original.

### Notable implementation points

- **Metadata preservation**: `initDna(Class, seed, meta)` is called with the trailing `meta` object for every node, preserving `readonly`, `description`, `~inner` constraints, etc.
- **Recursive objects (`$o`/`o`)**: A `DnaObject` skeleton is pre-cached before its children are built. A `ref` opcode that points to a node currently under construction returns this skeleton instead of recursing, so `fromDna` emits the same single `ref` node as the original builder. Double-ref chains from `DnaLazy` reconstruction are collapsed by `normalizeDna` in the test suite.
- **`wrp` (wrappers)**: Reconstructs `optional`, `nullable`, `nullish`, `nonoptional`, `exactOptional`, `default`, `prefault`, and `catch` by wrapping the inner schema with `dna.<wrapper>(...)`.
- **`pipe` / `transform`**: Generic `pipe` DNA is reconstructed as a `DnaPipe` whose `steps` are the rebuilt children. `transform` opcodes create `DnaTransform` instances from `["transform", [fnStr, arity], meta]`.
- **Records (`rcd`)**: Distinguishes `standard`, `loose`, and `partial` records based on the presence of `required` and finite `keys` constraints.
- **Map / Set**: `extractMapSet` scans a `pipe` for `instanceOf`, `chkSeq` (size constraints), `rcd` / `a`, and `transform` steps, reconstructing `DnaMap` / `DnaSet` with their key/value/item schemas. `readonly` metadata is taken from the `instanceOf` step, not the `pipe` node.
- **Refinement checks (`chkSeq`/`chkList`)**: `property` checks rebuild `min`/`max`/`size` constraints. `func` entries are pushed directly into `refinerList` as `["func", fnStr, arity, errorOpt?]` so the rebuilt `toDna()` matches the original layout.
- **Templates (`template`)**: Reconstructed via internal `DnaTemplateReconstructed` subclass that overrides `_emitSelf` to inject pre-computed `passiveParts` and child schema IDs directly, bypassing the irreversible part→regex re-escaping. The `canMutate` flag (index 3) distinguishes `templateLiteral` (false) from `templateLiteralMutate` (true).
- **JWT / discriminator / URL / instanceOf / promise / cidrv6**: Directly instantiated via `DnaJwt`, `DnaDiscriminatedUnion`, `DnaUrl`, `DnaInstanceOf`, `DnaPromise`, and `DnaCidrv6` with the decoded parameters. `url` rehydrates protocol/hostname regexes from their string form; `instanceOf` resolves the constructor from the registered externals map.

### Testing

- **`tests/from-dna-extended.test.ts`**: Dynamically loads every `zod-test-suite` case and verifies that `fromDna(schema.toDna()).toDna()` matches the original and that `safeParse` / `validate` results are identical.
- Be careful: `toDna()` equality is a strong signal, but `safeParse` parity also depends on `toJs` codegen supporting the same opcodes. Failures after `fromDna` is correct usually indicate a `toJs` issue, not a reconstruction issue.

### Limitations

- `.transform`, `.preprocess`, `.coerce`, and custom codecs roundtrip only when their function source is serializable (`fn.toString()`). Closures or captured variables are lost.
- `dna.function()` serializes as `["function", [inputDnaId, outputDnaId]]` — the input tuple and output schema are full children in the DNA graph. `fromDna` reconstructs the `DnaFunction` with both child schemas. `.implement(fn, externals?)` / `.implementAsync(fn, externals?)` accept an optional externals map (merged with `getRegisteredExternals()`); the returned function exposes `requiredExternals: string[]`.
- `.implement()` is sync-only: it detects async input/output schemas (`isAsyncFnStr`) and async `fn` (`fn instanceof AsyncFunction`) at construction time and throws — use `.implementAsync()` instead. The generated function body is clean (no runtime `instanceof Promise` checks).
- `DnaError` is inlined as `dnaErrorSource` (exported from `error.types.ts`) in `new Function` bodies because generated functions have no access to module imports. The `;` after the class is required in the generated body (separates the class declaration from subsequent statements).
- `dna.function()` without `.input()` defaults to a tuple with `rest: dna.unknown()` (pass-through, matching Zod). Explicit `.input([])` remains a strict empty tuple that rejects extra args.

## Build & Distribution

- **tsup Configuration**: Standard build with JSDoc preservation
- **Minification**: Minified builds are produced via `tsup.config.base.ts` `minConfig` and exported as `./toJs/min` and `./min` subpath entries
- **Type Declarations**: Automatically generated via tsup

---

## Zod v4 & DNA Type Guardrails

Project-specific type-safety rules that complement the general TS protocol:

- **No `as any` / `as unknown` (except `as unknown as T`)** — fix the type issue instead of hiding it.
- **No `any` or `| any` in function parameters** — use proper typing or generics.
- **No `@ts-ignore` / `@ts-nocheck`** — prefer `@ts-expect-error` with an explicit explanation, or fix the type.
- **Zod v4 reflection**: use `._zod` (never `._def`); use `.unwrap()` for optional/nullable/default; use `z.strictObject()` / `z.looseObject()` for objects.
- **Identification priority**: `instanceof z.Zod*` is the first truth; use property checks (`_zod` in v) only when `instanceof` is provably insufficient.
- **Console output**: never `JSON.stringify(obj, null, 2)`; use `console.dir(obj, { depth: null })` or `JSON.stringify(obj)`.
- **Naming conventions**: `I*` inputs, `O*` outputs, `$*` type modifiers, `ts*` static aliases, `u*` utilities, `sch*` / `*Schema` for Zod schemas.
- **Type testing**: use `expectTypeOf` / `assertType` in Vitest; validate with `npm test -- --typecheck`.

See the `prohibited-hacks-and-code-syntaxes.md` memory for the complete forbidden-syntax list.

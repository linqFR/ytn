# Serialization & Standalone Functions

Serialization is DNA's core differentiator vs Zod. This document covers the full serialization pipeline: schema → bytecode → standalone JS function → portable source code.

## Table of Contents

- [Overview](#overview)
- [Level 1: Schema ↔ DNA bytecode](#level-1-schema--dna-bytecode)
- [Level 2: Schema/DNA → standalone JavaScript function](#level-2-schemadna--standalone-javascript-function)
  - [2a. Schema methods — `.validate()` / `.safeParse()` / `.parse()` (everyday use)](#2a-schema-methods--validate--safeparse--parse-everyday-use)
  - [2b. Direct compilation from bytecode — `validatorBuilder()` / `parserBuilder()`](#2b-direct-compilation-from-bytecode--validatorbuilder--parserbuilder)
  - [2c. Full serialization — `toJS()` (portable)](#2c-full-serialization--tojs-portable)
  - [When to use which](#when-to-use-which)
- [Externals](#externals)
- [Export to JSON Schema](#export-to-json-schema)
- [End-to-end examples](#end-to-end-examples)
  - [Example 1: Validate in a web worker (no `@ytrynot/dna`)](#example-1-validate-in-a-web-worker-no-ytrynotdna)
  - [Example 2: Pre-compile at build time, ship a `.js` file](#example-2-pre-compile-at-build-time-ship-a-js-file)
  - [Example 3: `@ytrynot/schvalid` pipeline](#example-3-ytrynotschvalid-pipeline)

---

## Overview

There are two distinct serialization levels:

1. **Schema ↔ DNA bytecode** — serialize a schema to a portable JSON array (`tsDnaSeq`), rebuild it later with `fromDna()`.
2. **Schema/DNA → standalone JS function** — three entry points:
   - **2a. Schema methods** (`.validate()` / `.safeParse()` / `.parse()`) — everyday use, compiles + caches via `_validate` / `_safeParse`. **Not portable.**
   - **2b. Direct compilation** (`validatorBuilder()` / `parserBuilder()`) — compile from bytecode without a schema instance. **Not portable.**
   - **2c. Full serialization** (`toJS()`) — returns source code + dependency list. **Portable**, no `@ytrynot/dna` needed on the consumer side.

```
Schema ──toDna()──> tsDnaSeq ──fromDna()──> Schema (roundtrip)
  │                                  │
  ├── .validate()/.safeParse()/.parse()  ──> _validate()/_safeParse() ──> validatorBuilder()/parserBuilder() ──> Function (cached, not portable)
  │
  └── toDna() ──> tsDnaSeq ──validatorBuilder()/parserBuilder()──> Function (not portable)
                    │
                    └──toJS()──> { code, requiredExternals } ──new Function(...code)(externals)──> Function (portable)
```

---

## Level 1: Schema ↔ DNA bytecode

```typescript
import { dna, fromDna } from "@ytrynot/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
});

// Serialize to a plain array (JSON-serializable)
const bytecode = schema.toDna();
const json = JSON.stringify(bytecode);  // transfer: network, file, postMessage...

// Rebuild a schema from bytecode
const restored = JSON.parse(json);
const rebuilt = fromDna<typeof schema>(restored);
type Out = dna.infer<typeof rebuilt>;  // { name: string, age: number }
rebuilt.safeParse({ name: "John", age: 30 });  // works
```

`toDna()` returns a `tsDnaSeq` — a flat array of opcode tuples ending with a `refList` (`number[]`). It is plain JSON-serializable data, not a class instance.

`fromDna()` rebuilds a fluent schema from it. By default the return type is `DnaSomeType<any, any>` — fully functional but with `_output` typed as `any`. Pass a type argument (`dna.DnaString`, `dna.DnaObject<...>`, `typeof originalSchema`, `ReturnType<typeof dna.function>`, etc.) to recover full type safety. See [type-inventory.md](./type-inventory.md) § "`fromDna` Type Parameter Reference" for the complete list.

See also [Round-trip DNA Reconstruction](../README.md#round-trip-dna-reconstruction) in the README for supported families and limitations.

---

## Level 2: Schema/DNA → standalone JavaScript function

There are three entry points to runtime compilation, from highest to lowest level:

**Canonical vs builder DNA** — two DNA variants exist:
- **Canonical DNA** — produced by `@ytrynot/schvalid` from JSON Schema. Used for JSON Schema validation only. No externals, no builder-specific features.
- **Builder DNA** — produced by the fluent `dna.*` builder. Supports externals (transforms/refines/catch) and builder-specific opcodes.

`validator()` / `parser()` work with canonical DNA only. `validatorBuilder()` / `parserBuilder()` / `toJS(_, true)` work with builder DNA. Use the right function for your DNA variant.

**Imports** — separated by use case:
- `dna`, `validatorBuilder`, `parserBuilder` → from `@ytrynot/dna` (builder + runtime compilation)
- `toJS`, `validator`, `parser` → from `@ytrynot/dna/toJs` (portable compilation + canonical)
- `fromDna` + types (`DnaString`, `DnaObject`, ...) → from `@ytrynot/dna/fromDna` (schema reconstruction from bytecode)

```typescript
import { dna, validatorBuilder, parserBuilder } from "@ytrynot/dna";
import { toJS, validator, parser } from "@ytrynot/dna/toJs";
import { fromDna, type DnaString } from "@ytrynot/dna/fromDna";
```

**Output types** — the methods produce three kinds of output:

- **`boolean`** (validate mode) — fail-fast, returns `true`/`false`, no error collection. Used by `.validate()` / `.validateAsync()` and `validatorBuilder()` / `validator()`.
- **`result`** (parse mode) — structured result object: `{ success: true, data: T } | { success: false, errors: tsParserError[] }`. Used by `.safeParse()` / `.safeParseAsync()` / `.spa()` and `parserBuilder()` / `parser()`.
- **`T`** (parse + throw mode) — returns `data: T` directly on success, throws `DnaError` on failure. Used by `.parse()` / `.parseAsync()`. Internally calls `safeParse` and unwraps the result.

| Entry point | Mode | API | Input | Caching | Portable |
|-------------|------|-----|-------|---------|----------|
| **2a. Schema methods** | Sync | `.validate(v, ctx?)` → `boolean`<br>`.safeParse(v, ctx?)` → `result`<br>`.parse(v, ctx?)` → `T` (throws `DnaError`) | Schema + value | Yes (cached) | No |
| | Async | `.validateAsync(v, ctx?)` → `Promise<boolean>`<br>`.safeParseAsync(v, ctx?)` / `.spa(v, ctx?)` → `Promise<result>`<br>`.parseAsync(v, ctx?)` → `Promise<T>` (rejects with `DnaError`) | | | |
| **2b. Direct compilation** | Sync | `validatorBuilder(dna, ctx?)` → `(v) => boolean`<br>`parserBuilder(dna, ctx?)` → `(v) => result`<br>`validator(dna)` / `parser(dna)` (canonical only) | DNA bytecode | No | No |
| | Async | *(call sync fn, await result)* | | | |
| **2c. Full serialization** | Sync | `toJS(validate, enhanced)(dna)` → `{ code, requiredExternals }` | DNA bytecode | N/A | **Yes** |
| | Async | *(same — source is sync or async depending on schema)* | | | |

**What is cached (2a)**: the first call to `.validate()` / `.safeParse()` / `.parse()` compiles the schema's DNA bytecode into a JS function via `validatorBuilder()` / `parserBuilder()` and stores it on the schema instance (`_core.seed.cachedValidator` / `cachedParser`). Subsequent calls reuse the cached function — no recompilation. The cache is per-schema-instance: two separate `dna.object({...})` calls produce two independent caches. The cached function captures the externals `ctx` passed on the first call; subsequent calls with a different `ctx` still use the cached function (externals are baked into the closure at compile time). `validatorBuilder()` / `parserBuilder()` (2b) do **not** cache — each call recompiles.

**Sync vs async behavior**:
- Sync methods (`.validate()`, `.safeParse()`, `.parse()`) **throw** if the schema contains async refinements/transforms — the compiled function is detected as `AsyncFunction` at call time. Use the `*Async` variants in that case.
- Async methods (`.validateAsync()`, `.safeParseAsync()` / `.spa()`, `.parseAsync()`) work uniformly for sync and async schemas — awaiting a sync function's return value is a no-op. They also accept a `Promise` as input value (awaited first).
- `DnaPromise` schemas always require `*Async`.
- For 2b/2c, the compiled function is sync or async depending on the schema. There is no separate async compiler — the same source is generated; the difference is whether the function body contains `await`.

### 2a. Schema methods — `.validate()` / `.safeParse()` / `.parse()` (everyday use)

These are the primary API. Internally, they call `_validate()` / `_safeParse()` which compile the schema's DNA to a JS function via `validatorBuilder()` / `parserBuilder()`, **cache it** on the schema instance, and invoke it. You never need to call `_validate` / `_safeParse` or `validatorBuilder` / `parserBuilder` directly for everyday use.

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.object({ name: dna.string().min(2), age: dna.number().min(0) });

// First call: compiles DNA → JS function, caches it, invokes it
schema.validate({ name: "John", age: 30 });  // true

// Subsequent calls: reuse cached function
schema.safeParse({ name: "John", age: 30 });
// { success: true, data: { name: "John", age: 30 } }

// With externals (for schemas using .transform() / .refine() / .catch())
schema.safeParse({ name: "John", age: 30 }, { myHelper });
```

The compilation happens **once per schema instance** and is cached. The function is **not portable** — externals are injected into the closure, not in the source.

### 2b. Direct compilation from bytecode — `validatorBuilder()` / `parserBuilder()`

When you have DNA bytecode but no schema instance (e.g. bytecode received over the network, from `@ytrynot/schvalid`, or loaded from a file), use `validatorBuilder()` / `parserBuilder()` directly. These are the same functions that `_validate` / `_safeParse` call internally, but without caching.

```typescript
import { validatorBuilder, parserBuilder } from "@ytrynot/dna";

// Builder DNA — uses enhancedMapper: true + externals injection
const validate = validatorBuilder(bytecode, { myHelper });
const parse = parserBuilder(bytecode, { myHelper });

validate({ name: "John", age: 30 });  // true
parse({ name: "John", age: 30 });
// { success: true, data: { name: "John", age: 30 } }

console.log(parse.requiredExternals);  // ["myHelper", ...]
```

For canonical/JSON-Schema DNA only (no builder opcodes, no externals), `validator()` / `parser()` are simpler shortcuts:

```typescript
import { validator, parser } from "@ytrynot/dna/toJs";

const validate = validator(bytecode);  // no externals, canonical opcodes only
const parse = parser(bytecode);
```

`requiredExternals` is a `string[]` listing every external name the generated function destructures from its first argument. For a schema with `.transform((v) => myHelper(v), { myHelper })`, the generated function body starts with:

```javascript
function(v, _ctx) {
  const { myHelper } = _ctx;  // destructured from the externals map
  // ... validation logic referencing myHelper ...
}
```

So `requiredExternals` tells you **what the consumer must provide**. At runtime (2a/2b), you pass them to `parserBuilder(dna, externals)` or `.safeParse(value, externals)` and they're injected into the closure. At full serialization (2c), the consumer provides them to `new Function(...code)(externals)`.

**Why 2a/2b are not portable**: `validatorBuilder()` / `parserBuilder()` call `new Function(...code)({ ...getRegisteredExternals(), ...externals })` — the externals map is passed as the first argument and captured in the closure. If you `.toString()` the function, the externals are not in the source. Re-evaluating the source in another realm would lose them.

### 2c. Full serialization — `toJS()` (portable)

This is the **only truly portable form**. `toJS()` returns the raw JavaScript source as a string array plus the list of required externals. The source can be saved to a file, sent over the network, and re-evaluated in another realm with **zero `@ytrynot/dna` dependency**:

```typescript
import { toJS } from "@ytrynot/dna/toJs";

// Producer side: serialize the function source
const result = toJS(false, true)(bytecode) as { code: string[]; requiredExternals: string[] };
const fnSource = result.code.join("\n");
// Save to a .js file, send over the network, etc.

// Consumer side: evaluate with externals (no @ytrynot/dna needed)
const externals = { /* provide requiredExternals here */ };
const parse = new Function(...result.code)(externals);
parse({ name: "John", age: 30 });  // { success: true, data: { name: "John", age: 30 } }
```

**`toJS()` signature**:

```typescript
toJS(validateMode: boolean, enhancedMapper: boolean): (dna: tsDnaSeq) => string[] | { code: string[]; requiredExternals: string[] }
```

| Argument | `true` | `false` |
|----------|--------|---------|
| `validateMode` | Validator mode (boolean, fail-fast) | Parser mode (structured result) |
| `enhancedMapper` | Builder DNA (opcodes `o`, `a`, `or`, `and`, ...) | Canonical/JSON-Schema DNA only |

Use `enhancedMapper: true` for DNA produced by the fluent `dna.*` builder. Use `enhancedMapper: false` for DNA produced by `@ytrynot/schvalid` (JSON Schema → DNA).

### When to use which

| Need | Use | Portable? |
|-----|-----|-----------|
| Validate/parse with a schema instance (everyday) | `.validate()` / `.safeParse()` / `.parse()` (compiles + caches via `_validate`/`_safeParse`) | No (not needed) |
| Compile from bytecode, no schema instance | `validatorBuilder()` / `parserBuilder()` | No |
| Compile from canonical DNA (JSON Schema, no externals) | `validator()` / `parser()` | No |
| Transfer function to another realm/worker/process | `toJS()` → `new Function(...code)(externals)` | **Yes** |
| Save function to a file, ship without `@ytrynot/dna` | `toJS()` → write `code.join("\n")` to `.js` | **Yes** |
| `@ytrynot/schvalid` pipeline (JSON Schema → standalone JS) | `validator()` / `parser()` (call `toJS` internally) | **Yes** |

---

## Externals

Schemas with `.transform()`, `.refine()`, or `.catch()` that reference external values declare them via an `externals` argument. The **names** travel in the DNA bytecode; the **values** are injected when the compiled function is created.

### Lifecycle

#### 1. Declaration (builder)

```typescript
const myHelper = (v: string) => v.toUpperCase();
const schema = dna.string().transform((v) => myHelper(v), [myHelper]);
//                                              fn          ↑ externals declared here
```

The transform function is serialized via `fn.toString()` — only the body travels, not its lexical scope. The external names (`["myHelper"]`) are stored in the DNA meta (`meta.externals`). At this stage: nothing is compiled, the schema is just a data structure.

#### 2. Compilation (`toJS`)

`toJS(validateMode, enhancedMapper)(dna)` produces `{ code, requiredExternals }`:

- The codegen reads `meta.externals` from each transform/refine/catch node, emits a `[STEP.OUT_ARG, name]` step to collect all externals names.
- When Dna bytecodes are transformed into js code, the externals names are collected and listed in `requiredExternals = ["myHelper", ...]`. The `externals` names are then assembled into the function argument part `code[0]` as the externals parameter (`"{myHelper}"`), whereas `code[1]` is the function body (a string). When assembled, this is a **factory**: `new Function("{myHelper}", "return function(input){ ... };")` — a function that receives externals and returns the actual validator/parser.

```javascript
// Generated code (simplified):
const enclosed_valid_or_parse_factory_fn = new Function("{myHelper}", "const refFn(){},...; return function(input){ input = myHelper(input); ... };")
```

`enclosed_valid_or_parse_factory_fn` is the **factory** — a function whose only parameter is the destructured externals object `{myHelper}`. Its body has two parts: a list of `const` declarations (`refFn`, regex literals, helper functions like `dEq`/`fCount`/`toBigInt`, lookup maps for `stringbool`, ...) and then `return function(input){ ... }`, which creates and returns the actual validator/parser. At this point the factory has not been called yet: `myHelper` is a formal parameter, not a bound value, and the `const` declarations are not yet evaluated.

The returned `function(input){ ... }` is the **validation function**. It closes over two things from the factory's scope: the externals (`myHelper`, from the factory's parameter) and the compiled-once constants (`refFn`, regex literals, helpers, ...). When called with `input`, it executes the validation logic and uses both as normal local variables (e.g. `input = myHelper(input)` to apply a transform, `sppttn0.test(input)` to test a regex).

The **double closure** is primarily a **performance** design: it separates what must be done once from what must be done on every validation call.

- **Externals** (`OUT_ARG`) come from outside and are injected at factory call time — they cannot live in the inner scope because there is nowhere to inject them there.
- **Compiled-once constants** (`OUT_CONST` — ref functions for circular schemas, regex literals, helper functions, lookup maps) are declared in the factory body so they are evaluated **once**, when the factory is called. If they were declared inside the validation function, they would be re-created on every validation call — recompiling regexes, rebuilding lookup maps, re-declaring helpers on every input. Hoisting them into the factory scope eliminates that per-call overhead.

So the factory's job is to **bind externals and declare compiled-once constants into the closure** of the validation function. Calling the factory with `{ myHelper: fn }` produces a validation function where `myHelper` resolves to `fn` and the constants are evaluated once; the returned function can then be called N times with different inputs without recompiling the constants or re-injecting the externals.


#### 3. Injection (factory call)

The factory is called with an externals map to produce the final validator/parser function. The externals are closured inside — the returned function uses them as normal local variables.

Built-in externals (`dna` namespace, `jwtFn`, registered constructors) are merged automatically from the registry — user externals override them.

```javascript
// Generated code (simplified):
const validate_or_parse_function = enclosed_valid_or_parse_factory_fn({myHelper});
```

At this point the factory body executes: the `const` declarations (`refFn`, regex literals, helpers, ...) are evaluated **once**, and `myHelper` is bound to the provided function. The factory returns the validation function, where both the externals and the compiled-once constants are now closured. `validate_or_parse_function` is the final, ready-to-use validator/parser — no more injection or compilation will happen.

#### 4. Runtime

At runtime, only the validation logic executes: the closured externals and compiled-once constants are used as normal local variables inside the function body, with no recompilation or re-injection.

```javascript
validate_or_parse_function("hello");  // myHelper("hello") → "HELLO" → { success: true, data: "HELLO" }
```

How the enclosed function is obtained — and whether it is cached — depends on the entry point (see below).

### Entry points

The lifecycle above is the same regardless of the entry point — the difference is **who calls the factory**, **when**, and **whether the result is cached**:

- **2a** — `schema.validate(value, ctx)` / `schema.safeParse(value, ctx)` : `ctx` (externals map) lets the caller declare externals **before compilation**. The compiled function is cached in a `WeakMap` on `_core.seed` (`cachedValidatorMap` / `cachedParserMap`), keyed by the `ctx` object reference (or by `this` — the schema instance — when no `ctx` is provided). Reusing the same `ctx` object across calls is a cache hit (no recompilation). Passing a different `ctx` object recompiles with the new externals. `validate()` and `safeParse()` have separate caches.

```typescript
schema.safeParse("hello", { myHelper });  // { success: true, data: "HELLO" }
```

- **2b** — `validatorBuilder(dna, ctx)` / `parserBuilder(dna, ctx)` : calls the factory once and returns the enclosed function with `requiredExternals` attached. No cache — the caller is responsible for reusing the returned function. Externals are passed at build time and baked in.

```typescript
import { parserBuilder } from "@ytrynot/dna";
const parse = parserBuilder(schema.toDna(), { myHelper });
console.log(parse.requiredExternals);  // ["myHelper", ...]
parse("hello");  // { success: true, data: "HELLO" }
```

- **2c** — `toJS(validateMode, enhancedMapper)(dna)` : produces `{ code, requiredExternals }` — the serialized factory source, not yet activated. The consumer reactivates it by calling `new Function(...code)(externalsMap)`. No `@ytrynot/dna` needed on the consumer side. No cache — the caller controls the full lifecycle.

```typescript
import { toJS } from "@ytrynot/dna/toJs";
const { code, requiredExternals } = toJS(false, true)(schema.toDna());
// Consumer side (no @ytrynot/dna):
const parse = new Function(...code)({ myHelper });
parse("hello");  // { success: true, data: "HELLO" }
```

For the full externals contract (registry, built-in externals, declaration forms, portability rules), see [externals.md](./externals.md).

---

## Export to JSON Schema

```typescript
const jsonSchema = schema.toJSONSchema();
// Standard JSON Schema Draft 2020-12 object
```

This is a one-way export (no `fromJsonSchema` in this package — that's `@ytrynot/schvalid`'s job).

---

## End-to-end examples

### Example 1: Validate in a web worker (no `@ytrynot/dna`)

**Main thread (has `@ytrynot/dna`)**:

```typescript
import { dna } from "@ytrynot/dna";
import { toJS } from "@ytrynot/dna/toJs";

const schema = dna.object({ name: dna.string().min(2), age: dna.number().min(0) });
const result = toJS(false, true)(schema.toDna());

worker.postMessage({
  code: result.code,
  requiredExternals: result.requiredExternals,
});
```

**Worker (no `@ytrynot/dna`)**:

```javascript
self.onmessage = (e) => {
  const { code, requiredExternals } = e.data;
  const parse = new Function(...code)({ /* externals if any */ });
  const result = parse({ name: "John", age: 30 });
  self.postMessage(result);
};
```

### Example 2: Pre-compile at build time, ship a `.js` file

**Build script**:

```typescript
import { dna } from "@ytrynot/dna";
import { toJS } from "@ytrynot/dna/toJs";
import { writeFileSync } from "node:fs";

const schema = dna.object({ name: dna.string().min(2), age: dna.number().min(0) });
const result = toJS(false, true)(schema.toDna());

const fileContent = `
const parse = new Function(${result.code.map(c => JSON.stringify(c)).join(", ")})({});
export { parse };
`;
writeFileSync("dist/validator.js", fileContent);
```

**Consumer (no `@ytrynot/dna`)**:

```javascript
import { parse } from "./dist/validator.js";
const result = parse({ name: "John", age: 30 });
```

### Example 3: `@ytrynot/schvalid` pipeline

`@ytrynot/schvalid` converts JSON Schema → DNA bytecode, then uses `validator()` / `parser()` (which call `toJS` internally with `enhancedMapper: false`) to produce standalone JS validators:

```
JSON Schema ──@ytrynot/schvalid──> tsDnaSeq ──validator()/parser()──> standalone function
```

`@ytrynot/schvalid` re-exports `validator`, `parser`, and `toJS` from `@ytrynot/dna/toJs`. For debugging, you can call `toJS(true, false)(dna)` directly to inspect the generated source. The consumer never needs `@ytrynot/dna` or `@ytrynot/schvalid` at runtime — only the generated JS function.

# DNA Externals Mechanism

> Technical specification of the externals system used by `@ytrynot/dna` to inject
> runtime values (libraries, constructors, helpers, user functions) into compiled
> validator/parser functions.

---

## Table of Contents

- [Overview](#overview)
- [Why Externals Exist](#why-externals-exist)
- [Contract](#contract)
- [Registry](#registry)
- [Built-in Externals](#built-in-externals)
  - [dna](#dna)
  - [jwtFn](#jwtfn)
  - [Constructors (instanceOf)](#constructors-instanceof)
- [User Externals — transform, refine, catch](#user-externals--transform-refine-catch)
  - [transform](#transform)
  - [refine / check / superRefine](#refine--check--superrefine)
  - [catch](#catch)
  - [Declaration Forms](#declaration-forms)
  - [Complete transform + externals example](#complete-transform--externals-example)
  - [Complete refine + externals example](#complete-refine--externals-example)
  - [Passing a class constructor](#passing-a-class-constructor)
  - [Passing a namespace](#passing-a-namespace)
- [Codegen — How Externals Reach the Generated Function](#codegen--how-externals-reach-the-generated-function)
- [Consumer API](#consumer-api)
- [Complete Flow](#complete-flow)
- [JWT / jwtFn — Detailed Guide](#jwt--jwtfn--detailed-guide)
- [Portability of Externals](#portability-of-externals)

---

## Overview

DNA compiles schemas into **standalone JavaScript functions** via `new Function(...)`.
These functions are self-contained strings — they cannot use `import` or closures from
the host module. Any external value they need (a library function, a constructor, a
helper, a user-defined function) must be **injected at compile time** via the
`externals` argument.

The externals system has three parts:

1. **Registry** — a `Map<string, unknown>` that stores external values by name.
2. **Codegen declaration** — `[STEP.OUT_ARG, name]` tells the compiler to add `name`
   to the destructured parameter of the generated function.
3. **Compile-time injection** — `validatorBuilder`/`parserBuilder` merge
   `getRegisteredExternals()` with user-provided externals and pass the result as the
   first argument to `new Function(...)`.

---

## Why Externals Exist

When you write:

```typescript
const schema = dna.string().transform((v) => myHelper(v), [myHelper]);
```

The transform function `(v) => myHelper(v)` is serialized to a string via `fn.toString()`
and embedded in the DNA bytecode. The generated JavaScript looks like:

```javascript
function({ myHelper }) {
  return function(input) {
    input = ((v) => myHelper(v))(input);
    return { success: true, data: input };
  };
}
```

Without externals, `myHelper` would be an undefined reference inside the generated
function — it was a closure variable in the original code, but `fn.toString()` captures
only the function body, not its lexical scope.

**Externals solve this**: the name `myHelper` travels in the DNA (declared via the
`externals` parameter of `.transform()`), and the value is injected at compile time.
The generated function destructures `myHelper` from its first parameter and uses it
like a normal variable.

This applies to:
- **User functions** referenced inside `.transform()`, `.refine()`, `.catch()`
- **Library functions** like `jose.decodeProtectedHeader` (JWT validation)
- **Constructors** for `dna.instanceOf()` checks
- **The `dna` namespace itself** (for transforms that call `dna.*` methods)

---

## Contract

An **external** is a named value injected into the closure of a compiled
validator/parser.

```typescript
/** External references a serialized function uses (imports/helpers).
 *  The NAMES travel in the DNA; the VALUES are supplied at compile time.
 *  The value type is `unknown` — the registry stores anything (functions,
 *  namespaces, constructors, primitives). The consumer is responsible for
 *  knowing what type the value is and using it correctly in the generated code. */
export type tsDnaExternals = Record<string, unknown>;

/** Declaration form for externals (array or object) used in transform/refine/check/codec. */
export type tsDnaExternalsDeclArray = readonly (Function & { name: string })[];
export type tsDnaExternalsDeclObject = Record<string, unknown>;
export type tsDnaExternalsDecl = tsDnaExternalsDeclArray | tsDnaExternalsDeclObject;
```

### Rules

- The **name** is a string that appears in the generated JavaScript code as a local
  variable (destructured from the externals parameter). It must be a valid JS identifier.
- The **value** can be anything: a function, a constructor, a namespace object, a
  primitive. The registry is `Record<string, unknown>` — it does not enforce or
  validate the type. The consumer is responsible for using the value correctly.
- The name in the DNA/codegen **must match** the key in the externals map provided at
  compile time. If the name is missing, the generated function will throw
  `ReferenceError` at runtime.
- Externals are **merged**: `getRegisteredExternals()` provides built-in defaults,
  user-provided externals override them.
- **No lazy providers, no arity checks**: the registry stores values directly. What the
  generated code does with the value (call it, read it, etc.) is entirely up to the
  user's serialized function body.

---

## Registry

The registry is a module-level `Map<string, unknown>` in `src/toJs/registry.ts`.

```typescript
const externalRegistry = new Map<string, unknown>();

export const registerExternal = (name: string, value: unknown): void => {
  externalRegistry.set(name, value);
};

export const getExternal = (name: string): unknown => {
  return externalRegistry.get(name);
};

export const getRegisteredExternals = (): Record<string, unknown> => {
  return Object.fromEntries(externalRegistry);
};
```

### Properties

- **Global and mutable**: the registry is a module-level singleton. All schemas in the
  same process share it.
- **Direct values only**: no provider mechanism, no lazy evaluation. The value
  registered is the value injected.
- **Untyped storage**: the registry stores `unknown`. The consumer is responsible for
  knowing what type each value is and using it correctly in the generated code.
- **Override**: `registerExternal` overwrites any existing entry with the same name.
- **No scoping**: there is no per-schema isolation. If two schemas register different
  values for the same name, the last one wins.

---

## Built-in Externals

### `dna`

- **Name in codegen**: `dna`
- **Value**: the `dna` namespace (all builder methods: `dna.string()`, `dna.object()`,
  etc.)
- **Registered**: eagerly in `src/index.ts` at module load time.
- **Purpose**: allows transform/refine functions in the generated code to reference
  `dna.*` methods.

```typescript
// src/index.ts
// dna is a namespace (object with methods). The registry stores unknown,
// so no cast is needed — the value is injected as-is.
registerExternal("dna", dna);
```

### `jwtFn`

- **Name in codegen**: `jwtFn`
- **Value**: `jose.decodeProtectedHeader` (the function, not the namespace)
- **Registered**: in the `jwt` handler when a schema uses `dna.jwt()`.
- **Purpose**: the `jwt` opcode handler generates code that calls
  `jwtFn(input)` to decode a JWT's protected header and validate its `typ`/`alg`.

Since `@ytrynot/dna` is its own consumer for JWT validation (the `jwt` handler imports
`jose` and registers `decodeProtectedHeader` under the name `jwtFn`), `jose` remains
in `dependencies`. External consumers who do not use `dna.jwt()` still pay the `jose`
bundle cost — this is a known trade-off for the 0.2.x line. Isolating `jose` into an
optional subpath export is a post-1.0 consideration.

See [JWT / jwtFn — Detailed Guide](#jwt--jwtfn--detailed-guide) below.

### Constructors (instanceOf)

- **Name in codegen**: the constructor's `name` (e.g., `"Date"`, `"Map"`, `"URL"`)
- **Value**: the constructor function itself
- **Registered**: lazily in `DnaInstanceOf._emitSelf` when the builder encounters
  `dna.instanceOf(SomeConstructor)`.
- **Purpose**: the `instanceOf` opcode generates `value instanceof ConstructorName`,
  where `ConstructorName` is destructured from externals.

```typescript
// dna-interfaces.ts — DnaInstanceOf._emitSelf
registerExternal(constructorName, this._core.seed.constructor);
this._core.rawDna = ["instanceOf", constructorName];
```

The consumer can also register constructors manually:

```typescript
import { registerExternal } from "@ytrynot/dna";
registerExternal("MyClass", MyClass);
```

---

## User Externals — transform, refine, catch

The most common use of externals is when a user writes a `.transform()`, `.refine()`, or
`.catch()` function that references values from the outer scope. Because the function is
serialized to a string (`fn.toString()`) and embedded in the DNA, any captured variable
must be declared as an external so the codegen can inject it.

### transform

`.transform(fn, externals?)` accepts an optional `externals` parameter. Any variable
referenced inside `fn` that is not a parameter or a global must be listed in `externals`.

```typescript
import { dna } from "@ytrynot/dna";

const myHelper = (v: string) => v.toUpperCase();

const schema = dna.string().transform(
  (v) => myHelper(v),
  [myHelper]  // ← declare myHelper as an external
);

// At compile time, the generated function receives { myHelper: <the function> }
// and destructures it: function({ myHelper }) { ... myHelper(v) ... }
const result = schema.safeParse("hello");
// { success: true, data: "HELLO" }
```

### refine / check / superRefine

`.refine(fn, options?)` serializes `fn` to a string. If `fn` references external values,
they must be registered via `registerExternal` before compilation, or passed via the
`ctx` argument of `validate`/`safeParse`.

> **Note**: The current `refine()` signature does not accept an `externals` parameter
> directly (unlike `transform` and `catch`). The codegen infrastructure supports it
> (the `check` handler reads `dnaOpt[1]?.externals`), but the builder API does not yet
> expose it. To use externals with `refine`, register them globally before calling
> `validate`/`safeParse`:

```typescript
import { dna, registerExternal } from "@ytrynot/dna";

const isAdult = (age: number) => age >= 18;
registerExternal("isAdult", isAdult);

const schema = dna.number().refine(
  (value) => isAdult(value),  // isAdult is referenced but not a parameter
  { error: "Must be an adult" }
);

schema.safeParse(21);  // { success: true, data: 21 }
schema.safeParse(15);  // { success: false, errors: [...] }
```

### catch

`.catch(fn, externals?)` accepts an optional `externals` parameter, same as `transform`.

```typescript
const fallback = (ctx: any) => myDefault(ctx.value);
const schema = dna.string().catch(
  fallback,
  [myDefault]  // ← declare myDefault as an external
);
```

### Declaration Forms

Externals can be declared in two forms:

**Array form** — derives the name from each function's `.name` property:

```typescript
.transform(
  (v) => myHelper(v) + otherHelper(v),
  [myHelper, otherHelper]
)
// Names: "myHelper", "otherHelper" (from function.name)
```

**Object form** — explicit names (required for anonymous functions, arrow functions, or
non-function values):

```typescript
.transform(
  (v) => helper(v),
  { helper: (v) => v.toUpperCase() }  // arrow function needs explicit name
)
// Name: "helper"
```

```typescript
.transform(
  (v) => v.slice(0, maxLen),
  { maxLen: 100 }  // non-function value
)
// Name: "maxLen", value: 100
```

> **Pitfall**: Arrow functions and anonymous functions have no `.name` in the array
> form. Use the object form `{ myFn: arrowFn }` to name them explicitly.

### Complete transform + externals example

```typescript
import { dna } from "@ytrynot/dna";

// External values
const normalize = (v: string) => v.trim().toLowerCase();
const MAX_LEN = 50;

const schema = dna.string()
  .transform(
    (v) => normalize(v).slice(0, MAX_LEN),
    { normalize, MAX_LEN }  // ← object form: names + values
  );

const result = schema.safeParse("  Hello World  ");
// { success: true, data: "hello world" }
```

The generated function looks like:

```javascript
function({ normalize, MAX_LEN }) {
  return function(input) {
    // ... type check ...
    input = ((v) => normalize(v).slice(0, MAX_LEN))(input);
    return { success: true, data: input };
  };
}
```

### Complete refine + externals example

```typescript
import { dna, registerExternal } from "@ytrynot/dna";

// External validation helper
const checkLuhn = (cardNumber: string): boolean => {
  // Luhn algorithm...
  return true;
};
registerExternal("checkLuhn", checkLuhn);

const schema = dna.string()
  .refine(
    (value) => checkLuhn(value),
    { error: "Invalid credit card number" }
  );

schema.safeParse("4111111111111111");  // { success: true, data: "4111111111111111" }
```

### Passing a class constructor

You can pass a class constructor as an external for use inside transforms or refines:

```typescript
import { dna, registerExternal } from "@ytrynot/dna";

class Point {
  constructor(public x: number, public y: number) {}
}

registerExternal("Point", Point);

const schema = dna.object({ x: dna.number(), y: dna.number() })
  .refine(
    (value) => {
      const p = new Point(value.x, value.y);  // Point is available
      return p.x >= 0 && p.y >= 0;
    },
    { error: "Coordinates must be positive" }
  );
```

### Passing a namespace

You can pass an entire module/namespace as an external:

```typescript
import { dna, registerExternal } from "@ytrynot/dna";
import * as myUtils from "./my-utils.js";

registerExternal("myUtils", myUtils);

const schema = dna.string()
  .refine(
    (value) => myUtils.validate(value),  // myUtils.* is available
    { error: "Invalid value" }
  );
```

The generated function destructures `myUtils` from externals, making the entire
namespace available inside the serialized function.

---

## Codegen — How Externals Reach the Generated Function

### Step 1: Declaration in the handler

A handler declares that it needs an external by emitting a
`[STEP.OUT_ARG, name]` step. The `externalsOutArgs` helper generates one step per
external name:

```typescript
// src/toJs/utils.ts
export const externalsOutArgs = (externals: tsDnaExternals | undefined): tsStackFrame[] =>
  externals ? Object.keys(externals).map((name): tsStackFrame => [STEP.OUT_ARG, name]) : [];
```

### Step 2: Collection during compilation

During compilation, `[STEP.OUT_ARG, name]` steps are collected into a `Set<string>`
called `outerCtxArg`:

```typescript
// src/toJs/dna-to-js.ts
case STEP.OUT_ARG: outerCtxArg.add(ctx as string); continue;
```

### Step 3: Generation of the destructured parameter

At the end of compilation, the collected names become the **first parameter** of the
generated function — a destructured object literal:

```typescript
// src/toJs/dna-to-js.ts
const toJSArgFn = [];
if (outerCtxArg.size) toJSArgFn.push("{" + Array.from(outerCtxArg) + "}");
toJSArgFn.push(
  (outerCtxConst.size ? "const " + Array.from(outerCtxConst).join(",") + ";" : "")
  + "return " + (isAsync ? "async " : "") + "function(" + jsFnArgs.join(",") + "){" + body + "};"
);
```

The generated code looks like:

```javascript
// toJSArgFn[0] = "{myHelper,MAX_LEN,dna}"     ← destructured parameter
// toJSArgFn[1] = "return function(input){ ... }"

new Function("{myHelper,MAX_LEN,dna}", "return function(input){ ... }")
```

### Step 4: Injection at compile time

`validatorBuilder`/`parserBuilder` merge the registry with user-provided externals and
pass the result as the first argument:

```typescript
// src/toJs/dna-to-js.ts
export const validatorBuilder = (dna: tsDnaSeq, externals?: tsDnaExternals) => {
  const { code, requiredExternals } = toJS(true, true)(dna);
  const fn = new Function(...code)({ ...getRegisteredExternals(), ...externals });
  fn.requiredExternals = requiredExternals;
  return fn;
};
```

The merge order (`{ ...registry, ...userExternals }`) means user-provided externals
**override** registered ones.

---

## Consumer API

### Providing externals at compile time

```typescript
import { validatorBuilder, parserBuilder } from "@ytrynot/dna";

// Built-in externals (dna, jwtFn if registered) are included automatically.
// User externals override or supplement them.
const validate = validatorBuilder(dna, {
  myHelper: (v) => v.length > 0,
});

// The generated function receives: { ...getRegisteredExternals(), ...userExternals }
```

> **Note**: `validatorBuilder`/`parserBuilder` are low-level APIs that recompile the function on every call (no caching). For most use cases, prefer `schema.validate()`/`schema.safeParse()` which compile once and cache the result. Use `validatorBuilder`/`parserBuilder` only when you need different externals per compilation or need `requiredExternals` inspection.

### Via the schema instance (safeParse / validate)

```typescript
// Externals are passed via the ctx argument for the initial compilation.
// The compiled function is cached on the schema instance — subsequent calls
// reuse the cached function and IGNORE the ctx argument.
schema.safeParse(value, { myHelper: fn });  // first call: compiles with externals, caches result
schema.safeParse(value, { myHelper: otherFn });  // second call: uses cached function, ctx is IGNORED
```

> **Important**: The `ctx` parameter is used at **compile time** to create the cached validator/parser. It is NOT a per-call override mechanism. The first call to `safeParse`/`validate` with externals compiles and caches the function; all subsequent calls reuse the cached function regardless of what `ctx` is passed. To use different externals, either create separate schema instances or use the low-level `validatorBuilder`/`parserBuilder` API which recompiles on every call.

### Registering externals globally

```typescript
import { registerExternal } from "@ytrynot/dna";

// Available to all subsequent validatorBuilder/parserBuilder calls
registerExternal("myHelper", (v) => v.length > 0);
registerExternal("MyClass", MyClass);
```

### Inspecting required externals

```typescript
const validate = validatorBuilder(dna);
console.log(validate.requiredExternals);
// ["dna", "jwtFn", "myHelper"] — names the generated function expects
```

---

## Complete Flow

```
1. REGISTRATION (module load, builder emit, or user code)
   ┌──────────────────────────────────────────────┐
   │ registerExternal("dna", dnaNamespace)        │  ← eager (index.ts)
   │ registerExternal("jwtFn", decodeProtectedHdr)│  ← jwt handler
   │ registerExternal("Date", Date)               │  ← instanceOf
   │ registerExternal("myHelper", myHelper)       │  ← user code
   └──────────────────────────────────────────────┘
                         │
2. BUILDER (user declares externals on transform/refine/catch)
   ┌──────────────────────────────────────────────┐
   │ .transform((v) => myHelper(v), [myHelper])   │
   │   → externalsMap([myHelper]) → { myHelper }  │
   │   → DNA meta: { externals: { myHelper } }    │
   └──────────────────────────────────────────────┘
                         │
3. CODEGEN (toJS compilation)
   ┌──────────────────────────────────────────────┐
   │ Handler reads meta.externals                 │
   │ externalsOutArgs() emits [STEP.OUT_ARG, name]│
   │   per external                               │
   │ outerCtxArg Set collects all names           │
   │ toJS returns: { code, requiredExternals }    │
   └──────────────────────────────────────────────┘
                         │
4. CODE GENERATION (assembling the function source)
   ┌──────────────────────────────────────────────┐
   │ toJSArgFn[0] = "{myHelper,jwtFn,dna,Date}"   │  ← destructured param
   │ toJSArgFn[1] = "return function(input){...}" │  ← function body
   └──────────────────────────────────────────────┘
                         │
5. COMPILE-TIME INJECTION (validatorBuilder / parserBuilder)
   ┌───────────────────────────────────────────────┐
   │ const externals = {                           │
   │   ...getRegisteredExternals(),  ← built-ins   │
   │   ...userExternals             ← overrides    │
   │ };                                            │
   │ const fn = new Function(...code)(externals);  │
   │                                               │
   │ // new Function("{myHelper,...}", "return...")│
   │ //   → factory function                       │
   │ // factory({ myHelper: fn, jwtFn: fn, ... })  │
   │ //   → returns the actual validator/parser    │
   └───────────────────────────────────────────────┘
                         │
6. RUNTIME (generated function executes)
   ┌───────────────────────────────────────────────┐
   │ // The factory received externals and closed  │
   │ // over them. The returned function uses them │
   │ // as normal local variables.                 │
   │                                               │
   │ function(input) {                             │
   │   // myHelper is the user's function          │
   │   // jwtFn is jose.decodeProtectedHeader      │
   │   // dna is the builder namespace             │
   │   // Date is the Date constructor             │
   │   input = myHelper(input);                    │
   │   // ...                                      │
   │ }                                             │
   └───────────────────────────────────────────────┘
```

---

## JWT / jwtFn — Detailed Guide

### What is `jwtFn`?

`jwtFn` is the external name used by the `jwt` opcode handler. It represents the
function `jose.decodeProtectedHeader` — **not** the entire `jose` namespace.

### Name in generated code

The generated validator/parser code uses `jwtFn` as a local variable:

```javascript
// Generated code (validator mode):
let jH1;
try { jH1 = jwtFn(input); } catch(e) { return false; }
if (!(jH1 && (jH1.typ === undefined || jH1.typ === "JWT") && jH1.alg === "HS256")) {
  return false;
}
```

### Registration

Since `@ytrynot/dna` is its own consumer for JWT validation, the `jwt` handler imports
`jose` and registers `decodeProtectedHeader` under the name `jwtFn`:

```typescript
// src/toJs/dna-js-builder.ts — jwt handler
import * as jose from "jose";

export const jwt = (...) => {
  registerExternal("jwtFn", jose.decodeProtectedHeader);
  // ...
  return [[STEP.OUT_ARG, "jwtFn"], [STEP.BODY, body]];
};
```

`jose` remains in `dependencies` because the handler imports it directly. External
consumers who do not use `dna.jwt()` still pay the `jose` bundle cost — this is a
known trade-off for 0.2.x. Isolating `jose` into an optional subpath export is a
post-1.0 consideration.

### What the consumer needs to provide

| External name | Value | Required when | Source |
|---|---|---|---|
| `jwtFn` | `jose.decodeProtectedHeader` | Schema uses `dna.jwt()` | Registered automatically by the `jwt` handler |

If the consumer does not use `dna.jwt()`, `jwtFn` is never registered and never
appears in the generated code.

---

## Portability of Externals

An external value must be **portable** — it must work correctly when extracted from its
original module context and injected into a `new Function(...)` closure.

### What makes a value portable

A value is portable if it does not rely on:

- **Module-level state** that is not self-contained (e.g., a function that reads a
  module-level `let` variable from its original module).
- **`this` binding** to the original module (unless the value is a bound function or a
  plain function, not a method).
- **Closures** over variables that are not passed as externals.

### Portable examples

| Value type | Portable? | Notes |
|---|---|---|
| Pure function (`(v) => v.toUpperCase()`) | Yes | No external dependencies. |
| Module export (`jose.decodeProtectedHeader`) | Yes | Self-contained function. |
| Class constructor (`Date`, `Map`) | Yes | Constructors are global or self-contained. |
| Namespace (`import * as utils from ...`) | Yes | Object with properties; each property must itself be portable. |
| Bound method (`obj.method.bind(obj)`) | Yes | `this` is captured. |
| Unbound method (`obj.method`) | No | Loses `this` binding. |
| Closure over module variable | No | The variable is not available in the generated function. |

### Testing portability

To verify that a value is portable, test it by extracting the value and calling it
inside a `new Function(...)`:

```typescript
// Extract the value
const fn = jose.decodeProtectedHeader;

// Simulate the generated function environment
const generated = new Function("jwtFn", "return function(input) { return jwtFn(input); }")(fn);

// Test
const result = generated("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature");
// If this works, the value is portable.
```

The example above serves as a portability test for `jwtFn`.

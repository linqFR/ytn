# @ytn/shared/safe

Deterministic Error Management and Orchestration layer. This package implements the **SafeMode** philosophy, favoring tuples over exceptions to ensure linear and predictable code execution.

## Table of Contents

- [Philosophy: SafeMode](#philosophy-safemode)
- [Dual Result Styles and Fluent API](#dual-result-styles-and-fluent-api)
- [Interoperability and Conversions](#interoperability-and-conversions)
- [Orchestration Helpers](#orchestration-helpers)
  - [Bouncers (failfast)](#bouncers-failfast)
  - [Result Guards](#result-guards)

---

## Philosophy: SafeMode

In the **linqFR** ecosystem, we avoid `try/catch` cascades and unhandled exceptions for business orchestration. Instead of throwing, fallible functions return a `SafeResult`.

**Benefits**:

- **Explicit Failure**: TypeScript forces you to check for the error.
- **Linear Code**: No indentation hell caused by nested `if/then/else`.
- **Performance**: Tuples are lighter than stack-trace generation for business "errors" (like validation failures).

---

## Dual Result Styles and Fluent API

YTN's SafeMode supports two interchangeable representations for results. Results are **branded objects** that behave like arrays but provide a **Fluent API** for easy transformation.

### 1. Tuple Style (Default / Array-like)

Optimized for fast destructuring and linear flow.
`type SafeResult<T> = [error: unknown, result: T | undefined]`

```typescript
import { safeParse } from "@ytn/shared/js/json.js";
const [err, res] = safeParse(jsonString);
```

### 2. Object Style (Explicit / Getters)

Optimized for named access. You can convert any result instantly using the **`.toObject`** getter (no parentheses required).

```typescript
import { safeParseYaml } from "@ytn/shared/template/yaml-parser.js";

// Fluent chaining with getters
const result = safeParseYaml(rawYaml).toObject;

if (result.success) {
  console.log(result.data); // result is natively { success, data }
}
```

---

## Interoperability and Conversions

- **`.toObject`** (Getter): Converts `[err, res]` to `{ success, data, error }`.
- **`.toArr`** (Getter): Returns a plain, unbranded array `[err, res]`.
- **`fromObject(obj)`**: Injects an existing result object back into the branded tuple system.

### Polymorphic Guards

The guards **`isSuccess()`** and **`isFailure()`** work transparently with **BOTH** styles (Tuples and Objects).

```typescript
import { isSuccess } from "@ytn/shared/safe/safemode.js";

if (isSuccess(anyResult)) {
  // TypeScript correctly narrows the type regardless of format
}
```

---

## Orchestration Helpers

### Bouncers (failfast)

The `failfastBouncer` is used to orchestrate a sequence of fallible operations. If any operation returns an error, the entire chain stops and returns that error.

### Result Guards

Utilities to quickly identify the status of a result:

- `isSafeOk(result)`: True if the operation succeeded.
- `isSafeErr(result)`: True if the operation failed.

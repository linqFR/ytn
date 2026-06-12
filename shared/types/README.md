# @ytn/shared/types

Standard structural and utility types for the YTN monorepo. This directory establishes the common language for type safety across all independent packages.

## Table of Contents

- [Nominal Typing (Branding)](#nominal-typing)
- [Async Utilities](#async-utilities)
- [Structural Data (JSON)](#structural-data)
- [Advanced Modifiers](#advanced-modifiers)
- [Global Conventions](#global-conventions)

---

## Nominal Typing

To prevent logic errors where different string identifiers (e.g., `UserId` vs `OrderId`) are accidentally mixed even though they are both strings, we use **Branding**.

### `$Branded<T, K>`

Creates an opaque/branded type that remains compatible with base type `T` at runtime but stays incompatible with other identical structures at compile-time.

```typescript
import type { $Branded } from "@ytn/shared/types/index.js";

type UserId = $Branded<string, "UserId">;
type OrderId = $Branded<string, "OrderId">;

function getUser(id: UserId) { /* ... */ }

const myOrderId = "order-1" as OrderId;
// getUser(myOrderId); // ❌ TypeScript Error!
```

---

## Async Utilities

Simplifies handling of asynchronous values and function returns.

### `$Awaitable<T>`

Represents a value that may or may not be wrapped in a Promise. Essential for defining flexible interfaces that support both sync and async implementations.

```typescript
import type { $Awaitable } from "@ytn/shared/types/index.js";

type MyGate = (data: unknown) => $Awaitable<string>;
```

### `$UnwrapPromise<T>`

Extracts the inner type of a `Promise<T>`. If the type is not a Promise, it returns the type as-is.

---

## Structural Data (JSON)

Ensures data integrity when dealing with serialization and transmission.

### `tsJSONPrimitive`

The base set of primitives allowed in a JSON structure: `string | number | boolean | null`.

### `tsValidJSON<T>`

Strict recursive type checking to ensure a structure `T` is fully serializable to JSON. It validates arrays and objects while forbidding symbols, bigints, and functions.

```typescript
import type { tsValidJSON } from "@ytn/shared/types/index.js";

// ✅ Valid structure
const payload: tsValidJSON<{ id: string }> = { id: "1" };

// ❌ TypeScript Error: Functions are not valid JSON!
// const invalid: tsValidJSON<{f: Function}> = { f: () => {} };
```

---

## Advanced Modifiers

Low-level structural transformations used for complex type orchestration.

- **`$DeepReadonly<T>`**: Recursively applies `readonly` across an entire object tree.
- **`$Entries<T>`**: Provides a type-safe signature for `Object.entries(T)`.
- **`$Keys<T>`**: Provides a type-safe signature for `Object.keys(T)`.
- **`$RequireAtLeastOne<T, Keys>`**: Ensures at least one of the specified properties is present.
- **`$RequiredNotNull<T, K>`**: Ensures a specific property is both required and not null/undefined.
- **`$UnionToIntersection<U>`**: Converts a union type to an intersection type.
- **`$Without<T, U>`**: Guarantees that `T` does not contain any keys belonging to `U`.
- **`$XOR<T, U>`**: Exclusive OR. Enforces that exactly one of the two shapes is present.

---

## Global Conventions

All types in this directory follow the **YTN Naming Standards**:

- **`I*`**: Interfaces/Types for Input/Config data (e.g., `IContract`).
- **`O*`**: Interfaces/Types for Output/Result data (e.g., `OResult`).
- **`$*`**: Type-modifiers / active functional types (e.g., `$XOR`).
- **`ts*`**: Simple static type aliases or fixed structures (e.g., `tsSnakeCase`).
- **`u*`**: High-level exported utility functions to help developers to type correctly an item definition (e.g., `uDefineWf`).

### Integration with SafeMode

While defined in `shared/safe`, the `tsSafeResult` type is the cornerstone of YTN's error management:
`[error: E | null | undefined, result: R | null | undefined]`.

### The `ts.` Namespace

In the `@ytn/shared` package, all these types are gathered under the global `ts` namespace for easy access:

```typescript
import { ts } from "@ytn/shared";

type MyId = ts.$Branded<string, "MyId">;
```

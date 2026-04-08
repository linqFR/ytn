# @ytn/shared/types

Standard structural and utility types for the YTN monorepo. This directory establishes the common language for type safety across all independent packages.

## Table of Contents

- [Foundation Types](#foundation-types)
  - [Awaitable](#awaitable-types)
  - [SafeResult](#saferesult-types)
- [Nominal Typing (Branded)](#nominal-typing)
- [Structural Data (Json)](#structural-data)
- [Type Modifiers](#type-modifiers)

---

## Foundation Types

### Awaitable Types

Simplifies functions that can return either a synchronous value or a Promise of that value. Essential for defining flexible interfaces (e.g., in `WFRunner`).

```typescript
import type { Awaitable } from "@ytn/shared/types/index.js";

type MyGate = (data: unknown) => Awaitable<string>;
```

### SafeResult Types

The canonical tuple `[error: unknown, result: T | undefined]` used for deterministic failure management throughout the project.

---

## Nominal Typing

To prevent logic errors where different string identifiers (e.g., UserId vs OrderId) are accidentally mixed, we use **Branding**.

```typescript
import type { Branded } from "@ytn/shared/types/index.js";

type UserId = Branded<string, "UserId">;
type OrderId = Branded<string, "OrderId">;

function getUser(id: UserId) {
  /* ... */
}

const myOrderId = "order-1" as OrderId;
// getUser(myOrderId); // This will throw a TypeScript Error!
```

---

## Structural Data

### ValidJSON

Recursive generic type for ensuring that an object structure `T` can safely be serialized to JSON without loss of data (e.g., no functions, symbols, or bigints allowed).

```typescript
import type { ValidJSON } from "@ytn/shared/types/index.js";

// Valid structure
const payload: ValidJSON<{ id: string }> = { id: "1" };

// TypeScript Error: Functions are not valid JSON!
// const invalid: ValidJSON<{f: Function}> = { f: () => {} };
```

---

## Type Modifiers

Advanced structural transformations for the YTN monorepo. Found in `shared/types/modifiers.type.ts`.

- **`$XOR<T, U>`**: Enforces that exactly one of the two shapes is present.
- **`$DeepReadonly<T>`**: Recursively applies `readonly` across an entire object tree.
- **`$RequireAtLeastOne<T>`**: Ensures that at least one of the keys is explicitly defined.
- **`$Without<T, U>`**: Guarantees that T does not contain any keys belonging to U.

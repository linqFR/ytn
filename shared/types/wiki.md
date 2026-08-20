# shared/types Wiki — In-depth guide

Detailed examples, edge cases, and design rationale for each helper.

## Quick reference — all helpers by file

### `structural.type.ts` — object shape transformations

| Helper | Signature | One-liner | Example |
|--------|-----------|-----------|---------|
| `$Flatten<T>` | `<T>` → flat object | Resolve `Omit`/`Pick`/intersections to plain object for IDE | `$Flatten<Omit<{a:1;b:2}, "a">>` → `{b: number}` |
| `$FlattenCombinative<T>` | alias of `$Flatten` | Same — emphasizes non-distributive | — |
| `$ToRecord<T>` | alias of `$Flatten` | Same — emphasizes Record-like output | — |
| `$FlattenDistributive<T>` | `<T>` → flat per union member | Flatten each branch of a union independently | `$FlattenDistributive<{a:1} \| {b:2}>` → `{a:1} \| {b:2}` |
| `$Xor<T, U>` | `<T, U>` → T xor U | Exactly one shape, never both | `$Xor<{file:string}, {url:string}>` — file XOR url |
| `$Without<T, U>` | `<T, U>` → forbidden keys | Internal for `$Xor` — marks common keys as `never` | Not for direct use |
| `$Or<T, U>` | `<T, U>` → `T \| U` | Trivial union alias for syntax consistency | `$Or<string, number>` → `string \| number` |
| `$DeepReadonly<T>` | `<T>` → recursively readonly | `readonly` at every level | `$DeepReadonly<{x:{y:number}}>` → `{readonly x:{readonly y:number}}` |
| `$ReadonlyValue<T>` | `<T>` → readonly or identity | Readonly for objects, identity for primitives | `$ReadonlyValue<string>` → `string` |
| `$RemoveUndefined<T>` | `<T>` → T without undefined | Distributive over unions | `$RemoveUndefined<string \| undefined>` → `string` |

### `predicates.type.ts` — boolean checks

| Helper | Signature | One-liner | Example |
|--------|-----------|-----------|---------|
| `$IsAny<T>` | `<T>` → `true \| false` | Detects exactly `any` (not `unknown`) | `$IsAny<any>` → `true`, `$IsAny<unknown>` → `false` |
| `$IsDigit<C>` | `<C extends string>` → `true \| false` | Single char is 0-9 | `$IsDigit<"5">` → `true` |
| `$IsLower<C>` | `<C extends string>` → `true \| false` | Single char is lowercase | `$IsLower<"a">` → `true` |
| `$IsUpper<C>` | `<C extends string>` → `true \| false` | Single char is uppercase | `$IsUpper<"Z">` → `true` |
| `$HasProperty<T, K>` | `<T, K extends PropertyKey>` → `T \| never` | Type guard — key exists on T | `$HasProperty<{a:1}, "a">` → `{a:1}` |
| `$PropertyCheck<T, K, S>` | `<T, K, S>` → `T \| { [P in K]: S }` | Returns T if K exists, else shape with K:S | `$PropertyCheck<{a:1}, "b", string>` → `{b: string}` |

### `enum.type.ts` — enum & array extraction

| Helper | Signature | One-liner | Example on `T = { a: 1, b: 2 }` |
|--------|-----------|-----------|------|
| `$EnumKeys<T>` | `<T>` → key type | Extract key type from enum-like object | `"a" \| "b"` |
| `$EnumValues<T>` | `<T>` → value type | Extract value type (handles arrays and objects) | `1 \| 2` |
| `$EnumAsObj<T>` | `<T>` → readonly enum object | Normalize array/object to readonly enum obj | `{ readonly a: 1; readonly b: 2 }` |
| `$EnumObj<T>` | `<T>` → `Record<string, V>` | Full enum object as Record | `Record<string, 1 \| 2>` |
| `$ArrayItem<T>` | `<T>` → item type | Extract item type from array (`T[number]` equivalent) | `$ArrayItem<string[]>` → `string` |
| `$ToEnum<T>` | `<T extends string\|number\|bigint>` → enum obj | Convert union to flattened enum object | `$ToEnum<"a" \| "b">` → `{a:"a"; b:"b"} & {}` |

### `record.type.ts` — keys, entries, record transforms

| Helper | Signature | One-liner | Example on `T = { a: 1, b: 2 }` |
|--------|-----------|-----------|------|
| `$Keys<T>` | `<T>` → `(keyof T)[]` | Type-safe `Object.keys()` | `("a" \| "b")[]` |
| `$Entries<T>` | `<T>` → `[K, T[K]][]` | Type-safe `Object.entries()` | `["a", 1] \| ["b", 2][]` |
| `$RecordSetToArray<T>` | `<T extends Record<string, Set<any>>>` → `Record<string, I[]>` | Map `Set<I>` values to `I[]` | — |
| `$UnionToIntersection<U>` | `<U>` → intersection | `A \| B` → `A & B` | `$UnionToIntersection<{a:1} \| {b:2}>` → `{a:1} & {b:2}` |
| `$RequireAtLeastOne<T, K>` | `<T, K extends keyof T>` → requires ≥1 of K | At least one key from K present | `$RequireAtLeastOne<{a?:string; b?:string}, "a" \| "b">` |
| `$RequiredNotNull<T, K>` | `<T, K extends keyof T>` → T with K required & non-null | Property required and non-null | `$RequiredNotNull<{a?: string \| null}, "a">` → `{a: string}` |

### `async.type.ts` — Promise & function helpers

| Helper | Signature | One-liner | Example |
|--------|-----------|-----------|---------|
| `$Awaitable<T>` | `<T>` → `T \| Promise<T>` | Value may be Promise-wrapped | `$Awaitable<string>` → `string \| Promise<string>` |
| `$UnwrapPromise<T>` | `<T>` → inner type | `Promise<T>` → `T`, `T` → `T` | `$UnwrapPromise<Promise<string>>` → `string` |
| `$MaybeAsync<T>` | alias of `$Awaitable` | Same — used by DNA transforms | — |
| `$InferReturnType<F>` | `<F>` → inner return type | Like `ReturnType<F>` but unwraps Promise | `$InferReturnType<() => Promise<string>>` → `string` |

### `branding.type.ts` — phantom types

| Helper | Signature | One-liner | Example |
|--------|-----------|-----------|---------|
| `$Branded<T, K>` | `<T, K extends string>` → `T & { [$brand]: { [P in K]: true } }` | Phantom-typing via Zod's `$brand` | `$Branded<string, "RouteId">` → `string & { readonly [$brand]: { readonly RouteId: true } }` |

### `str.type.ts` — validated string patterns

| Helper | Returns | Description |
|--------|---------|-------------|
| `tsKebabCase` | branded string | Validated kebab-case (`my-component`) |
| `tsCamelCase` | branded string | Validated camelCase (`myComponent`) |
| `tsSnakeCase` | branded string | snake_case (`my_component`) |
| `tsScreamingSnakeCase` | branded string | SCREAMING_SNAKE_CASE (`MY_COMPONENT`) |
| `tsPascalCase` | branded string | PascalCase (`MyComponent`) |

### `json.type.ts` — JSON validation

| Helper | Signature | One-liner | Example |
|--------|-----------|-----------|---------|
| `tsJSONPrimitive` | — | `string \| number \| boolean \| null` | — |
| `$isValidJSON<T>` | `<T>` → `T \| never` | Recursively validates T is JSON-serializable | `$isValidJSON<{fn: () => void}>` → `never` |

---

## Comparison tables

### `$Keys` vs `$EnumKeys` vs `$Entries` vs `$EnumValues`

All four operate on `T = { a: 1, b: 2 }`:

| Helper | File | Returns | Use case |
|--------|------|---------|----------|
| `$Keys<T>` | `record.type.ts` | `("a" \| "b")[]` — array of keys | `Object.keys()` type signature |
| `$EnumKeys<T>` | `enum.type.ts` | `"a" \| "b"` — key type | Enum key extraction |
| `$Entries<T>` | `record.type.ts` | `["a", 1] \| ["b", 2][]` — tuples | `Object.entries()` type signature |
| `$EnumValues<T>` | `enum.type.ts` | `1 \| 2` — value type | Enum value extraction (handles arrays too) |

**Usage example:**
```typescript
import type { $Keys, $Entries } from "@ytrynot/shared/types/record.type.js";
import type { $EnumKeys, $EnumValues } from "@ytrynot/shared/types/enum.type.js";

const config = { host: "localhost", port: 3000 };

// $Keys — for Object.keys()
function getKeys<T extends Record<string, unknown>>(obj: T): $Keys<T> {
  return Object.keys(obj) as $Keys<T>;
}
// getKeys(config) → ["host", "port"] typed as ("host" | "port")[]

// $EnumKeys — for extracting the key union
type ConfigKeys = $EnumKeys<typeof config>; // "host" | "port"

// $Entries — for Object.entries()
function getEntries<T extends Record<string, unknown>>(obj: T): $Entries<T> {
  return Object.entries(obj) as $Entries<T>;
}
// getEntries(config) → [["host", "localhost"], ["port", 3000]]

// $EnumValues — for extracting the value union
type ConfigValues = $EnumValues<typeof config>; // string | number
```

### `$Flatten` vs `$FlattenDistributive`

```typescript
type A = { cmd: "build"; files: string[] };
type B = { cmd: "deploy"; target: string };
type Union = A | B;

// $Flatten — non-distributive, intersects common keys
type Flat = $Flatten<Union>;
// → { cmd: "build" | "deploy" } & {}
// Discrimination LOST — only common keys survive

// $FlattenDistributive — each branch flattened independently
type FlatDist = $FlattenDistributive<Union>;
// → { cmd: "build"; files: string[] } | { cmd: "deploy"; target: string }
// Discrimination PRESERVED — each branch intact
```

| Use case | Helper |
|----------|--------|
| Single object — resolve `Omit`/`Pick` | `$Flatten` |
| Discriminated union (cliUnion, oneOf) | `$FlattenDistributive` |
| Intersection of objects | `$Flatten` |

### `$InferReturnType` vs `ReturnType`

```typescript
async function fetchUser(): Promise<string> { return "Alice"; }

type R1 = ReturnType<typeof fetchUser>;       // Promise<string>
type R2 = $InferReturnType<typeof fetchUser>; // string (Promise unwrapped)
```

`$InferReturnType` is needed when transforms may be sync or async and the output type is always the resolved value.

---

## In-depth sections

### Flatten family

#### `$Flatten<T>` (alias `$FlattenCombinative`, `$ToRecord`)

Forces TypeScript to resolve a type to a flat object literal for IDE display.

**Problem:** TypeScript keeps types in their unresolved form for performance:
```typescript
type Result = Omit<{ a: string; b: number; c: boolean }, "c">;
// IDE shows: Omit<{ a: string; b: number; c: boolean }, "c">
// Not: { a: string; b: number }
```

**Solution:**
```typescript
type Result = $Flatten<Omit<{ a: string; b: number; c: boolean }, "c">>;
// IDE shows: { a: string; b: number }
```

**How it works:** The mapped type `{ [K in keyof T]: T[K] }` forces TypeScript to instantiate the type. The `& {}` preserves assignability.

#### `$FlattenDistributive<T>`

Distributes over unions — each member is flattened independently:
```typescript
type FlatDist = $FlattenDistributive<{ cmd: "build" } | { cmd: "deploy" }>;
// → { cmd: "build" } | { cmd: "deploy" }
```

**Real-world example (DNA CLI):**
```typescript
// preprocess.ts — extractStep output
type tte = {
  route: string & { _routeId: true };
  payload: $Flatten<Omit<$Output<S[number]>, "\x00ID">>;
} | {
  route: "";
  payload: {};
};
```

### Exclusive / mutual exclusion

#### `$Xor<T, U>`

```typescript
type Config = $Xor<{ file: string }, { url: string }>;
// ✅ { file: "config.json" }
// ✅ { url: "https://..." }
// ❌ { file: "x", url: "https://..." } — both present
// ❌ {} — neither present
```

#### `$Without<T, U>`

Internal for `$Xor`. Marks common keys as `never`:
```typescript
type T = { a: 1; b: 2 };
type U = { a: 3 };
type Result = $Without<T, U>; // { a?: never; b: 2 } — key `a` forbidden
```

### Deep transforms

#### `$DeepReadonly<T>`

```typescript
type Data = { user: { name: string; roles: string[] } };
type ReadonlyData = $DeepReadonly<Data>;
// → { readonly user: { readonly name: string; readonly roles: readonly string[] } }
```

Functions are preserved (not deep-readonly'd).

#### `$ReadonlyValue<T>`

Top-level readonly only, identity for primitives:
```typescript
$ReadonlyValue<string>;              // string (identity)
$ReadonlyValue<{ x: number }>;       // Readonly<{ x: number }> (top-level only)
```

#### `$RemoveUndefined<T>`

Distributive — removes `undefined` from each union member:
```typescript
$RemoveUndefined<string | undefined | number | undefined>; // string | number
```

### Predicates

#### `$IsAny<T>`

Detects exactly `any` — critical because `any` is absorbant:
```typescript
$IsAny<any>;     // true
$IsAny<unknown>; // false
$IsAny<string>;  // false

// Real use: conditional that only fires for any
type Default<T> = $IsAny<T> extends true ? "fallback" : T;
```

Uses the `0 extends 1 & T` trick — only true for `any`.

#### `$IsDigit` / `$IsLower` / `$IsUpper`

```typescript
$IsDigit<"5">; // true
$IsLower<"a">; // true
$IsUpper<"Z">; // true
```

#### `$HasProperty<T, K>` / `$PropertyCheck<T, K, S>`

```typescript
$HasProperty<{ a: 1; b: 2 }, "a">; // { a: 1; b: 2 }
$HasProperty<{ a: 1; b: 2 }, "c">; // never

$PropertyCheck<{ a: 1 }, "b", string>; // { b: string } — T doesn't have "b", returns shape
$PropertyCheck<{ a: 1; b: 2 }, "b", string>; // { a: 1; b: 2 } — T has "b", returns T
```

### Enum & array

#### `$EnumValues<T>` — handles arrays and objects

```typescript
$EnumValues<["a", "b", "c"]>;      // "a" | "b" | "c" (from array)
$EnumValues<{ x: 1; y: 2 }>;       // 1 | 2 (from object)
```

#### `$EnumAsObj<T>`

Normalizes arrays and objects to a readonly enum object:
```typescript
$EnumAsObj<["build", "deploy"]>;
// → { readonly build: "build"; readonly deploy: "deploy" }
```

#### `$ToEnum<T>`

```typescript
$ToEnum<"build" | "deploy">;
// → { build: "build"; deploy: "deploy" } & {}
```

#### `$ArrayItem<T>`

```typescript
$ArrayItem<string[]>;           // string
$ArrayItem<[number, string]>;   // number | string
```

### Record & keys

#### `$UnionToIntersection<U>`

```typescript
$UnionToIntersection<{ a: 1 } | { b: 2 }>; // { a: 1 } & { b: 2 }
```

#### `$RequireAtLeastOne<T, Keys>`

```typescript
type Config = $RequireAtLeastOne<{
  host?: string; port?: number; socket?: string;
}, "host" | "socket">;
// ✅ { host: "localhost" }
// ✅ { socket: "/tmp/sock" }
// ❌ { port: 3000 } — neither host nor socket
```

#### `$RequiredNotNull<T, K>`

```typescript
$RequiredNotNull<{ host?: string | null; port: number }, "host">;
// → { host: string; port: number } — host required and non-null
```

### Async

#### `$InferReturnType<F>` vs `ReturnType<F>`

```typescript
async function fetchUser(): Promise<{ name: string }> { return { name: "Alice" }; }
function syncUser(): { name: string } { return { name: "Bob" }; }

type AsyncReturn = ReturnType<typeof fetchUser>;      // Promise<{ name: string }>
type AsyncInfer = $InferReturnType<typeof fetchUser>;  // { name: string } — unwrapped

type SyncReturn = ReturnType<typeof syncUser>;         // { name: string }
type SyncInfer = $InferReturnType<typeof syncUser>;    // { name: string } — same
```

### Branding

#### `$Branded<T, K>`

```typescript
type RouteId = $Branded<string, "RouteId">;
// → string & { readonly [$brand]: { readonly RouteId: true } }

// A plain string is NOT assignable to RouteId
const plain: string = "build";
// const route: RouteId = plain; // ❌ Type error — needs explicit cast
```

### JSON

#### `$isValidJSON<T>`

```typescript
type Good = $isValidJSON<{ name: string; age: number }>;  // ✅ the type itself
type Bad = $isValidJSON<{ fn: () => void }>;               // never — functions not serializable
type Bad2 = $isValidJSON<{ sym: symbol }>;                 // never — symbols not serializable
type Bad3 = $isValidJSON<bigint>;                          // never — bigint not serializable
```

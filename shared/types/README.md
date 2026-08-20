# @ytrynot/shared/types

Type-level helpers for the ytrynot ecosystem. Pure TypeScript, zero runtime cost.

## Usage

```typescript
import type { $Flatten, $Xor, $IsAny, $Entries } from "@ytrynot/shared/types";
```

Granular imports (avoids resolving the full barrel):

```typescript
import type { $Flatten } from "@ytrynot/shared/types/structural.type.js";
import type { $IsAny } from "@ytrynot/shared/types/predicates.type.js";
```

## File organization

```
shared/types/
├── branding.type.ts    — $Branded, $brand
├── async.type.ts       — $Awaitable, $UnwrapPromise, $MaybeAsync, $InferReturnType
├── structural.type.ts  — $Flatten, $FlattenDistributive, $Xor, $Without, $DeepReadonly, $ReadonlyValue, $RemoveUndefined, $Or
├── predicates.type.ts  — $IsAny, $IsDigit, $IsLower, $IsUpper, $HasProperty, $PropertyCheck
├── enum.type.ts        — $EnumKeys, $EnumValues, $EnumAsObj, $EnumObj, $ArrayItem, $ToEnum
├── record.type.ts      — $Keys, $Entries, $RecordSetToArray, $UnionToIntersection, $RequireAtLeastOne, $RequiredNotNull
├── str.type.ts         — tsKebabCase, tsCamelCase, tsSnakeCase, tsScreamingSnakeCase, tsPascalCase
├── json.type.ts        — tsJSONPrimitive, $isValidJSON
├── index.ts            — re-export all
└── all-types.ts        — consolidated hub for the 'ts.' namespace
```

## Quick reference

### Flatten family (`structural.type.ts`)

| Helper | Behavior on `A \| B` | Use case |
|--------|----------------------|----------|
| `$Flatten<T>` | `{...A & B}` (intersection of common keys) | Single object: resolve `Omit`/`Pick`/intersections to flat shape |
| `$FlattenCombinative<T>` | alias of `$Flatten` | Same — emphasizes combinative behavior |
| `$ToRecord<T>` | alias of `$Flatten` | Same — emphasizes Record-like output |
| `$FlattenDistributive<T>` | `{...A} \| {...B}` (each member flattened) | Unions: preserve each branch (discriminated unions, cliUnion) |

### Exclusive / mutual exclusion (`structural.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `$Without<T, U>` | `{ [P in Exclude<keyof T, keyof U>]?: never }` | Internal — marks common keys as forbidden |
| `$Xor<T, U>` | `T` xor `U` | Exactly one of T or U, not both |
| `$Or<T, U>` | `T \| U` | Trivial union alias for syntax consistency |

### Deep transforms (`structural.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `$DeepReadonly<T>` | recursively readonly | Applies `readonly` at every level |
| `$ReadonlyValue<T>` | `Readonly<T>` or `T` | Readonly for objects, identity for primitives |
| `$RemoveUndefined<T>` | `T` without `undefined` | Distributive over unions |

### Predicates (`predicates.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `$IsAny<T>` | `true` or `false` | Detects exactly `any` (not just `unknown`) |
| `$IsDigit<C>` | `true` or `false` | Single-char string is 0-9 |
| `$IsLower<C>` | `true` or `false` | Single-char string is lowercase |
| `$IsUpper<C>` | `true` or `false` | Single-char string is uppercase |
| `$HasProperty<T, K>` | `T` or `never` | Type guard — key K exists on T |
| `$PropertyCheck<T, K, S>` | `T` or `{ [P in K]: S }` | Returns T if K exists, else a shape with K:S |

### Enum & array (`enum.type.ts`)

| Helper | Returns | Example on `{ a: 1, b: 2 }` |
|--------|---------|-------------------------------|
| `$EnumKeys<T>` | key type | `"a" \| "b"` |
| `$EnumValues<T>` | value type | `1 \| 2` |
| `$EnumAsObj<T>` | readonly enum object | `{ readonly a: 1; readonly b: 2 }` |
| `$EnumObj<T>` | `Record<string, V>` | `Record<string, 1 \| 2>` |
| `$ArrayItem<T>` | item type | `T[number]` equivalent |
| `$ToEnum<T>` | flattened enum object | `{ a: "a"; b: "b" } & {}` |

### Record & keys (`record.type.ts`)

| Helper | Returns | Example on `{ a: 1, b: 2 }` |
|--------|---------|-------------------------------|
| `$Keys<T>` | `(keyof T)[]` | `("a" \| "b")[]` |
| `$Entries<T>` | `[K, T[K]][]` | `["a", 1] \| ["b", 2][]` |
| `$RecordSetToArray<T>` | `Record<string, I[]>` | Maps `Set<I>` values to `I[]` |
| `$UnionToIntersection<U>` | intersection | `A \| B` → `A & B` |
| `$RequireAtLeastOne<T, K>` | requires ≥1 of K | At least one key from K must be present |
| `$RequiredNotNull<T, K>` | `T & { [P in K]-?: Exclude<T[P], null \| undefined> }` | Property required and non-null |

### Async (`async.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `$Awaitable<T>` | `T \| Promise<T>` | Value may be wrapped in Promise |
| `$UnwrapPromise<T>` | inner type | `Promise<T>` → `T`, `T` → `T` |
| `$MaybeAsync<T>` | `T \| Promise<T>` | Alias for `$Awaitable` |
| `$InferReturnType<F>` | inner return type | Like `ReturnType<F>` but unwraps `Promise<T>` → `T` |

### Branding (`branding.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `$Branded<T, K>` | `T & { [$brand]: { [P in K]: true } }` | Phantom-typing using Zod's `$brand` symbol |

### String patterns (`str.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `tsKebabCase` | branded string | Validated kebab-case |
| `tsCamelCase` | branded string | Validated camelCase |
| `tsSnakeCase` | branded string | snake_case |
| `tsScreamingSnakeCase` | branded string | SCREAMING_SNAKE_CASE |
| `tsPascalCase` | branded string | PascalCase |

### JSON (`json.type.ts`)

| Helper | Returns | Description |
|--------|---------|-------------|
| `tsJSONPrimitive` | `string \| number \| boolean \| null` | Base JSON primitives |
| `$isValidJSON<T>` | `T` or `never` | Recursively validates T is JSON-serializable |

## Comparison: `$Keys` vs `$EnumKeys` vs `$Entries`

| Helper | Returns | Example on `{ a: 1, b: 2 }` |
|--------|---------|-------------------------------|
| `$Keys<T>` | `(keyof T)[]` — array of keys | `("a" \| "b")[]` |
| `$EnumKeys<T>` | `K` — the key type itself | `"a" \| "b"` |
| `$Entries<T>` | `[K, T[K]][]` — array of tuples | `["a", 1] \| ["b", 2][]` |
| `$EnumValues<T>` | `V` — the value type | `1 \| 2` |

## Comparison: `$Flatten` vs `$FlattenDistributive`

```typescript
type A = { cmd: "build"; files: string[] };
type B = { cmd: "deploy"; target: string };
type Union = A | B;

type Flat = $Flatten<Union>;
// → { cmd: "build" | "deploy" } & {}  (common keys only, values intersected)

type FlatDist = $FlattenDistributive<Union>;
// → { cmd: "build"; files: string[] } | { cmd: "deploy"; target: string }  (each branch preserved)
```

Use `$Flatten` for single objects, `$FlattenDistributive` for discriminated unions.

## Comparison: `$InferReturnType` vs `ReturnType`

```typescript
async function fetchUser(): Promise<string> { return "Alice"; }

type R1 = ReturnType<typeof fetchUser>;      // Promise<string>
type R2 = $InferReturnType<typeof fetchUser>; // string (Promise unwrapped)
```

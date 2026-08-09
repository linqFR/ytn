# @ytrynot/shared/zod

Advanced Zod V4 inspection, unwrapping, and bidirectional codec layer. This package provides high-performance utilities to reflect upon Zod schemas and serialize them for storage or rehydration.

## Table of Contents

- [V4 Inspection Protocol](#v4-inspection-protocol)
- [Unwrapping (Root Search)](#unwrapping-root-search)
  - [unwrapZodDeep](#unwrapzoddeep)
- [Advanced Introspection](#advanced-introspection)
  - [getZodMetaDeep](#getzodmetadeep)
  - [getZodShapeDeep](#getzodshapedeep)
  - [getZodDefaultValue](#getzoddefaultvalue)
  - [getZodNumberFormat](#getzodnumberformat)
- [Codecs (Bidirectional)](#codecs-bidirectional)
- [Predefined Schemas (predefs)](#predefined-schemas-predefs)

---

## V4 Inspection Protocol

In **ytrynot**, we strictly adhere to Zod V4 standards. We **FORBID** any access to `_def` (V3 internals) and rely on the authoritative `._zod.def` structure and `instanceof z.Zod*` for all identification.

---

## Unwrapping (Root Search)

When a schema is wrapped in multiple layers (Optional, Nullable, Default, Lazy, or Pipeline), standard Zod methods might fail to find the underlying core type.

### `unwrapZodDeep`

Recursively follows all standard Zod V4 wrappers and special types (Pipes, Lazy) until the actual base schema is found.

```typescript
import { unwrapZodDeep } from "@ytrynot/shared/zod/zod-reflection.js";
import { z } from "zod";

const schema = z.string().optional().default("test").pipe(z.string().email());
const root = unwrapZodDeep(schema); // Returns the base z.ZodString (email)
```

---

## Advanced Introspection

### `getZodMetaDeep`

Recursively merges all metadata defined via `.meta()` across the entire schema chain, including transparent wrappers and pipelines.

### `getZodShapeDeep`

Iteratively finds the first `ZodObject` shape in a schema chain, resolving through `ZodLazy` or `ZodPipe` if necessary.

### `getZodDefaultValue`

Extracts the default value from a `ZodDefault` schema (Zod v4). Uses `instanceof z.ZodDefault` for identification and `._zod.def.defaultValue` for data access. Returns `undefined` if the schema is not a `ZodDefault`.

```typescript
import { getZodDefaultValue } from "@ytrynot/shared/zod/zod-reflection.js";
import { z } from "zod";

const schema = z.string().default("hello");
getZodDefaultValue(schema); // "hello"
getZodDefaultValue(z.string()); // undefined
```

A `getZodDefaultValueDeep` variant is also available, which resolves through transparent wrappers (Lazy, Pipe) to find a `ZodDefault` in the schema chain.

### `getZodNumberFormat`

Returns the Zod v4 number format string (`"int32"`, `"uint32"`, `"safeint"`, `"float32"`, `"float64"`) if the schema is an integer/float format. Uses `instanceof` guards exclusively — no duck-typing. Handles both V4 paths:

- **`z.int()` / `z.int32()` / `z.uint32()`** (top-level functions) — creates a `ZodNumberFormat` instance; format is read from `._zod.def.format`.
- **`z.number().int()` / `.safe()`** (legacy methods on `ZodNumber`) — adds a `$ZodCheckNumberFormat` check to the `._zod.def.checks` array; detected via `instanceof $ZodCheckNumberFormat`.

Returns `undefined` for plain `ZodNumber` without int format or any other type.

```typescript
import { getZodNumberFormat } from "@ytrynot/shared/zod/zod-reflection.js";
import { z } from "zod";

getZodNumberFormat(z.int());              // "safeint"
getZodNumberFormat(z.number().int());     // "safeint"
getZodNumberFormat(z.int32());            // "int32"
getZodNumberFormat(z.number());           // undefined
```

---

## Codecs (Bidirectional)

Codecs allow for bidirectional transformation between different data representation states (e.g., String <-> Functions).

### `vmCodec`

Securely rehydrates a function string within an isolated context using `node:vm`.

### `funcCodec`

Fast rehydration using `new Function()`. Recommended for non-critical performance paths.

### `jsonCodec`

Transparently handles string <-> JSON objects with automatic `SafeResult` error reporting during decoding.

### `jsonlCodec`

Zod codec for JSON Lines (newline-separated JSON objects). Ideal for logs and large dataset exports.

### `jsonSchemaCodec`

Zod Codec for bridging between string <-> JSON Schema <-> Zod schema. Used for standard industry interoperability.

### `stringListCodec`

Zod codec for comma-separated string lists. Automatically parses and joins arrays during transformation.

---

## Predefined Schemas (`predefs`)

Located in `shared/zod/predefs.ts`, these schemas provide common validation rules ready to be used or extended.

- **`emailSchema`**: Robust RFC-compliant email validation.
- **`uuidSchema`**: UUID V4/V5 string validation.
- **`urlSchema`**: Comprehensive URL validation with protocol checks.
- **`isoDateSchema`**: For valid ISO 8601 date strings.

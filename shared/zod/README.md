# @ytn/shared/zod

Advanced Zod V4 inspection, unwrapping, and bidirectional codec layer. This package provides high-performance utilities to reflect upon Zod schemas and serialize them for storage or rehydration.

## Table of Contents

- [V4 Inspection Protocol](#v4-inspection-protocol)
- [Unwrapping (Root Search)](#unwrapping-root-search)
  - [unwrapZodDeep](#unwrapzoddeep)
- [Advanced Introspection](#advanced-introspection)
  - [getZodMetaDeep](#getzodmetadeep)
  - [getZodShapeDeep](#getzodshapedeep)
- [Codecs (Bidirectional)](#codecs-bidirectional)
- [Predefined Schemas (predefs)](#predefined-schemas-predefs)

---

## V4 Inspection Protocol

In **YTN**, we strictly adhere to Zod V4 standards. We **FORBID** any access to `_def` (V3 internals) and rely on the authoritative `._zod.def` structure and `instanceof z.Zod*` for all identification.

---

## Unwrapping (Root Search)

When a schema is wrapped in multiple layers (Optional, Nullable, Default, Lazy, or Pipeline), standard Zod methods might fail to find the underlying core type.

### `unwrapZodDeep`

Recursively follows all standard Zod V4 wrappers and special types (Pipes, Lazy) until the actual base schema is found.

```typescript
import { unwrapZodDeep } from "@ytn/shared/zod/zod-reflection.js";
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

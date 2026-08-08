# @ytn/dna vs Zod v4 — Feature Comparison

> Generated from source code analysis of `@ytn/dna` (api-primitives.ts, api-enhanced.ts,
> dna-namespace.ts, dna-interfaces.ts) and the Zod v4 public API (zod.dev).
>
> Last updated: 2026-08-07.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Supported with parity | 130+ | ✅ |
| Partially supported | 1 | ⚠️ |
| Not supported | 3 | ❌ |
| DNA advantages (not in Zod) | 7 | 🟢 |

**Bottom line**:
- @ytn/dna covers the vast majority of the Zod v4 API with full parity,
including `z.codec()`, `z.int32()`, `z.xor()`, `z.e164()`, `z.hostname()`, `z.json()`,
`z.partialRecord()`, `z.looseRecord()`, `.brand(dir)`, `.safeExtend()`, `.spa()`,
`.nonempty()`, `.unwrap()` on arrays, `encode/decode/safeEncode/safeDecode`, and
`z.toJSONSchema()` top-level.
- The missing features are error formatting functions
(`z.flattenError()`, `z.formatError()`, `z.treeifyError()`). DNA adds features Zod doesn't
have: compiled standalone functions, DNA bytecode serialization, boolean validation,
property-level checks, and more.

---

## ❌ Not Supported (3 features)

| # | Zod v4 Feature | Notes | Workaround |
|---|---|---|---|
| 1 | `z.flattenError()` | No error formatting function (Zod v4 top-level) | Access `.issues` directly |
| 2 | `z.formatError()` | Deprecated in Zod v4, use `z.treeifyError()` | Access `.issues` directly |
| 3 | `z.treeifyError()` | No error formatting function (Zod v4 top-level) | Access `.issues` directly |

> **Note**: `z.object().deepPartial()` was a Zod v3 API that was deprecated and removed in Zod v4.
> It does not exist in Zod v4 and is therefore not listed as a missing feature.

---

## ⚠️ Partially Supported (1 feature)

| # | Zod v4 Feature | DNA Equivalent | Gap | Workaround |
|---|---|---|---|---|
| 1 | `.meta()` | `.meta()` | Different semantics (error/metadata vs Zod v4's arbitrary metadata for registry) | — |

---

## 🟢 DNA Advantages (7 features not in Zod)

| # | Feature | Notes |
|---|---|---|
| 1 | `dna.templateLiteralMutate()` / `dna.tlm()` | Mutating template literal that applies inner transformations |
| 2 | `.eq()` on date | Exact date match — `dna.literal(date)` fails (object reference comparison); `.eq()` uses `min`/`max` constraints which compare via `getTime()` |
| 3 | `.validate()` / `.validateAsync()` | Boolean validation (fail-fast); Zod doesn't have this |
| 4 | `.toDna()` / `fromDna()` | Bytecode serialization/reconstruction |
| 5 | `validator()` / `parser()` / `toJS()` | Compiled standalone functions |
| 6 | `dna.registerConstructor()` / `getConstructor()` | Constructor registry for instanceof validation |
| 7 | `.register()` | Schema registration (Zod has `.apply()` and `.overwrite()` but not `.register()`) |

---

## Detailed Comparison

### 1. Primitives

| Zod v4 | DNA | Status |
|---|---|---|
| `z.string()` | `dna.string()` | ✅ |
| `z.number()` | `dna.number()` | ✅ |
| `z.bigint()` | `dna.bigint()` | ✅ |
| `z.boolean()` | `dna.boolean()` | ✅ |
| `z.date()` | `dna.date()` | ✅ |
| `z.symbol()` | `dna.symbol()` | ✅ |
| `z.null()` | `dna.null()` | ✅ |
| `z.undefined()` | `dna.undefined()` | ✅ |
| `z.any()` | `dna.any()` | ✅ |
| `z.unknown()` | `dna.unknown()` | ✅ |
| `z.never()` | `dna.never()` | ✅ |
| `z.void()` | `dna.void()` | ✅ |
| `z.nan()` | `dna.nan()` | ✅ |
| `z.literal()` | `dna.literal()` | ✅ (DNA accepts arrays → union of literals) |
| `z.enum()` | `dna.enum()` | ✅ (`.extract()`, `.exclude()`, `.options`, `.values`, `.enum`) |
| `z.file()` | `dna.file()` | ✅ |
| `z.instanceof()` | `dna.instanceof()` | ✅ |
| `z.custom()` | `dna.custom()` | ✅ |
| `z.int()` | `dna.int()` | ✅ |
| `z.int32()` | `dna.int32()` | ✅ |

### 2. Coercions

| Zod v4 | DNA | Status |
|---|---|---|
| `z.coerce.string()` | `dna.coerce.string()` | ✅ |
| `z.coerce.number()` | `dna.coerce.number()` | ✅ |
| `z.coerce.boolean()` | `dna.coerce.boolean()` | ✅ |
| `z.coerce.bigint()` | `dna.coerce.bigint()` | ✅ |
| `z.coerce.date()` | `dna.coerce.date()` | ✅ |
| — | `dna.int({ coerce: true })` | 🟢 DNA advantage (Zod only has coerce for string/number/boolean/bigint/date; DNA also supports coerce on int/int32 via the `{ coerce: true }` parameter) |
| — | `dna.int32({ coerce: true })` | 🟢 DNA advantage |

### 3. String Formats

| Zod v4 | DNA | Status |
|---|---|---|
| `z.email()` | `dna.email()` | ✅ |
| `z.uuid()` | `dna.uuid()` | ✅ |
| `z.url()` | `dna.url()` | ✅ (DNA accepts `{ normalize, protocol, hostname }` options) |
| `z.httpUrl()` | `dna.httpUrl()` | ✅ |
| `z.ipv4()` / `z.ipv6()` | `dna.ipv4()` / `dna.ipv6()` | ✅ (both dropped `.ip({ version })` in Zod v4) |
| `z.cidrv4()` / `z.cidrv6()` | `dna.cidrv4()` / `dna.cidrv6()` | ✅ (both dropped `.cidr({ version })` in Zod v4) |
| `z.emoji()` | `dna.emoji()` | ✅ |
| `z.mac()` | `dna.mac()` | ✅ |
| `z.base64()` | `dna.base64()` | ✅ |
| `z.base64url()` | `dna.base64url()` | ✅ |
| `z.nanoid()` | `dna.nanoid()` | ✅ |
| `z.cuid()` | `dna.cuid()` | ✅ |
| `z.cuid2()` | `dna.cuid2()` | ✅ |
| `z.ulid()` | `dna.ulid()` | ✅ |
| `z.xid()` | `dna.xid()` | ✅ |
| `z.ksuid()` | `dna.ksuid()` | ✅ |
| `z.jwt()` | `dna.jwt()` | ✅ (Supports `{ alg }` option) |
| `z.hash()` | `dna.hash()` | ✅ |
| `z.hex()` | `dna.hex()` | ✅ |
| `z.guid()` | `dna.guid()` | ✅ (permissive 8-4-4-4-12 hex pattern, less strict than `z.uuid()`) |
| `z.e164()` | `dna.e164()` | ✅ |
| `z.hostname()` | `dna.hostname()` | ✅ |

### 4. ISO Formats

| Zod v4 | DNA | Status |
|---|---|---|
| `z.iso.datetime()` | `dna.iso.datetime()` | ✅ (`local`, `offset`, `precision`) |
| `z.iso.date()` | `dna.iso.date()` | ✅ |
| `z.iso.time()` | `dna.iso.time()` | ✅ (`precision`) |
| `z.iso.duration()` | `dna.iso.duration()` | ✅ |

### 5. String Methods

| Zod v4 | DNA | Status |
|---|---|---|
| `.min()` / `.max()` / `.length()` | `.min()` / `.max()` / `.length()` | ✅ |
| `.regex()` / `.pattern()` | `.regex()` / `.pattern()` | ✅ |
| `.trim()` | `.trim()` | ✅ |
| `.toLowerCase()` / `.toUpperCase()` | `.toLowerCase()` / `.toUpperCase()` | ✅ |
| `.normalize()` | `.normalize()` | ✅ |
| `.uppercase()` / `.lowercase()` (check) | `.uppercase()` / `.lowercase()` | ✅ |
| `.startsWith()` / `.endsWith()` | `.startsWith()` / `.endsWith()` | ✅ |
| `.includes()` | `.includes()` | ✅ (`{ position }` option) |
| `.nonempty()` | `.nonempty()` | ✅ |
| — | `.eq()` | 🟢 Exact length match |
| — | `.format()` | 🟢 Low-level format extensibility |

### 6. Number Methods

| Zod v4 | DNA | Status |
|---|---|---|
| `.min()` / `.max()` | `.min()` / `.max()` | ✅ |
| `.gt()` / `.gte()` / `.lt()` / `.lte()` | `.gt()` / `.gte()` / `.lt()` / `.lte()` | ✅ |
| `.int()` | `.int()` | ✅ |
| `.positive()` / `.nonnegative()` | `.positive()` / `.nonnegative()` | ✅ |
| `.negative()` / `.nonpositive()` | `.negative()` / `.nonpositive()` | ✅ |
| `.multipleOf()` | `.multipleOf()` | ✅ |
| `.step()` (deprecated) | `.step()` (deprecated) | ✅ (alias for `.multipleOf()`) |
| `.finite()` | `.finite()` | ✅ (no-op in both — Zod v4 rejects Infinity by default, DNA validates `Number.isFinite()` in generated code) |
| `.safe()` (deprecated) | `.safe()` | ✅ (deprecated in Zod v4, behaves like `.int()`; DNA clamps to MIN/MAX_SAFE_INTEGER) |
| — | `.eq()` on date | 🟢 Exact date match (see DNA-specific methods below) |

### 7. Transforms & Pipeline

| Zod v4 | DNA | Status |
|---|---|---|
| `.transform()` | `.transform()` | ✅ (async supported) |
| `.pipe()` | `.pipe()` | ✅ |
| `z.pipe()` / `z.pipeline()` | `dna.pipe()` | ✅ |
| `z.preprocess()` | `dna.preprocess()` | ✅ |
| `z.transform()` | `dna.transform()` | ✅ |

### 8. Refinements

| Zod v4 | DNA | Status |
|---|---|---|
| `.refine()` | `.refine()` | ✅ (async supported) |
| `.superRefine()` | `.superRefine()` | ✅ |
| `.check()` | `.check()` | ✅ |
| `.with()` | `.with()` | ✅ (alias for `.check()`) |
| `z.refine()` (top-level) | `dna.refine()` | ✅ |
| `z.check()` (top-level) | `dna.check()` | ✅ |
| `z.describe()` | `dna.describe()` | ✅ |
| `z.meta()` | `dna.meta()` | ✅ |

### 9. Unions & Intersections

| Zod v4 | DNA | Status |
|---|---|---|
| `z.union()` | `dna.union()` | ✅ |
| `.or()` | `.or()` | ✅ |
| `z.discriminatedUnion()` | `dna.discriminatedUnion()` | ✅ |
| `z.intersection()` / `.and()` | `dna.intersection()` / `.and()` | ✅ |
| `z.xor()` | `dna.xor()` | ✅ (both top-level only, no `.xor()` method) |
| `z.union().options` | `.options` | ✅ |
| `z.discriminatedUnion().options` | `.options` | ✅ |
| `z.discriminatedUnion().discriminator` | `.discriminator` | ✅ (Zod exposes via `._zod.def`, DNA exposes as public getter) |

### 10. Objects

| Zod v4 | DNA | Status |
|---|---|---|
| `z.object()` | `dna.object()` | ✅ |
| `z.strictObject()` | `dna.strictObject()` | ✅ |
| `z.looseObject()` | `dna.looseObject()` | ✅ |
| `.strict()` / `.loose()` | `.strict()` / `.loose()` | ✅ |
| `.passthrough()` (deprecated) | `.passthrough()` (deprecated) | ✅ (maps to `.loose()`) |
| `.catchall()` | `.catchall()` / `.catchAll()` | ✅ |
| `.extend()` | `.extend()` | ✅ |
| `.merge()` (deprecated) | `.merge()` (deprecated) | ✅ |
| `.pick()` / `.omit()` | `.pick()` / `.omit()` | ✅ |
| `.partial()` | `.partial()` | ✅ (selective keys) |
| `.required()` | `.required()` | ✅ (selective keys) |
| `.keyof()` | `.keyOf()` | ✅ |
| `.shape` | `.shape` | ✅ |
| `z.safeExtend()` | `.safeExtend()` | ✅ |

### 11. Arrays

| Zod v4 | DNA | Status |
|---|---|---|
| `z.array()` | `dna.array()` | ✅ |
| `.min()` / `.max()` / `.length()` | `.min()` / `.max()` / `.length()` | ✅ |
| `.nonempty()` | `.nonempty()` | ✅ |
| `.unwrap()` | `.unwrap()` | ✅ |

### 12. Tuples

| Zod v4 | DNA | Status |
|---|---|---|
| `z.tuple()` | `dna.tuple()` | ✅ |
| `.rest()` | 2nd arg to `tuple()` / `.rest()` method | ✅ (both supported) |
| — | `.min()` / `.max()` / `.length()` | 🟢 DNA advantage (Zod v4 tuples don't have these) |

### 13. Records

| Zod v4 | DNA | Status |
|---|---|---|
| `z.record(keySchema, valueSchema)` | `dna.record(keySchema, valueSchema)` | ✅ |
| `z.record().keyType` / `.valueType` | `.keyType` / `.valueType` (aliases) + `.keySchema` / `.valueSchema` | ✅ (both naming conventions supported) |
| `z.partialRecord()` | `dna.partialRecord()` | ✅ |
| `z.looseRecord()` | `dna.looseRecord()` | ✅ |

### 14. Maps & Sets

| Zod v4 | DNA | Status |
|---|---|---|
| `z.map()` | `dna.map()` | ✅ |
| `.min()` / `.max()` / `.size()` / `.nonempty()` | `.min()` / `.max()` / `.size()` / `.nonempty()` | ✅ |
| `z.set()` | `dna.set()` | ✅ |
| `.min()` / `.max()` / `.size()` / `.nonempty()` | `.min()` / `.max()` / `.size()` / `.nonempty()` | ✅ |

### 15. Promises & Functions

| Zod v4 | DNA | Status |
|---|---|---|
| `z.promise()` | `dna.promise()` | ✅ (deprecated in both Zod v4 and DNA; sync parse throws by design, use `parseAsync`) |
| `z.function()` | `dna.function()` | ✅ |
| `.implement()` | `.implement()` | ✅ |
| `.input()` / `.output()` | `.input()` / `.output()` | ✅ |
| `.implementAsync()` | `.implementAsync()` | ✅ |

### 16. Lazy & Circular

| Zod v4 | DNA | Status |
|---|---|---|
| `z.lazy()` | `dna.lazy()` | ✅ |
| `.innerType` | `.innerType` | ✅ |

### 17. Wrappers

| Zod v4 | DNA | Status |
|---|---|---|
| `.optional()` / `z.optional()` | `.optional()` / `dna.optional()` | ✅ |
| `.nullable()` / `z.nullable()` | `.nullable()` / `dna.nullable()` | ✅ |
| `.nullish()` / `z.nullish()` | `.nullish()` / `dna.nullish()` | ✅ |
| `.nonoptional()` / `z.nonoptional()` | `.nonoptional()` / `dna.nonoptional()` | ✅ |
| `.exactOptional()` | `.exactOptional()` | ✅ |
| `.default()` | `.default()` | ✅ |
| `.prefault()` / `z.prefault()` | `.prefault()` / `dna.prefault()` | ✅ |
| `.catch()` | `.catch()` | ✅ (value or `(ctx) => R`) |
| `.unwrap()` | `.unwrap()` | ✅ |
| `.removeDefault()` (deprecated) | `.removeDefault()` (deprecated) | ✅ (alias for `.unwrap()`) |
| `.isOptional()` / `.isNullable()` / `.isNullish()` | Same | ✅ |

### 18. Brand & Readonly

| Zod v4 | DNA | Status |
|---|---|---|
| `.brand()` | `.brand()` | ✅ (both support `dir: "in" \| "out" \| "inout"`) |
| `.readonly()` | `.readonly()` | ✅ |

### 19. stringbool

| Zod v4 | DNA | Status |
|---|---|---|
| `z.stringbool()` | `dna.stringbool()` | ✅ (`truthy`, `falsy`, `case` options) |

### 20. Template Literals

| Zod v4 | DNA | Status |
|---|---|---|
| `z.templateLiteral()` | `dna.templateLiteral()` / `dna.tl()` | ✅ |
| — | `dna.templateLiteralMutate()` / `dna.tlm()` | 🟢 Mutating variant |

### 21. Meta & Registry

| Zod v4 | DNA | Status |
|---|---|---|
| `.meta()` | `.meta()` | ⚠️ Different semantics |
| `.describe()` | `.describe()` | ✅ |
| `z.registry()` | — | ❌ No global schema metadata registry |
| `z.globalRegistry` | — | ❌ |
| `z.config()` | — | ❌ |

### 22. JSON Schema

| Zod v4 | DNA | Status |
|---|---|---|
| `.toJSONSchema()` | `.toJSONSchema()` | ✅ |
| `z.toJSONSchema()` (top-level) | `dna.toJSONSchema()` (top-level) | ✅ |

### 23. Error Handling

| Zod v4 | DNA | Status |
|---|---|---|
| `ZodError` | `DnaError` | ⚠️ Different structure; DNA has `.issues` |
| `z.flattenError()` / `z.formatError()` / `z.treeifyError()` | — | ❌ No error formatting functions (Zod v4 provides these as top-level functions) |
| `z.IssueCodes` | `dna.IssueCodes` | ✅ |
| `ctx.addIssue()` | `ctx.addIssue()` | ✅ |
| `.catch()` with ctx | `.catch((ctx) => R)` | ✅ |

### 24. Parsing & Validation

| Zod v4 | DNA | Status |
|---|---|---|
| `.parse()` | `.parse()` | ✅ |
| `.safeParse()` | `.safeParse()` | ✅ |
| `.parseAsync()` | `.parseAsync()` | ✅ |
| `.safeParseAsync()` | `.safeParseAsync()` | ✅ |
| `.spa()` | `.spa()` | ✅ |
| — | `.validate()` / `.validateAsync()` | 🟢 Boolean validation (fail-fast) |
| `z.NEVER` | `dna.NEVER` | ✅ |

### 25. Codec (Bidirectional)

| Zod v4 | DNA | Status |
|---|---|---|
| `z.codec()` | `dna.codec()` | ✅ |
| `.safeDecode()` / `.decode()` / `.safeDecodeAsync()` | Same | ✅ |
| `.safeEncode()` / `.encode()` / `.safeEncodeAsync()` | Same | ✅ |

### 26. DNA Bytecode & Compilation

| Feature | Status |
|---|---|
| `.toDna()` | 🟢 Serializes schema to DNA bytecode |
| `fromDna()` | 🟢 Reconstructs schema from DNA bytecode |
| `validator()` | 🟢 Compiles standalone boolean validator |
| `parser()` | 🟢 Compiles standalone parser |
| `toJS()` | 🟢 Low-level JS code generation |
| `dna.registerConstructor()` / `getConstructor()` | 🟢 Constructor registry |
| `.register()` | 🟢 Schema registration (Zod has `.apply()` and `.overwrite()` but not `.register()`) |

---

## DNA-Specific Methods (detailed)

These methods exist in DNA but have no direct equivalent in Zod v4.

### `.eq()` — Exact date match

Available on `date` schemas. Sets both `min` and `max` to the same value, creating an exact match constraint using native Date comparison (`getTime()`).

```typescript
// Date: exact date
dna.date().eq(new Date("2024-01-01"))
```

**Why not `dna.literal(date)`?** `dna.literal()` serializes the value into DNA bytecode and compares by reference/identity. Two `new Date("2024-01-01")` instances are not `===`, so `dna.literal(date)` always fails. `.eq()` uses the `min`/`max` constraints on the date core, which compare via native `<`/`>` operators (i.e. `getTime()`).

**Note**: `.eq()` also exists on `string` and `number` but is redundant there — use `.length()` (string) or `dna.literal()` (number) instead.

### `.validate()` / `.validateAsync()` — Boolean validation

Returns `true`/`false` instead of a result object. Fail-fast: stops at the first error.

```typescript
const schema = dna.string().min(5);
schema.validate("hello");        // true
schema.validate("hi");           // false
```

**Zod equivalent**: `schema.safeParse(data).success` — requires accessing `.success` on the result object.

### `.toDna()` / `fromDna()` — Bytecode serialization

Serializes a schema to DNA bytecode (a compact array format) and reconstructs it. Enables schema transport, storage, and cross-language interop.

### `validator()` / `parser()` / `toJS()` — Compiled standalone functions

Compiles a schema into a standalone JavaScript function (no runtime dependency on the DNA library). The generated code uses `Number.isFinite()`, `typeof` checks, etc. directly.

### `dna.registerConstructor()` / `getConstructor()` — Constructor registry

Registers constructors for `instanceof` validation, enabling serialization of class-based schemas across boundaries.

### `.register()` — Schema registration

Registers a schema by name for later reference. Distinct from Zod's `.apply()` (which applies metadata) and `.overwrite()` (which replaces the schema).

### `dna.templateLiteralMutate()` / `dna.tlm()` — Mutating template literal

Like `dna.templateLiteral()` but applies inner transformations (e.g. `.toUpperCase()`, `.trim()`) to the parsed output. The validate-only `dna.templateLiteral()` ignores inner transformations.

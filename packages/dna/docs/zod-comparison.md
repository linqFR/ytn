# @ytrynot/dna vs Zod v4 — Feature Comparison

> Generated from source code analysis of `@ytrynot/dna` (api-primitives.ts, api-enhanced.ts,
> dna-namespace.ts, dna-interfaces.ts, core.ts, introspect.ts) and the Zod v4 public API (zod.dev).
>
> Last updated: 2026-08-13.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Supported with parity | 130+ | ✅ |
| Partially supported | 1 | ⚠️ |
| Not supported | 3 | ❌ |
| DNA advantages (not in Zod) | 7 | 🟢 |

**Bottom line**:
- @ytrynot/dna covers the vast majority of the Zod v4 API with full parity,
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
| — | `.coerced()` | 🟢 DNA advantage (force-coerce any schema by walking wrappers/pipes to the leaf; Zod has no equivalent) |

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
| `.min()` / `.max()` / `.length()` | `.min()` / `.max()` / `.length()` | ⚠️ Different length semantics — see below |
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

#### String length: code points (DNA) vs UTF-16 code units (Zod)

DNA counts **Unicode code points** for `.min()` / `.max()` / `.length()`; Zod v4 counts **UTF-16 code units** (`String.prototype.length`). This is a deliberate spec-compliance choice: RFC 8259 §7 defines a JSON string as a sequence of Unicode characters (an astral character like U+1D11E is one character, not two), and JSON Schema Validation §6.3.1/6.3.2 defines string length as "the number of its characters as defined by RFC 8259" — i.e. code points.

| Input | Zod `.length` (UTF-16 units) | DNA `fCount` (code points) |
|---|---|---|
| `"abc"` | 3 | 3 |
| `"é"` (U+00E9 precomposed) | 1 | 1 |
| `"e\u0301"` (decomposed) | 2 | 2 |
| `"😀"` (U+1F600) | 2 | 1 |
| `"🇫🇷"` (regional indicator pair) | 4 | 2 |
| `"👩‍🚀"` (ZWJ sequence) | 5 | 3 |

This means `.max(5)` on `"🇫🇷"` passes in DNA (2 ≤ 5) but fails in Zod (4 > 5). Neither counts grapheme clusters — both operate at code-point / code-unit level, not `Intl.Segmenter` level.

**Performance trade-off:** `fCount` is O(n) (iterates the string), `String.prototype.length` is O(1). DNA accepts this cost as the price of RFC/JSON Schema compliance — `@ytrynot/schvalid` targets JSON Schema 2020-12 conformance, where "length" means code points.

**Tests:** `packages/dna/tests/utf16-length.test.ts` documents 29 divergence cases across BMP, astral plane, flag emojis, ZWJ sequences, lone surrogates, and mixed ASCII + astral strings.

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
| `.default()` | `.default()` | ✅ (both accept `T` or `() => T`; `defaultValue` getter resolves functions in both) |
| `.prefault()` / `z.prefault()` | `.prefault()` / `dna.prefault()` | ✅ (both accept `T` or `() => T`; `prefaultValue` getter resolves functions in both) |
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

---

## Semantic Differences (object parsing)

These are behavioral differences between DNA and Zod v4 on `safeParse().data` shape.
They reflect different choices in how the parser materializes the output object.
All differences below are confirmed empirically.

### Object output: `undefined` handling

All DNA object modes preserve explicitly-present `undefined` values, matching Zod v4.

| Input | Zod v4 | DNA standard | DNA strict | DNA loose |
|---|---|---|---|---|
| `{ name: "x", age: 42, active: undefined }` | `{ name, age, active: undefined }` (3 keys) | `{ name, age, active: undefined }` (3 keys) | `{ name, age, active: undefined }` (3 keys) | `{ name, age, active: undefined }` (3 keys) |
| `{ name: "x", age: 42 }` (active absent) | `{ name, age }` (2 keys) | `{ name, age }` (2 keys) | `{ name, age }` (2 keys) | `{ name, age }` (2 keys) |

No divergence on `undefined` handling — both preserve present-`undefined` and keep absent keys absent. The divergence is in the **presence detection mechanism**: Zod uses `key in input` (traverses prototype chain), DNA defaults to `in` for the builder (`"in-object"` mode) or `in` + `_hop.call` for sensitive keys (`"in-filtered"` mode for schvalid). See [Presence detection: `in` vs `Object.hasOwn`](#presence-detection-in-vs-objecthasown) below.

### Object output: prototype-chain properties

| Mode | Input with inherited property | Zod v4 | DNA |
|---|---|---|---|
| `standard` / `z.object` | `Object.create({ inherited: "x" })` + own keys | strips inherited (not in output) | strips inherited (not in output) ✅ |
| `strict` / `z.strictObject` | same | **REJECT** — "Unrecognized key: inherited" | **ACCEPT** (does not detect inherited) ❌ |
| `loose` / `z.looseObject` | same | **preserves** inherited in output | **does not preserve** inherited ❌ |

**Zod v4** uses `key in input` (traverses the prototype chain) for both presence and unknown-key detection. Inherited properties are treated as unknowns: rejected in strict, preserved in loose.

**DNA** uses `Object.keys` (own enumerable only) for unknown-key detection in strict/loose object modes. For property-presence checks, the strategy depends on the `ownProperties` mode (see [Presence detection](#presence-detection-in-vs-objecthasown) below): `"in-object"` uses `in` (like Zod), `"in-filtered"` uses `in` for normal keys and `_hop.call` for `Object.prototype` members, `"hasown"` uses `_hop.call` for all keys. Inherited properties are invisible in `"hasown"`/`"in-filtered"` modes; visible in `"in-object"` mode (like Zod).

**Practical impact**: an input built via `Object.create(proto)` with routing/extra keys on the prototype will be treated differently. DNA ignores prototype-level keys; Zod sees them.

### `__proto__` safety — prototype pollution protection

| Aspect | Zod v4 | DNA |
|---|---|---|
| Output object prototype | `{}` (Object.prototype) | `Object.create(null)` (loose/plainObject), `{}` (standard) |
| `__proto__` non-declared (loose) | **skip** — `if (key === "__proto__") continue;` (PR #5898) | **harmless own property** — null-proto output has no setter |
| `__proto__` non-declared (standard) | strips via `keepOnly` | strips via `keepOnly` |
| `__proto__` declared in schema | **broken** — JIT fastpass throws `SyntaxError` (#4357, #4358); `zod-from-json-schema` #41 strips it from output | **preserved** — `Object.create(null)` used when `__proto__` is declared (Fix A) |
| JSON Schema Test Suite (`properties.json`, `required.json`) | ❌ fails on declared `__proto__` | ✅ passes (validator + parser) |
| Runtime overhead | `if(key==="__proto__")continue;` in every dynamic loop iteration | **zero** — codegen-time check only (`hasProtoDeclared`) |

**Zod v4** uses `{}` for output objects, which inherits `Object.prototype`. The `__proto__` setter intercepts `data["__proto__"] = value` assignments — if the value is not an object, it's silently dropped; if it is an object, it pollutes the prototype chain. Zod's fix (PR #5898) is **defensive**: skip `__proto__` in catchall loops. But this also means `__proto__` cannot be a declared property — the JIT fastpass throws (issues #4357, #4358), and `zod-from-json-schema` #41 reports it's impossible to validate `__proto__` via Zod.

**DNA** uses `Object.create(null)` for loose/plainObject outputs — a null-prototype object has no `__proto__` setter, so `outReal["__proto__"] = value` is always a plain own-property assignment. This is an **architectural** protection: no skip needed, no runtime overhead. When `__proto__` is a **declared** property (in `properties` or `required`), DNA switches the output to `Object.create(null)` via a codegen-time check (`hasProtoDeclared`), preserving the validated value in compliance with the JSON Schema Test Suite.

**References**:
- Zod PR #5898: https://github.com/colinhacks/zod/pull/5898
- Zod Issue #4357: https://github.com/colinhacks/zod/issues/4357
- Zod Issue #4358: https://github.com/colinhacks/zod/issues/4358
- zod-from-json-schema #41: https://github.com/glideapps/zod-from-json-schema/issues/41
- JSON Schema Test Suite: draft2020-12/properties.json, required.json

**Tests**: `packages/dna/tests/proto-safety.test.ts` (19 tests)

### Object output: `keepOnly` mechanism and single-allocation (performance)

| | Zod v4 `z.object` | DNA `dna.object` (standard) | DNA `dna.looseObject` (loose) |
|---|---|---|---|
| Strategy | Single allocation, writes directly to output | Single allocation, writes only declared keys (fast path) | Pre-copies all input keys, then validates declared ones |
| Extra keys in input | Stripped from output | Stripped from output | Preserved in output |
| Perf vs Zod `z.object` (no extras) | baseline | **~1.3–1.5x faster** | **~3–4x slower** (copy overhead) |
| Perf vs Zod `z.looseObject` (with extras) | N/A | **~3–4x faster** (extras stripped, no impact) | **comparable** (similar copy strategy) |

**DNA standard objects** (the default `dna.object()`) use a fast path when no dynamic properties (`additionalProperties`, `patternProperties`, `unevaluatedProperties`) are declared: the parser writes only the declared keys directly to the output, skipping any unknown keys in the input. This is faster than Zod because there is no per-key "is this unknown?" check — unknown keys are simply never visited.

**DNA loose objects** (`dna.looseObject()` or `.loose()`) preserve unknown keys in the output (matching the JSON Schema default where `additionalProperties` is allowed). This requires copying all input keys first, then validating the declared ones. The copy overhead makes loose mode ~3–4x slower than standard mode, but it is comparable to Zod's `z.looseObject()` performance.

**Benchmark**: `packages/dna/sandbox/bench-keeponly-vs-zod.ts` — 1M iterations, Node.js 25, Zod 4.4.3.

### Presence detection: `in` vs `Object.hasOwn`

| | `in` (Zod) | `Object.hasOwn` (DNA) |
|---|---|---|
| Own property | `true` | `true` |
| Inherited property (1 level) | `true` (traverses proto) | `false` |
| `toString` (Object.prototype) | `true` | `false` |
| `Object.create(null)` + prop | `true` | `true` |
| UTF-16 keys (all Unicode planes) | ✅ works | ✅ works |
| Perf — plain object + own key (common case) | baseline | **~20–30x slower** (Node 25) |
| Perf — plain object + absent key (optional check) | baseline | **~1.5–2x faster** than `in` |
| Perf — null-proto object + own key | baseline | **~1.2x slower** (comparable) |
| Perf — inherited/proto key | baseline | **~1.3–1.6x faster** than `in` |

**Zod v4** uses `key in input` for presence detection (`handlePropertyResult` line 715, JIT fastpath line 905). This traverses the prototype chain — intentional, to support objects with prototypes.

**DNA** offers three presence-check strategies via the `ownProperties` option of `toJS` (see [technical.md — Presence-check strategies](technical.md#presence-check-strategies-tojs-ownproperties-option)):

| Mode | `in` vs `_hop.call` | Default for |
|------|---------------------|-------------|
| `"hasown"` | `_hop.call(v, key)` for all keys | — (opt-in) |
| `"in-filtered"` | `_hop.call` for the 12 `Object.prototype` member names, `in` for all other keys | `@ytrynot/schvalid` (`enhancedMapper === false`) |
| `"in-object"` | `("key" in v)` for all keys | DNA builder (`enhancedMapper === true`) |

The `"in-object"` mode matches Zod v4's fastpath behavior exactly. The `"in-filtered"` mode gains the same `in` performance on normal key names while falling back to own-property checks for the 12 well-known `Object.prototype` members (see [technical.md — Presence-check strategies](technical.md#presence-check-strategies-tojs-ownproperties-option) for compliance details).

**Performance nuance**: `in` is ~20–30x faster than `Object.hasOwn` only in the **monomorphic fast path** — a plain object with `Object.prototype` where the key is an own property present. V8 can inline the hidden-class lookup. In all other scenarios (absent key, null-proto object, inherited key, proto-chain key), `in` must traverse the prototype chain and becomes **comparable to or slower than** `Object.hasOwn`, which has stable ~130ms/10M-ops cost regardless of scenario.

**DNA optimization**: when `_hop.call` is used (`"hasown"` or `"in-filtered"` for sensitive keys), DNA hoists `Object.prototype.hasOwnProperty` into a `_hop` variable in the outer closure (`STEP.OUT_CONST`), giving ~17% speedup over `Object.hasOwn` with identical own-property semantics.

**Note**: `in` works correctly with all Unicode planes (BMP, SMP, TIP, Plane 14, surrogate pairs, combining characters, solo surrogates). The claim that "`in` does not work with UTF-16" is false — confirmed empirically.

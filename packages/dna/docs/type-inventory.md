# Type Inventory

Complete catalog of all DNA schema types, their factory functions, output types, and DNA opcodes.

## Summary

| Category | Types | Count |
|---|---|---|
| [Base Classes](#base-classes) | `DnaType`, `DnaTypeWithWrappers`, `DnaSomeType` | 3 |
| [Primitive Types](#primitive-types) | string, number, int, int32, bigint, boolean, date, symbol, nan + special (any, unknown, never, null, undefined, void) | 15 |
| [String Format Types](#string-format-types) | email, url, httpUrl, hostname, uuid, guid, e164, emoji, base64, base64url, hex, nanoid, cuid, cuid2, ulid, xid, ksuid, ipv4, ipv6, mac, cidrv4, cidrv6, jwt, hash | 24 |
| [ISO Date/Time](#iso-datetime) | datetime, date, time, duration | 4 |
| [Coerce Variants](#coerce-variants) | coerce.string/number/int/int32/bigint/boolean/date | 7 |
| [StringBool](#stringbool) | stringbool | 1 |
| [Literal & Enum](#literal--enum) | literal, enum | 2 |
| [Template Literals](#template-literals) | templateLiteral, templateLiteralMutate | 2 |
| [Combinators](#combinators) | union, intersection, xor, discriminatedUnion | 4 |
| [Wrapper Types](#wrapper-types) | optional, exactOptional, nonoptional, nullable, nullish, default, prefault, catch | 8 |
| [Container Types](#container-types) | object, strictObject, looseObject, array, tuple, record, partialRecord, looseRecord, map, set | 10 |
| [Function Type](#function-type) | function | 1 |
| [Pipe & Transform](#pipe--transform) | pipe, transform, preprocess, codec | 4 |
| [Other Types](#other-types) | lazy, promise, custom, instanceof, file, json | 6 |
| [Utility & Check Types](#utility--check-types) | property, refine, check, describe, meta | 5 |
| [Type Aliases](#type-aliases) | DnaJson, DnaJsonRaw, tsJsonValue, infer, input, inputHead | 6 |
| [`fromDna` Type Parameter Reference](#fromdna-type-parameter-reference) | All classes usable as `fromDna<S>` | — |
| **Total** | | **102 types** |

---

## Base Classes

| Class | Description |
|---|---|
| `DnaType<T, I>` | Root class. `_output: T`, `_input: I`. |
| `DnaTypeWithWrappers<T, I>` | Adds wrapper methods (`.optional()`, `.nullable()`, `.default()`, `.catch()`, `.pipe()`, `.refine()`, `.check()`, `.transform()`, `.meta()`). |
| `DnaSomeType<T, I>` | Structural interface (union of all concrete DNA types). |

---

## Primitive Types

| Factory | Class | `_output` | DNA opcode | Key methods |
|---|---|---|---|---|
| `dna.string()` | `DnaString` | `string` | `"s"` | `.min()`, `.max()`, `.length()`, `.regex()`, `.email()`, `.url()`, `.uuid()`, `.startsWith()`, `.endsWith()`, `.includes()`, `.trim()`, `.toLowerCase()`, `.toUpperCase()`, `.normalize()` |
| `dna.number()` | `DnaNumber` | `number` | `"n"` | `.min()`, `.max()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`, `.eq()`, `.multipleOf()`, `.int()`, `.positive()`, `.nonnegative()`, `.negative()`, `.nonpositive()`, `.safe()` |
| `dna.int()` | `DnaInt` | `number` | `"i"` | Same as `DnaNumber` (integer-validated) |
| `dna.int32()` | `DnaInt32` | `number` | `"i"` | Same as `DnaNumber` (clamped to INT32 range) |
| `dna.bigint()` | `DnaBigInt` | `bigint` | `"bi"` | `.min()`, `.max()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`, `.positive()`, `.nonnegative()`, `.negative()`, `.nonpositive()` |
| `dna.boolean()` | `DnaBoolean` | `boolean` | `"b"` | — |
| `dna.date()` | `DnaDate` | `Date` | `"date"` | `.min()`, `.max()`, `.eq()` |
| `dna.symbol()` | `DnaSymbol` | `symbol` | `"symbol"` | — |
| `dna.nan()` | `DnaNaN` | `typeof NaN` | `"nan"` | — |

### Special Primitives

| Factory | Class | `_output` | DNA opcode |
|---|---|---|---|
| `dna.any()` | `DnaAny` | `any` | `"any"` |
| `dna.unknown()` | `DnaUnknown` | `unknown` | `"unknown"` |
| `dna.never()` | `DnaNever` | `never` | `"F"` |
| `dna.null()` | `DnaNull` | `null` | `"n0"` |
| `dna.undefined()` | `DnaUndefined` | `undefined` | `"undefined"` |
| `dna.void()` | `DnaVoid` | `void` | `"undefined"` |

---

## String Format Types

All extend `DnaString` (output: `string`).

| Factory | Class | DNA opcode / format |
|---|---|---|
| `dna.email()` | `DnaEmail` | `"s"` with `format: "email"` |
| `dna.url()` | `DnaUrl` | `"url"` |
| `dna.httpUrl()` | `DnaHttpUrl` | `"s"` with `format: "httpUrl"` |
| `dna.hostname()` | `DnaHostname` | `"s"` with `format: "hostname"` |
| `dna.uuid()` | `DnaUUID` | `"s"` with `format: "uuid"` |
| `dna.guid()` | `DnaGuid` | `"s"` with `format: "guid"` |
| `dna.e164()` | `DnaE164` | `"s"` with `format: "e164"` |
| `dna.emoji()` | `DnaEmoji` | `"s"` with `format: "emoji"` |
| `dna.base64()` | `DnaBase64` | `"s"` with `format: "base64"` |
| `dna.base64url()` | `DnaBase64Url` | `"s"` with `format: "base64url"` |
| `dna.hex()` | `DnaHex` | `"s"` with `format: "hex"` |
| `dna.nanoid()` | `DnaNanoId` | `"s"` with `format: "nanoid"` |
| `dna.cuid()` | `DnaCuid` | `"s"` with `format: "cuid"` |
| `dna.cuid2()` | `DnaCuid2` | `"s"` with `format: "cuid2"` |
| `dna.ulid()` | `DnaUlid` | `"s"` with `format: "ulid"` |
| `dna.xid()` | `DnaXid` | `"s"` with `format: "xid"` |
| `dna.ksuid()` | `DnaKsuid` | `"s"` with `format: "ksuid"` |
| `dna.ipv4()` | `DnaIpv4` | `"s"` with `format: "ipv4"` |
| `dna.ipv6()` | `DnaIpv6` | `"s"` with `format: "ipv6"` |
| `dna.mac()` | `DnaMac` | `"s"` with `format: "mac"` |
| `dna.cidrv4()` | `DnaCidrv4` | `"s"` with `format: "cidrv4"` |
| `dna.cidrv6()` | `DnaCidrv6` | `"cidrv6"` |
| `dna.jwt()` | `DnaJwt` | `"jwt"` |
| `dna.hash(algorithm)` | `DnaHash` | `"s"` with `format: "hash:<algo>"` |

### ISO Date/Time

Accessed via `dna.iso.*`.

| Factory | Class | Format |
|---|---|---|
| `dna.iso.datetime()` | `DnaIsoDatetime` | `"date-time"` (with options: `local`, `offset`, `precision`) |
| `dna.iso.date()` | `DnaIsoDate` | `"date"` |
| `dna.iso.time()` | `DnaIsoTime` | `"time"` (with `precision`) |
| `dna.iso.duration()` | `DnaIsoDuration` | `"duration"` |

---

## Coerce Variants

Accessed via `dna.coerce.*` or via `{ coerce: true }` option on the base factory.

| Factory | Class | `_output` |
|---|---|---|
| `dna.coerce.string()` | `DnaCoerceString` | `string` |
| `dna.coerce.number()` | `DnaCoerceNumber` | `number` |
| `dna.coerce.int()` | `DnaCoerceInt` | `number` |
| `dna.coerce.int32()` | `DnaCoerceInt32` | `number` |
| `dna.coerce.bigint()` | `DnaCoerceBigInt` | `bigint` |
| `dna.coerce.boolean()` | `DnaCoerceBoolean` | `boolean` |
| `dna.coerce.date()` | `DnaCoerceDate` | `Date` |

---

## StringBool

| Factory | Class | `_output` | DNA opcode |
|---|---|---|---|
| `dna.stringbool()` | `DnaStringBool` | `boolean` | `"sb"` |

Accepts `truthy`/`falsy` arrays and `case` option. Coerces string representations to boolean.

---

## Literal & Enum

| Factory | Class | `_output` | DNA opcode | Key methods |
|---|---|---|---|---|
| `dna.literal(value)` | `DnaLiteral<T>` | `T` | `"l"` | — |
| `dna.enum(values)` | `DnaEnum<T>` | `T[keyof T]` | `"e"` | `.values`, `.options`, `.enum`, `.extract()`, `.exclude()` |

---

## Template Literals

| Factory | Class | `_output` | DNA opcode | Description |
|---|---|---|---|---|
| `dna.templateLiteral(parts)` / `dna.tl()` | `DnaTemplateLiteral<Parts>` | `Parts` | `"template"` (`canMutate: false`) | Validate-only (inner transforms ignored) |
| `dna.templateLiteralMutate(parts)` / `dna.tlm()` | `DnaTmplLiteralMutate<Parts>` | `Parts` | `"template"` (`canMutate: true`) | Mutating (inner transforms applied) |

Both share the `"template"` opcode. The 4th tuple element (`canMutate` boolean at index 3) distinguishes them: `["template", passiveParts, partIds, canMutate]`. `DnaTemplateLiteral` extends `DnaTmplLiteralMutate` and overrides `canMutate` to `false`.

---

## Combinators

| Factory | Class | `_output` | DNA opcode | Key methods |
|---|---|---|---|---|
| `dna.union(schemas)` | `DnaUnion<S>` | union of outputs | `"anyOf"` | `.options` |
| `dna.intersection(s1, s2)` | `DnaIntersection<T, U>` | `T & U` | `"allOf"` | — |
| `dna.xor([s1, s2])` | `DnaXorUnion<T, U>` | XOR of `T` and `U` | `"oneOf"` | — |
| `dna.discriminatedUnion(key, schemas)` | `DnaDiscriminatedUnion<K, S>` | union of branch outputs | `"discriminator"` | `.options`, `.discriminator` |

---

## Wrapper Types

Created via methods on any `DnaTypeWithWrappers` (e.g. `dna.string().optional()`).

| Method | Class | `_output` | DNA wrapper type | Description |
|---|---|---|---|---|
| `.optional()` | `DnaOptional<Inner>` | `$Output<Inner> \| undefined` | `"optional"` | Allows `undefined` |
| `.exactOptional()` | `DnaExactOptional<Inner>` | `$Output<Inner>` (no `undefined` added) | `"exactOptional"` | Object key optional without `undefined` in value type |
| `.nonoptional()` | `DnaNonOptional<Inner>` | `$Output<Inner>` (stripped `undefined`) | `"nonoptional"` | Marks key as required |
| `.nullable()` | `DnaNullable<Inner>` | `$Output<Inner> \| null` | `"nullable"` | Allows `null` |
| `.nullish()` | `DnaNullish<Inner>` | `$Output<Inner> \| null \| undefined` | `"nullish"` | Allows `null` and `undefined` |
| `.default(value)` | `DnaDefault<Inner>` | `$Output<Inner>` | `"default"` | Supplies default for output |
| `.prefault(value)` | `DnaPrefault<Inner>` | `$Output<Inner>` | `"prefault"` | Supplies default for input |
| `.catch(value)` | `DnaCatch<Inner>` | `$Output<Inner>` | `"catch"` | Fallback on validation error |

Top-level wrappers: `dna.optional(s)`, `dna.nonoptional(s)`, `dna.nullable(s)`, `dna.nullish(s)`, `dna.prefault(s, value)`.

---

## Container Types

| Factory | Class | `_output` | DNA opcode | Key methods |
|---|---|---|---|---|
| `dna.object(shape)` | `DnaObject<T>` | `{ [K in keyof T]: $Output<T[K]> }` | `"o"` | `.strict()`, `.loose()`, `.standard()`, `.partial()`, `.required()`, `.pick()`, `.omit()`, `.extend()`, `.safeExtend()`, `.catchall()`, `.shape`, `.keyOf()` |
| `dna.strictObject(shape)` | `DnaObject<T>` | same | `"o"` (strict) | Same as `dna.object()` with `objType: "strict"` |
| `dna.looseObject(shape)` | `DnaObject<T>` | same | `"o"` (loose) | Same as `dna.object()` with `objType: "loose"` |
| `dna.array(item)` | `DnaArray<S>` | `$Output<S>[]` | `"a"` | `.min()`, `.max()`, `.length()`, `.nonempty()` |
| `dna.tuple(items, rest?)` | `DnaTuple<S, R>` | tuple of outputs | `"a"` (with `prefixItems`) | `.rest()`, `.min()`, `.max()`, `.length()`, `.nonempty()` |
| `dna.record(key, value)` | `DnaRecord<K, V>` | `Record<$Output<K> & PropertyKey, $Output<V>>` | `"rcd"` | `.keySchema`, `.valueSchema`, `.keyType`, `.valueType` |
| `dna.partialRecord(key, value)` | `DnaRecord<K, V>` | same (partial) | `"rcd"` | Same, keys optional |
| `dna.looseRecord(key, value)` | `DnaRecord<K, V>` | same (loose) | `"rcd"` | Same, non-matching keys pass through |
| `dna.map(key, value)` | `DnaMap<K, V>` | `Map<$Output<K>, $Output<V>>` | (pipe of `instanceof` + `record` + transforms) | `.min()`, `.max()`, `.size()`, `.nonempty()` |
| `dna.set(item)` | `DnaSet<T>` | `Set<$Output<T>>` | (pipe of `instanceof` + `array` + transforms) | `.min()`, `.max()`, `.size()`, `.nonempty()` |

---

## Function Type

| Factory | Class | `_output` | DNA opcode | Key methods |
|---|---|---|---|---|
| `dna.function()` | `DnaFunction<I, O>` | `(...args: DnaFunctionArgs<I>) => $Output<O>` | `"function"` | `.input()`, `.output()`, `.implement()`, `.implementAsync()` |

---

## Pipe & Transform

| Factory | Class | `_output` | DNA opcode | Description |
|---|---|---|---|---|
| `dna.pipe(src, target)` | `DnaPipe<S, T>` | `$Output<T>` | `"pipe"` | Sequential validation pipeline |
| `dna.transform(fn)` | `DnaTransform<T, R>` | `R` | `"transform"` | Transform step (function source serialized) |
| `dna.preprocess(fn, target)` | `DnaPipe<DnaTransform, Target>` | `$Output<Target>` | `"pipe"` | Preprocess input before validation |
| `dna.codec(in, out, opts)` | `DnaCodec<I, O>` | `O` | (emits decode twin) | Bidirectional encode/decode |

---

## Other Types

| Factory | Class | `_output` | DNA opcode | Description |
|---|---|---|---|---|
| `dna.lazy(getter)` | `DnaLazy<Out, In>` | `Out` | `"ref"` | Recursive / deferred schema |
| `dna.promise(schema)` | `DnaPromise<T, I>` | `T` | `"promise"` | Promise validation (async-only) |
| `dna.custom(fn)` | `DnaCustom<T>` | `T` | `"custom"` | Custom validation function |
| `dna.instanceof(Constructor)` | `DnaInstanceOf<T, O>` | `O` | `"instanceOf"` | `instanceof` check |
| `dna.file()` | `DnaFile` | `File` | `"instanceOf"` | File validation with `.min()`, `.max()`, `.mime()` |
| `dna.json()` | `DnaJson` | `tsJsonValue` | (recursive union) | JSON value validation |

---

## Utility & Check Types

| Factory | Class | Description |
|---|---|---|
| `dna.property(key, schema)` | `DnaCheckProperty<K, S>` | Property-level validation check for `.check()` |
| `dna.refine(fn, opts)` | — (returns `tsDnaValidationCheck`) | Top-level refine check |
| `dna.check(fn)` | — (returns `tsDnaValidationCheck`) | Top-level low-level check |
| `dna.describe(desc)` | — (returns `tsDnaDescribeCheck`) | Description metadata |
| `dna.meta(meta)` | — (returns `tsDnaMetaCheck`) | Metadata check |

---

## Type Aliases

### Public (exported from `@ytn/dna`)

| Alias | Definition |
|---|---|
| `DnaJson` | `DnaLazy<tsJsonValue>` |
| `tsJsonValue` | `string \| number \| boolean \| null \| tsJsonValue[] \| { [x: string]: tsJsonValue }` |
| `dna.infer<S>` | `$Output<S>` (extracts `_output` from schema type) |
| `dna.input<S>` | `$Input<S>` (extracts `_input` from schema type) |
| `dna.inputHead<S>` | `$InputHead<S>` |
| `tsDna` | DNA node tuple type |
| `tsDnaOpcode` | DNA opcode string union |
| `tsDnaSeq` | Full DNA sequence type (`[...tsDna[], number[]]`) |
| `DnaFunctionOptions` | Options for `dna.function()` |

---

## `fromDna` Type Parameter Reference

All classes extending `DnaTypeWithWrappers` can be used as the type argument to `fromDna<T>`:

- **Primitives**: `dna.DnaString`, `dna.DnaNumber`, `dna.DnaInt`, `dna.DnaInt32`, `dna.DnaBigInt`, `dna.DnaBoolean`, `dna.DnaDate`, `dna.DnaSymbol`, `dna.DnaNaN`
- **Special**: `dna.DnaAny`, `dna.DnaUnknown`, `dna.DnaNever`, `dna.DnaNull`, `dna.DnaUndefined`, `dna.DnaVoid`
- **String formats**: `dna.DnaEmail`, `dna.DnaHttpUrl`, `dna.DnaHostname`, `dna.DnaUUID`, `dna.DnaGuid`, `dna.DnaE164`, `dna.DnaEmoji`, `dna.DnaBase64`, `dna.DnaBase64Url`, `dna.DnaHex`, `dna.DnaNanoId`, `dna.DnaCuid`, `dna.DnaCuid2`, `dna.DnaUlid`, `dna.DnaXid`, `dna.DnaKsuid`, `dna.DnaIpv4`, `dna.DnaIpv6`, `dna.DnaMac`, `dna.DnaCidrv4`, `dna.DnaCidrv6`, `dna.DnaJwt`, `dna.DnaHash`, `dna.DnaUrl`
- **ISO**: `dna.DnaIsoDatetime`, `dna.DnaIsoDate`, `dna.DnaIsoTime`, `dna.DnaIsoDuration`
- **StringBool**: `dna.DnaStringBool`
- **Literal/Enum**: `dna.DnaLiteral<T>`, `dna.DnaEnum<T>`
- **Template**: `dna.DnaTemplateLiteral<Parts>`, `dna.DnaTmplLiteralMutate<Parts>`
- **Combinators**: `dna.DnaUnion<S>`, `dna.DnaIntersection<T, U>`, `dna.DnaXorUnion<T, U>`, `dna.DnaDiscriminatedUnion<K, S>`
- **Wrappers**: `dna.DnaOptional<Inner>`, `dna.DnaExactOptional<Inner>`, `dna.DnaNonOptional<Inner>`, `dna.DnaNullable<Inner>`, `dna.DnaNullish<Inner>`, `dna.DnaDefault<Inner>`, `dna.DnaPrefault<Inner>`, `dna.DnaCatch<Inner>`
- **Containers**: `dna.DnaObject<T>`, `dna.DnaArray<S>`, `dna.DnaTuple<S, R>`, `dna.DnaRecord<K, V>`, `dna.DnaMap<K, V>`, `dna.DnaSet<T>`
- **Function**: `dna.DnaFunction<I, O>`
- **Pipe/Transform**: `dna.DnaPipe<S, T>`, `dna.DnaTransform<T, R>`, `dna.DnaCodec<I, O>`
- **Other**: `dna.DnaLazy<Out, In>`, `dna.DnaPromise<T, I>`, `dna.DnaCustom<T>`, `dna.DnaInstanceOf<T, O>`, `dna.DnaFile`

For complex generics, instantiate the DNA class directly with its type parameters (e.g. `dna.DnaObject<{ name: dna.DnaString }>`, `dna.DnaFunction<readonly [dna.DnaString], dna.DnaNumber>`).

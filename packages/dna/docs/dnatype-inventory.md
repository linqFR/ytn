# DnaType Type Inventory: A Senior Architectural Perspective

> **Scope**: `@ytn/dna` package and its git history, including the pre-extraction `@ytn/dna-schema` lineage.
> **Purpose**: Exhaustive inventory of the `DnaType` concept (and every name it has worn), the philosophies used to trace DNA types through runtime bytecode, and the TypeScript type-level techniques that bind compile-time inference to the builder hierarchy.

---

## 1. Executive Summary

`DnaType` is the central schema type of the DNA engine. It is simultaneously:

1. A **runtime class** that emits a compact opcode-based bytecode (`tsDna` / `tsDnaSeq`).
2. A **TypeScript type carrier** that tracks two semantic axes: `Output` (`T`) and `Input` (`I`).
3. A **Zod-mimetic fluent API** surface, composed through classes and interfaces.

The architecture separates **what the schema is at runtime** (a class instance with `_core`, `_head`, and metadata) from **what the schema means to TypeScript** (an `IDnaType<T, I, _ts>` shape carrying a `TsType<Out, In>` proof object). This duality is the dominant design pattern throughout the package's type evolution.

---

## 2. Chronology of the DNA Type Nomenclature

### Phase 0 — `packages/dna-schema` (pre-June 2026)

| Artifact | Role |
|----------|------|
| `packages/dna-schema/src/dna.type.ts` | Legacy location of the type model (often `.js` or `.ts` depending on the snapshot). |
| `ISchemaBase<T>` | First central interface for any schema object. |
| `tsSch*` aliases | Product types such as `tsSchString`, `tsSchNumber`, `tsSchObject<T>`, `tsSchUnion<T>`, etc. Built from `ISchemaBase<T>` plus method interfaces. |
| `packages/dna-schema/src/jschema-to-dna.ts` | JSON-Schema-to-DNA converter; did not own the builder type. |

### Phase 1 — Extraction to `@ytn/dna` (commit `5296b95`, 2026-06-12)

* `@ytn/dna` is extracted from `@ytn/schvalid` (formerly `@ytn/dna-schema`).
* The central schema interface remains `ISchemaBase<T>`.
* Concrete product types are still `tsSch*` (e.g. `tsSchString`, `tsSchObject<T>`).
* Type aliases are exposed under a `t` namespace (`t.DnaString`, `t.DnaNumber`, etc.) but they are thin re-exports of `tsSch*`.

### Phase 2 — `builder.types.ts` / `core.ts` split (commits around `1914442`, `e559afc`, July 2026)

* `builder.types.ts` is removed.
* The concrete implementation moves to `packages/dna/src/builder/core.ts`.
* A transitional name `tsDnaType<T, I>` appears as the class/alias for the schema object.
* `DnaType` first appears as a usable class name around commit `e559afc` (2026-07-07) in `packages/dna/src/builder/dna-interfaces.ts`.

### Phase 3 — `dna-interfaces.ts` + `dna-core.ts` refactor (commit `675abe8`, 2026-07-23)

* `core.ts` is renamed to `dna-core.ts`.
* `dna-interfaces.ts` becomes the canonical home of the builder classes.
* `DnaBase<T, I, _ts>` is introduced as the abstract superclass.
* `DnaType<T, I, _ts>` becomes the concrete, wrapper-capable schema class.
* `IDnaType<T, I, _ts>` and `IDnaTypeWithWrappers<T, I, _ts>` formalize the public interface.

### Phase 4 — Type-system hardening (commit `528293a`, 2026-07-30)

* `TsType<Out, In>` is introduced as a readonly phantom/proof type.
* `$Output<S>` / `$Input<S>` helpers replace earlier `tsSchemaValue` and `$DnaOut`/`$DnaIn` patterns.
* `fromDna` is added, requiring a round-trip `DnaTypeWithWrappers` reconstruction.
* `keepOnly` object output and function tuple input are modeled in the type system.

### Phase 5 — Xor and Standard Schema (commit `c0ac517`, 2026-07-31)

* `DnaXorUnion<T, U>` is added.
* The type algebra for exclusive unions (`$Xor<T, U>`) is hardened.
* Standard Schema v1 (`~standard`) integration is finalized through `standard-schema.types.ts` and `standard-schema-utils.ts`.

---

## 3. Exhaustive Inventory of DNA Types

### 3.1 The `DnaType` lineage

| Name | File | Kind | Signature | Responsibility |
|------|------|------|-----------|----------------|
| `ISchemaBase<T>` | `builder/builder.types.ts` (legacy) | interface | `ISchemaBase<T>` | Original schema contract: parsing, validation, metadata, wrappers, and DNA emission. |
| `tsDnaType<T, I>` | `shared/base.types.ts` (transitional) | type alias | `tsDnaType<T, I>` | Transitional class/alias used while `DnaType` was being introduced. |
| `IDnaType<T, I, _ts>` | `builder/dna-interfaces.ts` | interface | `IDnaType<out T, out I, out _ts extends TsType<T, I>>` | Public readonly contract for a DNA schema: parse/validate/encode methods, `toDna`, metadata accessors, and wrapper return types. |
| `IDnaTypeWithWrappers<T, I, _ts>` | `builder/dna-interfaces.ts` | interface | extends `IDnaType` | Adds the `optional`, `nullable`, `default`, `prefault`, `catch`, etc. methods. |
| `DnaBase<T, I, _ts>` | `builder/dna-interfaces.ts` | abstract class | `DnaBase<T = unknown, I = unknown, _ts extends TsType<T, I> = TsType<T, I>>` | Shared runtime implementation: `_core`, `_head`, `toDna`, `safeParse`, `validate`, `encode`. |
| `DnaType<T, I, _ts>` | `builder/dna-interfaces.ts` | concrete class | `DnaType<T = unknown, I = T, _ts extends TsType<T, I> = TsType<T, I>>` | Final class for non-wrapped schemas; exposes the wrapper API and is the superclass of all primitives, objects, arrays, and combinators. |

### 3.2 Concrete primitive and pseudo-type classes

All extend `DnaType<T, T>` (or `DnaType<T, I>` when input differs):

* `DnaAny` — `DnaType<any, any>`
* `DnaUnknown` — `DnaType<unknown, unknown>`
* `DnaNever` — `DnaType<never, never>`
* `DnaNull` — `DnaType<null, null>`
* `DnaUndefined` — `DnaType<undefined, undefined>`
* `DnaSymbol` — `DnaType<symbol, symbol>`
* `DnaVoid` — `DnaType<void, void>`
* `DnaNaN` — `DnaType<typeof NaN, typeof NaN>`
* `DnaString` — `DnaType<string, string>`
* `DnaNumber` — `DnaType<number, number>`
* `DnaInteger` / `DnaInteger32`
* `DnaBigInt`
* `DnaBoolean`
* `DnaDate`
* `DnaUrl`
* `DnaJwt`
* `DnaHash`
* `DnaLiteral<T>`
* `DnaEnum<T>`
* `DnaTemplateLiteral<Parts>`
* `DnaCodec<I, O>`
* `DnaInstanceOf<T>`

### 3.3 Container and composite classes

| Class | Extends | Type tracking |
|-------|---------|---------------|
| `DnaObject<T, I>` | `DnaType<T, I>` | Object output/input via `$DnaObjectOutput` / `$DnaObjectInput`. |
| `DnaRecord<K, V>` | `DnaType<Record<K, V>, ...>` | Record shapes with `strict` / `loose` / `partial` modes. |
| `DnaArray<T, I>` | `DnaType<T[], I[]>` | Item type `T`, input `I`. |
| `DnaTuple<S, R>` | `DnaType<...>` | `S` is a tuple of `IDnaType`, `R` is an optional rest type. |
| `DnaMap<K, V>` | `DnaType<Map<K, V>, ...>` | Reconstructed from `seq` opcodes. |
| `DnaSet<T>` | `DnaType<Set<T>, ...>` | Reconstructed from `seq` opcodes. |
| `DnaLazy<T>` | `DnaType<T, T>` | Circular/lazy schema resolution. |
| `DnaFunction<I, O>` | `DnaType<tsFunctionType<I, O>, ...>` | Callable input/output tracking. |
| `DnaPromise<T>` | `DnaType<Promise<T>, ...>` | Promise output. |

### 3.4 Combinator classes

* `DnaCombinator<T, I, S>` — generic `anyOf` / `allOf` / `oneOf` implementation.
* `DnaUnion<S>` — `anyOf` semantics.
* `DnaIntersection<T, U>` — `allOf` semantics.
* `DnaXorUnion<T, U>` — `oneOf` semantics with exclusive overlap rejection.
* `DnaDiscriminatedUnion<Disc, Ob>` — discriminator-driven union.
* `DnaPipe<I, T, O>` — sequential transformation pipeline.
* `DnaTransform<T, R>` — single-step transformation.

### 3.5 Wrapper classes

All extend `_DnaWrapper<Inner, T, I>` and wrap an `Inner extends DnaBase`:

* `DnaOptional<Inner>`
* `DnaExactOptional<Inner>`
* `DnaNonOptional<Inner>`
* `DnaNullable<Inner>`
* `DnaNullish<Inner>`
* `DnaDefault<Inner>`
* `DnaPrefault<Inner>`
* `DnaCatch<Inner>`

### 3.6 Type-level helper types (`src/types/helpers.types.ts`)

| Type | Purpose |
|------|---------|
| `TsType<Out, In>` | Readonly phantom carrier for a schema's output and input types. |
| `$DnaOut<S>` / `$DnaIn<S>` | Extract `_ts.output` / `_ts.input` from a schema. |
| `$Output<S>` / `$Input<S>` | Shorthand aliases for `$DnaOut` / `$DnaIn`. |
| `$InputHead<T>` | Walks the `_head` chain to resolve the original input type. |
| `infer<T>` | Public alias for `$Output<T>` (mirrors `z.infer`). |
| `$ReadonlyValue<T>` | Adds `Readonly<T>` for non-primitive values. |
| `$UnionToIntersection<U>` | Converts a union to an intersection (used in `allOf`). |
| `$Xor<T, U>` | Exclusive-or type: matches one branch, never the overlap. |
| `$DnaBranded<T, Brand, Dir>` | Brands `_input` and/or `_output` with a property-key brand. |
| `$MaybeAsync<T>` | `T \| Promise<T>` helper for transform/refine. |
| `$RemoveUndefined<T>` | Removes `undefined` from a type distributively. |
| `$DnaObjectOutput<T>` / `$DnaObjectInput<T>` | Maps object shape schemas to output/input types. |
| `$DnaPartialProperty<S>` / `$DnaPartialShape<T, K>` | Partial-optional helpers for `.partial()`. |
| `$SafeExtendShape<Base, Ext>` | Ensures extended shapes are assignable in both input and output directions. |
| `$TemplateLiteral<Parts>` | Builds a template-literal string type from a parts tuple. |

### 3.7 DNA bytecode types (`src/types/core.types.ts`)

* `tsDnaOpcode` — union of all string opcodes (`"s"`, `"o"`, `"a"`, `"anyOf"`, `"optional"`, etc.).
* `tsDnaId` — `number`, a node index in the collector.
* `tsDnaNoMeta` — `[tsDnaOpcode, ...any[]]`.
* `tsDna` — `[...tsDnaNoMeta, tsDnaInnerMeta]`.
* `tsDnaSeq` — `[...tsDna[], number[]]` (the flat bytecode sequence plus `refList`).
* `tsDnaObjectType` — `'strict' \| 'loose' \| 'standard' \| 'object' \| 'plainObject'`.
* `tsDnaCombinatorType` — `"anyOf" \| "allOf" \| "oneOf"`.

### 3.8 Inference types (`src/types/dna-inference.types.ts`)

* `InferDNA<T extends tsDna>` — template-literal-style conditional type that maps a DNA opcode tuple to a TypeScript type.
* `InferObjectDNA`, `InferConstDNA`, `InferLiteralDNA`, `InferEnumDNA` — helpers.
* `isDNA<T>` — runtime/type-guard placeholder.
* `AssertDNA<T, U>` — compile-time assertion helper.

---

## 4. Type-Tracing Philosophies and Techniques

### 4.1 Dual-track typing: `Output` vs `Input`

The most consequential design decision is that every schema carries **two** type parameters:

* `T` — the **output** type (what `parse` returns).
* `I` — the **input** type (what `safeParse` accepts, before transforms/defaults).

This is encoded in `TsType<Out, In>` and threaded through `DnaBase<T, I, _ts>` and `IDnaType<T, I, _ts>`. It enables:

* `.transform()` to change `T` while keeping `I`.
* `.pipe()` to chain `I → T → U`.
* `.encode()` to reverse the direction.
* `.default()` and `.prefault()` to inject values without confusing the original input type.

### 4.2 `_ts` as a phantom/proof carrier

The third generic parameter `_ts extends TsType<T, I>` is not a value at runtime. It is a **proof object** attached to the class to let the type system recover `T` and `I` from any schema instance. This is the key to the `$Output<S>` / `$Input<S>` helpers:

```ts
type $DnaOut<S> = S extends { _ts: { output: any } } ? S["_ts"]["output"] : unknown;
```

### 4.3 Class-based schema objects with metadata

Unlike Zod, which uses `ZodType` with an internal `_def` (forbidden in this repo per the `._zod` rule), DNA uses a **class hierarchy**:

* `DnaBase` owns the shared runtime: `_core`, `_head`, `toDna`, `safeParse`, `validate`.
* `DnaType` adds the fluent wrapper methods.
* Concrete classes (`DnaString`, `DnaObject`) extend `DnaType` and override `_core`.

Each class's `_core` is a `BaseCore` instance that carries the opcode, the seed (runtime constraints), and the metadata. The type is recovered from the class's generic parameters, not from `_core` fields.

### 4.4 Interface + class separation

`IDnaType` and `IDnaTypeWithWrappers` are the **public contracts**. `DnaBase` / `DnaType` are the **implementations**. This allows:

* Return types of builder methods to be interface types (e.g. `IDnaOptional<this>`), hiding the concrete class.
* The implementation to evolve without breaking the public type.

### 4.5 Wrapper chaining as type transformations

Wrappers are not just runtime decorators; they are **type constructors**:

```ts
export class DnaOptional<Inner extends DnaBase<any, any, any> = DnaType<any, any, any>>
  extends _DnaWrapper<Inner, $Output<Inner> | undefined, $Input<Inner> | undefined>
```

The output and input types are computed from the inner schema via `$Output` / `$Input`. This makes `.optional()` a type-level operation as much as a runtime one.

### 4.6 Template-literal and conditional type inference

`$TemplateLiteral<Parts>` uses recursive conditional types on tuples to build a string literal type. `InferDNA<T>` uses the same technique to map DNA opcodes to TS types. These are pure compile-time computations, separate from the runtime bytecode.

### 4.7 The `$*` namespace for type algebra

The codebase follows the global naming convention (`$*` for type-modifiers). All advanced type manipulation lives in `helpers.types.ts` under names such as `$Xor`, `$DnaBranded`, `$SafeExtendShape`. This keeps the runtime classes free of type-level noise while centralizing the type-level DSL.

### 4.8 Strict assignability through `$SafeExtendShape`

Object extension (`.extend()`) is not typed as an unconstrained merge. It uses `$SafeExtendShape<Base, Ext>`, which requires that every overriding key's output type be assignable to the base output and its input type be assignable to the base input. This prevents accidental contravariance/covariance mismatches.

---

## 5. Commit-by-Commit Type Evolution

| Commit | Date | Package | Key type-system change |
|--------|------|---------|------------------------|
| `3dce800` | 2026-05-29 | `dna-schema` | Early DNA-to-JS compiler; schema types centered in `ISchemaBase<T>` and `tsSch*` aliases. |
| `be63e12` | 2026-05-29 | `dna-schema` | Unevaluated tracking refactor. |
| `c319313` | 2026-05-29 | `dna` | Package renamed from `@ytn/dna-schema` to `@ytn/dna`; `ISchemaBase<T>` still central. |
| `4581992` | 2026-05-29 | `dna` | Changelog and release prep. |
| `a12b7618` | 2026-06-01 | `schvalid` | `@ytn/dna-schema` renamed to `@ytn/schvalid`; refactor to consume `@ytn/dna` types. |
| `5296b95` | 2026-06-12 | `dna` | Extraction from `@ytn/schvalid`; `builder.types.ts` with `ISchemaBase<T>` and `tsSch*`; `t.Dna*` namespace aliases. |
| `0284855` | 2026-06-12 | `dna` / `schvalid` | Release `0.2.0` / `0.2.2`; types stable with `ISchemaBase`. |
| `e559afc` | 2026-07-07 | `dna` | First appearance of `DnaType` as a class name in `dna-interfaces.ts` (from `core.ts`/`tsDnaType` transition). |
| `1914442` | 2026-07-05 | `dna` | `core.ts` era; `tsDnaType<T, I>` still imported from `shared/base.types.ts`; `DnaType` appears in `pipeFactory` signature. |
| `9a06712` | 2026-07-21 | `dna` | Intermediate `dna-interfaces.ts` with `DnaBase`/`DnaType` class split emerging. |
| `675abe8` | 2026-07-23 | `dna` | `dna-core.ts` + `dna-interfaces.ts` canonicalized; `DnaBase<T, I, _ts>` and `DnaType<T, I, _ts>` established; `builder.types.ts` deleted; `api-builder.types.ts` / `helpers.types.ts` introduced. |
| `5f556e8` / `ab924a4` | 2026-07-26 | `dna` | `seq` → `pipe` rename and `chk` → `chkSeq` / `chkList` refactor; type names `DnaPipe`, `DnaPipe` / `DnaTransform` align. |
| `355a38d` | 2026-07-26 | `dna` | `chk` opcode renamed to `chkSeq` and `chkList` introduced for `allOf` semantics; `DnaIntersection` type adjusted. |
| `4fcdb3c` | 2026-07-27 | `schvalid` | `parserFast` added; no direct `DnaType` change, but consumer contracts tightened. |
| `528293a` | 2026-07-30 | `dna` | Type-system hardening: `TsType<Out, In>` becomes the canonical proof; `keepOnly` object output; function tuple input; `fromDna` reconstruction; `$Output` / `$Input` helpers. |
| `c0ac517` | 2026-07-31 | `dna` | `DnaXorUnion<T, U>` added; `$Xor<T, U>` hardened. |
| `6abc226` | 2026-07-30 | `cdna` / `dna` | `v0.3.0` release with architecture hardening. |
| `7e81590` | 2026-08-01 | `dna` | Dependency bump (`jose`); no type changes. |

---

## 6. Architectural Observations

1. **Name convergence**: The central schema concept has moved from `ISchemaBase<T>` / `tsSch*` to `tsDnaType` to `DnaBase` / `DnaType`. The name `DnaType` now denotes the **class**, while `IDnaType` denotes the **interface**.

2. **Three-layer type model**:
   * **Runtime**: `BaseCore` + opcode (`tsDna`).
   * **Class**: `DnaBase` / `DnaType` instances with `_core`.
   * **Compile-time**: `TsType<Out, In>` + `IDnaType` contract + `$*` helpers.

3. **Type safety over convenience**: The project forbids `as any`, `as unknown` outside the `as unknown as T` escape hatch, and `any` in parameters. This forces every type transform (wrappers, combinators, object extension) to be modeled explicitly in `helpers.types.ts`.

4. **Zod parity by type, not by implementation**: The public API surface mimics Zod (`z.infer` → `infer`, `.optional()`, `.transform()`, `.pipe()`), but the internal machinery is class-based and emits DNA bytecode instead of holding a `_def` tree.

5. **Bytecodes are data, types are inference**: `tsDna` is a pure data format. `InferDNA` is a separate compile-time interpreter. The builder classes bridge the two by producing `tsDna` at runtime while carrying `TsType` at compile time.

6. **Forward references and cycles are modeled at the DNA level, not the type level**: Circular schemas use `ref` opcodes and a `refList` in `tsDnaSeq`. The TypeScript type does not attempt to express the cycle structurally; it relies on `DnaLazy` and `tsDnaId` indirection.

7. **The `fromDna` roundtrip is a type-system proof point**: Reconstructing a `DnaType` from `tsDnaSeq` and round-tripping `toDna()` demonstrates that the type model and the bytecode model are mutually consistent.

---

## 7. File Map of Current Type Artifacts

| File | Responsibility |
|------|----------------|
| `src/builder/dna-interfaces.ts` | `IDnaType`, `IDnaTypeWithWrappers`, `DnaBase`, `DnaType`, and all concrete schema classes. |
| `src/builder/dna-core.ts` | `BaseCore`, `initDna`, `bindMethods` — runtime core. |
| `src/types/helpers.types.ts` | `$*` type algebra: `TsType`, `$Output`, `$Input`, `$Xor`, `$DnaBranded`, `$TemplateLiteral`, etc. |
| `src/types/api-builder.types.ts` | Builder-specific product types: `tsDnaCheck`, `tsDnaTupleSchema*`, `DnaFunctionArgs`, `tsFunctionType`, etc. |
| `src/types/core.types.ts` | DNA bytecode shape: `tsDnaOpcode`, `tsDna`, `tsDnaSeq`, `tsDnaObjectType`, `tsDnaCombinatorType`. |
| `src/types/dna-inference.types.ts` | `InferDNA` compile-time interpreter. |
| `src/shared/base.types.ts` | `tsPrimitive*`, `tsTmplLitPart`, and runtime primitive unions. |
| `src/shared/handlers-builder.types.ts` | Function types for transforms, refinements, codecs, pipes, and checks. |
| `src/shared/meta-context.type.ts` | Metadata and context types (`tsDnaMeta`, `tsDnaInnerMeta`, `tsDnaBaseCtx`). |
| `src/shared/runtime.types.ts` | Validator/parser function signatures (`tsDnaValidatorFn`, `tsDnaParserFn`). |
| `src/shared/inference.types.ts` | Inference helpers for the `toJs` code generator. |

---

## 8. Type Health Diagnostic: Why the DNA Type System Still Fails

This section records the build and type errors observed while validating the current implementation, and the deeper structural causes behind them.

### 8.1 The `IDnaType extends DnaBase` circularity

**Observation**: `IDnaType` is declared as an interface that extends the class `DnaBase`:

```ts
export interface IDnaType<out T, out I, out _ts extends TsType<T, I>>
  extends DnaBase<T, I, _ts> {}
```

**Root cause**: This is an unusual design. An interface should describe a contract, but here the contract is *identical* to the implementation. Because `IDnaType` extends `DnaBase`, any change to `DnaBase` ripples into the public contract. There is no clean seam between the runtime class and the public type.

**What it reveals**: The architecture never finished the separation between "what a schema is" and "what a schema looks like to TypeScript". The interface layer is a thin re-export of the class layer, not an abstraction.

### 8.2 `initDna` has no bridge between class and interface

**Observation**: The factory `initDna` is typed as:

```ts
export const initDna = <Cls extends new () => any, State extends tsStateDef = tsStateDef>
  (cls: Cls, state?: State, meta?: ...): InstanceType<Cls> => { ... }
```

It knows the constructor, but it does not know that `_DnaArray<T>` should be assignable to `DnaArray<T>`, or that `DnaDefault<this>` should be assignable to `IDnaDefault<this>`.

**Root cause**: `initDna` returns `InstanceType<Cls>`, which is the concrete class instance. The concrete class (e.g. `_DnaArray<T>` or `DnaDefault<this>`) must be *structurally* assignable to the public interface. TypeScript cannot prove this because:

- `_DnaArray` does not explicitly `implements DnaArray<T>`.
- `DnaArray<T>` (interface) and `_DnaArray<T>` (class) have different generic parameter names (`S` vs `T`).
- `_DnaArray.readonly()` returns `this`, but `DnaArray<S>.readonly()` returns `DnaArray<S>`. `this` is a wider type than `DnaArray<S>` in the context of the class.

**What it reveals**: The factory is generic over constructors, not over the public interface. This is the single biggest source of `as unknown as` casts.

### 8.3 Public `DnaObject`/`DnaArray` are interfaces, private `_DnaObject`/`_DnaArray` are classes

**Observation**: The public API uses `DnaObject<Shape>` and `DnaArray<S>` as interfaces, while the runtime uses `_DnaObject<Shape>` and `_DnaArray<S>` as classes. The naming convention is inconsistent: `DnaType` is a class, but `DnaObject` and `DnaArray` are interfaces.

**Root cause**: The refactorings between versions mixed the old `tsSch*` style (interface-only) with the new class model. Some schemas kept their class name (`DnaType`), while objects/arrays were split into `Dna*` (public interface) and `_Dna*` (private class).

**What it reveals**: The codebase has two naming schemes at once. This makes imports error-prone, as shown by `api-enhanced.ts` importing `DnaArray` as a value when it is only a type.

### 8.4 `Shape` is not structurally tied to `_core.seed.propertySchemas`

**Observation**: In `_DnaObject`:

```ts
export class _DnaObject<Shape extends Record<string, any>, ...> extends DnaType<any, any, _ts> {
  public override _core = new BaseCore<{ propertySchemas: Record<string, IDnaType>, ... }>("object");

  get shape(): Shape {
    return this._core.seed.propertySchemas as unknown as Shape;
  }
}
```

**Root cause**: `Shape` is a generic type parameter. `propertySchemas` is `Record<string, IDnaType>`. There is no proof that `Record<string, IDnaType>` is assignable to `Shape`. The compiler cannot verify that the runtime `propertySchemas` matches the compile-time `Shape`. Hence the `as unknown as Shape`.

**What it reveals**: The input type `T` of `dna.object({ ... })` is not transformed into a verified `Record<string, IDnaType>`. The factory accepts `Record<string, any>` and assumes it will be a record of schemas.

### 8.5 `readonly()` at the base already requires a cast

**Observation**: In `DnaBase`:

```ts
readonly(): DnaType<$ReadonlyValue<T>, $ReadonlyValue<I>> & Omit<this, "_output" | "_input" | "readonly"> {
  const r = cloner(this, cl => cl._core.meta.readonly = true);
  return r as unknown as DnaType<$ReadonlyValue<T>, $ReadonlyValue<I>> & Omit<this, "_output" | "_input" | "readonly">;
}
```

**Root cause**: Even the base class cannot prove that cloning and setting a metadata flag changes the TS type. `cloner(this, fn)` returns `this` (same type), but the method claims to return a transformed type.

**What it reveals**: The type-level effects of mutations (metadata, wrappers, modifiers) are not modeled in `cloner`. The cast is needed at the very bottom of the hierarchy.

### 8.6 Wrapper class `this` vs interface `this` mismatch

**Observation**: `DnaType` wrapper methods return `IDnaOptional<this>`, `IDnaDefault<this>`, etc. The implementation creates an instance of `DnaOptional<this>`, `DnaDefault<this>`, etc.

**Root cause**: `DnaDefault<this>` is structurally `DnaDefault<this>` (class with `_ts = TsType<$Output<this>, $Input<this>>`). `IDnaDefault<this>` is the interface with `Out = $Output<this>`, `In = $Input<this>`. In theory they match. In practice, TypeScript cannot prove the match because:

- `DnaDefault` does not explicitly `implements IDnaDefault<Inner>`.
- The class uses `declare _input: In; declare _output: Out;` but the interface inherits `readonly _input: In; readonly _output: T;` from `IDnaType`.
- `_DnaWrapper` declares its own `_input` and `_output`, shadowing `DnaBase`'s declarations.

**What it reveals**: The shadowing of `_input`/`_output` declarations between `DnaBase` and `_DnaWrapper` creates duplicate, potentially incompatible property declarations.

### 8.7 `bindMethods` is `any`

**Observation**: `bindMethods` is typed as:

```ts
export const bindMethods = (inst: any, ...methodNames: string[]): any => { ... }
```

**Root cause**: Every schema created by `initDna` goes through `bindMethods`. Because `initDna` returns `InstanceType<Cls>` and `bindMethods` returns `any`, the resulting type is weakened at the exact point where the object is constructed.

**What it reveals**: The construction pipeline throws away precise type information at the first step.

### 8.8 The `as unknown as` casts are not isolated; they are structural

Collecting the casts that appear in the builder layer alone:

- `api-primitives.ts`: `as unknown as IDnaObject<...>`, `as unknown as IDnaArray<...>`
- `dna-interfaces.ts`: `as unknown as Shape`, `as unknown as DnaObject<Shape>`, `as unknown as DnaType<$ReadonlyValue<...>>`
- `api-enhanced.ts`: `as unknown as DnaArray<T>`

**Root cause**: Each cast is at a boundary where the implementation class does not structurally satisfy the public interface. They are not workarounds for edge cases; they are the normal way the factory returns values.

**What it reveals**: The public interface is a wish, and the implementation class is a different shape. Casts are the glue.

### 8.9 Why the versions did not fix this

- `675abe8` (July 2026) introduced `DnaBase`/`DnaType` and `TsType`. It established the *concept* of `_ts`, but did not retype `initDna`, `cloner`, or the factories.
- `528293a` (July 2026) added `$Output`/`$Input` helpers and `fromDna`. It improved the helper algebra, but did not remove the casts.
- `c0ac517` (July 2026) added `DnaXorUnion` and `$Xor`. It added more type features without addressing the underlying mismatch.

Each version refined the *surface* (more helpers, more interfaces) without retyping the *constructor pipeline* (`initDna`, `bindMethods`, `cloner`).

### 8.10 Nine root causes for persistent bad typing

1. **Interface-class circularity**: `IDnaType` extends `DnaBase`, making the public contract identical to the implementation.
2. **Constructor pipeline untyped**: `initDna` and `bindMethods` are generic over `new () => any`, not over the public interface.
3. **Naming collision**: `DnaObject`/`DnaArray` are interfaces; `_DnaObject`/`_DnaArray` are classes. `DnaType` is a class.
4. **Shape not proven**: `Shape` generic in `_DnaObject` is not tied to `_core.seed.propertySchemas`.
5. **Base methods cast**: Even `DnaBase.readonly()` cannot be typed without `as unknown as`.
6. **Wrapper shadowing**: `_DnaWrapper` redeclares `_input`/`_output`, shadowing `DnaBase`.
7. **No explicit `implements`**: `_Dna*` classes do not `implements Dna*` or `IDna*`.
8. **Cumulative casts**: `as unknown as` is used at every boundary, hiding the structural mismatch.
9. **Consumer packaging gap**: `@ytn/schvalid` cannot resolve `@ytn/dna/toJs`, so the types are never exercised end-to-end.

### 8.11 Conclusion

The DNA type system is conceptually sound (three-layer model, `_ts` proof, dual-track input/output). However, the **constructor and cloning pipeline was never retyped to produce the public interfaces**. The public types are declared, but the factories return concrete classes through an untyped `new () => any` mechanism. This is why `as unknown as` appears at every boundary: the compiler is being told to trust that the concrete shape matches the public shape, instead of being given a proof.

## 9. Recommendations

Three repair strategies are possible, ordered from least to most invasive.

### 9.1 Option A — Minimal: type the constructor pipeline

**What to do**

1. Retype `initDna` so it returns the public interface, not `InstanceType<Cls>`:

```ts
export const initDna = <
  T,
  I,
  _ts extends TsType<T, I>,
  Cls extends new () => IDnaType<T, I, _ts>
>(
  cls: Cls,
  state?: State,
  meta?: string | tsDnaInnerMeta
): IDnaType<T, I, _ts> => { ... }
```

2. Retype `bindMethods` to preserve the instance type:

```ts
export const bindMethods = <T>(inst: T, ...methodNames: string[]): T => { ... }
```

3. Add explicit `implements` to concrete classes:

```ts
export class _DnaArray<S extends IDnaType, _ts extends TsType<...>>
  extends DnaType<...>
  implements DnaArray<S> { ... }
```

**Pros**: Preserves the current architecture. Fixes the casts at the source. Low churn.
**Cons**: `initDna` still constructs concrete classes; the interface-class duality remains. It treats the symptom (untyped construction) but not the disease (interface and class are too coupled).

### 9.2 Option B — Recommended: separate the public interface from the class contract

**What to do**

1. Make `IDnaType` a *minimal* interface (do not `extends DnaBase`).
2. Make `DnaBase` `implements IDnaType<T, I, _ts>`.
3. Keep `DnaType` as the public-facing class and make `_Dna*` classes implement the corresponding `Dna*`/`IDna*` interfaces.
4. Retype `cloner` to be generic over the public interface:

```ts
export const cloner = <T extends IDnaType>(schema: T, fn: (cl: T) => void): T => { ... }
```

5. Retype `initDna` to return a public interface:

```ts
export const initDna = <
  T,
  I,
  _ts extends TsType<T, I>
>(
  cls: new () => IDnaType<T, I, _ts>,
  state?: State,
  meta?: ...
): IDnaType<T, I, _ts> => { ... }
```

6. For `_DnaObject`, change the `_core.seed.propertySchemas` type from `Record<string, IDnaType>` to a shape-aware type (e.g. `Record<keyof Shape, IDnaType>`) or validate `shape` input at the `dna.object()` factory.

**Pros**: Restores the interface/class separation. Makes `implements` the source of truth. Removes most `as unknown as` casts. `IDna*` becomes a real contract.
**Cons**: More lines changed. `IDnaType` no longer carries `DnaBase` members implicitly, so `this['_ts']` patterns need to be updated.

**Why this is the best option**: It fixes the structural cause without discarding the three-layer model. The public interface becomes a contract, the class becomes the implementation, and the factory returns the contract.

### 9.3 Option C — Radical: collapse the public interface into the concrete class

**What to do**

1. Rename `_DnaArray` → `DnaArray`, `_DnaObject` → `DnaObject`.
2. Delete the `DnaArray`/`DnaObject` interfaces.
3. Expose the concrete classes as the public API.
4. Keep `IDnaType` as a base interface but make it small.

**Pros**: Simplest mental model. No more name collision. No more `as unknown as` between class and interface.
**Cons**: Leaks implementation details in public `.d.ts`. Loses the ability to refactor internal classes without breaking the public API. Zod-style structural hiding is lost.

**Verdict**: Too aggressive. It solves the typing problem by removing the interface layer, but it weakens the public contract.

### 9.4 Recommended first step

Start with **Option B**, but only on the builder files that cause the most casts:

1. `src/builder/dna-core.ts`: retype `initDna` and `bindMethods`.
2. `src/builder/dna-interfaces.ts`: decouple `IDnaType` from `DnaBase`; add `implements` to `_DnaArray`, `_DnaObject`, `_DnaWrapper`, `DnaDefault`, etc.
3. `src/builder/api-primitives.ts`: remove `as unknown as` from `array`, `object`, and the wrapper helpers.
4. Add `tests/assignability.test.ts` or `tests/type-regression.test.ts` with `expectTypeOf` checks for each public factory.

### 9.5 What to avoid

- Do **not** add more `as unknown as` or `any` parameters.
- Do **not** keep `IDnaType extends DnaBase`; it makes the interface an implementation copy.
- Do **not** change the runtime bytecode (`tsDna`) or the `toJs` generator; the runtime is not the source of the type failures.

---

## 10. Verification Addendum (2026-08-02 13:35 +02:00)

This section records an independent verification pass against the actual source tree, run on the environment below. It does not replace Sections 1–9; it corrects and supplements them where the live code disagrees with the audit.

**Environment**: Node `v26.5.0` · `typescript` (alias `@typescript/typescript6`) `6.0.2` · `@typescript/native` (tsgo preview, aliased as `typescript@^7.0.2`) `7.0.2` · `tsdown` `0.22.14` (with nested `rolldown-plugin-dts@0.25.2`) · git `HEAD 7e81590` ("[@ytn/dna] Bump jose to ^6.2.7 and remove test-out.txt", committed 2026-08-01T18:43:10+02:00).

### 10.1 Confirmed against current source

- **§8.2** (`initDna` returns `InstanceType<Cls>`, generic over the constructor and not the public interface) — confirmed verbatim in `src/builder/dna-core.ts:29`.
- **§8.4 / §8.5** (`_DnaObject.shape` and `DnaBase.readonly()` cast with `as unknown as`) — confirmed verbatim at the cited call sites in `src/builder/dna-interfaces.ts`.
- **§8.3** (`DnaObject`/`DnaArray` are public interfaces; `_DnaObject`/`_DnaArray` are the private classes; factories in `api-primitives.ts` cast `_DnaObject<...>` / `_DnaArray<...>` to the public interface with `as unknown as`) — confirmed.
- **§8.7** (`bindMethods` typed as `(inst: any, ...methodNames: string[]): any`) — confirmed verbatim in `dna-core.ts:19`.

### 10.2 Refuted / inaccurate

- **§8.1** — the claim `export interface IDnaType<...> extends DnaBase<T, I, _ts> {}` does **not** match the current source. The actual code (`dna-interfaces.ts:179`, `:310`) is the *opposite* relationship: `IDnaType` is a standalone interface, and `export class DnaBase<...> implements IDnaType<T, I, _ts>`. This is already the separation the audit itself recommends as "Option B" (§9.2), so root cause #1 in §8.10 is not currently present as described.

### 10.3 Important context not in the original audit

- As of this verification, `packages/dna/src` has **uncommitted working-tree changes** on top of `HEAD` (`git diff --stat` shows `dna-interfaces.ts`, `api-primitives.ts`, `api-enhanced.ts`, `helpers.types.ts`, `api-builder.types.ts`, `fromDna/index.ts` modified, plus `tests/assignability.test.ts`). The committed `HEAD` state has a *simpler*, single-class model (`DnaType implements IDnaType<T, I>`, no `_ts` phantom parameter); the `DnaBase`/`DnaType` split with `_ts: TsType<T, I>` described in §3.1/§4.2 only exists in this uncommitted work-in-progress, not in git history at `HEAD`. The audit's commit table (Section 5) should not be read as reflecting the exact current working tree.
- **New finding, not covered by the audit**: type-checking `src/**/*.ts` in isolation (no `tests/`, no `sandbox/`) with the classic JS compiler (`node_modules/typescript/bin/tsc6`, i.e. TS 6.0.2) crashes after ~65s with:
  ```
  FATAL ERROR: Ineffective mark-compacts near heap limit - JavaScript heap out of memory
  ```
  after allocating >4 GB of V8 heap. This is not a clean "Type instantiation is excessively deep" diagnostic; it is a genuine combinatorial blow-up in the number of type instantiations, most likely triggered by the uncommitted `_ts` phantom-parameter change interacting with the recursive `$*` helpers (`$DnaObjectOutput`, `$Output`/`$Input`, `$SafeExtendShape`) across the ~2700-line class hierarchy in `dna-interfaces.ts`.
  With the native preview compiler (`@typescript/native` 7.0.2, resolved via `npx tsc`), the same `src`-only check instead stalls indefinitely with negligible CPU usage (no OOM, no error), pointing to a separate issue in the native/tsgo preview rather than a second instance of the same root cause.
  This should be treated as the current top-priority defect in the working tree — worse than any individual `as unknown as` cast, since it currently prevents `tsc --noEmit` from ever completing on `src/` alone.

### 10.4 Recursive test suite findings

A separate `tsc --noEmit` attempt on the **test** tree revealed a second, related defect: the recursive test cases in `tests/zod-test-suite/recursive-types.ts` and `tests/zod-test-suite/lazy.ts` cannot be type-checked.

**Symptoms**

- `tests/zod-test-suite/recursive-types.ts` reports `'subcategories' implicitly has return type 'any'`, `Type of property 'subcategories' circularly references itself in mapped type`, and `Type instantiation is excessively deep and possibly infinite`.
- `tests/zod-test-suite/lazy.ts` reports `Cannot find name 'complicatedCategoryDna'` (a missing test declaration) and `Type instantiation is excessively deep and possibly infinite`.
- A full `tsc --noEmit` over `packages/dna` (including tests) crashes with `JavaScript heap out of memory`.

**Root cause: Zod uses direct `_output` access; DNA uses `_ts.output` indirection**

Zod's object output is computed as:

```ts
type objectOutputType<Shape, ...> = { [k in keyof Shape]: Shape[k]["_output"] };
```

Each `ZodType` exposes `_output: T` and `_input: I` directly. The circularity, when it occurs, passes through declared class properties, which TypeScript can resolve.

DNA's object output is computed as:

```ts
export type $DnaObjectOutput<T extends Record<string, any>> = {
  [K in keyof T]: $DnaOut<T[K]>
};
export type $DnaOut<S> = S extends { _ts: { output: any } } ? S["_ts"]["output"] : unknown;
```

The extra `TsType` object (`_ts`) means the mapped type expands through `Shape[K]["_ts"]["output"]`, and any circular schema has to expand `TsType<Out, In>` → `output` → another `TsType` → another `output`. TypeScript cannot lazily resolve this indirection inside a mapped type; the expansion becomes infinite.

**Consequence**

The fix belongs in the type inference layer, **not in the tests**. Changing the tests (e.g. forcing `dna.lazy()` or adding `as unknown as` casts) makes them test a different API shape and invalidates the comparison with Zod.

**Proposed experiment**

Replace the `TsType` indirection in the output/input extraction helpers:

```ts
export type $DnaOut<S> = S extends { _output: infer O } ? O : unknown;
export type $DnaIn<S>  = S extends { _input:  infer I } ? I : unknown;
```

`DnaBase` already declares `readonly _output: T` and `readonly _input: I` (line 280-282 of `dna-interfaces.ts`). If the helpers read these properties directly, the mapped type `$DnaObjectOutput<Shape>` becomes `{ [K in keyof Shape]: Shape[K]["_output"] }`, structurally closer to Zod and potentially resolvable by TypeScript for recursive schemas.

This is an architectural change in `src/types/helpers.types.ts`. It should be evaluated against `src/` first, then against the recursive test files, before touching any test.

### 10.5 Experiment result: direct `_output` / `_input` extraction

The experiment in §10.4 was attempted on the working tree.

**Changes made**

```ts
// src/types/helpers.types.ts
export type $DnaOut<S> = S extends { _output: infer O } ? O : unknown;
export type $DnaIn<S>  = S extends { _input:  infer I } ? I : unknown;
```

Plus two call sites in `src/builder/dna-interfaces.ts` (`default` and `prefault` signatures) changed from `this['_ts']['output']` / `this['_ts']['input']` to `this['_output']` / `this['_input']`.

**Result**

`npx tsc --noEmit` in `packages/dna` with `NODE_OPTIONS='--max-old-space-size=8192'` still crashed:

```
FATAL ERROR: Ineffective mark-compacts near heap limit - JavaScript heap out of memory
```

after allocating ~8 GB of V8 heap. The check did not complete.

**Conclusion**

Removing the `TsType` indirection is **not sufficient**. The circularity is deeper than the `_ts` object. The mapped type `$DnaObjectOutput<Shape>` still expands infinitely because `DnaObject` (and `IDnaObject`) derive their `_output` from `Shape` itself. As long as `Shape` contains the same `DnaObject` recursively, the mapped type cannot terminate.

This rules out the "direct `_output`" quick fix. The viable remaining paths are:

- **Solution 3**: allow `dna.object<Out, In>(shape)` with explicit output/input generics (Zod-style `z.ZodType<T>`).
- **Solution 7**: refactor `DnaObject` so it no longer computes output from a mapped type over `Shape`.
- **Temporary workaround**: exclude `recursive-types.ts` / `lazy.ts` from `tsconfig.base.json` until a structural fix is implemented.

### 10.6 Experiment result: explicit `Out` / `In` generics on `DnaObject`

The experiment in §10.5 (Solution 3) was attempted.

**Changes made**

1. `DnaObject` interface changed to four generics:
   ```ts
   export interface DnaObject<
     out Shape extends Record<string, any> = Record<string, any>,
     out Out = $DnaObjectOutput<Shape>,
     out In = $DnaObjectInput<Shape>,
     out _ts extends TsType<Out, In> = TsType<Out, In>
   > extends DnaType<Out, In, _ts> { ... }
   ```

2. `_DnaObject` class updated with the same four generics.
3. `dna.object`, `dna.strictObject`, and `dna.looseObject` updated to accept `Out`/`In`:
   ```ts
   export function object<
     T extends Record<string, any>,
     Out = $DnaObjectOutput<$Writeable<T>>,
     In = $DnaObjectInput<$Writeable<T>>
   >(shape: T, meta?: string | tsDnaMeta): DnaObject<$Writeable<T>, Out, In> { ... }
   ```

**Result**

`npx.cmd tsc6 --noEmit` in `packages/dna` with `NODE_OPTIONS='--max-old-space-size=8192'` still crashed with `JavaScript heap out of memory` after ~225s. The full project type-check did not complete.

**Conclusion**

Adding explicit `Out`/`In` generics is also **not sufficient**. The defaults `Out = $DnaObjectOutput<$Writeable<T>>` and `In = $DnaObjectInput<$Writeable<T>>` are still evaluated by TypeScript whenever the function is used without an explicit output type. As long as `Shape` contains a recursive reference, the default expansion fires and the mapped type becomes infinite.

For Solution 3 to work, the user would have to *always* provide explicit `Out`/`In` (e.g. `const CategoryDna: DnaType<Category, Category> = dna.object(...)`) and the defaults would have to be disabled or replaced by `unknown`. But that changes `dna.object`'s inference for non-recursive calls too, breaking the ergonomics of the current API.

**Rule out**: explicit generics as a minimal fix.

**Remaining viable paths**

- **Solution 7**: remove `$DnaObjectOutput` / `$DnaObjectInput` mapped types entirely and rebuild `DnaObject` on an interface/structural model that TypeScript can resolve recursively (major architecture change).
- **Temporary workaround**: exclude `recursive-types.ts` / `lazy.ts` from `tsconfig.base.json` to stop `tsc` from crashing while the architecture is fixed.

**Status of the working tree**: the experimental changes were reverted after the failed check.

---

## 11. Proposed Zod-inspired architecture for recursive objects

This section proposes a structural fix for the circular-type failures described in §10. It is inspired by the way Zod V4 separates `Output` / `Input` from the runtime `Shape`.

### 11.1 What Zod does differently

Zod V4 schema classes inherit from:

```ts
abstract class ZodType<Output, Def, Input = Output> { ... }
```

Key points:

- `Output` and `Input` are **type parameters** of the class, not derived from `Shape`.
- `ZodObject<Shape, UnknownKeys, Catchall, Output, Input>` stores `Output`/`Input` directly.
- `objectOutputType<Shape>` is a helper, but the `Output` of a concrete `ZodObject` is a **concrete type argument**.
- A recursive schema is typically declared with an explicit type:
  ```ts
  const Category: z.ZodType<Category> = z.object({ ... });
  ```
  or via `z.lazy(() => z.object<...>({ ... }))`.

This means the circularity is **named** (`Category`) and does not pass through a mapped type.

### 11.2 Target model for DNA

Adopt the same separation:

```ts
export interface IDnaType<T = unknown, I = T, Def = any> {
  readonly _output: T;
  readonly _input: I;
  readonly _def: Def;
  // ... methods
}
```

`DnaBase` becomes:

```ts
export abstract class DnaBase<T = unknown, I = T, Def = any> implements IDnaType<T, I, Def> {
  abstract readonly _def: Def;
  // _output and _input are phantom; no TsType object
}
```

`DnaObject` becomes:

```ts
export interface DnaObject<
  out Shape extends Record<string, any> = Record<string, any>,
  out T = unknown,
  out I = T,
  out _def = { propertySchemas: Shape, objType: tsDnaObjectType, ... }
> extends DnaBase<T, I, _def> {
  readonly shape: Shape;
  // methods return DnaObject<..., T, I> variants
}
```

### 11.3 How the output type is produced

Remove the mapped types `$DnaObjectOutput` and `$DnaObjectInput`. Instead:

1. **Factory with explicit output**:
   ```ts
   const CategoryDna: DnaObject<any, Category, Category> = dna.object<Category, Category>({
     name: dna.string(),
     subcategories: dna.array(CategoryDna).optional(),
   });
   ```

2. **Factory with default (non-recursive only)**:
   ```ts
   const UserDna = dna.object({
     name: dna.string(),
   });
   // infer T = { name: string }, I = { name: string }
   ```
   The default inference should not use a mapped type over the whole `Shape`. It should read each property's `_output` / `_input` directly:
   ```ts
   type DnaObjectOutput<Shape> = { [K in keyof Shape]: Shape[K]["_output"] };
   type DnaObjectInput<Shape> = { [K in keyof Shape]: Shape[K]["_input"] };
   ```
   No conditional, no `TsType` object.

3. **Lazy for recursion**:
   ```ts
   const CategoryDna: DnaType<Category, Category> = dna.lazy(() =>
     dna.object<Category, Category>({ ... })
   );
   ```

### 11.4 Files to change

| File | Change |
|------|--------|
| `src/types/helpers.types.ts` | Remove `TsType`; simplify `$DnaOut`/`$DnaIn` to `S["_output"]` / `S["_input"]`; remove `$DnaObjectOutput` / `$DnaObjectInput` mapped types; keep only `DnaObjectOutput` / `DnaObjectInput` as direct-property mapped types. |
| `src/builder/dna-interfaces.ts` | Make `IDnaType` three generic parameters `<T, I, Def>`; remove `_ts`; update `DnaBase`, `DnaType`, `DnaObject`, `_DnaObject`. |
| `src/builder/dna-core.ts` | Update `initDna` and `bindMethods` generics to `DnaBase<T, I, Def>`. |
| `src/builder/api-primitives.ts` | Update `dna.object` to accept `<T, I>`; default `T`/`I` to `unknown` if not provided, and use `DnaObjectOutput` only in the default case. |
| `src/builder/api-enhanced.ts` and combinators | Update all `IDnaType<_, _, _ts>` references to `IDnaType<T, I, Def>`. |

### 11.5 Expected trade-offs

**Pros**:
- Recursive objects with explicit `T`/`I` become type-safe without circularity.
- Runtime is unchanged (only `_def` moves from `_core` to a typed generic).
- Aligns DNA with the Zod model that already works.

**Cons**:
- Non-annotated recursive objects (`const X = dna.object({ get x() { return X; } })`) still require `dna.lazy()` or an explicit type.
- Large surface change: every `DnaType`, `IDnaType`, `_ts`, and helper type must be updated.
- Breaks existing `.d.ts` consumers until the package is rebuilt.

### 11.6 Migration path

1. Land the architecture change in a branch.
2. Temporarily exclude `recursive-types.ts` / `lazy.ts` from `tsconfig.base.json`.
3. Convert the recursive tests to use `dna.lazy()` or explicit `DnaType<...>` annotations.
4. Restore the tests in `tsconfig.base.json`.
5. Run `npm.cmd test -w @ytn/dna` and `npx.cmd tsc6 --noEmit` before merging.

---

## 12. What Zod V4 actually does (source inspection)

This section documents the actual Zod V4 source in `node_modules/zod/src/v4/core/schemas.ts` as of `zod@4.4.3`. It is the authoritative basis for the architectural proposal in §11.

### 12.1 `output` / `input` are NOT class type parameters

`$ZodObject` is declared as:

```ts
export interface $ZodObject<
  out Shape extends Readonly<$ZodShape> = Readonly<$ZodShape>,
  out Params extends $ZodObjectConfig = $ZodObjectConfig,
> extends $ZodType<any, any, $ZodObjectInternals<Shape, Params>> {}
```

`$ZodType<any, any, ...>` means the `Output` and `Input` class parameters are **`any`**. The concrete `output` and `input` are stored inside `$ZodObjectInternals`.

### 12.2 The real `output` / `input` live in `internals`

```ts
export interface $ZodObjectInternals<
  out Shape extends $ZodShape = $ZodShape,
  out Config extends $ZodObjectConfig = $ZodObjectConfig,
> extends _$ZodTypeInternals {
  def: $ZodObjectDef<Shape>;
  config: Config;
  output: $InferObjectOutput<Shape, Config["out"]>;
  input: $InferObjectInput<Shape, Config["in"]>;
  ...
}
```

`output` and `input` are properties of the internals object, not generics of the class. This is the mirror of DNA's `_ts` object. However, the critical difference is that `$ZodType` itself is not generic in `Output`/`Input` for `$ZodObject`.

### 12.3 `$InferObjectOutput` is a mapped type, like DNA

```ts
export type $InferObjectOutput<T extends $ZodLooseShape, Extra extends Record<string, unknown>> =
  util.Prettify<{
    -readonly [k in keyof T as T[k] extends OptionalOutSchema ? never : k]: T[k]["_zod"]["output"];
    -readonly [k in keyof T as T[k] extends OptionalOutSchema ? k : never]?: T[k]["_zod"]["output"];
  } & Extra>;
```

This is structurally equivalent to DNA's `$DnaObjectOutput`. It also reads `T[k]["_zod"]["output"]` for each property.

### 12.4 `output<T>` / `input<T>` are conditional extractors

```ts
export type input<T> = T extends { _zod: { input: any } } ? T["_zod"]["input"] : unknown;
export type output<T> = T extends { _zod: { output: any } } ? T["_zod"]["output"] : unknown;
```

These helpers extract `_zod.output` and `_zod.input` at the use site, not at the class level.

### 12.5 Why this works for recursion

Because `$ZodObject` extends `$ZodType<any, any, ...>`, TypeScript does **not** try to resolve `Output`/`Input` as class parameters. The recursive reference `Shape[k]["_zod"]["output"]` is resolved only when an external consumer calls `output<T>` or `z.infer<T>`. As long as the recursive `ZodObject` is typed with an explicit interface (e.g. `const Category: z.ZodType<Category> = z.object(...)`), the `_zod.output` of the recursive property is a **named reference** to `Category`, not an expansion of the same mapped type.

### 12.6 The DNA mismatch

DNA currently does the opposite:

```ts
export interface DnaObject<Shape, _ts = TsType<$DnaObjectOutput<Shape>, $DnaObjectInput<Shape>>>
  extends DnaType<$DnaObjectOutput<Shape>, $DnaObjectInput<Shape>, _ts>
```

`$DnaObjectOutput<Shape>` is passed as a class type parameter. TypeScript must resolve it at the class declaration. When `Shape` contains the same `DnaObject`, the class definition becomes self-referential through its own type parameters. This is the source of the circularity error.

### 12.7 Required change for DNA

To match Zod, DNA must:

1. Keep `Output`/`Input` out of `DnaType`'s class parameters for `DnaObject`.
2. Store `output`/`input` inside `_core` (or a `def` object) instead of `TsType`.
3. Make `DnaObject` extend `DnaType<any, any, DnaObjectInternals<Shape>>`.
4. Make `$Output<T>` / `$Input<T>` read `T["_core"]["output"]` / `T["_core"]["input"]` conditionally.

This is a larger change than §11 proposed. It means `DnaBase` / `DnaType` must accept an opaque `Def` type parameter, not `Output`/`Input`, for recursive classes.

---

## 13. Diagnostic: `tsc6` OOM resolution

This section records the live diagnostic session that isolated the source of the `tsc6 --noEmit` out-of-memory failure.

### 13.1 Initial state

`npx tsc6 --noEmit` in `packages/dna` crashed with `FATAL ERROR: JavaScript heap out of memory` after consuming ~4 GB of V8 heap. The working tree had the following uncommitted changes on top of `HEAD`:

- `_ts` phantom parameter added to `IDnaType` / `DnaBase`.
- `DnaObject` / `_DnaObject` attempted with explicit `Out` / `In` generics (reverted).
- `partial()` temporarily changed to `DnaObject<$DnaPartialShape<Shape>>` (reverted).

### 13.2 Hypotheses tested

| Hypothesis | Test | Result |
|---|---|---|
| `TsType` indirection causes the circularity | Change `$DnaOut` / `$DnaIn` to read `_output` / `_input` directly | OOM still occurs |
| Explicit `Out` / `In` generics fix recursion | Add `Out` / `In` to `DnaObject` / `dna.object` | OOM still occurs |
| `partial()` change causes OOM | Revert `partial()` to original | OOM still occurs |
| TypeScript installation is broken | `npm install` + update `tsx` to 4.23.5 | OOM still occurs |
| `recursive-types.ts` / `lazy.ts` trigger OOM | Exclude `**/tests/zod-test-suite/lazy.ts` and `**/tests/zod-test-suite/recursive-types.ts` | OOM still occurs |
| All `packages/dna/tests/` trigger OOM | Exclude `packages/dna/tests/**/*.ts` and `**/sandbox/**/*.ts` | **OOM resolved** |

### 13.3 Conclusion of the diagnostic

The OOM is **not** caused by `src/` alone. `src/` has type errors but completes. The OOM is triggered by **test and sandbox files** in `packages/dna`. These files force the type checker to instantiate circular schema types that the current `$DnaObjectOutput` mapped type cannot resolve.

### 13.4 Current working `tsconfig.base.json` exclude

```json
"exclude": [
  "**/node_modules",
  "**/tests/json-schema-suite/bin/*",
  "packages/dna/tests/**/*.ts",
  "**/sandbox/**/*.ts"
]
```

This is a **temporary workaround**, not a fix. It allows `npx tsc6 --noEmit` to finish and report the actual type errors in `src/`.

### 13.5 Remaining `src/` errors (first pass)

After the OOM is avoided, `tsc6` reports errors in:

- `packages/dna/src/builder/dna-interfaces.ts`
  - `DnaObject` / `DnaArray` `readonly()` return type incompatibility.
  - `_DnaObject` not assignable to `DnaObject` due to `default` / `prefault` parameter invariance.
- `packages/dna/src/fromDna/index.ts`
  - `DnaObject` / `DnaArray` not exported (suggests `_DnaObject` / `_DnaArray` should be used, or re-exported).
  - `DnaCheckProperty` schema type mismatch (`DnaBase` vs `DnaType`).

### 13.6 Next steps

1. Fix the remaining `src/builder/dna-interfaces.ts` errors.
2. Fix `src/fromDna/index.ts` imports and type constraints.
3. Once `src/` is clean, re-enable `packages/dna/tests/` one file at a time.
4. For the recursive tests, implement the Zod-like architecture described in §11–12.

---

## 14. Refactor plan (Zod-like architecture)

This section documents the planned refactor to be executed in the next session. It is based on §11, §12, and the diagnostic in §13.

### 14.1 Goal

Make recursive object schemas type-check without `dna.lazy()` or explicit type annotations, by aligning DNA's type model with Zod V4:

- `Output` / `Input` must **not** be class-level generics for `DnaObject`.
- `Output` / `Input` must be stored in `_core` (or a `def` object) and extracted at use sites via conditional helpers.
- `DnaType` / `DnaBase` must become generic in an opaque `Def` type, not in `Output` / `Input`.

### 14.2 Files to change

| File | What to change |
|---|---|
| `packages/dna/src/types/helpers.types.ts` | Remove `TsType`. Replace `$DnaOut` / `$DnaIn` with `_core.output` / `_core.input` conditional access. Remove `$DnaObjectOutput` / `$DnaObjectInput` mapped types or replace them with direct `_core.output` access. |
| `packages/dna/src/builder/dna-interfaces.ts` | Redefine `IDnaType<T, I, _ts>` as `IDnaType<T, I, Def>` with `_core: BaseCore<Def>` and `_output` / `_input` declared as phantom or removed. `DnaBase` / `DnaType` take `Def` as third parameter. `DnaObject` extends `DnaType<any, any, DnaObjectDef<Shape>>` and stores `output` / `input` in `Def`. |
| `packages/dna/src/builder/dna-core.ts` | Update `initDna` and `bindMethods` to be generic over `DnaBase<any, any, Def>`. |
| `packages/dna/src/builder/api-primitives.ts` | Update `dna.object`, `dna.array`, `dna.string`, etc. to return `DnaType<any, any, Def>` with `Def` carrying `output` / `input`. |
| `packages/dna/src/builder/api-enhanced.ts` and combinators | Update all `IDnaType` references to use the new `Def` shape. |
| `packages/dna/src/fromDna/index.ts` | Fix `DnaObject` / `DnaArray` imports (use `_DnaObject` / `_DnaArray` or re-export). |
| `packages/dna/tests/zod-test-suite/recursive-types.ts` | Re-enable after the refactor. |
| `packages/dna/tests/zod-test-suite/lazy.ts` | Re-enable after the refactor. |
| `E:/Antigravity/ytn/tsconfig.base.json` | Remove `packages/dna/tests/**/*.ts` and `**/sandbox/**/*.ts` excludes once the refactor is complete. |

### 14.3 Step-by-step execution plan

1. **Backup / branch** : `git checkout -b dna/zod-like-types`.
2. **Simplify `helpers.types.ts`** :
   - Remove `TsType`.
   - Set `$DnaOut<S> = S extends { _core: { output: infer O } } ? O : unknown`.
   - Set `$DnaIn<S> = S extends { _core: { input: infer I } } ? I : unknown`.
   - Keep `$Output` / `$Input` as aliases.
3. **Redefine `IDnaType` and `DnaBase`** :
   - `IDnaType<T, I, Def>` with `_core: BaseCore<Def>`, `_output: T`, `_input: I` (phantom).
   - `DnaBase<T, I, Def>` implements `IDnaType<T, I, Def>`.
4. **Redefine `DnaObject`** :
   - `DnaObject<Shape>` extends `DnaType<any, any, DnaObjectDef<Shape>>`.
   - `DnaObjectDef<Shape>` contains `shape`, `output`, `input`, `objType`, `propertySchemas`, etc.
   - `DnaObject` declares `readonly _output: Out` and `readonly _input: In` in addition to `_core`.
5. **Update `dna.object` factory** :
   - `dna.object<Out, In>(shape)` : `Out` and `In` are explicitly computed or provided by context.
   - Default `Out` / `In` are inferred from `_core.output` / `_core.input` of each property, not from a mapped type over `Shape`.
6. **Update wrappers** (`DnaOptional`, `DnaArray`, `DnaDefault`, etc.) :
   - All extend `DnaType<any, any, Def>` with `Def` carrying `output` / `input`.
   - `DnaOptional<S extends IDnaType>` has `Def` pointing to `S` plus `optout`/`optin`.
7. **Update `fromDna/index.ts`** :
   - Replace `DnaObject` / `DnaArray` with `_DnaObject` / `_DnaArray` or re-export them.
8. **Run `npx tsc6 --noEmit` after each file group**.
9. **Re-enable tests** one by one, starting with `recursive-types.ts`.

### 14.4 Risks

- **Build output change** : `.d.ts` files will change structure, breaking consumers until a new release.
- **Runtime unchanged but compile-time heavy** : the refactor is purely type-level, but it touches many files.
- **Intermediate state may not compile** : the package may not build until step 8 is complete.

### 14.5 What to preserve

- Do **not** change `tsDna` bytecode, `toJs`, `_emitSelf`, `BaseCore` runtime logic.
- Do **not** change test data or expected runtime output.
- Do **not** add `as any` / `as unknown` except in the double-cast pattern `as unknown as T`.

### 14.6 Success criteria

1. `npx tsc6 --noEmit` in `packages/dna` completes **without OOM** and with **zero errors**.
2. `npm.cmd test -w @ytn/dna` passes.
3. `packages/dna/tests/zod-test-suite/recursive-types.ts` and `lazy.ts` can be removed from `tsconfig.base.json` exclude.

---

*Document generated from an exhaustive analysis of the `@ytn/dna` git history and current source tree. Section 10 added after an independent verification pass (see above for environment/versions). Section 11 added as a design proposal. Section 12 added after source inspection of Zod V4. Section 13 added after live OOM diagnostic. Section 14 added as a planned refactor.*

---

## 15. Devin Independent Diagnostic — 2026-08-03

This section records an independent diagnostic pass run on the current working tree (`git HEAD 7e81590` plus uncommitted changes) using TypeScript 6.0.3 / `npx.cmd tsc6`.

### 15.1 Methodology

`packages/dna/tsconfig.json` is just `{ "extends": "../../tsconfig.base.json" }`; `--showConfig` confirms it resolves as the monorepo root and would type-check `shared/**/*.ts` and `packages/**/*.ts` (including `tests/`, `sandbox/` and all other packages). Because the test/sandbox excludes in `tsconfig.base.json` are currently commented out, a full `npx tsc6 --noEmit` attempts to load the whole monorepo and is not practical.

To obtain a usable error list, a temporary `packages/dna/tsconfig.diag.json` was created, extending `../../tsconfig.base.json` but restricting `include` to `shared/**/*.ts` and `src/**/*.ts` and `exclude` to `node_modules`, `dist`, `tests` and `sandbox`. It was removed after the run. The command was:

```
npx.cmd tsc6 --noEmit -p packages/dna/tsconfig.diag.json --pretty false
```

### 15.2 Findings

1. **The full project is the whole monorepo.** `packages/dna/tsconfig.json` inherits `rootDir: "../.."` and the `include`/`files` list spans every package. This is why `tsc6` runs out of memory: the type checker is not looking at `@ytn/dna` in isolation, it is also loading every `tests/` and `sandbox/` file.

2. **Isolated `src/` check completed.** The `src`-only run reported **72** total TypeScript errors. The first 30 visible error lines split as follows:
   - **17** in `packages/dna/src/builder/dna-interfaces.ts` and `packages/dna/src/fromDna/index.ts`.
   - **13** in `shared/_archive/collection-ops.ts` and `shared/_archive/fs_ops.ts`.
   The remaining **42** errors are overwhelmingly from `shared/_archive/fs_ops.ts` (the temporary `exclude` array did not propagate the base `**/_archive` exclude).

3. **Concrete `@ytn/dna` errors (first 30 lines).**

   - `TS2430` in `src/builder/dna-interfaces.ts:254,274`: `DnaObject<Shape, _ts>` and `DnaArray<S, _ts>` incorrectly extend `DnaType<$DnaObjectOutput<...>, $DnaObjectInput<...>, _ts>`.
   - `TS2344` in `src/builder/dna-interfaces.ts:619,623`: `this` does not satisfy `DnaType<any, any, TsType<any, any>>`.
   - `TS2589` in `src/builder/dna-interfaces.ts:789`: type instantiation is excessively deep and possibly infinite.
   - `TS2416` in `src/builder/dna-interfaces.ts:793,2166`: `optional` / `readonly` not assignable to the base interface.
   - `TS2339` in `src/builder/dna-interfaces.ts:878`: `_objType` does not exist on `DnaObject<Record<string, any>, ...>`.
   - `TS2322` in `src/builder/dna-interfaces.ts:967,2158,2159,2163,2027` and `src/fromDna/index.ts`: `this`, `Inner`, and `IDnaType<...>` not assignable to expected `DnaObject` / `DnaType` shapes.
   - `TS2551` in `src/fromDna/index.ts:168,207,487`: `DnaObject` / `DnaArray` do not exist on the module export; did you mean `_DnaObject` / `_DnaArray`?
   - `TS2345` in `src/fromDna/index.ts:288`: `DnaCheckProperty` not assignable to `tsDnaCheck` / `DnaCheckProperty`.

4. **Surface of casts and internal markers.** A search of `packages/dna/src` showed:
   - `as unknown as`: 20 occurrences.
   - `_ts` token: 44 occurrences.

5. **Constructor pipeline remains untyped.** `bindMethods(inst: any, ...): any` and `initDna<Cls extends new () => any>(...): InstanceType<Cls>` are still in `src/builder/dna-core.ts`, and `src/types/helpers.types.ts` still uses `TsType<Out, In>` and the `_ts` indirection.

### 15.3 Interpretation

The working tree matches the state described in Sections 10–13: the `_ts` phantom type is still active, `DnaObject`/`DnaArray` are still circular through `$DnaObjectOutput`/`$DnaObjectInput`, and the public/private class split (`_DnaObject` vs `DnaObject`) still produces assignability and import errors. The good news is that `src/` alone is now type-checkable without crashing; the OOM is purely a function of loading `tests/` and `sandbox/` through the monorepo `tsconfig.json`.

### 15.4 Suggested next step

Proceed with the Section 14 Zod-like refactor incrementally, using a local `packages/dna/tsconfig.diag.json` that includes only `src/` and `shared/` (and excludes `**/_archive`) to verify each file group. Only re-enable the full monorepo `tsc6 --noEmit` once `packages/dna/src` is clean and the recursive test files can be compiled without infinite type instantiation.

---

## 16. Direct-Fix Assessment and Proposed Implementation Plan

This section documents the immediate attempt to fix the `packages/dna/src` errors reported in Section 15 and explains why a direct patch is not viable. It also turns the Zod-like architecture described in Section 14 into an executable checklist.

### 16.1 Why direct patches are insufficient

The 17 concrete `packages/dna/src` errors are not self-contained bugs. They are symptoms of the same structural mismatch:

- `DnaObject` and `DnaArray` are **public interfaces** that extend the concrete class `DnaType`, but their own methods (`readonly()`, `partial()`, etc.) return more specific types that do not match the base class return types. The `TS2430` errors at `dna-interfaces.ts:254,274` are exactly this: an interface cannot extend a class whose own `readonly()` method returns a type that the interface cannot assign back to.
- `DnaBase` methods use `this` as a type. `this` in `DnaBase` is `DnaBase`, not `DnaType`. Any helper that expects `DnaType<any, any, TsType<any, any>>` (e.g. `brand`, wrappers, combinators) fails with `TS2344` because `DnaBase` is not a `DnaType`.
- `DnaObject`'s `Out`/`In` are computed from `$DnaObjectOutput<Shape>` and `$DnaObjectInput<Shape>`. These are mapped types that, for any recursive `Shape`, expand forever. `TS2589` and the `tsc6` OOM both originate here.
- The public/private split means `fromDna/index.ts` tries to instantiate `DnaObject`/`DnaArray` as runtime values, but they are not exported as values; only `_DnaObject` and `_DnaArray` are. A quick import rename to `_DnaObject`/`_DnaArray` would fix `TS2551`, but it would not fix `DnaCheckProperty` assignability (`TS2345`) or the object-output circularity.

A patchwork of `as unknown as T` casts at each call site would silence `tsc6`, but it would violate the project's prohibition on hiding type debt and it would not fix the recursive-object OOM. A real fix must change the type model.

### 16.2 Proposed implementation plan (executable checklist)

The only direct path to a clean `npx tsc6 --noEmit` is to implement the Zod-like architecture from Section 14. Below is a concrete order of operations, designed to be executed one step at a time with a local `packages/dna/tsconfig.diag.json` for verification.

1. **Create a local diagnostic tsconfig**.
   ```
   packages/dna/tsconfig.diag.json
   ```
   - `extends: "../../tsconfig.base.json"`
   - `include: ["../../shared/**/*.ts", "src/**/*.ts"]`
   - `exclude: ["**/node_modules", "**/dist", "**/tests", "**/sandbox", "**/_archive"]`

2. **Simplify `src/types/helpers.types.ts`**.
   - Remove `TsType<Out, In>`.
   - Replace `$DnaOut<S>` and `$DnaIn<S>` with `S extends { _output: infer O } ? O : unknown` and `S extends { _input: infer I } ? I : unknown`.
   - Remove `$DnaObjectOutput` and `$DnaObjectInput` mapped types (or replace them with direct `_output`/`_input` reads).
   - Update every `$Output`/`$Input` consumer to the new extraction.

3. **Refactor `src/builder/dna-interfaces.ts` (the core of the change)**.
   - `IDnaType<T, I, Def>`: only `_core: BaseCore<Def>`, `_output: T`, `_input: I`.
   - `DnaBase<T, I, Def>`: implements `IDnaType<T, I, Def>`, carries the `Def` generic in `_core`.
   - `DnaType<T, I, Def>`: extends `DnaBase` and keeps the fluent API.
   - `DnaObject<Shape, Def>` / `_DnaObject<Shape, Def>`: store `output`, `input` inside `Def`; stop deriving `T`/`I` from `Shape` at the class level.
   - `DnaArray<S, Def>`: same treatment; `Def` carries `itemSchema` and `output`/`input`.
   - Wrappers (`_DnaWrapper`, `DnaOptional`, etc.): update to `Def`-based typing, remove duplicate `_output`/`_input` declarations that shadow `DnaBase`.

4. **Retype `src/builder/dna-core.ts`**.
   - `bindMethods<T>(inst: T, ...): T` (or `T extends DnaBase`).
   - `initDna<T, I, Def>(cls: new () => IDnaType<T, I, Def>, ...): IDnaType<T, I, Def>`.
   - Add `output` and `input` fields (or getters) on `BaseCore<Def>` where the `Def` shape requires them.

5. **Update factory signatures in `src/builder/api-primitives.ts` and `src/builder/api-enhanced.ts`**.
   - `dna.object<T, I>(shape)` returns `DnaObject<Shape, Def>` with explicit `T`/`I` when provided.
   - Default inference uses direct `_output`/`_input` extraction per property, not a recursive mapped type over `Shape`.

6. **Fix `src/fromDna/index.ts` and combinators**.
   - Replace public `DnaObject`/`DnaArray` instantiations with `_DnaObject`/`_DnaArray`.
   - Update `DnaCheckProperty` constraints to `DnaType`/`DnaBase` where the new `Def` model requires it.

7. **Verify and re-enable tests**.
   - Run `npx.cmd tsc6 --noEmit -p packages/dna/tsconfig.diag.json` after each step above.
   - Once `src/` is clean, run `npm.cmd test -w @ytn/dna`.
   - Restore `packages/dna/tests/zod-test-suite/recursive-types.ts` and `lazy.ts` only when they type-check without OOM.

### 16.3 What will not be touched

To stay within the spirit of a type-only repair:

- `tsDna` opcodes and runtime `BaseCore` logic.
- `src/toJs/**` code generators.
- Test expectations and runtime behavior.
- `package.json` version or build scripts.

### 16.4 Definition of done

1. `npx.cmd tsc6 --noEmit -p packages/dna/tsconfig.diag.json` reports zero errors.
2. `npm.cmd test -w @ytn/dna` passes.
3. The full monorepo `npx.cmd tsc6 --noEmit` no longer OOM and the recursive test files can be included.

*Section added after a direct-fix attempt showed the errors are structural rather than isolated.*

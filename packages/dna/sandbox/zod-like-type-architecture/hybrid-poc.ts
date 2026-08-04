/**
 * Simplified DNA architecture proof-of-concept.
 *
 * `DnaType<T, I>` is the public contract.
 * `DnaTypeBase<T, I, Seed>` is the concrete base class.
 * `_ts` is a view on `BaseCore.seed`; `BaseCore` carries `type` explicitly.
 *
 * `parse`, `validate`, `toDna` and `toJs` are intentionally omitted.
 */

import { type $FlattenObject, type $ReadOnly } from "./test-helpers.js";
import {z} from "zod"

// ---------------------------------------------------------------------------
// Runtime core
// ---------------------------------------------------------------------------

/**
 * Minimal runtime core for a DNA schema node.
 *
 * `BaseCore` owns the runtime `seed` (the schema-specific payload) and a `type`
 * string for dispatch. `type` is passed explicitly so that `seed` does not have
 * to carry a redundant `kind` field.
 */
export class BaseCore<out Seed> {
  /** Schema-specific runtime payload (e.g. object shape, array item schema). */
  readonly seed: Seed;
  /** Public/leaf kind for dispatch. */
  readonly type: string;
  /** Raw DNA bytecode sequence, if any. */
  readonly rawDna: unknown[];

  constructor(seed: Seed, type: string, rawDna: unknown[] = []) {
    this.seed = seed;
    this.type = type;
    this.rawDna = rawDna;
  }
}

// ---------------------------------------------------------------------------
// DnaType public contract
// ---------------------------------------------------------------------------

/** Lazy output extractor: reads the `_output` field without inlining. */
/** Lazy output extractor. `DnaObject` output is computed from its `Shape`. */
export type $Output<S> = S extends DnaObject<infer Shape> ? $ObjectOutput<Shape>
  : S extends { _tag: "nullable"; inner: infer Inner } ? $Output<Inner> | null
  : S extends { _tag: "optional"; inner: infer Inner } ? $Output<Inner> | undefined
  : S extends { _tag: "array"; itemSchema: infer Item } ? $Output<Item>[]
  : S extends { _output: infer O } ? O
  : unknown;

/** Lazy input extractor. `DnaObject` input is computed from its `Shape`. */
export type $Input<S> = S extends DnaObject<infer Shape> ? $ObjectInput<Shape>
  : S extends { _tag: "nullable"; inner: infer Inner } ? $Input<Inner> | null
  : S extends { _tag: "optional"; inner: infer Inner } ? $Input<Inner> | undefined
  : S extends { _tag: "array"; itemSchema: infer Item } ? $Input<Item>[]
  : S extends { _input: infer I } ? I
  : unknown;

/**
 * Public contract of a DNA type, comparable to `z.ZodType<T, I>`.
 *
 * `T` = output type, `I` = input type.
 */
export interface DnaType<T, I = T> {
  readonly _core: BaseCore<unknown>;
  readonly _ts: unknown;
  readonly _output: T;
  readonly _input: I;

  optional(): DnaOptional<this>;
  nullable(): DnaNullable<this>;
  transform<R>(fn: (v: T) => R): DnaType<R, I>;
  refine(fn: (v: T) => boolean): DnaType<T, I>;
}

// ---------------------------------------------------------------------------
// DnaType base class
// ---------------------------------------------------------------------------

export abstract class DnaTypeBase<T, I, Seed = unknown>
  implements DnaType<T, I>
{
  readonly _core: BaseCore<Seed>;
  /** Direct view of the runtime metadata payload. */
  readonly _ts: Seed;
  readonly _output!: T;
  readonly _input!: I;

  constructor(core: BaseCore<Seed>) {
    this._core = core;
    this._ts = core.seed;
  }

  optional(): DnaOptional<this> {
    return new DnaOptional(this);
  }

  nullable(): DnaNullable<this> {
    return new DnaNullable(this);
  }

  transform<R>(fn: (v: T) => R): DnaType<R, I> {
    return new DnaTransform(this, fn);
  }

  refine(fn: (v: T) => boolean): DnaType<T, I> {
    return new DnaRefine(this, fn);
  }
}

/** Optional wrapper. */
export class DnaOptional<out Inner extends DnaType<any, any>> extends DnaTypeBase<
  any,
  any,
  { inner: Inner }
> {
  readonly _tag = "optional" as const;
  get inner(): Inner {
    return this._core.seed.inner;
  }

  constructor(inner: Inner) {
    super(new BaseCore({ inner }, "optional"));
  }
}

/** Nullable wrapper. */
export class DnaNullable<out Inner extends DnaType<any, any>> extends DnaTypeBase<
  any,
  any,
  { inner: Inner }
> {
  readonly _tag = "nullable" as const;
  get inner(): Inner {
    return this._core.seed.inner;
  }

  constructor(inner: Inner) {
    super(new BaseCore({ inner }, "nullable"));
  }
}

/** Transform schema (internal type). */
class DnaTransform<R, I, T> extends DnaTypeBase<
  R,
  I,
  { schema: DnaType<T, I>; fn: (v: T) => R }
> {
  get schema(): DnaType<T, I> {
    return this._core.seed.schema;
  }

  get fn(): (v: T) => R {
    return this._core.seed.fn;
  }

  constructor(schema: DnaType<T, I>, fn: (v: T) => R) {
    super(new BaseCore({ schema, fn }, "transform"));
  }
}

/** Refine schema (internal type). */
class DnaRefine<T, I> extends DnaTypeBase<
  T,
  I,
  { schema: DnaType<T, I>; fn: (v: T) => boolean }
> {
  get schema(): DnaType<T, I> {
    return this._core.seed.schema;
  }

  get fn(): (v: T) => boolean {
    return this._core.seed.fn;
  }

  constructor(schema: DnaType<T, I>, fn: (v: T) => boolean) {
    super(new BaseCore({ schema, fn }, "refine"));
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export class DnaString extends DnaTypeBase<string, string, {}> {
  constructor() {
    super(new BaseCore({}, "string"));
  }

  min(_n: number): this {
    return this;
  }
}

export class DnaNumber extends DnaTypeBase<number, number, {}> {
  constructor() {
    super(new BaseCore({}, "number"));
  }
}

export class DnaNull extends DnaTypeBase<null, null, {}> {
  constructor() {
    super(new BaseCore({}, "null"));
  }
}

export function dnaString(): DnaString {
  return new DnaString();
}

export function dnaNumber(): DnaNumber {
  return new DnaNumber();
}

export function dnaNull(): DnaNull {
  return new DnaNull();
}

// ---------------------------------------------------------------------------
// Object helpers
// ---------------------------------------------------------------------------

type IsOutputOptional<V extends DnaType<any, any>> = V extends { _tag: "optional" }
  ? true
  : false;

type IsInputOptional<V extends DnaType<any, any>> = V extends { _tag: "optional" }
  ? true
  : false;

type OutputOptionalKeys<T extends Record<string, DnaType<any, any>>> = {
  [K in keyof T]: IsOutputOptional<T[K]> extends true ? K : never;
}[keyof T];

type InputOptionalKeys<T extends Record<string, DnaType<any, any>>> = {
  [K in keyof T]: IsInputOptional<T[K]> extends true ? K : never;
}[keyof T];

type $OptionalOutput<T extends Record<string, DnaType<any, any>>> =
  [OutputOptionalKeys<T>] extends [never]
    ? unknown
    : { [K in OutputOptionalKeys<T>]?: T[K] extends { _tag: "optional"; _ts: { inner: infer Inner } } ? $Output<Inner> : $Output<T[K]> };

type $OptionalInput<T extends Record<string, DnaType<any, any>>> =
  [InputOptionalKeys<T>] extends [never]
    ? unknown
    : { [K in InputOptionalKeys<T>]?: $Input<T[K]> };

export type $ObjectOutput<T extends Record<string, DnaType<any, any>>> = $FlattenObject<{
  [K in Exclude<keyof T, OutputOptionalKeys<T>>]: $Output<T[K]>;
} & $OptionalOutput<T>>;

export type $ObjectInput<T extends Record<string, DnaType<any, any>>> = $FlattenObject<{
  [K in Exclude<keyof T, InputOptionalKeys<T>>]: $Input<T[K]>;
} & $OptionalInput<T>>;

export interface DnaObject<out Shape extends Record<string, DnaType<any, any>>>
  extends DnaType<any, any>
{
  readonly _ts: { shape: Shape };
  readonly shape: Shape;
}

class DnaObjectImpl<Shape extends Record<string, DnaType<any, any>>> extends DnaTypeBase<
  any,
  any,
  { shape: Shape }
> implements DnaObject<Shape>
{
  get shape(): Shape {
    return this._ts.shape;
  }

  constructor(shape: Shape) {
    super(new BaseCore({ shape }, "object"));
  }
}

export function dnaObject<T extends Record<string, any>>(
  shape: T,
): DnaObject<$ReadOnly<T>> {
  return new DnaObjectImpl(shape as $ReadOnly<T>);
}

// ---------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------

export class DnaArray<out T extends DnaType<any, any>> extends DnaTypeBase<
  any,
  any,
  { itemSchema: T }
> {
  readonly _tag = "array" as const;
  get itemSchema(): T {
    return this._core.seed.itemSchema;
  }

  constructor(itemSchema: T) {
    super(new BaseCore({ itemSchema }, "array"));
  }
}

export function dnaArray<T extends DnaType<any, any>>(itemSchema: T): DnaArray<T> {
  return new DnaArray(itemSchema);
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export class DnaUnion<S extends readonly DnaType<any, any>[]> extends DnaTypeBase<
  $Output<S[number]>,
  $Input<S[number]>,
  { schemas: S }
> {
  get schemas(): S {
    return this._core.seed.schemas;
  }

  constructor(schemas: S) {
    super(new BaseCore({ schemas }, "union"));
  }
}

export function dnaUnion<S extends readonly DnaType<any, any>[]>(
  schemas: S,
): DnaUnion<S> {
  return new DnaUnion(schemas);
}

// ---------------------------------------------------------------------------
// Lazy
// ---------------------------------------------------------------------------

export class DnaLazy<T> extends DnaTypeBase<
  T,
  T,
  { getter: () => DnaType<T> }
> {
  get getter(): () => DnaType<T> {
    return this._core.seed.getter;
  }

  constructor(getter: () => DnaType<T>) {
    super(new BaseCore({ getter }, "lazy"));
  }

  unwrap(): DnaType<T> {
    return this.getter();
  }
}

export function dnaLazy<T>(getter: () => DnaType<T>): DnaLazy<T> {
  return new DnaLazy(getter);
}

// ---------------------------------------------------------------------------
// Recursive type checks
// ---------------------------------------------------------------------------

import { type $Expect, type $ExpectSame } from "./test-helpers.js";

export type Category = { name: string; subcategories: Category[] };

export const CategoryDna: DnaLazy<Category> = dnaLazy(() =>
  dnaObject({
    name: dnaString(),
    subcategories: dnaArray(CategoryDna),
  }),
);

export type LinkedList = null | { value: number; next: LinkedList };

export const LinkedListDna: DnaLazy<LinkedList> = dnaLazy(() =>
  dnaUnion([
    dnaNull(),
    dnaObject({
      value: dnaNumber(),
      next: LinkedListDna,
    }),
  ]),
);

// Non-recursive example for shape comparison.
const Simple = dnaObject({
  name: dnaString(),
  age: dnaNumber().optional(),
  tags: dnaArray(dnaString()),
});

export type SimpleOut = $Output<typeof Simple>;

const _categoryCheck: $Expect<$ExpectSame<$Output<typeof CategoryDna>, Category>> = true;
const _categoryInCheck: $Expect<$ExpectSame<$Input<typeof CategoryDna>, Category>> = true;
const _linkedListCheck: $Expect<$ExpectSame<$Output<typeof LinkedListDna>, LinkedList>> = true;
const _linkedListInCheck: $Expect<$ExpectSame<$Input<typeof LinkedListDna>, LinkedList>> = true;
const _simpleOutCheck: $Expect<
  $ExpectSame<SimpleOut, { name: string; age?: number | undefined; tags: string[] }>
> = true;


// Complicated self-recursion with getters
const zComplicatedCategoryZod = z.object({
  name: z.string(),
  age: z.optional(z.number()),
  get nullself(){
    return zComplicatedCategoryZod.nullable();
  },
  get optself() {
    return zComplicatedCategoryZod.optional();
  },
  get self() {
    return zComplicatedCategoryZod;
  },
  get subcategories() {
    return z.array(zComplicatedCategoryZod);
  },
  nested: z.object({
    get sub() {
      return zComplicatedCategoryZod;
    },
  }),
});

type ComplicatedCategory = {
  name: string;
  age?: number;
  nullself: ComplicatedCategory | null;
  optself?: ComplicatedCategory;
  self: ComplicatedCategory;
  subcategories: ComplicatedCategory[];
  nested: { sub: ComplicatedCategory };
};

const _zodComplicatedCheck: $Expect<$ExpectSame<z.infer<typeof zComplicatedCategoryZod>, ComplicatedCategory>> = true;

const ComplicatedCategoryDna = dnaObject({
    name: dnaString(),
    age: dnaNumber().optional(),
    get nullself() {
      return ComplicatedCategoryDna.nullable();
    },
    get optself() {
      return ComplicatedCategoryDna.optional();
    },
    get self() {
      return ComplicatedCategoryDna;
    },
    get subcategories() {
      return dnaArray(ComplicatedCategoryDna);
    },
    nested: dnaObject({
      get sub() {
        return ComplicatedCategoryDna;
      },
    }),
});

const _complicatedCheck: $Expect<$ExpectSame<$Output<typeof ComplicatedCategoryDna>, ComplicatedCategory>> = true;

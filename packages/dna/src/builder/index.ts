/**
 * DNA Schema Builder Core
 *
 * Discriminated schema types and implementation classes
 */
import { parserBuilder as parser, validatorBuilder as validator } from "../toJs/dna-to-js.js"
import type { tsDna, tsDnaSeq, tsDnaOpcode, tsMeta, tsDnaId } from "../types/dna-core.types.js";
import type { tsExternals, tsParserResult } from "../types/dna.types.js";
import type { $UnionToIntersection, $Xor, IDnaCollector, tsStoreMark, tsStorePosition } from "./generic.types.js";
import type {
  ISchemaBase,
  tsSchString,
  tsSchNumber,
  tsSchInteger,
  tsSchInteger32,
  tsSchBigInt,
  tsSchBoolean,
  tsSchDate,
  tsSchUrl,
  tsSchInstanceOf,
  tsSchObject,
  tsSchArray,
  tsSchUnion,
  tsSchEnum,
  tsSchLiteral,
  tsSchAny,
  tsSchUnknown,
  tsSchNever,
  tsSchOptional,
  tsSchNullable,
  tsSchNullish,
  tsSchMutate,
  tsCombinatorSchemas,
  tsSchemaValue,
  tsTupleValue,
  tsTupleValueWithRest,
  schStringMethods,
  schNumberMethods,
  schBigIntMethods,
  schBooleanMethods,
  schObjectMethods,
  schArrayMethods,
  schUnionMethods,
  schEnumMethods,
  schLiteralMethods,
  schPseudoTypeMethods,
  schWrapperMethods,
  schDateMethods,
  schUrlMethods,
  tsSchDefault,
  tsSchPrefault,
} from "./builder.types.js";



// ============================================
// DNA Context for deduplication and index resolution (storeDNA pattern)
// ============================================
export class DnaCollector implements IDnaCollector {
  dnaList: tsDna[] = [];
  dnaCache = new Map<string, number>();
  count = 0;
  refList: number[] = [];
  store = new Map<number, any>();
  storeId = 0;

  private cacheKey(dna: tsDna): string {
    return JSON.stringify(dna, (key, value) => {
      if (typeof value === 'bigint') return value.toString();
      return value;
    });
  }

  setStore(objToStore: any): tsStoreMark {
    const storeSize = this.storeId++;
    this.store.set(storeSize, objToStore);
    return storeSize;
  }

  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void {
    if (typeof position === "number") {
      this.store.get(storeMark)[position] = targetIdx;
    } else if (Array.isArray(position)) {
      this.store.get(storeMark)[position[0]][position[1]] = targetIdx;
    } else {
      this.store.set(storeMark, targetIdx);
    }
  }

  // getStoreValue(storeMark: number): any {
  //   return this.store.get(storeMark);
  // }

  storeDNA(dna: tsDna, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const key = this.cacheKey(dna);
    if (this.dnaCache.has(key)) {
      const cachedIdx = this.dnaCache.get(key)!;
      if (typeof storeMark === "number") {
        this.updateStore(storeMark, cachedIdx, storePosition);
      }
      return cachedIdx;
    }
    const idx = this.count++;
    this.dnaList[idx] = dna;
    this.dnaCache.set(key, idx);
    if (typeof storeMark === "number") {
      this.updateStore(storeMark, idx, storePosition);
    }
    return idx;
  }

  getDnaSeq(): tsDnaSeq {
    return [...this.dnaList, this.refList];
  }
}


// ============================================
// REgistry for toDna Substitution
// ============================================

type tsFnToDnaSeq = () => tsDnaSeq;
type tsFnToDnaId = (collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition) => tsDnaId;

// WeakMap to store custom toDna functions externally (to avoid exposing in public API)
const customToDnaMap = new WeakMap<any, tsFnToDnaId | tsFnToDnaSeq>();
// Utility function to set custom toDna behavior on a schema
export function setCustomToDna<T>(schema: ISchemaBase<T>, fn: tsFnToDnaId | tsFnToDnaSeq): void {
  customToDnaMap.set(schema, fn);
}


// ============================================
// Schema Builder Class (with discriminated types)
// ============================================
class SchemaImpl<T> implements ISchemaBase<T> {
  dnaId?: tsDnaId;
  protected _dna?: tsDna;
  #meta: tsMeta = {};
  #cachedValidator?: (value: unknown) => boolean;
  #cachedParser?: (value: unknown) => tsParserResult;
  protected _checkerList: [string, any?, any?][] = [];

  get description(): string | undefined {
    return this.#meta.description;
  }

  constructor() {
    this.#meta = {};
    this._dna = ["T", this.#meta];
  }

  protected _newInstance<U>(dna: tsDna): SchemaImpl<U> {
    const instance = new SchemaImpl<U>();
    instance._dna = dna;
    return instance;
  }

  public _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    if (this._checkerList.length > 0) {
      const dna_params = new Array(this._checkerList.length + 1);
      const storeId = coll.setStore(dna_params);
      const dna: tsDna = ["seq", dna_params, {}];
      this.dnaId = coll.storeDNA(dna, storeMark, storePosition);

      ([
        this._dna!,
        ...this._checkerList.map(it => ["check", it, {}] as tsDna)
      ] as tsDna[]).forEach((it, i) => {
        const itId = coll.storeDNA(it, storeId, i);
      });
    } else {
      this.dnaId = coll.storeDNA(this._dna!, storeMark, storePosition);
    }
    return this.dnaId;
  }


  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
  toDna(collector?: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId | tsDnaSeq {
    if (collector instanceof DnaCollector) {
      if (this.dnaId) return this.dnaId;
      const customToDna = customToDnaMap.get(this) as tsFnToDnaId;
      if (customToDna) return customToDna(collector, storeMark, storePosition);
      this._toDna(collector, storeMark, storePosition);
      return this.dnaId!;
    }
    const customToDna = customToDnaMap.get(this) as tsFnToDnaSeq;
    if (customToDna) return customToDna();
    const coll = new DnaCollector();
    this._toDna(coll, storeMark, storePosition);
    return coll.getDnaSeq();
  }

  transform<R>(fn: ((value: T) => R) | R): tsSchMutate<R> {
    if (typeof fn === "function") return this._newInstance<R>(["mutate", ["func", fn.toString()], {}]);
    return this._newInstance<R>(["mutate", ["assign", JSON.stringify(fn)], {}])

  }

  refine(fn: (value: T) => boolean): ISchemaBase<T> {
    this._checkerList.push(["func", fn.toString(), fn.length]);
    return this;
  }

  check(...schemas: ISchemaBase<any>[]): this {
    // In Zod V4, .check() is used for metadata constraints like .describe() and .meta()
    // For DNA compatibility, we return this as a no-op since metadata is handled by .meta()
    return this;
  }

  custom<R>(fn: (data: any) => R): ISchemaBase<R> {
    // In Zod, .custom() creates a schema with a custom validation function
    // For DNA compatibility, we accumulate the checker
    this._checkerList.push(["func", fn.toString(), fn.length]);
    return this as unknown as ISchemaBase<R>;
  }

  brand<B extends string, D extends "out" | "in" | "inout" = "out">(brand: B, direction?: D): ISchemaBase<T & { __brand: B }> {
    // In Zod, .brand() adds a brand to the type for type-level discrimination
    // This is purely for TypeScript typing, no runtime effect
    // The direction parameter ("out" | "in" | "inout") controls which type gets branded
    return this as unknown as ISchemaBase<T & { __brand: B }>;
  }

  catch<R>(defaultValue: R): ISchemaBase<T | R> {
    // In Zod, .catch() provides a default value when parsing fails
    // For DNA compatibility, we implement this as anyOf(schema, TrueSchema.transform(v => defaultValue))
    const trueSchema = new DnaGeneric<R>(["T", {}]);
    const catchSchema = trueSchema.transform<typeof defaultValue>(defaultValue);
    const union = new UnionImpl([this, catchSchema] as [ISchemaBase<T>, ISchemaBase<R>]);
    return union as unknown as ISchemaBase<T | R>;
  }

  meta(): tsMeta;
  meta(value: string | tsMeta): ISchemaBase<T>;
  meta(value?: string | tsMeta): ISchemaBase<T> | tsMeta {
    if (value === undefined) return this.#meta;
    if (typeof value === "string") { this.#meta.message = value; return this }
    for (const p in value) this.#meta[p] = value[p];
    return this;
  }

  // Properties
  toJSONSchema(): Record<string, unknown> {
    // Placeholder for JSON Schema conversion
    return {};
  }

  // Additional wrappers
  exactOptional(): ISchemaBase<T | undefined> & schWrapperMethods<T> {
    // In Zod, exactOptional is similar to optional but with stricter undefined handling
    return this.optional();
  }

  nonoptional(): ISchemaBase<T> {
    // In Zod, nonoptional removes optional wrapper
    // For DNA, this should be implemented in SchemaImplWithWrappers
    return this;
  }

  // Additional validation
  superRefine(fn: (value: T, ctx: any) => void): tsSchMutate<T> {
    // In Zod, superRefine provides a refinement context for custom error reporting
    // For DNA compatibility, we use refine with a context-aware function
    return this.refine((value) => {
      const ctx = { issues: [] };
      fn(value, ctx);
      return ctx.issues.length === 0;
    });
  }

  // Composition methods
  array(): tsSchArray<T> {
    const arraySchema = new ArrayImpl<T>(this);
    arraySchema.meta(this.meta());
    return arraySchema;
  }

  or<U>(other: ISchemaBase<U>): ISchemaBase<T | U> {
    const union = new UnionImpl([this, other] as [ISchemaBase<T>, ISchemaBase<U>]);
    union.meta(this.meta());
    return union as ISchemaBase<T | U>;
  }

  and<U>(other: ISchemaBase<U>): ISchemaBase<T & U> {
    // In Zod, and() creates an intersection
    // For DNA, we use allOf (intersection) with a store pattern like UnionImpl
    const intersection = new IntersectionImpl([this, other] as [ISchemaBase<T>, ISchemaBase<U>]);
    intersection.meta(this.meta());
    return intersection as ISchemaBase<T & U>;
  }

  xor<U>(other: ISchemaBase<U>): ISchemaBase<$Xor<T, U>> {
    // In Zod, xor() creates an exclusive union (exactly one must match)
    // For DNA, we use oneOf opcode
    const xorSchema = new XorImpl([this, other] as [ISchemaBase<T>, ISchemaBase<U>]);
    xorSchema.meta(this.meta());
    return xorSchema as ISchemaBase<$Xor<T, U>>;
  }

  pipe<U>(other: ISchemaBase<U>): ISchemaBase<U> {
    // In Zod, pipe() chains schemas: input → transform → output schema
    // For DNA, pipe is equivalent to transform followed by validation
    // For now, return the output schema as a placeholder
    return other;
  }

  readonly(): SchemaImpl<Readonly<T>> {
    // In Zod, readonly() marks the type as readonly (TypeScript-only)
    // For DNA, this is a no-op at runtime
    return this as SchemaImpl<Readonly<T>>;
  }

  // Utility methods
  with(fn: (schema: this) => this): this {
    return fn(this);
  }

  clone(): this {
    const cloned = Object.create(Object.getPrototypeOf(this));
    // Copy all own properties (including private fields via bracket notation)
    const keys = Reflect.ownKeys(this);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(this, key);
      if (descriptor) {
        Object.defineProperty(cloned, key, descriptor);
      }
    }
    return cloned as this;
  }

  register(fn: (schema: this) => void): this {
    fn(this);
    return this;
  }

  overwrite<U>(fn: (schema: this) => U): U {
    return fn(this);
  }

  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R {
    return fn(this, ...args);
  }

  describe(description: string): this {
    this.#meta.description = description;
    return this;
  }

  // Information methods
  isOptional(): boolean {
    return this.#meta.optional === true;
  }

  isNullable(): boolean {
    return this.#meta.nullable === true;
  }

  validate(value: unknown, ctx?: tsExternals): boolean {
    if (!this.#cachedValidator) {
      this.#cachedValidator = validator(this.toDna(), ctx);
    }
    return this.#cachedValidator(value);
  }
  safeParse(value: unknown, ctx?: tsExternals): tsParserResult {
    if (!this.#cachedParser) {
      this.#cachedParser = parser(this.toDna(), ctx);
    }
    return this.#cachedParser(value);
  }

  // Additional parsing methods
  parse(value: unknown, ctx?: tsExternals): any | never{
    const res = this.safeParse(value, ctx);
    if (res.success) return res.data;
    throw res.errors;
  }

  parseAsync(value: unknown, ctx?: tsExternals): Promise<any> {
    return Promise.resolve(this.parse(value, ctx));
  }

  safeParseAsync(value: unknown, ctx?: tsExternals,): Promise<tsParserResult> {
    return Promise.resolve(this.safeParse(value, ctx));
  }

  spa(value: unknown, ctx?: tsExternals): Promise<tsParserResult> {
    return this.safeParseAsync(value, ctx);
  }

  // Encoding/decoding methods
  encode(value: T): any {
    // In Zod, encode() is for bidirectional codecs
    // For DNA, we return the value as-is (no encoding by default)
    return value;
  }

  decode(value: unknown): T {
    // In Zod, decode() is the inverse of encode()
    // For DNA, we use parse()
    const result = this.safeParse(value);
    if (result.success) {
      return result.data as T;
    }
    throw result.errors;
  }

  encodeAsync(value: T): Promise<any> {
    return Promise.resolve(this.encode(value));
  }

  decodeAsync(value: unknown): Promise<T> {
    return Promise.resolve(this.decode(value));
  }

  safeEncode(value: T): { success: boolean; data?: any; error?: any } {
    return { success: true, data: this.encode(value) };
  }

  safeDecode(value: unknown): tsParserResult {
    return this.safeParse(value);
  }

  safeEncodeAsync(value: T): Promise<{ success: boolean; data?: any; error?: any }> {
    return Promise.resolve(this.safeEncode(value));
  }

  safeDecodeAsync(value: unknown): Promise<tsParserResult> {
    return this.parseAsync(value);
  }

  // Stub wrapper methods for interface compliance (should not be called on base SchemaImpl)
  optional(): ISchemaBase<T | undefined> & schWrapperMethods<T> {
    throw new Error("optional() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullable(): ISchemaBase<T | null> & schWrapperMethods<T> {
    throw new Error("nullable() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  nullish(): ISchemaBase<T | null | undefined> & schWrapperMethods<T> {
    throw new Error("nullish() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  default(value: T): ISchemaBase<T> & schWrapperMethods<T> & { defaultValue: () => T } {
    throw new Error("default() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }

  prefault(value: T): ISchemaBase<T> & schWrapperMethods<T> {
    throw new Error("prefault() is not available on base SchemaImpl. Use SchemaImplWithWrappers instead.");
  }
}

class SchemaImplWithWrappers<T> extends SchemaImpl<T> {
  protected _wrappers: {
    optional?: any;
    nullable?: any;
    nullish?: any;
    default?: any;
    prefault?: any;
  } = {};
  protected _wrapperOrder: ("optional" | "nullable" | "nullish" | "default" | "prefault")[] = [];

  // Override wrapper methods to return ISchemaBase<T> with schWrapperMethods to hide _toDna from autocomplete
  unwrap(): ISchemaBase<T> {
    if (this._wrapperOrder.length === 0) {
      throw new Error("unwrap() can only be called when a wrapper (optional, nullable, nullish, default, prefault) has been applied");
    }
    const lastWrapper = this._wrapperOrder.pop()!;
    this._wrappers[lastWrapper] = false;
    return this;
  }

  optional(): tsSchOptional<T> {
    this._wrappers.optional = true;
    this._wrapperOrder.push("optional");
    return this as unknown as tsSchOptional<T>;
  }

  nullable(): tsSchNullable<T> {
    this._wrappers.nullable = true;
    this._wrapperOrder.push("nullable");
    return this as unknown as tsSchNullable<T>;
  }

  nullish(): tsSchNullish<T> {
    this._wrappers.nullish = true;
    this._wrapperOrder.push("nullish");
    return this as unknown as tsSchNullish<T>;
  }

  default(value: T): tsSchDefault<T> {
    this.meta({ default: value });
    this._wrappers.default = value;
    this._wrapperOrder.push("default");
    (this as unknown as tsSchDefault<T>).defaultValue = () => value;
    return this as unknown as tsSchDefault<T>;
  }

  prefault(value: T): tsSchPrefault<T> {
    this.meta({ prefault: value });
    this._wrappers.prefault = value;
    this._wrapperOrder.push("prefault");
    (this as unknown as tsSchPrefault<T>).prefaultValue = () => value;
    return this as unknown as tsSchPrefault<T>
  }

  protected _storeWrapper(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): [tsStoreMark, tsStorePosition | undefined] | [undefined, undefined] {

    // preprocess and wrappers are:
    // - default:   value if the input value is undefined ; will short circuit the parsing/validation
    // - prefault:  value if the input value is undefined ; will pass the value through the parsing / validation;
    //              equivalent to a preprocess: value = value===undefined?prefaultValue:value; schema_validation/parsing(value);
    // - optional : equivalent to oneOf/xor(value===undefined, schema_validation/parsing(value))
    // - nullable : equivalent to oneOf/xor(null, schema_validation/parsing(value))
    // - nullish : equivalent to oneOf/xor(null, undefined, schema_validation/parsing(value))
    //
    //
    // Zod behavior (reference):
    // - Wrappers are applied in reverse order of declaration (last wins)
    // - Wrappers close the type when applied BEFORE validations (e.g., z.string().optional().min(5) fails - min is not a function of optional)
    // - Wrappers preserve the type when applied AFTER validations (e.g., z.string().min(5).optional() works)
    // - Correct order: validations → wrappers (in reverse declaration order)
    // - Priority is not fixed; it depends on declaration order
    // - meta() and describe() do NOT close the type (they are metadata-only methods)
    //
    if (this._wrapperOrder.length === 0) return [undefined, undefined];
    let acc: ([string, any] | [string])[] = []
    for (let i = this._wrapperOrder.length - 1; i--;) {
      const wrapperType = this._wrapperOrder[i];
      const value = this._wrappers[wrapperType];
      if (value === false) continue; // Skip unwrapped wrappers
      acc.push(value !== true ? [wrapperType, JSON.stringify(value)] : [wrapperType])
      this.meta({ [wrapperType]: value !== true ? JSON.stringify(value) : true });
    }
    const wrpDef = [acc, 1];
    const storeId = collector.setStore(wrpDef);
    this.dnaId = collector.storeDNA(["wrp", wrpDef, this.meta], storeMark, storePosition);
    return [storeId, 1]
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const [parentStoreId, parentPosition] = this._storeWrapper(coll, storeMark, storePosition);
    // Let SchemaImpl._toDna handle checkers with the wrapper context
    return super._toDna.call(this, coll, parentStoreId, parentPosition);
  }
}

class DnaGeneric<T> extends SchemaImplWithWrappers<T> {
  constructor(dna: tsDna) {
    super();
    this.meta(dna.slice(-1));
    this._dna = [...dna.slice(0, -1), this.meta()] as tsDna;
  }
}


// String implementation
class StringImpl extends SchemaImplWithWrappers<string> implements schStringMethods {
  // private __dna:tsDna
  private _mutatorList: [string, any?][] = [];
  private _min: number | null = null;
  private _max: number | null = null;
  private _pattern: RegExp | null = null;
  private _format: string | null = null;

  constructor(options?: { format?: string }) {
    super();
    this._format = options?.format ?? null;
  }

  min(length: number): tsSchString {
    this._min = length;
    return this;
  }

  max(length: number): tsSchString {
    this._max = length;
    return this;
  }

  pattern(regex: RegExp): tsSchString {
    this._pattern = regex;
    return this;
  }
  regex = this.pattern;

  format(fmt: string): tsSchString {
    this._format = fmt;
    return this;
  }

  trim(): tsSchString {
    this._mutatorList.push(["trim"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  toLowerCase(): tsSchString {
    this._mutatorList.push(["toLowerCase"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  toUpperCase(): tsSchString {
    this._mutatorList.push(["toLowerCase"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  normalize(): tsSchString {
    this._mutatorList.push(["normalize"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  uppercase(): tsSchString {
    this._checkerList.push(["upperCase"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  lowercase(): tsSchString {
    this._checkerList.push(["lowercase"]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  startsWith(start: string): tsSchString {
    this._checkerList.push(["startWith", JSON.stringify(start)]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  endsWith(end: string): tsSchString {
    this._checkerList.push(["endsWith", JSON.stringify(end)]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }
  includes(inc: string): tsSchString {
    this._checkerList.push(["inludes", JSON.stringify(inc)]);
    // mutation opcode : codec, in, transformFn, out, reverseFn 
    return this;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const storeWrap = this._storeWrapper(coll, storeMark, storePosition);
    const selfDna: tsDna = ["s", [this._min ?? null, this._max ?? null, this._pattern ?? null, this._format ?? null], this.meta()]
    if (this._mutatorList.length > 0 || this._checkerList.length > 0) {
      const dna_params = new Array(this._mutatorList.length + this._checkerList.length + 1);
      const storeId = coll.setStore(dna_params);
      const dna: tsDna = ["seq", dna_params, {}];
      this.dnaId = coll.storeDNA(dna, storeWrap[0], storeWrap[1]);
      ([
        ["s", [null, null, null, null], {}],
        ...this._mutatorList.map(it => ["mutate", it, {}]),
        ["s", [this._min ?? null, this._max ?? null, this._pattern ?? null, this._format ?? null], {}],
        ...this._checkerList.map(it => ["check", it, {}])
      ] as tsDna[]).forEach((it, i) => {
        const itId = coll.storeDNA(it, storeId, i);
      })
    } else {
      this.dnaId = coll.storeDNA(selfDna, storeMark, storePosition);
    }
    return this.dnaId;
  }
}

// Mutate implementation - mutation operation
class MutateImpl<T> extends SchemaImpl<T> {
  private _mutator: string;

  constructor(mutator: string) {
    super();
    this._mutator = mutator;
    this._dna = ["mutate", mutator, {}];
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    this.dnaId = coll.storeDNA(this._dna!);
    return this.dnaId;
  }
}

// Seq implementation - sequence of DNA operations
class SeqImpl<T> extends SchemaImpl<T> {
  private _steps: SchemaImpl<any>[] = [];

  constructor() {
    super();
  }

  addStep(step: SchemaImpl<any>): this {
    this._steps.push(step);
    return this;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const dna_params = new Array(this._steps.length);
    const storeId = coll.setStore(dna_params);
    this._dna = ["seq", dna_params, {}];
    this.dnaId = coll.storeDNA(this._dna);
    this._steps.forEach((step, i) => {
      step._toDna(coll);
      coll.updateStore(storeId, step.dnaId!, i)
    });
    return this.dnaId;
  }
}

// Seq implementation - sequence of DNA operations
class CoerceImpl<T> extends SchemaImpl<T> {
  private _mutator: string;
  private _impl: SchemaImpl<T>;

  constructor(mutator: string, impl: SchemaImpl<T>) {
    super();
    this._mutator = mutator;
    this._impl = impl;
    setCustomToDna(this._impl, (c, sm, sp) => this.toDna(c, sm, sp));
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const dna_params = [this._mutator, 0];
    const storeId = coll.setStore(dna_params);
    this._dna = ["coerce", dna_params, {}];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    coll.updateStore(storeId, this._impl._toDna(coll, storeId, 1), 1);
    return this.dnaId;
  }
}

// Coerce implementation - static methods
class Coerce {
  private static createCoerce<T, I extends ISchemaBase<T>>(mutator: string, impl: I): I {
    const seq = new CoerceImpl<T>(mutator, impl as unknown as SchemaImpl<T>);
    return impl;
  }

  static string(): tsSchString { return this.createCoerce<string, StringImpl>("toString", new StringImpl({})); }
  static number(): tsSchNumber { return this.createCoerce<number, NumberImpl<number>>("toNumber", new NumberImpl<number>("n")); }
  static int(): tsSchInteger { return this.createCoerce<number, IntImpl>("toNumber", new IntImpl()); }
  static int32(): tsSchInteger32 { return this.createCoerce<number, Int32Impl>("toNumber", new Int32Impl()); }
  static boolean(): tsSchBoolean { return this.createCoerce<boolean, BooleanImpl>("toBoolean", new BooleanImpl()); }
  static bigint(): tsSchBigInt { return this.createCoerce<bigint, BigIntImpl>("toBigInt", new BigIntImpl()); }
  static date(): tsSchDate { return this.createCoerce<Date, DateImpl>("toDate", new DateImpl()); }
}

// ISO implementation - static methods
class Iso {
  static datetime(options?: { local?: boolean; offset?: boolean; precision?: number; message?: string }): tsSchString {
    let format = "date-time";
    if (options?.local) format = "date-time-local";
    if (options?.offset) format = "date-time-offset";
    if (options?.precision !== undefined) format = `date-time-precision-${options.precision}`;
    const instance = new StringImpl({ format });
    if (options?.message) {
      instance.meta({ message: options.message });
    }
    return instance;
  }

  static date(options?: { message?: string }): tsSchString {
    const format = "date";
    const instance = new StringImpl({ format });
    if (options?.message) {
      instance.meta({ message: options.message });
    }
    return instance;
  }

  static time(options?: { precision?: number; message?: string }): tsSchString {
    let format = "time";
    if (options?.precision !== undefined) format = `time-precision-${options.precision}`;
    const instance = new StringImpl({ format });
    if (options?.message) {
      instance.meta({ message: options.message });
    }
    return instance;
  }

  static duration(options?: { message?: string }): tsSchString {
    const format = "duration";
    const instance = new StringImpl({ format });
    if (options?.message) {
      instance.meta({ message: options.message });
    }
    return instance;
  }
}

// Date implementation
class DateImpl extends SchemaImplWithWrappers<Date> implements schDateMethods {
  #min: Date | null = null;
  #max: Date | null = null;
  #innerDef: [Date | null, Date | null] = [null, null];

  constructor() {
    super();
    this._dna = ["date", this.#innerDef, this.meta()];
  }

  min(date: Date): this { this.#min = date; this.#innerDef[0] = date; return this; }
  max(date: Date): this { this.#max = date; this.#innerDef[1] = date; return this; }

  // public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
  //   const selfDna: tsDna = ["date", [this._min, this._max, null, null], this.meta()];
  //   if (this._checkerList.length > 0) {
  //     const dna_params = new Array(this._checkerList.length + 1);
  //     const storeId = coll.setStore(dna_params);
  //     const dna: tsDna = ["seq", dna_params, {}];
  //     this.dnaId = coll.storeDNA(dna, storeMark, storePosition);

  //     [
  //       selfDna,
  //       ...this._checkerList.map(it => ["check", ...it])
  //     ].forEach((it, i) => {
  //       const itId = coll.storeDNA(it);
  //       coll.updateStore(storeId, itId, i);
  //     });
  //   } else {
  //     this.dnaId = coll.storeDNA(selfDna, storeMark, storePosition);
  //   }
  //   return this.dnaId;
  // }
}


// URL implementation
class UrlImpl extends SchemaImplWithWrappers<string> implements schUrlMethods {
  #protocols: string[] | null = null;
  #domains: string[] | null = null;
  #innerDef: [string[] | null, string[] | null] = [null, null];

  constructor() {
    super();
    this._dna = ["url", this.#innerDef, this.meta()];
  }

  protocol(protocols: string[]): this { this.#protocols = protocols; this.#innerDef[0] = protocols; return this; }
  domain(domains: string[]): this { this.#domains = domains; this.#innerDef[1] = domains; return this; }

  // public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
  //   if (this._checkerList.length > 0) {
  //     const dna_params = new Array(this._checkerList.length + 1);
  //     const storeId = coll.setStore(dna_params);
  //     const dna: tsDna = ["seq", dna_params, {}];
  //     this.dnaId = coll.storeDNA(dna, storeMark, storePosition);

  //     [
  //       selfDna,
  //       ...this._checkerList.map(it => ["check", ...it] as tsDna)
  //     ].forEach((it, i) => {
  //       const itId = coll.storeDNA(it);
  //       coll.updateStore(storeId, itId, i);
  //     });
  //   } else {
  //     this.dnaId = coll.storeDNA(selfDna, storeMark, storePosition);
  //   }
  //   return this.dnaId;
  // }
}




// Number implementation
class NumberImpl<T> extends SchemaImplWithWrappers<T> implements schNumberMethods<T> {
  protected _type: tsDnaOpcode;
  protected _min: T | null = null;
  protected _max: T | null = null;
  protected _exclMin: boolean = false;
  protected _exclMax: boolean = false;
  protected _multOf: T | null = null;

  constructor(type: tsDnaOpcode = "n") {
    super();
    this._type = type;
  }

  min(value: T): this { this._min = value; return this; }
  max(value: T): this { this._max = value; return this; }
  gt(value: T): this { this._min = value; this._exclMin = true; return this; }
  gte(value: T): this { this._min = value; this._exclMin = false; return this; }
  lt(value: T): this { this._max = value; this._exclMax = true; return this; }
  lte(value: T): this { this._max = value; this._exclMax = false; return this; }
  multipleOf(value: T): this { this._multOf = value; return this; }

  int(): tsSchInteger {
    const impl = new IntImpl();
    if (this._min !== null) {
      if (this._exclMin) impl.gt(this._min as number);
      else impl.gte(this._min as number);
    }
    if (this._max !== null) {
      if (this._exclMax) impl.lt(this._max as number);
      else impl.lte(this._max as number);
    }
    if (this._multOf !== null) impl.multipleOf(this._multOf as number);
    return impl;
  }

  positive(): this { this._min = 0 as T; this._exclMin = true; return this; }
  nonnegative(): this { this._min = 0 as T; return this; }
  negative(): this { this._max = 0 as T; this._exclMax = true; return this; }
  nonpositive(): this { this._max = 0 as T; return this; }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = [this._type, [this._min, this._exclMin, this._max, this._exclMax, this._multOf], this.meta()];
    this.dnaId = coll.storeDNA(selfDna, storeMark, storePosition);
    return this.dnaId;
  }
}

// Boolean implementation
class BooleanImpl extends SchemaImplWithWrappers<boolean> implements schBooleanMethods {
  constructor() {
    super();
    this._dna = ["b", this.meta()];
  }
}

class BigIntImpl extends NumberImpl<bigint> implements schBigIntMethods {
  constructor() {
    super("bi")
  }

  override positive(): this { this._min = BigInt(0); this._exclMin = true; return this; }
  override nonnegative(): this { this._min = BigInt(0); return this; }
  override negative(): this { this._max = BigInt(0); this._exclMax = true; return this; }
  override nonpositive(): this { this._max = BigInt(0); return this; }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const selfDna: tsDna = [this._type, [this._min, this._exclMin, this._max, this._exclMax, this._multOf], this.meta()];
    this.dnaId = coll.storeDNA(selfDna, storeMark, storePosition);
    return this.dnaId;
  }
}

class IntImpl extends NumberImpl<number> {
  constructor() {
    super("i")
  }
}

class Int32Impl extends NumberImpl<number> {
  #min = -(2 ** 31)
  #max = 2 ** 31 - 1
  constructor() {
    super("i")
    this._type = "i";
  }

  override min(value: number): this { this._min = Math.max(this.#min, value); return this; }
  override max(value: number): this { this._max = Math.min(this.#max, value); return this; }
  override gt(value: number): this { this._min = Math.max(this.#min, value); this._exclMin = true; return this; }
  override gte(value: number): this { this._min = Math.max(this.#min, value); this._exclMin = false; return this; }
  override lt(value: number): this { this._max = Math.min(this.#max, value); this._exclMax = true; return this; }
  override lte(value: number): this { this._max = Math.min(this.#max, value); this._exclMax = false; return this; }
  override multipleOf(value: number): this { this._multOf = Math.max(this.#min, Math.min(this.#max, value)); return this; }
}

// Enum implementation
class EnumImpl<T extends readonly string[]> extends SchemaImplWithWrappers<T[number]> implements schEnumMethods<T> {
  #enumList: string[];

  constructor(values: T) {
    super();
    this.#enumList = [...values];
  }

  get values(): string[] { return this.#enumList; }

  get enum(): Record<string, string> {
    return this.#enumList.reduce((acc, val) => ({ ...acc, [val]: val }), {});
  }

  extract(values: T[number][]): tsSchEnum<T> {
    this.#enumList = this.#enumList.filter(v => values.includes(v));
    return this;
  }

  exclude(values: T[number][]): tsSchEnum<T> {
    this.#enumList = this.#enumList.filter(v => !values.includes(v));
    return this;
  }

  override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    this._dna = ["e", this.#enumList, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    return this.dnaId;
  }
}

// Array implementation
class ArrayImpl<T> extends SchemaImplWithWrappers<T[]> implements schArrayMethods<T> {
  #min: number | null = null;
  #max: number | null = null;
  #length: number | null = null;
  #itemSchema: ISchemaBase<T>;

  constructor(itemSchema: ISchemaBase<T>) {
    super();
    this.#itemSchema = itemSchema;
  }


  override unwrap(): ISchemaBase<T[]>;
  override unwrap(): ISchemaBase<T>;
  unwrap(): ISchemaBase<T> | ISchemaBase<T[]> {
    if (this._wrapperOrder.length) return super.unwrap();
    else return this.#itemSchema;
  }

  min(n: number): tsSchArray<T> { this.#min = n; return this; }
  max(n: number): tsSchArray<T> { this.#max = n; return this; }
  length(n: number): tsSchArray<T> { this.#length = n; return this; }
  nonempty(): tsSchArray<T> { this.#min = 1; return this; }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    if (this.#min !== null) constraints.push(["minItems", this.#min]);
    if (this.#max !== null) constraints.push(["maxItems", this.#max]);
    if (this.#length !== null) {
      constraints.push(["minItems", this.#length]);
      constraints.push(["maxItems", this.#length]);
    }
    this._dna = ["a", constraints, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    return this.dnaId;
  }
}

// Tuple implementation (Zod's z.tuple(items, rest?)): one schema per position,
// plus an optional rest schema for any extra items.
class TupleImpl<S extends tsCombinatorSchemas, R = never> extends SchemaImplWithWrappers<tsTupleValueWithRest<S, R>> {
  #items: S;
  #rest?: ISchemaBase<R>;

  constructor(items: S, rest?: ISchemaBase<R>) {
    super();
    this.#items = items;
    this.#rest = rest;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const len = this.#items.length;
    const prefixItems = new Array(len);
    const prefixStoreId = coll.setStore(prefixItems);
    // No rest -> `items: false` (no extra items, Zod default). Rest -> the rest schema id.
    const itemsDef: any[] = ["items", this.#rest ? 0 : false];
    const itemsStoreId = this.#rest ? coll.setStore(itemsDef) : -1;
    const constraints: any[] = [
      ["prefixItems", prefixItems],
      ["minItems", len],
      itemsDef,
    ];
    this._dna = ["a", constraints, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    for (let poz = len; poz--;) this.#items[poz]._toDna(coll, prefixStoreId, poz);
    if (this.#rest) this.#rest._toDna(coll, itemsStoreId, 1);
    return this.dnaId;
  }
}

// Object implementation
class ObjectImpl<T extends Record<string, any>> extends SchemaImplWithWrappers<T> implements schObjectMethods<T> {
  #propertySchemas?: Record<string, SchemaImpl<any>>;
  #addPropSchema?: true | false | SchemaImpl<any>;
  #objType: 'strict' | 'loose' | 'standard' = 'standard';

  constructor(propertySchemas?: Record<string, SchemaImpl<any>>, objType: 'strict' | 'loose' | 'standard' = 'standard') {
    super();
    this.#propertySchemas = propertySchemas;
    this.#objType = objType;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const constraints: any[] = [];
    this._dna = ["o", constraints, {}];
    if (this.#propertySchemas) {
      const properties: [string, number][] = [];
      const required: string[] = []
      constraints.push(["properties", properties]);
      constraints.push(["required", Object.keys(this.#propertySchemas)]);

      // Store each property schema and update its index
      for (const [key, schema] of Object.entries(this.#propertySchemas)) {
        const propDef: [string, number] = [key, 0];
        const propStoreId = coll.setStore(propDef);
        properties.push(propDef);
        required.push(key);
        const schDnaId = schema._toDna(coll);
        coll.updateStore(propStoreId, schDnaId, 1)
      }
    }
    if (this.#objType === 'strict') {
      constraints.push(["additionalProperties", false]);
    } else if (this.#objType === 'loose') {
      constraints.push(["additionalProperties", true]);
    }
    const selfDna: tsDna = ["o", constraints, this.meta()];
    this.dnaId = coll.storeDNA(selfDna);
    return this.dnaId;
  }

  strict() { this.#addPropSchema = false; return this; }
  loose() { this.#addPropSchema = true; return this; }

  catchAll(addPropSchema: SchemaImpl<any>) { this.#addPropSchema = addPropSchema; return this }

  apply<R>(fn: (schema: this) => R): R {
    return fn(this);
  }

  omit<K extends keyof T>(keys: Record<K, boolean>): tsSchObject<Omit<T, K>> {
    if (!this.#propertySchemas) {
      return this;
    }
    const newPropertySchemas: Record<string, SchemaImpl<any>> = {};
    for (const [key, schema] of Object.entries(this.#propertySchemas)) {
      if (!keys[key as K]) {
        newPropertySchemas[key] = schema;
      }
    }
    const newObject = new ObjectImpl(newPropertySchemas, this.#objType);
    newObject.meta(this.meta());
    return newObject as unknown as tsSchObject<Omit<T, K>>;
  }
}

// Generic combinator implementation (anyOf, allOf, oneOf)
class CombinatorImpl<T, S extends tsCombinatorSchemas = tsCombinatorSchemas> extends SchemaImplWithWrappers<T> {
  #schemas: S;
  #combinatorType: "anyOf" | "allOf" | "oneOf";

  constructor(schemas: S, combinatorType: "anyOf" | "allOf" | "oneOf") {
    super();
    this.#schemas = schemas;
    this.#combinatorType = combinatorType;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const nbItems = this.#schemas.length
    const combinatorDef = new Array(nbItems);
    const storeId = coll.setStore(combinatorDef);
    this._dna = [this.#combinatorType, combinatorDef, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    for (let poz = nbItems; poz--;) this.#schemas[poz]._toDna(coll, storeId, poz);
    return this.dnaId;
  }
}

// Union implementation (anyOf)
class UnionImpl<S extends tsCombinatorSchemas> extends CombinatorImpl<tsSchemaValue<S[number]>, S> implements schUnionMethods<tsSchemaValue<S[number]>> {
  constructor(schemas: S) {
    super(schemas, "anyOf");
  }
}

// Intersection implementation (allOf)
class IntersectionImpl<S extends tsCombinatorSchemas> extends CombinatorImpl<$UnionToIntersection<tsSchemaValue<S[number]>>, S> {
  constructor(schemas: S) {
    super(schemas, "allOf");
  }
}

// Exclusive union implementation (oneOf)
class XorImpl<S extends tsCombinatorSchemas> extends CombinatorImpl<tsSchemaValue<S[number]>, S> {
  constructor(schemas: S) {
    super(schemas, "oneOf");
  }
}

// Record implementation
class RecordImpl<K extends PropertyKey, V> extends SchemaImplWithWrappers<Record<K, V>> {
  #keySchema: ISchemaBase<K>;
  #valueSchema: ISchemaBase<V>;
  #type: "partial" | "loose" | "standard";

  constructor(keySchema: ISchemaBase<K>, valueSchema: ISchemaBase<V>, type: "partial" | "loose" | "standard" = "standard") {
    super();
    this.#keySchema = keySchema;
    this.#valueSchema = valueSchema;
    this.#type = type;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    const keyDef = ["propertyNames", 0];
    const keyStoreId = coll.setStore(keyDef);
    const valueDef = ["additionalProperties", 0];
    const valueStoreId = coll.setStore(valueDef);

    const constraints: any[] = [];
    constraints.push(keyDef);
    constraints.push(valueDef);

    // For enum keys with standard type, add required array
    if (this.#type === "standard" && this.#keySchema instanceof EnumImpl) {
      // Extract enum values from the key schema
      const enumValues = this.#keySchema.values;
      constraints.push(["required", enumValues]);
    }

    this._dna = ["o", constraints, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);
    this.#keySchema.toDna(coll, keyStoreId, 1);
    this.#valueSchema.toDna(coll, valueStoreId, 1);
    return this.dnaId;
  }
}

// Codec implementation - bidirectional encode/decode
class CodecImpl<I, O> extends SchemaImpl<O> {
  #inSchema: ISchemaBase<I>;
  #outSchema: ISchemaBase<O>;
  #decode: (inVal: I) => O;
  #encode: (outVal: O) => I;

  constructor(inSchema: ISchemaBase<I>, outSchema: ISchemaBase<O>, decode: (inVal: I) => O, encode: (outVal: O) => I) {
    super();
    this.#inSchema = inSchema;
    this.#outSchema = outSchema;
    this.#decode = decode;
    this.#encode = encode;
  }

  public override _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // codec opcode: ["codec", [inSchemaId, outSchemaId, decodeFn, encodeFn], meta]
    // Codec should be at position 0, referencing in/out schemas
    const codecDef = [0, 1, this.#decode.toString(), this.#encode.toString()];
    const storeId = coll.setStore(codecDef);
    this._dna = ["codec", codecDef, this.meta()];
    this.dnaId = coll.storeDNA(this._dna, storeMark, storePosition);

    // Store inSchema at position 0
    const inSchemaId = this.#inSchema.toDna(coll, storeId, 0);

    // Store outSchema at position 1
    const outSchemaId = this.#outSchema.toDna(coll, storeId, 1);

    return this.dnaId;
  }

  override safeDecode(value: unknown): tsParserResult<O> {
    return this.safeParse(value) as tsParserResult<O>;
  }

  override decode(value: unknown): O {
    return this.parse(value) as O;
  }

  override async safeDecodeAsync(value: unknown): Promise<tsParserResult> {
    return this.safeParseAsync(value);
  }

  override async decodeAsync(value: unknown): Promise<O> {
    return this.parseAsync(value);
  }

  override safeEncode(value: O): tsParserResult {
    return this.#inSchema.safeParse(this.#encode(value));
  }

  override encode(value: O): I {
    const result = this.safeEncode(value);
    if (result.success) {
      return result.data as I;
    }
    throw result.errors;
  }

  override async safeEncodeAsync(value: O): Promise<tsParserResult> {
    return this.#inSchema.safeParseAsync(await Promise.resolve(this.#encode(value)));
  }

  override async encodeAsync(value: O): Promise<I> {
    const result = await this.safeEncodeAsync(value);
    if (result.success) {
      return result.data as I;
    }
    throw result.errors;
  }
}


// ============================================
// Helper wrapper for meta parameter
// ============================================
const withMeta = <T>(instance: T, meta?: string | tsMeta): T => {
  if (meta === undefined || !(instance instanceof SchemaImpl)) return instance;
  instance.meta(meta);
  return instance;
};

// ============================================
// Schema Factory (returns discriminated types, Zod V4 style)
// ============================================

export const dna = {
  coerce: {
    string: (meta?: string | tsMeta): tsSchString => withMeta(Coerce.string(), meta),
    number: (meta?: string | tsMeta): tsSchNumber => withMeta(Coerce.number(), meta),
    boolean: (meta?: string | tsMeta): tsSchBoolean => withMeta(Coerce.boolean(), meta),
    bigint: (meta?: string | tsMeta): tsSchBigInt => withMeta(Coerce.bigint(), meta),
  },
  iso: {
    datetime: (options?: { local?: boolean; offset?: boolean; precision?: number; message?: string }, meta?: string | tsMeta): tsSchString => withMeta(Iso.datetime(options), meta),
    date: (options?: { message?: string }, meta?: string | tsMeta): tsSchString => withMeta(Iso.date(options), meta),
    time: (options?: { precision?: number; message?: string }, meta?: string | tsMeta): tsSchString => withMeta(Iso.time(options), meta),
    duration: (options?: { message?: string }, meta?: string | tsMeta): tsSchString => withMeta(Iso.duration(options), meta),
  },
  any: (meta?: string | tsMeta): tsSchAny => withMeta(new DnaGeneric<any>(["T", {}]), meta),

  unknown: (meta?: string | tsMeta): tsSchUnknown => withMeta(new DnaGeneric<unknown>(["T", {}]), meta),
  never: (meta?: string | tsMeta): tsSchNever => withMeta(new DnaGeneric<never>(["F", {}]), meta),
  string: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl(), meta),
  number: (meta?: string | tsMeta): tsSchNumber => withMeta(new NumberImpl<number>("n"), meta),
  bigint: (meta?: string | tsMeta): tsSchBigInt => withMeta(new BigIntImpl(), meta),
  int: (meta?: string | tsMeta): tsSchInteger => withMeta(new IntImpl(), meta),
  int32: (meta?: string | tsMeta): tsSchInteger32 => withMeta(new Int32Impl(), meta),
  boolean: (meta?: string | tsMeta): tsSchBoolean => withMeta(new BooleanImpl(), meta),
  date: (meta?: string | tsMeta): tsSchDate => withMeta(new DateImpl(), meta),
  null: (meta?: string | tsMeta): ISchemaBase<null> => withMeta(new DnaGeneric<null>(["n0", {}]), meta),
  undefined: (meta?: string | tsMeta): ISchemaBase<undefined> => withMeta(new DnaGeneric<undefined>(["undefined", {}]), meta),
  literal: <T>(value: T, meta?: string | tsMeta): tsSchLiteral<T> => withMeta(new DnaGeneric<T>(["l", [value], {}]), meta),
  enum: <T extends string[]>(values: T, meta?: string | tsMeta): tsSchEnum<T> => withMeta(new EnumImpl<T>(values), meta),
  union: <S extends tsCombinatorSchemas>(schemas: S, meta?: string | tsMeta): tsSchUnion<tsSchemaValue<S[number]>> => withMeta(new UnionImpl(schemas), meta),
  record: <K extends PropertyKey, V>(keySchema: ISchemaBase<K>, valueSchema: ISchemaBase<V>, meta?: string | tsMeta): ISchemaBase<Record<K, V>> => withMeta(new RecordImpl<K, V>(keySchema, valueSchema, "standard"), meta),
  partialRecord: <K extends PropertyKey, V>(keySchema: ISchemaBase<K>, valueSchema: ISchemaBase<V>, meta?: string | tsMeta): ISchemaBase<Record<K, V>> => withMeta(new RecordImpl<K, V>(keySchema, valueSchema, "partial"), meta),
  looseRecord: <K extends PropertyKey, V>(keySchema: ISchemaBase<K>, valueSchema: ISchemaBase<V>, meta?: string | tsMeta): ISchemaBase<Record<K, V>> => withMeta(new RecordImpl<K, V>(keySchema, valueSchema, "loose"), meta),

  // top-level format functions
  email: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "email" }), meta),
  // url: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "url" }), meta),
  url: (meta?: string | tsMeta): tsSchUrl => withMeta(new UrlImpl(), meta),
  httpUrl: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "httpUrl" }), meta),
  instanceof: <T>(constructor: abstract new (...args: any[]) => T, meta?: string | tsMeta): tsSchInstanceOf<T> => withMeta(new DnaGeneric<T>(["instanceOf", [constructor.name], {}]), meta),
  hostname: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "hostname" }), meta),
  uuid: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "uuid" }), meta),
  e164: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "e164" }), meta),
  emoji: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "emoji" }), meta),
  base64: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "base64" }), meta),
  base64url: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "base64url" }), meta),
  hex: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "hex" }), meta),
  jwt: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "jwt" }), meta),
  nanoid: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "nanoid" }), meta),
  cuid: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "cuid" }), meta),
  cuid2: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "cuid2" }), meta),
  ulid: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "ulid" }), meta),
  ipv4: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "ipv4" }), meta),
  ipv6: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "ipv6" }), meta),
  mac: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "mac" }), meta),
  cidrv4: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "cidrv4" }), meta),
  cidrv6: (meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: "cidrv6" }), meta),
  hash: (algorithm: "sha1" | "sha256" | "sha384" | "sha512" | "md5", meta?: string | tsMeta): tsSchString => withMeta(new StringImpl({ format: `hash:${algorithm}` }), meta),

  object: <T extends Record<string, any>>(shape: T, meta?: string | tsMeta): tsSchObject<T> => withMeta(new ObjectImpl<T>(shape, 'standard'), meta),
  strictObject: <T extends Record<string, any>>(shape: T, meta?: string | tsMeta): tsSchObject<T> => withMeta(new ObjectImpl<T>(shape, 'strict'), meta),
  looseObject: <T extends Record<string, any>>(shape: T, meta?: string | tsMeta): tsSchObject<T> => withMeta(new ObjectImpl<T>(shape, 'loose'), meta),
  array: <T>(item: any, meta?: string | tsMeta): tsSchArray<T> => withMeta(new ArrayImpl<T>(item), meta),
  tuple: <S extends tsCombinatorSchemas, R = never>(items: S, rest?: ISchemaBase<R>, meta?: string | tsMeta): ISchemaBase<tsTupleValueWithRest<S, R>> => withMeta(new TupleImpl(items, rest), meta),

  codec: <I, O>(inSchema: ISchemaBase<I>, outSchema: ISchemaBase<O>, options: { decode: (inVal: I) => O, encode: (outVal: O) => I }, meta?: string | tsMeta) => withMeta(new CodecImpl<I, O>(inSchema, outSchema, options.decode, options.encode), meta),

  lazy: <T>(getter: () => any): tsSchMutate<T> => new DnaGeneric<T>(["ref", Math.random().toString(36).substring(7), {}]),

  custom: <T>(fn: (val: any) => boolean, message?: string): ISchemaBase<T> => {
    const impl = new DnaGeneric<T>(["T", {}]);
    impl.refine(fn);
    return impl;
  },

  // Top-level utility functions (Zod V4 style)
  // default: <T>(schema: ISchemaBase<T>, value: T): ISchemaBase<T> => {
  //   const impl = schema as SchemaImpl<T>;
  //   impl.default(value)
  //   return impl;
  // },
  prefault: <T>(schema: ISchemaBase<T>, value: T): ISchemaBase<T> => {
    const impl = schema as SchemaImplWithWrappers<T>;
    impl.prefault(value)
    return impl;
  },
  optional: <T>(schema: ISchemaBase<T>): tsSchOptional<T> => {
    const impl = schema as SchemaImplWithWrappers<T>;
    return impl.optional();
  },
  nullable: <T>(schema: ISchemaBase<T>): tsSchNullable<T> => {
    const impl = schema as SchemaImplWithWrappers<T>;
    return impl.nullable();
  },
  nullish: <T>(schema: ISchemaBase<T>): tsSchNullish<T> => {
    const impl = schema as SchemaImplWithWrappers<T>;
    return impl.nullish();
  },
};

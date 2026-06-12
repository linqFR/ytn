import type { tsDnaId, tsDnaSeq, tsMeta } from "../types/dna-core.types.js";
import type { tsExternals, tsParserResult } from "../types/dna.types.js";
import type { $Xor, IDnaCollector, tsStoreMark, tsStorePosition } from "./generic.types.js";


// Base schema type
export interface ISchemaBase<T> {
  // Properties
  get description(): string | undefined;
  toJSONSchema(): Record<string, unknown>;

  // Meta and wrappers
  meta(): tsMeta;
  meta(value: string | tsMeta): ISchemaBase<T>;
  meta(value?: string | tsMeta): ISchemaBase<T> | tsMeta;
  
  nullable(): ISchemaBase<T | null> & schWrapperMethods<T>;
  optional(): ISchemaBase<T | undefined> & schWrapperMethods<T>;
  exactOptional(): ISchemaBase<T | undefined> & schWrapperMethods<T>;
  nullish(): ISchemaBase<T | null | undefined> & schWrapperMethods<T>;
  nonoptional(): ISchemaBase<T>;
  default(value: T): ISchemaBase<T> & schWrapperMethods<T> & { defaultValue: () => T };
  prefault(value: T): ISchemaBase<T> & schWrapperMethods<T>;
  catch<R>(defaultValue: R): ISchemaBase<T | R>;

  // Validation and transformation
  refine(fn: (value: T) => boolean): tsSchMutate<T>;
  superRefine(fn: (value: T, ctx: any) => void): tsSchMutate<T>;
  transform<R>(fn: (value: T) => R): tsSchMutate<R>;
  check(...schemas: ISchemaBase<any>[]): this;
  custom<R>(fn: (data: any) => R): ISchemaBase<R>;
  brand<B extends string, D extends "out" | "in" | "inout" = "out">(brand: B, direction?: D): ISchemaBase<T & { __brand: B }>;

  // Composition
  array(): tsSchArray<T>;
  or<U>(other: ISchemaBase<U>): ISchemaBase<T | U>;
  and<U>(other: ISchemaBase<U>): ISchemaBase<T & U>;
  xor<U>(other: ISchemaBase<U>): ISchemaBase<$Xor<T, U>>;
  pipe<U>(other: ISchemaBase<U>): ISchemaBase<U>;
  readonly(): ISchemaBase<Readonly<T>>;

  // Utilities
  with(fn: (schema: this) => this): this;
  clone(): this;
  register(fn: (schema: this) => void): this;
  overwrite<U>(fn: (schema: this) => U): U;
  apply<R>(fn: (schema: this) => R): R;
  describe(description: string): this;

  // Information
  isOptional(): boolean;
  isNullable(): boolean;

  // Parsing
  safeParse(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): tsParserResult;
  safeParse(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): tsParserResult;
  parseAsync(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): Promise<tsParserResult>;
  safeParseAsync(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): Promise<tsParserResult>;
  spa(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): Promise<tsParserResult>; // alias for parseAsync

  // Encoding/decoding
  encode(value: T): any;
  decode(value: unknown): T;
  encodeAsync(value: T): Promise<any>;
  decodeAsync(value: unknown): Promise<T>;
  safeEncode(value: T): { success: boolean; data?: any; error?: any };
  safeDecode(value: unknown): tsParserResult;
  safeEncodeAsync(value: T): Promise<{ success: boolean; data?: any; error?: any }>;
  safeDecodeAsync(value: unknown): Promise<tsParserResult>;

  // Validation
  validate(value: unknown, ctx?: tsExternals, collector?: IDnaCollector): boolean;

  // DNA conversion
  toDna(): tsDnaSeq;
  toDna(collector: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;

  _toDna(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
}

// String methods
export interface schStringMethods {
  min(length: number): tsSchString;
  max(length: number): tsSchString;
  pattern(regex: RegExp): tsSchString;
  regex(regex: RegExp): tsSchString;
  trim(): tsSchString;
  toLowerCase(): tsSchString;
  toUpperCase(): tsSchString;
  uppercase(): tsSchString;
  lowercase(): tsSchString;
  normalize(): tsSchString;
  includes(inc: string): tsSchString;
  startsWith(start: string): tsSchString;
  endsWith(end: string): tsSchString;
}

// Number methods
export interface schNumberMethods<T = number> {
  min(value: T): this;
  max(value: T): this;
  gt(value: T): this;
  gte(value: T): this;
  lt(value: T): this;
  lte(value: T): this;
  multipleOf(value: T): this;
  int(): tsSchInteger;
  positive(): this;
  nonnegative(): this;
  negative(): this;
  nonpositive(): this;
}

// BigInt methods
export interface schBigIntMethods extends Omit<schNumberMethods<bigint>, "int"> { }

// Boolean methods
export interface schBooleanMethods { }

// Object methods
export interface schObjectMethods<T extends Record<string, any>> {
  catchAll(s: ISchemaBase<T>): this;
  apply<R>(fn: (schema: this) => R): R;
  omit<K extends keyof T>(keys: Record<K, boolean>): tsSchObject<Omit<T, K>>;
}

// Array methods
export interface schArrayMethods<T> {
  unwrap(): ISchemaBase<T> | ISchemaBase<T[]>;
  min(n: number): tsSchArray<T>;
  max(n: number): tsSchArray<T>;
  length(n: number): tsSchArray<T>;
  nonempty(): tsSchArray<T>;
}

// Union methods
export interface schUnionMethods<T> { }

// Enum methods
export interface schEnumMethods<T extends readonly string[]> {
  enum: Record<string, string>;
  values: string[],
  extract(values: T[number][]): tsSchEnum<T>;
  exclude(values: T[number][]): tsSchEnum<T>;
}

// Literal methods
export interface schLiteralMethods<T> { }

// PseudoType methods
export interface schPseudoTypeMethods<T> { }

// Date methods
export interface schDateMethods {
  min(date: Date): this;
  max(date: Date): this;
}

// URL methods
export interface schUrlMethods {
  protocol(protocols: string[]): this;
  domain(domains: string[]): this;
}

// Unwrap methods
export interface schUnWrapMethods<T> {
  unwrap(): ISchemaBase<T>;
}

// Discriminated schema types
export type tsSchString = ISchemaBase<string> & schStringMethods;
export type tsSchNumber = ISchemaBase<number> & schNumberMethods<number>;
export type tsSchInteger = ISchemaBase<number> & schNumberMethods<number>;
export type tsSchInteger32 = ISchemaBase<number> & schNumberMethods<number>;
export type tsSchBigInt = ISchemaBase<bigint> & schNumberMethods<bigint>;
export type tsSchBoolean = ISchemaBase<boolean> & schBooleanMethods;
export type tsSchDate = ISchemaBase<Date> & schDateMethods;
export type tsSchUrl = ISchemaBase<string> & schUrlMethods;
export type tsSchInstanceOf<T> = ISchemaBase<T>;
export type tsSchObject<T extends Record<string, any>> = ISchemaBase<T> & schObjectMethods<T>;
export type tsSchArray<T> = ISchemaBase<T[]> & schArrayMethods<T>;

export type tsSchUnion<T> = ISchemaBase<T> & schUnionMethods<T>;
export type tsSchEnum<T extends readonly string[]> = ISchemaBase<T[number]> & schEnumMethods<T>;
export type tsSchLiteral<T> = ISchemaBase<T> & schLiteralMethods<T>;
export type tsSchAny = ISchemaBase<any> & schPseudoTypeMethods<any>;
export type tsSchUnknown = ISchemaBase<unknown> & schPseudoTypeMethods<unknown>;
export type tsSchNever = ISchemaBase<never> & schPseudoTypeMethods<never>;
export type tsSchOptional<T> = ISchemaBase<T | undefined> & schUnWrapMethods<T> & schWrapperMethods<T>;
export type tsSchNullable<T> = ISchemaBase<T | null> & schUnWrapMethods<T> & schWrapperMethods<T>;
export type tsSchNullish<T> = ISchemaBase<T | null | undefined> & schUnWrapMethods<T> & schWrapperMethods<T>;
export type tsSchDefault<T> = ISchemaBase<T> & schWrapperMethods<T> & schUnWrapMethods<T> & { defaultValue: () => T };
export type tsSchPrefault<T> = ISchemaBase<T> & schWrapperMethods<T> & schUnWrapMethods<T> & { prefaultValue: () => T };
export type tsSchMutate<T> = ISchemaBase<T>;

// Combinator types
export type tsSchemaValue<S> = S extends ISchemaBase<infer V> ? V : never;
export type tsCombinatorSchemas = readonly [ISchemaBase<any>, ...ISchemaBase<any>[]];
export type tsTupleValue<S extends tsCombinatorSchemas> = { -readonly [K in keyof S]: tsSchemaValue<S[K]> };
export type tsTupleValueWithRest<S extends tsCombinatorSchemas, R> = [R] extends [never]
  ? tsTupleValue<S>
  : [...tsTupleValue<S>, ...R[]];


  // Wrapper methods
export interface schWrapperMethods<T> {
  optional(): tsSchOptional<T>;
  nullable(): tsSchNullable<T>
  nullish(): tsSchNullish<T>;
  default(value: T): tsSchDefault<T>;
  prefault(value: T): ISchemaBase<T> & schUnWrapMethods<T> & schWrapperMethods<T>;
}


import type { tsDna, tsDnaId, tsDnaSeq } from "../types/core.types.js";
import type { tsExternals } from "./runtime.types.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "./meta-context.type.js";
import type { IRefineContext, ISuperRefineContext, ITransformContext } from "./meta-context.type.js";
import type { tsRefineOptions } from "./error.types.js";
import type { tsExternalsDecl, tsParserResult } from "./runtime.types.js";
import type { tsStateDef } from "../builder/state.types.js";
import type { IDnaCollector } from "../builder/collector.types.js";
import type { $MaybeAsync, $Output, $WithBrand, $Xor } from "../types/helpers.types.js";

import type {
  tsDnaNullable,
  tsDnaOptional,
  tsDnaNullish,
  tsDnaDefault,
  tsDnaPrefault,
  tsDnaCatch
} from "../types/api-builder.types.js";
import type { DnaType } from "../builder/dna-interfaces.js";



// Primitive types excluding DNA schemas (all DNA schemas extend IDnaSchemaBase)
// Base primitives without containers (to avoid circular reference)
export type tsPrimitiveBase =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  | object
  | Date
  | RegExp
  | tsPrimitivePromise
  | URL
  | File;

// Container types (use any for nested values to avoid circular reference)
export type tsPrimitiveTuple = readonly tsPrimitiveAll[];
export type tsPrimitivePromise = Promise<any>
export type tsPrimitiveMap = Map<tsPrimitiveAll, tsPrimitiveAll>;
export type tsPrimitiveSet = Set<tsPrimitive>;
export interface tsPrimitiveRecord extends Record<PropertyKey, tsPrimitiveRecord> { }
export type tsPrimitiveArray = Array<tsPrimitiveAll>;

// Combined primitive type with containers
export type tsPrimitive =
  | tsPrimitiveBase
  | tsPrimitiveArray;

// Other primitive types
export type tsPrimitiveFunction = Function;
export type tsPrimitiveClass<A extends any[] = any[], R = any> = abstract new (...args: A) => R;
export type tsPrimitiveEnum = Enumerator;
export type tsPrimitiveLiteral = string | number | bigint | boolean | null | undefined | symbol;

// All primitive types combined
export type tsPrimitiveAll =
  | tsPrimitiveBase
  | tsPrimitiveFunction
  | tsPrimitiveMap
  | tsPrimitiveSet
  | tsPrimitiveClass
  | tsPrimitiveEnum
  | tsPrimitiveLiteral
  | tsPrimitiveRecord
  | tsPrimitiveTuple
  | tsPrimitiveArray;

// Types for the collector
export type tsStoreMark = number;
export type tsStorePosition = number | number[];



// Transform an object of schemas into an object of value types (for refine callbacks)
export type $DnaShapeToValue<T> = T extends Record<PropertyKey, any>
  ? { [K in keyof T]: T[K] extends DnaType<infer V, any> ? V : T[K] }
  : T;

// Lazy schema interface (for recursive definitions)
export interface IDnaLazySchema<T> extends DnaType<T> {
  get innerType(): T;
}

// Variadic sequence types for pipe/seq operations
export type $SeqFirstInput<Schemas extends readonly DnaType<any, any>[]> =
  Schemas extends readonly [DnaType<any, infer I>, ...any[]] ? I : never;

export type $SeqLastOutput<Schemas extends readonly any[]> =
  Schemas extends readonly [...any[], DnaType<infer O, any>] ? O : never;

// Type helpers to extract output/input from schema types (Zod compatibility)
// Extract from _output/_input properties (like Zod's _zod.output/_zod.input)
// ============================================
// Type inference helpers
// ============================================



// Robust helpers with fallback on IDnaSchemaBase generics (for public API)
export type $DnaInferOutput<S> = S extends { _output: infer O } ? O : S extends DnaType<infer V, any> ? V : never;
export type $DnaInferInput<S> = S extends { _input: infer I } ? I : S extends DnaType<any, infer I> ? I : never;
export type $DnaInfer<S> = $DnaInferOutput<S>;


// Parcourt le tuple en s'assurant que l'Input de l'étape N correspond à l'Output de N-1
export type $ValidatePipeArgs<PrevOutput, Schemas extends readonly any[]> =
  Schemas extends readonly [DnaType<infer O, infer I>, ...infer Rest]
  ? [PrevOutput] extends [I]
  ? [DnaType<O, I>, ...$ValidatePipeArgs<O, Rest>]
  : [DnaType<any, PrevOutput>, ...any[]] // Force une erreur TS explicite si mismatch
  : [];


// ============================================
// Core Schema Types
// ============================================

// Core schema type (internal structure with _output/_input like Zod's _zod)
// export interface IDnaSchemaCore<T, I = unknown> {
//   _input: I
//   _output: T
// }

// Base schema type
// export interface tsDnaType<T = any, I = unknown, S extends tsStateDef = tsStateDef> extends IDnaSchemaCore<T, I> {
// export interface tsDnaType<T = any, I = unknown> extends IDnaSchemaCore<T, I> {

//   // Config Properties
//   get _coerce(): boolean;

//   // Properties
//   get description(): string | undefined;
//   get type(): string;
//   toJSONSchema(): Record<string, unknown>;

//   // setHead(head: tsDnaType<any>): void;

//   // Meta and wrappers
//   meta(): tsDnaInnerMeta;
//   meta(value: string | tsDnaMeta): this;

//   nullable(): tsDnaNullable<T, I>;
//   optional(): tsDnaOptional<T, I>;
//   exactOptional(): this;
//   nullish(): tsDnaNullish<T, I>;
//   nonoptional(): tsDnaType<T, I>;
//   default(value: T): tsDnaDefault<T, I>;
//   prefault(value: I): tsDnaPrefault<T, I>;
//   catch<R>(defaultValue: R): tsDnaCatch<R, T, I>;

//   // Validation and transformation
//   refine(fn: (value: $Output<this>) => boolean): this;
//   refine(fn: (value: $Output<this>) => Promise<boolean>): this;
//   refine(fn: (value: $Output<this>) => boolean, options?: string | tsRefineOptions<DnaType<any, any>>): this;
//   refine(fn: (value: $Output<this>) => Promise<boolean>, options?: string | tsRefineOptions<DnaType<any, any>>): this;
//   refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean): this;
//   refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>): this;
//   refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => boolean, options?: string | tsRefineOptions<DnaType<any, any>>): this;
//   refine(fn: (value: $Output<this>, ctx: IRefineContext<$Output<this>>) => Promise<boolean>, options?: string | tsRefineOptions<DnaType<any, any>>): this;
//   superRefine(fn: (value: $Output<this>, ctx: ISuperRefineContext<$Output<this>>) => void): this;

//   transform<R>(fn: (arg: any, ctx: any) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
//   transform<R>(fn: (arg: $Output<this>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
//   transform<R>(fn: (arg: $Output<this>, ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;
//   transform<R>(fn: (ctx: ITransformContext<$Output<this>>) => $MaybeAsync<R>, externals?: tsExternalsDecl): tsDnaType<R, I>;

//   check(...checks: any[]): this;
//   with(...checks: any[]): this;

//   brand<T extends PropertyKey = PropertyKey, Dir extends "in" | "out" | "inout" = "out">(value?: T): PropertyKey extends T ? this : any;

//   // Composition
//   array(): any;
//   or<U>(other: tsDnaType<U>): tsDnaType<T | U>;
//   and<U>(other: tsDnaType<U>): tsDnaType<T & U>;
//   xor<U>(other: tsDnaType<U>): tsDnaType<$Xor<T, U>>;

//   // --- NOUVELLES SIGNATURES POUR PIPE ---
//   pipe<U>(other: tsDnaType<U, T>): tsDnaType<U, I>;
//   pipe<U>(other: tsDnaType<U, any>): tsDnaType<U, I>;
//   pipe<Schemas extends readonly [tsDnaType<any, any>, ...tsDnaType<any, any>[]]>(
//     ...schemas: Schemas & $ValidatePipeArgs<T, Schemas>
//   ): tsDnaType<$SeqLastOutput<Schemas>, I>;
//   // ---------------------------------------

//   readonly(): this;

//   // Utilities
//   clone(): this;
//   register(fn: (schema: this) => void): this;
//   overwrite<U>(fn: (schema: this) => U): U;
//   apply<R>(fn: (schema: this) => R): R;
//   describe(description: string): this;

//   isOptional(): boolean;
//   isNullable(): boolean;
//   isNullish(): boolean;

//   // Parsing and encoding
//   parse(value: unknown, ctx?: tsExternals): T;
//   parseAsync(value: unknown, ctx?: tsExternals): Promise<T>;
//   encode(value: unknown, ctx?: tsExternals): T;
//   encodeAsync(value: unknown, ctx?: tsExternals): Promise<T>;
//   decode(value: unknown, ctx?: tsExternals): T;
//   decodeAsync(value: unknown, ctx?: tsExternals): Promise<T>;
//   safeParse(value: unknown, ctx?: tsExternals): tsParserResult;
//   safeParseAsync(value: unknown, ctx?: tsExternals): Promise<tsParserResult>;
//   safeEncode(value: unknown, ctx?: tsExternals): tsParserResult;
//   safeDecode(value: unknown, ctx?: tsExternals): tsParserResult;
//   safeEncodeAsync(value: unknown, ctx?: tsExternals): Promise<tsParserResult>;
//   safeDecodeAsync(value: unknown, ctx?: tsExternals): Promise<tsParserResult>;

//   toDna(): any;
//   toDna(collector: IDnaCollector, storeMark: tsStoreMark, storePosition?: tsStorePosition): any;
// }







import type { tsDnaType } from "./base.types.js";
import type { IRefinerErrorOpt, IRefinerPayload } from "./error.types.js";
import type { IContext, ITransformContext } from "./meta-context.type.js";

// Transform function type: can be simple (value only) or with context, sync or async, or a constant value
export type tsTransformFn<T, R> =
  | R
  | ((value: T) => R)
  | ((value: T) => Promise<R>)
  | ((value: T, ctx: ITransformContext<T>) => R)
  | ((value: T, ctx: ITransformContext<T>) => Promise<R>)
  | ((ctx: ITransformContext<T>) => R);

// Refine function type: validation function returning boolean
export type tsRefineFn<T> = (value: T) => boolean;

// SuperRefine function type: validation function with context
export type tsSuperRefineFn<T> = (value: T, ctx: any) => void;

// Codec function types: bidirectional encode/decode
export type tsDecodeFn<I, O> = (inVal: I, ctx: IContext<I>) => O;
export type tsEncodeFn<O, I> = (outVal: O, ctx: IContext<O>) => I;

// Mutate opcode options: built-in primitive mutations only
export type tsMutateOpt =
  | ["trim"]
  | ["toUpperCase"]
  | ["toLowerCase"]
  | ["normalize"]
  | ["assign", string]; // constant value JSON string

// Transform opcode options: custom schema transformation
export type tsTransformOpt = [string, number]; // [function string, arity]

export type tsCheckFn<T> = (ctx: IRefinerPayload<T>) => Promise<void> | void;

export type tsRefinerOpt =
| ["func", string, number]
| ["func", string, number, IRefinerErrorOpt]
| ["func", string, number, IRefinerErrorOpt, Record<string, string>]
| ["func", string, number, IRefinerErrorOpt, Record<string, string>, Record<string, string>]
| ["func", string, number, IRefinerErrorOpt, Record<string, string>, Record<string, string>, Record<string, string>];


// Check opcode options: built-in checks or custom functions
export type tsCheckOpt<Flag extends "dna"|"opt"="dna"> =
  | ["lowercase"]
  | ["uppercase"]
  | ["startsWith", string]
  | ["endsWith", string]
  | ["includes", string, number?]
  | ["property", string | number, Flag extends"dna" ? tsDnaType<any> : number]
  | tsRefinerOpt;


// Preprocess opcode options: transform function applied before validation
export type tsPreprocessOpt = [number, string, number]; // [schemaId, function string, arity]

// Pipe opcode options: chain input schema → transform → output schema
export type tsPipeOpt = [number, number, string, number]; // [inSchemaId, outSchemaId, transformFn, arity]

export type tsTmplPartPrimitives = string | number | bigint | boolean | null | undefined ;
export type tsTmplLitArg = tsTmplPartPrimitives | tsDnaType<any>;

/**
 * State Types - Internal State Definitions for DNA Schemas
 *
 * This file contains all the StateDef type definitions used by DNA schemas.
 * These types define the internal state structure for each schema type.
 *
 */

import type { tsDnaType } from "../shared/base.types.js";
import type { tsDna, tsDnaNoMeta, tsDnaSeq } from "../types/core.types.js";
import type { tsTmplLitArg, tsCheckOpt } from "../shared/handlers-builder.types.js";
import type { tsDnaInnerMeta } from "../shared/meta-context.type.js";
import type { tsParserFn, tsValidatorFn } from "../shared/runtime.types.js"
import type { tsDnaEnumInput, tsDnaEnumValues, tsDnaFunctionInput, tsDnaTupleSchemaBase, tsDnaTupleSchemaRO } from "../types/api-builder.types.js";
import type { $CatchValue, $Output } from "../types/helpers.types.js";

// ============================================
// Base State Type
// ============================================


// ============================================
// Local Type Definitions
// ============================================

export type tsWrpTypes = "optional" | "nullable" | "nullish" | "default" | "prefault" | "catch";
// export type tsEnumInput = readonly any[] | Record<string, any>;
// export type tsEnumValues = readonly any[];

// ============================================
// Base State Type
// ============================================

// Layer 1: Pure state declaration (no metadata, no type field)
// This is the core state definition for each schema type
export type tsStateDef = {
  [key: string]: any;
};

// Layer 2: Internal state for StateManager
// Contains StateManager-specific metadata + the pure state declaration
export type tsStateFull<T extends tsStateDef = tsStateDef> = {
  type: string;
  meta: tsDnaInnerMeta;
  coerce?: boolean;
  coerceCode?: string;
  refinerList: tsCheckOpt[];
  dna?: tsDnaNoMeta;
  innerState: T;
  fullDna?: tsDnaSeq;
  cachedParser?: tsParserFn;
  cachedValidator?: tsValidatorFn;
};



// ============================================
// Primitive State Types
// ============================================

export type tsStateLiteral<T> = { value: T };

export type tsStateString = {
  min: number | null;
  max: number | null;
  pattern: RegExp | null;
  format: string | null;
  startsWith?: string;
  endsWith?: string;
  includes?: string;
  sequence: tsDna[];
};

export type tsStateNumber<T extends number | bigint> = {
  min: T | null;
  max: T | null;
  exclMin: boolean;
  exclMax: boolean;
  multOf: T | null;
};

export type tsStateBoolean = {};

export type tsStateDate = {
  min: Date | null;
  max: Date | null;
};

export type tsStateUrl = {
  protocol: RegExp | null;
  hostname: RegExp | null;
  normalize: boolean;
};

// ============================================
// Complex State Types
// ============================================

export type tsStateEnum<T extends tsDnaEnumInput> = {
  enumList: tsDnaEnumValues;
  isObject: boolean;
};

export type tsStateArray<S extends tsDnaType<any, any>> = {
  min: number | null;
  max: number | null;
  length: number | null;
  itemSchema: S;
};

export type tsStateObject<PS extends Record<string,tsDnaType<any, any>> = Record<string,tsDnaType<any, any>>, ADP extends true | false | tsDnaType<any, any> | undefined = undefined> = {
  propertySchemas?: PS;
  addPropSchema?: ADP | true | false | undefined;
  objType: 'strict' | 'loose' | 'standard';
  requiredKeys: string[];
};

export type tsStateRecord<K extends tsDnaType<any>, V extends tsDnaType<any>, I = Record<$Output<K>, $Output<V>>> = {
  keySchema: K;
  valueSchema: V;
  type: "partial" | "loose" | "standard";
};

export type tsStateTuple<S, R> = {
  items: S;
  rest?: tsDnaType<R>;
};

export type tsStateStringBool = {
  map: { truthy: string[]; falsy: string[]; case: boolean };
  case: boolean;
};

export type tsStateTemplateLiteral = {
  parts: tsTmplLitArg[];
  canMutate: false;
};

export type tsStateTemplateLiteralMutate = {
  parts: tsTmplLitArg[];
  canMutate: true;
};

// ============================================
// Special State Types
// ============================================

export type tsStatePromise<T, I> = {
  innerSchema: tsDnaType<T, I>;
};

export type tsStateMap<K extends tsDnaType<any>, V extends tsDnaType<any>> = {
  min: number | null;
  max: number | null;
  size: number | null;
  keySchema: K;
  valueSchema: V;
};

export type tsStateSet<T extends tsDnaType<any>> = {
  min: number | null;
  max: number | null;
  size: number | null;
  itemSchema: T;
};

export type tsStateFunction<I extends tsDnaFunctionInput, O> = {
  input: I;
  output: tsDnaType<O>;
};

export type tsStateCodec<I, O> = {
  inSchema: tsDnaType<I>;
  outSchema: tsDnaType<O>;
  decodeTwin: tsDnaType<O>;
  encodeTwin: tsDnaType<I>;
  cachedEncodeValidator?: any;
  cachedEncodeParser?: any;
};

export type tsStateGetter<T, I> = {
  getter: () => any;
};

// ============================================
// Sequence State Types
// ============================================

export type tsStateSeqRaw = {
  dnaSteps: any[];
};

export type tsStateSeq<T, I, U = I | unknown> = {
  dnaSteps: tsDnaType<any, any>[];
};

// ============================================
// Wrapper State Types
// ============================================

export type tsStateWrp<T, I, Inner extends tsDnaType<T, I> = tsDnaType<T, I>> =
  | { wrapperType: "optional" | "nullable" | "nullish"; inner: Inner; value?: undefined }
  | { wrapperType: "default"; inner: Inner; value: T }
  | { wrapperType: "prefault"; inner: Inner; value: I }
  | { wrapperType: "catch"; inner: Inner; value: $CatchValue<T, I> };

// ============================================
// Discriminator State Types
// ============================================

export type tsStateDiscriminator<K extends string, S extends tsDnaTupleSchemaBase, I> = {
  discriminator: K;
  schemas: S;
};

// ============================================
// Combinator State Types
// ============================================

export type tsStateCombinator<S extends tsDnaTupleSchemaBase> = {
  schemas: S;
  combinatorType: "anyOf" | "allOf" | "oneOf";
};

// ============================================
// Property Check State Type
// ============================================

export type tsStatePropCheck<K extends string | number, S extends tsDnaType<any, any, any>> = {
  property: K;
  schema: S;
};

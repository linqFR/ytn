// ============================================
// DNA Public API Type Definitions
// ============================================

// Import internal method interfaces from method-interfaces.types.ts
import type {
  IArrayMethods,
  IBooleanMethods,
  IDateMethods,
  IEnumMethods,
  ILiteralMethods,
  IMapMethods,
  INumberMethods,
  IObjectMethods,
  IPseudoTypeMethods,
  ISetMethods,
  IUrlMethods
} from "../builder/method-interfaces.types.js";
import type { DnaString } from "../builder/dna-interfaces.js";

// Import IDnaSchemaBase and helper types from base.types.ts
import type {
  tsStateFull,
  tsStateString,
  tsStateNumber,
  tsStateBoolean,
  tsStateDate,
  tsStateUrl,
  tsStateObject,
  tsStateArray,
  tsStateMap,
  tsStateSet,
  tsStateRecord,
  tsStateCombinator,
  tsStateTemplateLiteral,
  tsStateTemplateLiteralMutate,
  tsStateSeq,
  tsStateWrp,
  tsStateEnum,
  tsStateLiteral,
  tsStatePromise,
  tsStateFunction,
  tsStateCodec,
  tsStateTuple,
  tsStateDef,
  tsStateDiscriminator
} from "../builder/state.types.js";
import type { tsDnaType, tsPrimitiveAll, tsPrimitiveClass, $DnaInfer } from "../shared/base.types.js";
import type { IIssue } from "../shared/error.types.js";
import type { tsDnaMeta } from "../shared/meta-context.type.js";
import type { $Input, $Output, $State, $UnionToIntersection, $WithBrand } from "./helpers.types.js";

// ============================================
// Context Types
// ============================================

export interface IContext<T> {
  value: T;
  issues: Array<IIssue<T>>;
  error?: {
    issues: Array<IIssue<T>>;
  };
  input?: unknown;
  path?: PropertyKey[];
}

export interface IRefineContext<T> extends IContext<T> {
  addIssue(issue: { code?: string; message: string; path?: PropertyKey[] }): void;
}

export interface ISuperRefineContext<T> extends IRefineContext<T> {
  path: PropertyKey[];
}

export interface ITransformContext<T> extends IContext<T> {
  addIssue(issue: { code?: string; message: string; path?: PropertyKey[] }): void;
}

export interface ICheckContext<T> extends IContext<T> { }

export type tsDnaCtx<T = unknown> = IContext<T>;

// ============================================
// Refine Options
// ============================================

export interface IRefineOptions<I> {
  error?: string | ((issue: IIssue<I>) => string | null);
  message?: string;
  path?: string[];
  abort?: boolean;
  when?: (payload: { value: I }) => boolean;
  params?: Record<string, unknown>;
  externals?: readonly unknown[] | Record<string, unknown>;
}

export type tsDnaRefineOptions<I> = string | IRefineOptions<I>;

// ============================================
// Runtime Types
// ============================================

export type tsDnaParserError = {
  message: string;
  path: string;
  input: unknown;
};

export type tsDnaParserResult<O = any> =
  | { success: true; data: O }
  | { success: false; errors: tsDnaParserError[] };

export type tsDnaValidatorFn = (value: unknown) => boolean;
export type tsDnaParserFn<I = unknown, O = any> = (value: I) => tsDnaParserResult<O>;

export type tsDnaExternals = Record<string, string | Function>;
export type tsDnaExternalsDeclArray = readonly (Function & { name: string })[];
export type tsDnaExternalsDeclObject = Record<string, unknown>;
export type tsDnaExternalsDecl = tsDnaExternalsDeclArray | tsDnaExternalsDeclObject;

// ============================================
// Helper Types
// ============================================

// ============================================
// Core Schema Types
// ============================================

// Public API type alias for IDnaSchemaBase

// ============================================
// Type Inference Helpers
// ============================================

export type tsDnaInferOutput<S> = S extends { _output: infer O } ? O : S extends tsDnaType<infer V, any> ? V : never;
export type tsDnaInferInput<S> = S extends { _input: infer I } ? I : S extends tsDnaType<any, infer I> ? I : never;
export type tsDnaInfer<S> = tsDnaInferOutput<S>;

// ============================================
// String Format Type Aliases
// ============================================

export interface tsDnaEmail extends tsDnaString { _format: "email"; }
export interface tsDnaUUID extends tsDnaString { _format: "uuid"; }
export interface tsDnaHostname extends tsDnaString { _format: "hostname"; }
export interface tsDnaBase64 extends tsDnaString { _format: "base64"; }
export interface tsDnaHex extends tsDnaString { _format: "hex"; }
export interface tsDnaISODateTime extends tsDnaString { _format: "iso-datetime"; }
export interface tsDnaISODate extends tsDnaString { _format: "iso-date"; }
export interface tsDnaISOTime extends tsDnaString { _format: "iso-time"; }
export interface tsDnaISODuration extends tsDnaString { _format: "iso-duration"; }

// ============================================
// Discriminated Schema Types
// ============================================

export interface tsDnaAny extends tsDnaType<any>, IPseudoTypeMethods<any> { }

export interface tsDnaUnknown extends tsDnaType<unknown>, IPseudoTypeMethods<unknown> { }
export interface tsDnaUndefined extends tsDnaType<undefined>, IPseudoTypeMethods<undefined> { }
export interface tsDnaNull extends tsDnaType<null>, IPseudoTypeMethods<null> { }

export type tsDnaString = DnaString;
export interface tsDnaCoerceString extends tsDnaString { _coerce: true; }
export interface tsDnaNumber extends tsDnaType<number, unknown, tsStateNumber<number>>, INumberMethods<number> { }
export interface tsDnaCoerceNumber extends tsDnaNumber { _coerce: true; }
export interface tsDnaInteger extends tsDnaType<number, unknown, tsStateNumber<number>>, INumberMethods<number> { }
export interface tsDnaCoerceInteger extends tsDnaInteger { _coerce: true; }
export interface tsDnaInteger32 extends tsDnaType<number, unknown, tsStateNumber<number>>, INumberMethods<number> { }
export interface tsDnaCoerceInteger32 extends tsDnaInteger32 { _coerce: true; }
export interface tsDnaBigInt extends tsDnaType<bigint, unknown, tsStateNumber<bigint>>, INumberMethods<bigint> { }
export interface tsDnaCoerceBigInt extends tsDnaBigInt { _coerce: true; }
export interface tsDnaBoolean extends tsDnaType<boolean, unknown, tsStateBoolean>, IBooleanMethods { }
export interface tsDnaCoerceBoolean extends tsDnaBoolean { _coerce: true; }
export interface tsDnaDate extends tsDnaType<Date, unknown, tsStateDate>, IDateMethods { }
export interface tsDnaCoerceDate extends tsDnaDate { _coerce: true; }
export interface tsDnaUrl extends tsDnaType<string, unknown, tsStateUrl>, IUrlMethods { }
export interface tsDnaInstanceOf<T = tsPrimitiveClass> extends tsDnaType<T>, IPseudoTypeMethods<T> { }

export interface tsDnaObject<T extends Record<PropertyKey, any> = Record<PropertyKey, any>, I = unknown> extends tsDnaType<T, I, tsStateObject>, IObjectMethods<T> { }
export interface tsDnaRecord<K extends tsDnaType<PropertyKey, any> = tsDnaType<PropertyKey, any>, V extends tsDnaType = tsDnaType> extends tsDnaType<Record<$Output<K>, $Output<V>>, Record<$Input<K>, $Input<V>>, tsStateRecord<K, V>> { }

export interface tsDnaArray<S extends tsDnaType = tsDnaType> extends tsDnaType<S extends tsDnaType<infer O> ? O[] : S, S extends tsDnaType<infer I> ? I[] : S, tsStateArray<S extends tsDnaType<infer O> ? O : S>>, IArrayMethods<S extends tsDnaType<infer O> ? O : S> { }

export interface tsDnaMap<K extends tsDnaType = tsDnaType, V extends tsDnaType = tsDnaType> extends tsDnaType<Map<$Output<K>, $Output<V>>, Map<$Input<K>, $Input<V>>, tsStateMap<K, V>>, IMapMethods<K, V> { }
export interface tsDnaSet<S extends tsDnaType = tsDnaType> extends tsDnaType<Set<$Output<S>>, Set<$Input<S>>, tsStateSet<S>>, ISetMethods<S> { }

export interface tsDnaUnion<S = any> extends tsDnaType<S extends tsDnaType<infer O> ? O : S, S extends tsDnaType<infer I> ? I : S, tsStateCombinator<S extends tsDnaTupleSchemaBase ? S : any>> { }
export type tsDnaIntersection<S extends tsDnaType[] = tsDnaType[], I = unknown> = tsDnaType<$UnionToIntersection<$Output<S[number]>>, I, tsStateCombinator<S extends tsDnaTupleSchemaBase ? S : any>>;
export interface tsDnaXorUnion<T = any> extends tsDnaType<T extends tsDnaType<infer O> ? O : T, T extends tsDnaType<infer I> ? I : T, tsStateCombinator<T extends tsDnaTupleSchemaBase ? T : any>> { }
export interface tsDnaDiscriminatedUnion<K extends string = string, S extends tsDnaTupleSchemaBase = tsDnaTupleSchemaBase, I = unknown> extends tsDnaType<$DnaInfer<S[number]>, I, tsStateDiscriminator<K, S, I>> { }

export interface tsDnaTmplLit extends tsDnaType<string, string, tsStateString> { }
export interface tsDnaTemplateLiteral extends tsDnaType<string, string, tsStateTemplateLiteral> { }
export interface tsDnaTemplateLiteralMutate extends tsDnaType<string, string, tsStateTemplateLiteralMutate> { }

export interface tsDnaLazy<S = any> extends tsDnaType<any> {
  get innerType(): any;
}

export interface tsDnaPipe<T, I = T> extends tsDnaType<T, I, tsStateSeq<T, I>> { }
export interface tsDnaNonOptional<T, I = T> extends tsDnaType<T, I, tsStateWrp<T, I>> { }

export interface tsDnaEnum<T extends tsDnaEnumInput> extends tsDnaType<tsDnaEnumValueType, tsDnaEnumValueType, tsStateEnum<T>>, IEnumMethods<T extends tsDnaEnumValues ? T : tsDnaEnumValues> { }

export interface tsDnaLiteral<T> extends tsDnaType<T, T, tsStateLiteral<T>>, ILiteralMethods<T> { }
export interface tsDnaNever extends tsDnaType<never, never>, IPseudoTypeMethods<never> { }

export interface tsDnaOptional<T = any, I = T> extends tsDnaType<T | undefined, I | undefined, tsStateWrp<T, I>> { }
export interface tsDnaNullable<T = any, I = T> extends tsDnaType<T | null, I | null, tsStateWrp<T, I>> { }
export interface tsDnaNullish<T = any, I = T> extends tsDnaType<T | null | undefined, I | null | undefined, tsStateWrp<T, I>> { }
export interface tsDnaDefault<T = tsPrimitiveAll, I = tsPrimitiveAll> extends tsDnaType<T, I, tsStateWrp<T, I>> { }
export interface tsDnaPrefault<T = tsPrimitiveAll, I = tsPrimitiveAll> extends tsDnaType<T, I, tsStateWrp<T, I>> { }
export interface tsDnaCatch<R = tsPrimitiveAll, T = tsPrimitiveAll, I = T> extends tsDnaType<T | R, I, tsStateWrp<T, I>> { }

export interface tsDnaMutate<T, I = T> extends tsDnaType<T, I, tsStateWrp<T, I>> { }

export interface tsDnaSymbol extends tsDnaType<symbol, symbol> { }
export interface tsDnaNaN extends tsDnaType<typeof NaN, typeof NaN> { }
export interface tsDnaVoid extends tsDnaType<void, void> { }
export interface tsDnaCustom<T = any, I = any> extends tsDnaType<T, I> { }
export interface tsDnaJson<T = any, I = any> extends tsDnaType<T, I> { }
export interface tsDnaPromise<T = any> extends tsDnaType<Promise<T>, unknown, tsStatePromise<T, unknown>> { }
export interface tsDnaFunction<I extends tsDnaFunctionInput = tsDnaFunctionInput, O = any> extends tsDnaType<O extends tsDnaType<infer OO> ? OO : O, I, tsStateFunction<I, O extends tsDnaType<infer OO> ? OO : O>> { }
export interface tsDnaCodec<I = any, O = any> extends tsDnaType<O extends tsDnaType<infer OO> ? OO : O, I extends tsDnaType<infer II> ? II : I, tsStateCodec<I, O extends tsDnaType<infer OO> ? OO : O>> { }

// ============================================
// Tuple Types
// ============================================


export interface tsDnaTuple<S extends tsDnaTupleSchemaRO, R = never> extends tsDnaType<tsDnaTupleValueWithRest<S, R>, tsDnaTupleValueWithRest<S, R>, tsStateTuple<S, R>> {
  min(n: number, meta?: string | tsDnaMeta): this;
  max(n: number, meta?: string | tsDnaMeta): this;
  length(n: number, meta?: string | tsDnaMeta): this;
  nonempty(): this;
}

// ============================================
// Check Types
// ============================================

export interface tsDnaPropertyCheck<K extends PropertyKey, S extends tsDnaType<any, any, tsStateDef>= tsDnaType<any, unknown, tsStateDef>> {
  kind: "property";
  property: K;
  schema: S;
}

export type tsDnaDescribeCheck = {
  kind: "describe";
  description: string;
};

export type tsDnaMetaCheck = {
  kind: "meta";
  meta: tsDnaMeta;
};

export type tsDnaValidationCheck = {
  kind: "validation";
  check: any;
};

export type tsDnaCheck = tsDnaDescribeCheck | tsDnaMetaCheck | tsDnaValidationCheck;

// ============================================
// Enum Types
// ============================================

export type tsDnaEnumValueType = string | number | bigint;
export type tsDnaEnumValues = readonly tsDnaEnumValueType[];
export type tsDnaEnumInput = tsDnaEnumValues | Record<string, tsDnaEnumValueType>;

// ============================================
// Tuple Types
// ============================================

export type tsDnaTupleSchemaBase = [tsDnaType<any, any, tsStateDef>, ...tsDnaType<any, any, tsStateDef>[]] | [];
export type tsDnaTupleSchemaRO = readonly [tsDnaType<any, any, tsStateDef>, ...tsDnaType<any, any, tsStateDef>[]] | readonly [];
export type tsDnaTupleSchemaArray = tsDnaTupleSchemaRO;
export type tsDnaTupleSchemaSingle = tsDnaType<any>;
export type tsDnaTupleSchema = tsDnaTupleSchemaArray | tsDnaTupleSchemaSingle;
export type tsDnaTupleValue<S extends tsDnaTupleSchemaRO> = { -readonly [K in keyof S]: tsDnaInfer<S[K]> };
export type tsDnaTupleValueWithRest<S extends tsDnaTupleSchemaRO, R> = [R] extends [never]
  ? tsDnaTupleValue<S>
  : [...tsDnaTupleValue<S>, ...R[]];

// ============================================
// Function Types
// ============================================

export type tsDnaFunctionInput = tsDnaTupleSchemaRO;

export type tsDnaFunctionArgs<I extends tsDnaFunctionInput> = I extends readonly tsDnaType<any>[]
  ? { -readonly [K in keyof I]: I[K] extends tsDnaType<infer V> ? V : never }
  : I extends tsDnaType<infer V>
  ? V extends readonly (infer T)[]
  ? V
  : [V]
  : unknown[];


export type tsAllDnaTypes =
  | tsDnaAny
  | tsDnaArray
  | tsDnaBase64
  | tsDnaBigInt
  | tsDnaBoolean
  | tsDnaCatch<any, any, any>
  | tsDnaCodec<any, any>
  | tsDnaCoerceBigInt
  | tsDnaCoerceBoolean
  | tsDnaCoerceDate
  | tsDnaCoerceInteger
  | tsDnaCoerceInteger32
  | tsDnaCoerceNumber
  | tsDnaCoerceString
  | tsDnaCustom<any, any>
  | tsDnaDate
  | tsDnaDefault<any, any>
  | tsDnaDiscriminatedUnion
  | tsDnaEmail
  | tsDnaEnum<any>
  | tsDnaFunction<any, any>
  | tsDnaHex
  | tsDnaHostname
  | tsDnaInstanceOf
  | tsDnaInteger
  | tsDnaInteger32
  | tsDnaIntersection
  | tsDnaISODate
  | tsDnaISODateTime
  | tsDnaISODuration
  | tsDnaISOTime
  | tsDnaJson<any, any>
  | tsDnaLazy
  | tsDnaLiteral<any>
  | tsDnaMap
  | tsDnaMutate<any, any>
  | tsDnaNaN
  | tsDnaNever
  | tsDnaNonOptional<any, any>
  | tsDnaNull
  | tsDnaNullable<any, any>
  | tsDnaNullish<any, any>
  | tsDnaNumber
  | tsDnaObject
  | tsDnaOptional<any, any>
  | tsDnaPipe<any, any>
  | tsDnaPrefault<any, any>
  | tsDnaPromise<any>
  | tsDnaPropertyCheck<any, any>
  | tsDnaRecord
  | tsDnaSet
  | tsDnaString
  | tsDnaSymbol
  | tsDnaTemplateLiteral
  | tsDnaTemplateLiteralMutate
  | tsDnaTmplLit
  | tsDnaTuple<any, any>
  | tsDnaUndefined
  | tsDnaUnion
  | tsDnaUnknown
  | tsDnaUrl
  | tsDnaUUID
  | tsDnaVoid
  | tsDnaXorUnion
  ;

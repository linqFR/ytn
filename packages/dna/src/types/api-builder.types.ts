
import type {
  DnaCatch,
  DnaDefault,
  DnaEnum,
  DnaExactOptional,
  DnaLiteral,
  DnaNonOptional,
  DnaNullable,
  DnaNullish,
  DnaNull,
  DnaObject,
  DnaOptional,
  DnaPrefault,
  DnaType,
  DnaUndefined,
} from "../builder/dna-interfaces.js";

import type { IIssue } from "../shared/error.types.js";
import type { tsDnaMeta } from "../shared/meta-context.type.js";

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
// Type Inference Helpers
// ============================================

export type tsDnaInferOutput<S> = S extends { _output: infer O } ? O : S extends DnaType<infer V, any> ? V : never;
export type tsDnaInferInput<S> = S extends { _input: infer I } ? I : S extends DnaType<any, infer I> ? I : never;
export type tsDnaInfer<S> = tsDnaInferOutput<S>;

// ============================================
// Check Types
// ============================================

export interface tsDnaPropertyCheck<K extends PropertyKey, S extends DnaType<any, any>= DnaType<any, any>> {
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
// TypeScript enums can have both string and number keys, so accept both index signatures.
export type tsDnaEnumInput = tsDnaEnumValues | Record<string, tsDnaEnumValueType> | Record<number, tsDnaEnumValueType>;
export type tsDnaEnumLike = Record<string, tsDnaEnumValueType>;

// ============================================
// Discriminated Unions
// ============================================
export type tsDnaDiscriminant =
  | DnaCatch<tsDnaDiscriminant>
  | DnaDefault<tsDnaDiscriminant>
  | DnaEnum<any>
  | DnaExactOptional<tsDnaDiscriminant>
  | DnaLiteral<any>
  | DnaNonOptional<tsDnaDiscriminant>
  | DnaNullable<tsDnaDiscriminant>
  | DnaNullish<tsDnaDiscriminant>
  | DnaNull
  | DnaOptional<tsDnaDiscriminant>
  | DnaPrefault<tsDnaDiscriminant>
  | DnaUndefined;

export interface tsDnaDiscriminatedBranch<Disc extends string> {
  shape: { [K in Disc]: tsDnaDiscriminant } | undefined;
}

export type tsDnaDiscriminatedUnionObjects<
  Disc extends string,
  Ob extends DnaObject<any> & tsDnaDiscriminatedBranch<Disc> = DnaObject<any> & tsDnaDiscriminatedBranch<Disc>
> = [Ob, ...Ob[]];

// ============================================
// Tuple Types
// ============================================

// export type tsDnaTupleSchemaBase = [DnaType<any, any>, ...DnaType<any, any>[]] | [];
export type tsDnaTupleSchemaBase = [DnaType<any, any>, ...DnaType<any, any>[]];
export type tsDnaTupleSchemaRO = readonly [DnaType<any, any>, ...DnaType<any, any>[]] | readonly [];
export type tsDnaTupleSchemaArray = tsDnaTupleSchemaRO;
export type tsDnaTupleSchemaSingle = [DnaType<any, any>];
export type tsDnaTupleSchema = tsDnaTupleSchemaArray | tsDnaTupleSchemaSingle;
export type tsDnaTupleValue<S extends tsDnaTupleSchemaRO> = { -readonly [K in keyof S]: tsDnaInfer<S[K]> };
export type tsDnaTupleValueWithRest<S extends tsDnaTupleSchemaRO, R> = [R] extends [never]
  ? tsDnaTupleValue<S>
  : [...tsDnaTupleValue<S>, ...R[]];

// ============================================
// Function Types
// ============================================

export type DnaFunctionInput = tsDnaTupleSchemaArray;

export interface DnaFunctionOptions<I extends DnaFunctionInput = DnaFunctionInput, O = unknown> {
  input?: I;
  output?: DnaType<O>;
}

export type DnaFunctionArgs<I extends DnaFunctionInput> = I extends readonly DnaType<any>[]
  ? { -readonly [K in keyof I]: I[K] extends DnaType<infer V> ? V : never }
  : I extends DnaType<infer V>
  ? V extends readonly (infer T)[]
  ? V
  : [V]
  : never[];

// Inferred callable shape of a `DnaFunction<I, O>` schema — mirrors Zod's
// `z.function()`: the schema's own `$Output`/`$Input` IS a function type.
export type tsFunctionType<I extends DnaFunctionInput, O> = (...args: DnaFunctionArgs<I>) => O;


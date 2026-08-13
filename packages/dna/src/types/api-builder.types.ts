
import type {
  DnaSomeType,
  DnaObject,
  DnaType,
  DnaTuple,
} from "@ytrynot/dna/core";
import type { $Output } from "./helpers.types.js";

import type { tsDnaMeta } from "../shared/meta-context.type.js";

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
export type tsDnaDiscriminant = DnaSomeType;

export type tsDnaDiscriminatedUnionObjects<
  Disc extends string,
  Ob extends DnaObject<any> = DnaObject<any>
> = [Ob, ...Ob[]];

// ============================================
// CLI Union (multi-key routing)
// ============================================

export type tsDnaCliUnionObjects<
  S extends DnaSomeType = DnaSomeType
> = [S, ...S[]];

export interface ICliUnionConfig {
  /** Keys that are positionals, in order. If absent → auto-detection. */
  positionals?: string[];
  /** Override auto-detected discriminators. */
  discriminators?: string[];
}

// ============================================
// Tuple Types
// ============================================

export type tsDnaTupleSchemaBase = [DnaType<any, any>, ...DnaType<any, any>[]] | [];
export type tsDnaTupleSchemaRO = readonly [DnaType<any, any>, ...DnaType<any, any>[]] | readonly [];
export type tsDnaTupleSchemaArray = tsDnaTupleSchemaRO;
export type tsDnaTupleSchemaSingle = [DnaType<any, any>];
export type tsDnaTupleSchema = tsDnaTupleSchemaArray | tsDnaTupleSchemaSingle;
export type tsDnaTupleValue<S extends tsDnaTupleSchemaRO> = { -readonly [K in keyof S]: S[K] extends DnaType<infer O, any> ? O : never };
export type tsDnaTupleValueWithRest<S extends tsDnaTupleSchemaRO, R> = [R] extends [never]
  ? tsDnaTupleValue<S>
  : [...tsDnaTupleValue<S>, ...R[]];

// ============================================
// Function Types
// ============================================

export type DnaFunctionInput = readonly [DnaSomeType<any, any>, ...DnaSomeType<any, any>[]] | readonly [] | DnaSomeType<any, any>;

export interface DnaFunctionOptions<I extends DnaFunctionInput = DnaFunctionInput, O extends DnaType<any> = DnaType<unknown>> {
  input?: I;
  output?: O;
}

export type DnaFunctionArgs<I extends DnaFunctionInput> = [I] extends [never]
  ? never[]
  : I extends readonly []
  ? []
  : I extends readonly (infer E)[]
  ? E extends { _output: infer V }
    ? { -readonly [K in keyof I]: I[K] extends { _output: infer V2 } ? V2 : never }
    : never[]
  : I extends { _output: infer V }
  ? V extends readonly (infer T)[]
    ? V
    : [V]
  : never[];

// Inferred callable shape of a `DnaFunction<I, O>` schema — mirrors Zod's
// `z.function()`: the schema's own `$Output`/`$Input` IS a function type.
// `O` is a schema instance (e.g. DnaNumber), so `$Output<O>` extracts the raw
// output type (e.g. number) — same pattern as DnaArray<S> using $Output<S>[].
export type tsFunctionType<I extends DnaFunctionInput, O extends DnaType<any>> = (...args: DnaFunctionArgs<I>) => $Output<O>;


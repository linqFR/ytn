import type { DnaOptional, DnaType, DnaSomeType } from "@ytrynot/dna/core";
import type { tsDnaBaseCtx } from "../shared/meta-context.type.js";
import type { tsPrimitiveLiteral, tsTmplLitPart } from "../shared/base.types.js";

// Re-export shared type helpers for DNA-internal use.
// These were previously duplicated here; they now come from @ytrynot/shared/types.
// See shared/types/README.md and shared/types/wiki.md for the full reference.
export type {
  $IsAny,
  $HasProperty,
  $PropertyCheck,
} from "@ytrynot/shared/types/predicates.type.js";
export type {
  $ReadonlyValue,
  $RemoveUndefined,
  $Without,
  $Or,
  $Xor,
  $Flatten,
  $FlattenDistributive,
} from "@ytrynot/shared/types/structural.type.js";
export type {
  $MaybeAsync,
  $InferReturnType,
} from "@ytrynot/shared/types/async.type.js";
export type {
  $EnumKeys,
  $EnumValues,
  $EnumAsObj,
  $EnumObj,
  $ArrayItem,
  $ToEnum,
} from "@ytrynot/shared/types/enum.type.js";
export type { $UnionToIntersection } from "@ytrynot/shared/types/record.type.js";

// =================================
// infering tools for Dna
// =================================

// Simple helpers for internal use (extract directly from schema properties)
// Use indexed access (S["_output"]) instead of infer O — the infer pattern
// captures the parent's `any` on deferred classes (DnaObject uses
// `extends DnaType<any, any>` + `declare _output`), while indexed access
// correctly resolves the `declare` override.
export type $Output<S> = S extends { _output: any } ? S["_output"] : unknown;
export type $Input<S> = S extends { _input: any } ? S["_input"] : unknown;
export type $InputHead<T> = T extends { _head: infer H }
  ? unknown extends H
  ? $Input<T>
  : $InputHead<H>
  : $Input<T>;

// Brand symbol (like Zod's $brand)
export declare const $brand: unique symbol;
export type $brand<T extends PropertyKey = PropertyKey> = {
  [$brand]: {
    [k in T]: true;
  };
};

// Helper type for branded schemas (like Zod's $ZodBranded)
// Modifies _input and _output to include the brand directly
export type $DnaBranded<T extends DnaType<any, any>, Brand extends PropertyKey, Dir extends "in" | "out" | "inout" = "out"> = T & (Dir extends "inout" ? {
  _input: $Input<T> & $brand<Brand>;
  _output: $Output<T> & $brand<Brand>;
} : Dir extends "in" ? {
  _input: $Input<T> & $brand<Brand>;
} : {
  _output: $Output<T> & $brand<Brand>;
});

// Helper for .catch() recovery value: either a plain fallback value or a recovery function
export type $CatchValue<T, I> = T | ((ctx: tsDnaBaseCtx<I>) => T);

// Map object schemas to their output types
export type $DnaObjectOutput<T extends Record<string, DnaSomeType>> = {
  [K in keyof T]: $Output<T[K]>
};

// Map object schemas to their input types
export type $DnaObjectInput<T extends Record<string, DnaSomeType>> = {
  [K in keyof T]: $Input<T[K]>
};

// Wrap a schema in DnaOptional unless it is already optional
export type $DnaPartialProperty<S extends DnaSomeType> =
  S extends DnaOptional<infer _U> ? S : S extends DnaType<any, any> ? DnaOptional<S> : S;

// Mark selected keys partial; by default all keys
export type $DnaPartialShape<T extends Record<string, DnaSomeType>, K extends keyof T = keyof T> = {
  [P in keyof T]: P extends K ? $DnaPartialProperty<T[P]> : T[P]
};

// Safe extend: restrict overrides to assignable (narrower) schemas
export type $SafeExtendShape<Base extends Record<string, DnaSomeType>, Ext extends Record<string, DnaSomeType>> = {
  [K in keyof Ext]: K extends keyof Base
    ? $Output<Ext[K]> extends $Output<Base[K]>
      ? $Input<Ext[K]> extends $Input<Base[K]>
        ? Ext[K]
        : never
      : never
    : Ext[K];
};

// Helper to infer template literal type from parts array
// Adapted from Zod's approach to handle runtime arrays
type $UndefinedToEmptyString<T> = T extends undefined ? "" : T;
type $ResolvePart<T> = T extends DnaType<any, any> ? $Output<T> : T;

export type $AppendToTemplateLiteral<Template extends string, Suffix extends tsTmplLitPart> =
  Suffix extends tsPrimitiveLiteral ?
  `${Template}${$UndefinedToEmptyString<Suffix>}`
  : Suffix extends DnaType<any, any> ?
  `${Template}${$Output<Suffix> extends infer T extends tsPrimitiveLiteral ? $UndefinedToEmptyString<T> : never}`
  : never;

/**
 * Recursively builds the template literal string type from a parts tuple.
 * `Parts` is `readonly` because `templateLiteral()` uses `readonly [...PP]`, so the
 * helper must accept readonly tuples. `readonly [...infer Rest, infer Last]` is the
 * tuple-safe way to destructure the last element while preserving the rest of the tuple.
 */
export type $TemplateLiteral<Parts extends readonly tsTmplLitPart[]> =
  [] extends Parts ? ``
  : Parts extends readonly [...infer Rest, infer Last extends tsTmplLitPart]
  ? Rest extends readonly tsTmplLitPart[] ?  $AppendToTemplateLiteral<$TemplateLiteral<Rest>, Last>
  : never
  : never;


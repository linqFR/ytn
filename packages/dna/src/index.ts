/**
 * @ytn/dna - DNA-based schema builder with Zod-like syntax
 *
 * Main exports:
 * - dna: Schema factory (Zod-like API)
 * - Types: DNA bytecode type definitions
 * - toJs: Code generation utilities (exportable for @ytn/schvalid)
 * - Constructor registry: For registering constructors used in instanceof validation
 */

// Core schema builder
export { dna } from "./builder/index.js";
import type {
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
  tsSchDefault,
} from "./builder/builder.types.js";

// Classes
export type { tsDna, tsDnaOpcode, tsDnaSeq } from "./types/index.js";

// DNA schema types (for type constraints in helper functions)
export namespace t  {
  export type DnaString = tsSchString;
  export type DnaNumber = tsSchNumber;
  export type DnaInteger = tsSchInteger;
  export type DnaInteger32 = tsSchInteger32;
  export type DnaBigInt = tsSchBigInt;
  export type DnaBoolean = tsSchBoolean;
  export type DnaDate = tsSchDate;
  export type DnaUrl = tsSchUrl;
  export type DnaInstanceOf<T> = tsSchInstanceOf<T>;
  export type DnaObject<T extends Record<string, any>> = tsSchObject<T>;
  export type DnaArray<T> = tsSchArray<T>;
  export type DnaUnion<T> = tsSchUnion<T>;
  export type DnaEnum<T extends readonly string[]> = tsSchEnum<T>;
  export type DnaLiteral<T> = tsSchLiteral<T>;
  export type DnaAny = tsSchAny;
  export type DnaUnknown = tsSchUnknown;
  export type DnaNever = tsSchNever;
  export type DnaOptional<T> = tsSchOptional<T>;
  export type DnaNullable<T> = tsSchNullable<T>;
  export type DnaNullish<T> = tsSchNullish<T>;
  export type DnaMutate<T> = tsSchMutate<T>;
  export type DnaDefault<T> = tsSchDefault<T>;
}
export type { t as types };

// Constructor registry for instanceof validation
export {
  registerConstructor,
  getConstructor,
} from "./toJs/jshelpers.js";

// to JS
export * from "./toJs.js";
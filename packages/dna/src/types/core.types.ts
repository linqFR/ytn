import type { tsDnaMeta, tsDnaInnerMeta } from "../shared/meta-context.type.js";

export type tsDnaOpcode =
  // primitives
  | "s"
  | "_s"
  | "n"
  | "_n"
  | "i"
  | "b"
  | "n0" // null
  | "bi"
  | "undefined"
  | "o"
  | "_o"
  | "a" // array
  | "_a" // undeclared array
  | "c"
  | "cD"
  | "l"
  | "e"
  | "eD" // value constraints
  | "T"
  | "F" // true/false schemas

  // pseudotypes
  | "coerce"
  | "symbol" // symbol 
  | "sb" // string to boolean coercion
  | "void" // void 
  | "template" // templateLiterals
  | "nan" // NaN 
  | "map" // Map 
  | "set" // Set 
  | "json" // JSON 
  | "date"
  | "url"
  | "codec"
  | "function" // function 
  | "promise" // Promise 
  | "instanceOf"

  // Unions
  | "anyOf"
  | "oneOf"
  | "allOf"
  | "discriminator" // discriminated union

  // Conditions
  | "not" // schema composition
  | "if"
  | "then"
  | "else" // conditional schemas

  // wrappers
  | "wrp" // wrapper for default/prefault
  | "optional"
  | "nullable"
  | "default"
  | "prefault"

  // modifiers : wrappers

  // Ref / link
  | "ref" // references

  // checks
  | "check" // refine ( only)

  // Mutations / transformations
  | "preprocess" // transform before 
  | "mutate" // built-in primitive mutations (trim, toUpperCase, etc.)
  | "transform" // custom schema transformation
  | "pipe" // chain schemas with transformations
  | "seq";

export type tsDnaId = number;

export type tsDnaNoMeta = [tsDnaOpcode, ...any[]];
export type tsDna = [...tsDnaNoMeta, tsDnaInnerMeta];

export type tsDnaSeq = [...tsDna[], number[]];

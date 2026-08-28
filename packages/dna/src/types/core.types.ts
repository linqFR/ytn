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
  | "$o"
  | "rcd"
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

  // specifics
  | "cidrv6"
  | "jwt"

  // Unions
  | "anyOf"
  | "oneOf"
  | "allOf"
  | "discriminator" // discriminated union
  | "maranget"      // multi-key routing union (Maranget decision tree)

  // Conditions
  | "not" // schema composition
  | "ifThenElse" // combined if/then/else (emitted by schvalid)

  // wrappers
  | "wrp" // dnaopcode
  | "optional"
  | "nullable"
  | "nullish"
  | "default"
  | "prefault"
  | "catch"

  // modifiers : wrappers

  // Ref / link
  | "ref" // references

  // checks
  | "check" // refine ( only)

  // Mutations / transformations
  | "mutate" // built-in primitive mutations (trim, toUpperCase, etc.)
  | "chkList" // canonical check-all (allOf-like)
  | "chkSeq" // builder multi-step Check refine and superrefined
  | "transform" // transformation handlertransformation
  | "pipe"; // builder multi-step transformation pipeline

export type tsDnaId = number;

export type tsDnaNoMeta = [tsDnaOpcode, ...any[]];
export type tsDna = [...tsDnaNoMeta, tsDnaInnerMeta];

export type tsDnaSeq = [...tsDna[], number[]];

export type tsDnaObjectType = 'strict' | 'loose' | 'standard' | 'object' | 'plainObject';
export type tsDnaCombinatorType = "anyOf" | "allOf" | "oneOf";

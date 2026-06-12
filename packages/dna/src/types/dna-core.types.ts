
export type tsDnaOpcode =
  | "s" | "_s" | "n" | "_n" | "i" | "b" | "n0" // primitives
  | "bi" | "undefined" // additional primitives
  | "o" | "_o" | "a" | "_a" // object/array
  | "c" | "cD" | "l" | "e" | "eD" // value constraints
  | "T" | "F" // true/false schemas
  | "anyOf" | "oneOf" | "allOf" | "not" // schema composition
  | "if" | "then" | "else" // conditional schemas
  | "discriminator" // discriminated union
  | "optional" | "nullable" | "default" | "prefault" // modifiers
  | "ref" // references
  | "mutate" // transform (type change)
  | "check" // refine (validation only)
  | "wrp" // wrapper for default/prefault
  | "date"
  | "url"
  | "instanceOf"
  | "seq"
  | "coerce"
  | "codec";

export type tsMeta = Record<string, any>;

export type tsDnaId = number;

export type tsDna = [tsDnaOpcode, ...any[], tsMeta];

export type tsDnaSeq = [...tsDna[], number[]];

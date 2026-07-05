// ============================================
// DNA Error Codes (runtime constants for Zod compatibility)
// ============================================

import { stringify } from "@ytn/shared/js/json.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "./meta-context.type.js";

// Error codes enum for runtime use
export const DnaIssueCodes = {
  custom: "custom",
  invalid_type: "invalid_type",
  invalid_literal: "invalid_value",
  invalid_value: "invalid_value",
  unrecognized_keys: "unrecognized_keys",
  invalid_union: "invalid_union",
  invalid_union_discriminator: "invalid_union",
  invalid_enum_value: "invalid_enum_value",
  too_small: "too_small",
  too_big: "too_big",
  invalid_date: "invalid_type",
  invalid_format:"invalid_format",
  not_multiple_of:"not_multiple_of",
  invalid_key:"invalid_key",
  invalid_element:"invalid_element",
} as const;

// Type-safe mapping of error codes to their specific field types
type tsDnaErrorFieldsBase = {
  code?: string;
  message?: string;
  error?: string;
};

export type tsDnaErrorFieldsByCode = {
  custom: tsDnaErrorFieldsBase & { params?: Record<string, any> };
  invalid_type: tsDnaErrorFieldsBase & { expected?: tsDnaInvalidTypeExpected };
  invalid_literal: tsDnaErrorFieldsBase & { expected?: any };
  invalid_value: tsDnaErrorFieldsBase & { expected?: any };
  unrecognized_keys: tsDnaErrorFieldsBase & { keys?: string[] };
  invalid_union: tsDnaErrorFieldsBase & { errors?: any[]; discriminator?: string; options?: any[]; inclusive?: boolean };
  invalid_union_discriminator: tsDnaErrorFieldsBase & { discriminator?: string };
  invalid_enum_value: tsDnaErrorFieldsBase & { values?: any[] };
  too_small: tsDnaErrorFieldsBase & { minimum?: number | bigint; inclusive?: boolean; exact?: boolean; origin?: string };
  too_big: tsDnaErrorFieldsBase & { maximum?: number | bigint; inclusive?: boolean; exact?: boolean; origin?: string };
  invalid_date: tsDnaErrorFieldsBase & {};
  invalid_format: tsDnaErrorFieldsBase & { format?: string; pattern?: string; algorithm?: string; prefix?: string; suffix?: string; includes?: string; };
  not_multiple_of: tsDnaErrorFieldsBase & { divisor?: number | bigint };
  invalid_key: tsDnaErrorFieldsBase & { origin?: string };
  invalid_element: tsDnaErrorFieldsBase & { origin?: string };
};

// Type-safe field arrays for each error code
type tsConfErrorFieldsByCode = {
  custom: Array<keyof tsDnaErrorFieldsByCode["custom"]>;
  invalid_type: Array<keyof tsDnaErrorFieldsByCode["invalid_type"]>;
  invalid_literal: Array<keyof tsDnaErrorFieldsByCode["invalid_literal"]>;
  invalid_value: Array<keyof tsDnaErrorFieldsByCode["invalid_value"]>;
  unrecognized_keys: Array<keyof tsDnaErrorFieldsByCode["unrecognized_keys"]>;
  invalid_union: Array<keyof tsDnaErrorFieldsByCode["invalid_union"]>;
  invalid_union_discriminator: Array<keyof tsDnaErrorFieldsByCode["invalid_union_discriminator"]>;
  invalid_enum_value: Array<keyof tsDnaErrorFieldsByCode["invalid_enum_value"]>;
  too_small: Array<keyof tsDnaErrorFieldsByCode["too_small"]>;
  too_big: Array<keyof tsDnaErrorFieldsByCode["too_big"]>;
  invalid_date: Array<keyof tsDnaErrorFieldsByCode["invalid_date"]>;
  invalid_format: Array<keyof tsDnaErrorFieldsByCode["invalid_format"]>;
  not_multiple_of: Array<keyof tsDnaErrorFieldsByCode["not_multiple_of"]>;
  invalid_key: Array<keyof tsDnaErrorFieldsByCode["invalid_key"]>;
  invalid_element: Array<keyof tsDnaErrorFieldsByCode["invalid_element"]>;

};

export const confError: Record<keyof tsConfErrorFieldsByCode, { message: string, expected?: string, fields: tsConfErrorFieldsByCode[keyof tsConfErrorFieldsByCode] }> = {
  custom: {
    message: "Custom validation failed",
    fields: ["params"],
  },
  invalid_type: {
    message: "Invalid type",
    fields: ["expected"],
  },
  invalid_literal: {
    message: "Invalid literal value",
    fields: ["expected"],
  },
  invalid_value: {
    message: "Invalid value",
    fields: ["expected"],
  },
  unrecognized_keys: {
    message: "Unrecognized keys in object",
    fields: ["keys"],
  },
  invalid_union: {
    message: "Invalid union",
    fields: ["errors", "discriminator", "options", "inclusive"],
  },
  invalid_union_discriminator: {
    message: "Invalid union discriminator",
    fields: ["discriminator"],
  },
  invalid_enum_value: {
    message: "Invalid enum value",
    fields: ["values"],
  },
  too_small: {
    message: "Value is too small",
    fields: ["minimum", "inclusive", "exact", "origin"],
  },
  too_big: {
    message: "Value is too big",
    fields: ["maximum", "inclusive", "exact", "origin"],
  },
  invalid_date: {
    message: "Invalid date",
    fields: [],
  },
  invalid_format: {
    message: "Invalid string format",
    fields: ["format", "pattern", "algorithm", "prefix", "suffix", "includes"],
  },
  not_multiple_of: {
    message: "Number is not a multiple of",
    fields: ["divisor"],
  },
  invalid_key: {
    message: "Invalid key",
    fields: ["origin"],
  },
  invalid_element: {
    message: "Invalid element",
    fields: ["origin"],
  },
} as const;

// Type derived from runtime constants
export type tsDnaIssueCodeValues = typeof DnaIssueCodes[keyof typeof DnaIssueCodes];

// Specific error code types derived from runtime constants
export type tsDnaIssueCodeCustom = typeof DnaIssueCodes.custom;
export type tsDnaIssueCodeInvalidType = typeof DnaIssueCodes.invalid_type;
export type tsDnaIssueCodeInvalidLiteral = typeof DnaIssueCodes.invalid_literal;
export type tsDnaIssueCodeInvalidValue = typeof DnaIssueCodes.invalid_value;
export type tsDnaIssueCodeUnrecognizedKeys = typeof DnaIssueCodes.unrecognized_keys;
export type tsDnaIssueCodeInvalidUnion = typeof DnaIssueCodes.invalid_union;
export type tsDnaIssueCodeInvalidUnionDiscriminator = typeof DnaIssueCodes.invalid_union_discriminator;
export type tsDnaIssueCodeInvalidEnumValue = typeof DnaIssueCodes.invalid_enum_value;
export type tsDnaIssueCodeTooSmall = typeof DnaIssueCodes.too_small;
export type tsDnaIssueCodeTooBig = typeof DnaIssueCodes.too_big;
export type tsDnaIssueCodeInvalidDate = typeof DnaIssueCodes.invalid_date;
export type tsDnaIssueCodeInvalidFormat = typeof DnaIssueCodes.invalid_format;
export type tsDnaIssueCodeNotMultipleOf = typeof DnaIssueCodes.not_multiple_of;
export type tsDnaIssueCodeInvalidKey = typeof DnaIssueCodes.invalid_key;
export type tsDnaIssueCodeInvalidElement = typeof DnaIssueCodes.invalid_element;

// Configuration error types based on Zod V4 error structure
export type tsDnaIssueBase = {
  readonly code?: string;
  readonly input?: unknown;
  readonly path: PropertyKey[];
  readonly message: string;
};

export type tsDnaInvalidTypeExpected =
  | "string"
  | "number"
  | "int"
  | "boolean"
  | "bigint"
  | "symbol"
  | "undefined"
  | "null"
  | "never"
  | "void"
  | "date"
  | "array"
  | "object"
  | "tuple"
  | "record"
  | "map"
  | "set"
  | "file"
  | "nonoptional"
  | "nan"
  | "function"
  | (string & {});

export interface tsDnaIssueInvalidType<Input = unknown> extends tsDnaIssueBase {
  readonly code: "invalid_type";
  readonly expected: tsDnaInvalidTypeExpected;
  readonly input?: Input;
}

export interface tsDnaIssueTooBig<Input = unknown> extends tsDnaIssueBase {
  readonly code: "too_big";
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly maximum: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly input?: Input;
}

export interface tsDnaIssueTooSmall<Input = unknown> extends tsDnaIssueBase {
  readonly code: "too_small";
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly minimum: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly input?: Input;
}

export interface tsDnaIssueInvalidStringFormat extends tsDnaIssueBase {
  readonly code: "invalid_format";
  readonly format: string;
  readonly pattern?: string;
  readonly input?: string;
}

///////////////////////////////////////////
////     first-party string formats     ////
///////////////////////////////////////////

export interface tsDnaIssueStringCommonFormats extends tsDnaIssueInvalidStringFormat {
  readonly format: Exclude<string, "regex" | "jwt" | "starts_with" | "ends_with" | "includes">;
}

export interface tsDnaIssueStringInvalidRegex extends tsDnaIssueInvalidStringFormat {
  readonly format: "regex";
  readonly pattern: string;
}

export interface tsDnaIssueStringInvalidJWT extends tsDnaIssueInvalidStringFormat {
  readonly format: "jwt";
  readonly algorithm?: string;
}

export interface tsDnaIssueStringStartsWith extends tsDnaIssueInvalidStringFormat {
  readonly format: "starts_with";
  readonly prefix: string;
}

export interface tsDnaIssueStringEndsWith extends tsDnaIssueInvalidStringFormat {
  readonly format: "ends_with";
  readonly suffix: string;
}

export interface tsDnaIssueStringIncludes extends tsDnaIssueInvalidStringFormat {
  readonly format: "includes";
  readonly includes: string;
}

export type tsDnaStringFormatIssues =
  | tsDnaIssueStringCommonFormats
  | tsDnaIssueStringInvalidRegex
  | tsDnaIssueStringInvalidJWT
  | tsDnaIssueStringStartsWith
  | tsDnaIssueStringEndsWith
  | tsDnaIssueStringIncludes;

export interface tsDnaIssueNotMultipleOf<Input extends number | bigint = number | bigint> extends tsDnaIssueBase {
  readonly code: "not_multiple_of";
  readonly divisor: number | bigint;
  readonly input?: Input;
}

export interface tsDnaIssueUnrecognizedKeys extends tsDnaIssueBase {
  readonly code: "unrecognized_keys";
  readonly keys: string[];
  readonly input?: Record<string, unknown>;
}

export interface tsDnaIssueInvalidUnionNoMatch extends tsDnaIssueBase {
  readonly code: "invalid_union";
  readonly errors: any[][];
  readonly input?: unknown;
  readonly discriminator?: string | undefined;
  readonly options?: any[];
  readonly inclusive?: true;
}

export interface tsDnaIssueInvalidUnionMultipleMatch extends tsDnaIssueBase {
  readonly code: "invalid_union";
  readonly errors: [];
  readonly input?: unknown;
  readonly discriminator?: string | undefined;
  readonly inclusive: false;
}

export type tsDnaIssueInvalidUnion = tsDnaIssueInvalidUnionNoMatch | tsDnaIssueInvalidUnionMultipleMatch;

export interface tsDnaIssueInvalidKey<Input = unknown> extends tsDnaIssueBase {
  readonly code: "invalid_key";
  readonly origin: "map" | "record";
  readonly issues: any[];
  readonly input?: Input;
}

export interface tsDnaIssueInvalidElement<Input = unknown> extends tsDnaIssueBase {
  readonly code: "invalid_element";
  readonly origin: "map" | "set";
  readonly key: unknown;
  readonly issues: any[];
  readonly input?: Input;
}

export interface tsDnaIssueInvalidValue<Input = unknown> extends tsDnaIssueBase {
  readonly code: "invalid_value";
  readonly values: any[];
  readonly input?: Input;
}

export interface tsDnaIssueCustom extends tsDnaIssueBase {
  readonly code: "custom";
  readonly params?: Record<string, any> | undefined;
  readonly input?: unknown;
}

export type tsDnaIssue =
  | tsDnaIssueInvalidType
  | tsDnaIssueTooBig
  | tsDnaIssueTooSmall
  | tsDnaIssueInvalidStringFormat
  | tsDnaIssueNotMultipleOf
  | tsDnaIssueUnrecognizedKeys
  | tsDnaIssueInvalidUnion
  | tsDnaIssueInvalidKey
  | tsDnaIssueInvalidElement
  | tsDnaIssueInvalidValue
  | tsDnaIssueCustom;


export function formatErr<TCode extends keyof tsDnaErrorFieldsByCode>(
  meta: tsDnaInnerMeta | undefined,
  defaultFields: { message: string, path: string, input: string, code: TCode },
  customFields: tsDnaErrorFieldsByCode[TCode] = {}
): string {
  const _meta = meta ?? {};
  const { code, message, path, input } = defaultFields;
  const conf = confError[code];
  const fieldsArray = conf?.fields || [];
  const err = "input:" + input + ","
    + "code:" + stringify((customFields.code ?? code)) + ","
    + "message:" + stringify(customFields.message ?? customFields.error ?? _meta.error ?? _meta.message ?? message ?? conf?.message) + ","
    + fieldsArray.reduce((acc, k) => { const v = customFields[k as keyof tsDnaErrorFieldsByCode[TCode]]; if (v !== undefined) acc.push(k + ":" + stringify(v) + ","); return acc }, [] as string[]).join("")
    + "path:" + stringify(path);
  return "errors.push({" + err + "})";
}

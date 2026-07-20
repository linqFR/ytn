// ============================================
// DNA Error Types (inspired by Zod V4)
// ============================================

import type { $Input, $Output } from "../types/helpers.types.js";
import type {
  tsDnaIssueCodeValues,
  tsDnaIssueCodeCustom,
  tsDnaIssueCodeInvalidType,
  tsDnaIssueCodeInvalidLiteral,
  tsDnaIssueCodeUnrecognizedKeys,
  tsDnaIssueCodeInvalidUnion,
  tsDnaIssueCodeInvalidUnionDiscriminator,
  tsDnaIssueCodeInvalidEnumValue,
  tsDnaIssueCodeTooSmall,
  tsDnaIssueCodeTooBig,
  tsDnaIssueCodeInvalidDate,
} from "./error-codes.js";

///////////////////////////
////     base type     ////
///////////////////////////
export interface ODnaIssueBase {
  readonly code?: string;
  readonly input?: unknown;
  readonly path: PropertyKey[];
  readonly message: string;
}

////////////////////////////////
////     issue subtypes     ////
////////////////////////////////
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
  | (string & {}); // class names for instanceof

export interface ODnaIssueInvalidType<Input = unknown> extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeInvalidType;
  readonly expected: tsDnaInvalidTypeExpected;
  readonly input?: Input;
}

export interface ODnaIssueTooBig<Input = unknown> extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeTooBig;
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly maximum: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly input?: Input;
}

export interface ODnaIssueTooSmall<Input = unknown> extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeTooSmall;
  readonly origin: "number" | "int" | "bigint" | "date" | "string" | "array" | "set" | "file" | (string & {});
  readonly minimum: number | bigint;
  readonly inclusive?: boolean;
  readonly exact?: boolean;
  readonly input?: Input;
}

export interface ODnaIssueInvalidStringFormat extends ODnaIssueBase {
  readonly code: "invalid_format";
  readonly format: string;
  readonly pattern?: string;
  readonly input?: string;
}

export interface ODnaIssueNotMultipleOf<Input extends number | bigint = number | bigint> extends ODnaIssueBase {
  readonly code: "not_multiple_of";
  readonly divisor: number;
  readonly input?: Input;
}

export interface ODnaIssueUnrecognizedKeys extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeUnrecognizedKeys;
  readonly keys: string[];
  readonly input?: Record<string, unknown>;
}

export interface ODnaIssueInvalidUnion extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeInvalidUnion;
  readonly errors: tsDnaIssue[][];
  readonly input?: unknown;
  readonly discriminator?: string | undefined;
  readonly options?: unknown[];
  readonly inclusive?: true;
}

export interface ODnaIssueInvalidKey<Input = unknown> extends ODnaIssueBase {
  readonly code: "invalid_key";
  readonly origin: "map" | "record";
  readonly issues: tsDnaIssue[];
  readonly input?: Input;
}

export interface ODnaIssueInvalidElement<Input = unknown> extends ODnaIssueBase {
  readonly code: "invalid_element";
  readonly origin: "map" | "set";
  readonly key: unknown;
  readonly issues: tsDnaIssue[];
  readonly input?: Input;
}

export interface ODnaIssueInvalidValue<Input = unknown> extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeInvalidLiteral;
  readonly values: unknown[];
  readonly input?: Input;
}

export interface ODnaIssueCustom extends ODnaIssueBase {
  readonly code: tsDnaIssueCodeCustom;
  readonly params?: Record<string, any> | undefined;
  readonly input?: unknown;
}

////////////////////////
////     utils     /////
////////////////////////

export type tsDnaIssue =
  | ODnaIssueInvalidType
  | ODnaIssueTooBig
  | ODnaIssueTooSmall
  | ODnaIssueInvalidStringFormat
  | ODnaIssueNotMultipleOf
  | ODnaIssueUnrecognizedKeys
  | ODnaIssueInvalidUnion
  | ODnaIssueInvalidKey
  | ODnaIssueInvalidElement
  | ODnaIssueInvalidValue
  | ODnaIssueCustom;

export type tsDnaIssueCode = tsDnaIssue["code"];

export type tsDnaInternalIssue<T extends ODnaIssueBase = tsDnaIssue> = T extends any ? RawIssue<T> : never;
type RawIssue<T extends ODnaIssueBase> = T extends any
? (Omit<T, "message" | "path"> & {
  readonly input: unknown;
      readonly inst?: unknown;
      readonly continue?: boolean | undefined;
    } & Record<string, unknown>)
  : never;

export type tsDnaRawIssue<T extends ODnaIssueBase = tsDnaIssue> = tsDnaInternalIssue<T>;

export interface IDnaErrorMap<T extends ODnaIssueBase = tsDnaIssue> {
  (issue: tsDnaRawIssue<T>): { message: string } | string | undefined | null;
}

////////////////////////    ERROR INTERFACE   ////////////////////////

export interface ODnaError<T = unknown> extends Error {
  type: T;
  issues: tsDnaIssue[];
  _dna: {
    output: T;
    def: tsDnaIssue[];
  };
  stack?: string;
  name: string;
}

export class DnaError<T = unknown> extends Error {
	public type: T;
	public issues: tsParserError[];
	public _dna: { output: T; def: tsParserError[] };
	constructor(issues: tsParserError[], type?: T) {
		super(issues[0]?.message ?? "DNA validation error");
		this.name = "DnaError";
		this.issues = issues;
		this.type = (type ?? undefined) as unknown as T;
		this._dna = { output: undefined as unknown as T, def: this.issues };
		if (Error.captureStackTrace) Error.captureStackTrace(this, DnaError);
	}
}

///////////////////    ERROR UTILITIES (TYPES ONLY)   ////////////////////////

export type tsDnaFlattenedError<T, U = string> = {
  formErrors: U[];
  fieldErrors: {
    [P in keyof T]?: U[];
  };
};

type _tsDnaFormattedError<T, U = string> = T extends [any, ...any[]]
  ? { [K in keyof T]?: tsDnaFormattedError<T[K], U> }
  : T extends any[]
    ? { [k: number]: tsDnaFormattedError<T[number], U> }
    : T extends object
    ? { [K in keyof T]?: tsDnaFormattedError<T[K], U> }
      : any;

export type tsDnaFormattedError<T, U = string> = {
  _errors: U[];
} & _tsDnaFormattedError<T, U>;

// ============================================
// DNA-specific error types
// ============================================

// Unified issue type for all contexts (refine, check, transform)
export interface IIssue<T> {
  code?: string;
  message?: string;
  input?: T;
  inst?: T;
  path?: PropertyKey[];
  [key: string]: unknown;
}

// Error message type (can be string or null)
export type tsErrorMsg = string | null;

// Refine options
export interface IRefineOptions<I> {
  error?: string | ((issue: IIssue<I>) => tsErrorMsg);
  message?: string;
  path?: string[];
  abort?: boolean;
  when?: (payload: { value: $Output<I> }) => boolean;
  params?: Record<string, unknown>;
  // External references used inside the refine fn (imports/helpers), declared so codegen
  // can expose them (`const name = externals.name`); values supplied at validate/parse.
  externals?: readonly unknown[] | Record<string, unknown>;
}

// Refine options can be a string (error message) or an object
export type tsRefineOptions<I> = string | IRefineOptions<I>;

// Payload for refiner functions
export interface IRefinerPayload<T = unknown> {
  value: $Output<T>;
  issues: IIssue<T>[];
  aborted?: boolean;
  fallback?: boolean | undefined;
}

// Error options for refiner functions
export interface IRefinerErrorOpt<T = unknown> {
  error?: string | ((issue: IIssue<T>) => string | { error: string } | null | undefined);
  abort?: boolean;
  path?: string[];
  when?: ((payload: IRefinerPayload<T>) => boolean) | undefined;
}

// Meta error type for schema metadata
export type tsDnaMetaError =
  | string
  | { error?: string; message?: string }
  | { error?: (() => tsDnaIssue) | ((iss: tsDnaIssue) => string | undefined) };

// Parser error type
export type tsParserError = {
  message: string;
  path: string;
  input: unknown;
};

// Type for addIssue parameter
export interface IAddIssue {
  code?: string;
  message: string;
  path?: PropertyKey[];
}
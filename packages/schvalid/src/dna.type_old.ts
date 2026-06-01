import type { STEP } from "./toJS/utils.js";

/**
 * @type tsDnaOpcode
 * @description Opcode names for the DNA bytecode representation.
 */
export type tsDnaOpcode =
	// Primitive Types
	| "string"
	| "number"
	| "integer"
	| "bigint"
	| "boolean"
	| "date"
	| "null"
	| "undefined"
	| "any"
	| "email"
	| "uuid"
	| "url"

	// Value Constraints
	| "literal"
	| "const"
	| "enum"

	// String Constraints
	| "minLength"
	| "maxLength"
	| "eqLength"
	| "pattern"

	// Number Constraints
	| "minimum"
	| "maximum"
	| "exclusiveMinimum"
	| "exclusiveMaximum"
	| "multipleOf"

	// Array Types
	| "array"
	| "tuple"
	| "prefixItems"
	| "items"

	// Array Constraints
	| "uniqueItems"
	| "contains"
	| "minContains"
	| "maxContains"
	| "minItems"
	| "maxItems"
	| "unevaluatedItems"

	// Object Types
	| "object"
	| "strictObject"
	| "looseObject"

	// Object Structure
	| "properties"
	| "patternProperties"
	| "additionalProperties"
	| "propertyNames"
	| "proptype"
	| "required"
	| "dependentRequired"
	| "minProperties"
	| "maxProperties"
	| "unevaluatedProperties"

	// Schema Composition
	| "allOf"
	| "anyOf"
	| "oneOf"
	| "not"
	| "ifThenElse"
	| "dependentSchemas"

	// References
	| "$ref"
	| "dynRef"
	| "dynAnchor"
	| "definitions"
	| "$defs"

	// Modifiers
	| "optional"
	| "nullable"
	| "default"
	| "prefault"
	| "seq";

/**
 * @type tsDna
 * @description DNA bytecode representation - array-based validation schema.
 */
export type tsDna = [tsDnaOpcode, ...any[]];
export type tsDnaSeq = tsDna[];

export type tsErr = {
	input: any;
	expected: string;
	code: string;
	path: string[];
	abort: boolean;
	message?: string | ((v: any) => string);
	[x: string]: any;
};
export type tsResOk = [any, undefined];
export type tsResExc = { success: true; data: any } | { success: false; error: tsErr[] };

export type tsTargetDNA = number;

export type tsMeta = Record<string, any>;

export type tsJSFuncReturn = string;
export type tsJSFuncReturnLong = [string, string];

export type tsJSParentCtx = {
	unEvalObj?: string,
	unEvalArr?: string,
	breakBlock?: String,
	counter?: string,
	isCond?:boolean,
	ownScope?: boolean,
	typeChecked?:string,
	not?:string,
}
export type tsJSStepString = string;
// tsJSStepOp : dnaid, _inVarName (can be "" but rarely), _outVarName (being "" changes the output), pathVar, Environment/Context
// Context will track types already check at parent level and pass through varname of evaluated items (for unevaluated Properties / items)
export type tsJSStepOp = [number, string, string?, string?, tsJSParentCtx?];
export type tsJSStepAct = [typeof STEP[keyof typeof STEP], string];
export type tsJSFn = tsJSStepString | (tsJSStepOp | tsJSStepAct)[];
export type tsLaberlId = (_?: 0 | 1) => number;

// export type tsFnDNACached = (varName: string, pathVar: string, assign?: string ) => tsJSFuncReturn;
// export type tsFnInlineCache = Record<number, tsFnDNACached>;

export type tsFnDNA = (args: any[], inputVarName: string, outputVarName: string, pathVar: string, labelId?: tsLaberlId, parentCtx?: tsJSParentCtx) => tsJSFn;

// export type tsFnDNAHybrid = (inlineCache: tsFnInlineCache, args: any[], varName: string, pathVar: string) => tsJSFuncReturnLong;

export type tsMapper = Record<string, tsFnDNA>;

export type tsTypeDNA = [number[], tsMeta];
export type tsOfList = [[string, ...number[]], tsMeta];

export type tsStringDNA = [
	[number | null, number | null, string | null, string | null], // [min, max, pattern, format]
	tsMeta, // meta (without path)
];

export type tsNumberDNA = [
	[number | null, number | null, number | null, number | null, number | null], // [min, exclMin, max, exclMax, multOf]
	tsMeta, // meta (without path)
];

export type tsConstDNA = ["c", any, tsMeta];

export type tsEnumDNA = ["e", any[], tsMeta];

export type tsLiteralDNA = ["l", any, tsMeta];

export type tsRequiredDNA = [
	string[], // required keys
	tsTargetDNA,
];

export type tsObjectDNA = [any[], tsMeta];

export type tsObjProperties = [[string, tsTargetDNA][]];

export type tsArrayDNA = [any[], tsMeta];

export type tsIfThenElseDNA = [
	[number, number, number], // [ifIndex, thenIndex, elseIndex] where -1 means n/a
];

/**
 * @type tsValidatorFn
 * @description Function signature for DNA validator - returns boolean.
 */
export type tsValidatorFn = (value: unknown) => boolean;

/**
 * @type tsParserError
 * @description Error object returned by DNA parser.
 */
export type tsParserError = {
	message: string;
	path: string;
	input: unknown;
};

/**
 * @type tsParserResult
 * @description Result object returned by DNA parser.
 */
export type tsParserResult =
	| { success: true; data: any }
	| { success: false; errors: tsParserError[] };

/**
 * @type tsParserFn
 * @description Function signature for DNA parser - returns parser result.
 */
export type tsParserFn = (value: unknown) => tsParserResult;

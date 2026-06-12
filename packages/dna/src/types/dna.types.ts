
export type { tsDnaOpcode, tsDna } from "./dna-core.types.js";


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


export type tsExternals = Record<string, string | Function>;


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
export type tsParserResult<O = any> =
	| { success: true; data: O }
	| { success: false; errors: tsParserError[] };

/**
 * @type tsParserFn
 * @description Function signature for DNA parser - returns parser result.
 */
export type tsParserFn<I = unknown, O = any> = (value: I) => tsParserResult<O>;

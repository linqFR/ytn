import type { tsParserError } from "./error.types.js";

export type tsErr<T = any> = {
	input: T;
	expected: string;
	code: string;
	path: string[];
	abort: boolean;
	message?: string | ((v: T) => string);
	[x: string]: any;
};
export type tsResOk<T = any> = [T, undefined];
export type tsResExc<T = any> = { success: true; data: T } | { success: false; error: tsErr[] };


/** External references a serialized function uses (imports/helpers). Array form derives
 * the name from each value's `.name`; object form uses its keys. The NAMES travel in the
 * DNA (so codegen can normalize bundler-mangled refs and expose `const name = externals.name`);
 * the VALUES are supplied at validate/parse time via the externals argument. */

export type tsDnaExternals = Record<string, string | Function>;

/** Declaration form for externals (array or object) used in transform/refine/check/codec.
 * Array form: named functions with `.name` (e.g., `[myFn]`). Arrow functions or anonymous
 * functions are NOT allowed — use the object form `{ myHelper: (v) => v }` to explicitly name them.
 * Object form: `{ myHelper: fn }` where values can be functions or other values (e.g., strings for codec). */
export type tsDnaExternalsDeclArray = readonly (Function & { name: string })[];
export type tsDnaExternalsDeclObject = Record<string, unknown>;
export type tsDnaExternalsDecl = tsDnaExternalsDeclArray | tsDnaExternalsDeclObject;


/**
 * @type tsDnaValidatorFn
 * @description Function signature for DNA validator - returns boolean.
 */
export type tsDnaValidatorFn = (value: unknown) => boolean;

/**
 * @type tsDnaParserResult
 * @description Result object returned by DNA parser.
 */
export type tsDnaParserResult<O = any> =
	| { success: true; data: O }
	| { success: false; errors: tsParserError[] };

/**
 * @type tsDnaParserFn
 * @description Function signature for DNA parser - returns parser result.
 */
export type tsDnaParserFn<I = unknown, O = any> = (value: I) => tsDnaParserResult<O>;

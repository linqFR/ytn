
// DNA types now imported from @ytrynot/dna
// export type * from "@ytrynot/dna";
export * from "./jschema-to-dna.js";
// export * from "./zod-to-dna.js"; // deprecated

// Re-export validation functions from @ytrynot/dna for convenience
// Use schvalid-specific versions (canonical DNA opcodes only)
import { validator as _validator, parser as _parser, toJS as _toJS } from "@ytrynot/dna/toJs";
import type { tsDnaParserFn, tsDnaValidatorFn, tsDnaSeq } from "@ytrynot/dna/toJs"

// Convenience functions that combine schema conversion and validation
// import { validator as dnaValidator, parser as dnaParser } from "@ytrynot/dna";
import { jschemaToDna } from "./jschema-to-dna.js";
/**
 * Compiles DNA bytecode into a fast boolean validator function (fail-fast).
 * Re-exported from `@ytrynot/dna/toJs`.
 *
 * @param dna - DNA bytecode sequence produced by `jschemaToDna()`.
 * @returns A validator function `(value: unknown) => boolean`. Returns `true` if the input matches the schema, `false` otherwise. No error collection.
 * @example
 * import { jschemaToDna, validator } from "@ytrynot/schvalid";
 * const dna = jschemaToDna({ type: "string", minLength: 3 });
 * const validate = validator(dna);
 * validate("hello"); // true
 * validate("hi");    // false
 */
export const validator: typeof _validator = _validator;
/**
 * Compiles DNA bytecode into a parser function with full error collection and output construction.
 * Re-exported from `@ytrynot/dna/toJs`.
 *
 * @param dna - DNA bytecode sequence produced by `jschemaToDna()`.
 * @returns A parser function `(value) => { success: true, data } | { success: false, errors }`. On success, `data` is a fresh output object built from the validated input. On failure, `errors` contains detailed issue objects.
 * @example
 * import { jschemaToDna, parser } from "@ytrynot/schvalid";
 * const dna = jschemaToDna({ type: "string", minLength: 3 });
 * const parse = parser(dna);
 * parse("hello"); // { success: true, data: "hello" }
 * parse("hi");    // { success: false, errors: [...] }
 */
export const parser: typeof _parser = _parser;
/**
 * Low-level DNA → JavaScript code compiler.
 * Re-exported from `@ytrynot/dna/toJs`.
 *
 * @param validateMode - `true` for validator mode (boolean, fail-fast), `false` for parser mode (error collection + output construction).
 * @param enhancedMapper - `false` for canonical JSON Schema opcodes (schvalid), `true` for builder API opcodes.
 * @param ownProperties - Optional. Controls `Object.hasOwnProperty` vs `in` semantics for property checks.
 * @returns A function `(dna: tsDnaSeq) => string[]` that produces JavaScript source code from DNA bytecode.
 * @example
 * import { jschemaToDna, toJS } from "@ytrynot/schvalid";
 * const dna = jschemaToDna({ type: "string" });
 * const code = toJS(true, false)(dna);
 * console.log(code.join("\n")); // generated validator source
 */
export const toJS: typeof _toJS = _toJS;
/**
 * Function signature returned by `parser()`.
 * Re-exported as alias of `tsDnaParserFn` from `@ytrynot/dna/toJs`.
 *
 * @typeParam I - Input type (defaults to `unknown`).
 * @typeParam O - Output type (defaults to `any`).
 * @example
 * const parse: DnaParseFn = parser(dna);
 * const result = parse(input); // { success: true, data: O } | { success: false, errors: [...] }
 */
export type DnaParseFn = tsDnaParserFn;
/**
 * Function signature returned by `validator()`.
 * Re-exported as alias of `tsDnaValidatorFn` from `@ytrynot/dna/toJs`.
 *
 * @example
 * const validate: DnaValidatorFn = validator(dna);
 * const ok: boolean = validate(input);
 */
export type DnaValidatorFn = tsDnaValidatorFn;


type tsCompileOptions = {
	/** Enable format validation (default: false, per Draft 2020-12) */
	formatAssertion?: boolean;
	/** Enable strict JSON Schema validation (default: true) */
	strict?: boolean;
	/** Validate schema against JSON Schema 2020-12 rules (default: true) */
	validateSchema?: boolean;
}

/**
 * Combines an already-compiled `validate`/`parse` pair into a hybrid parser:
 * runs the (cheaper) validator first; on success, returns
 * `{ success: true, data: value }` WITHOUT re-running the full parser. This skips
 * the parser's own output construction entirely, so `data` is the raw input
 * reference (not a filtered/copied object) on the happy path. On failure, falls
 * back to the full parser to collect detailed errors.
 *
 * TRADE-OFF (schvalid-only — not offered on `@ytrynot/dna` builder schemas, where
 * output construction is a core part of the parse contract):
 * on success, `parse()` returns a FRESH output object (its own copy, e.g. via
 * `Object.assign(Object.create(null), value)`), while this hybrid returns
 * `data === value` (the same reference, no copy at all). Both still agree on
 * validity — `additionalProperties: false` and other constraints are checked
 * identically by `validate()`. Only use this when the fast path's lack of a
 * fresh `data` object is acceptable for your workload.
 *
 * PERFORMANCE INVARIANT: takes ALREADY-compiled `validate`/`parse` functions
 * (each backed by a `new Function(...)` compilation) instead of re-compiling —
 * callers (`parserFast`, `schvalid("all").compile`) must compile `validate`/
 * `parse` ONCE and pass the same instances here, never recreate them per call.
 */
const combineFast = <I = unknown, O = any>(validate: tsDnaValidatorFn, parse: tsDnaParserFn<I, O>): tsDnaParserFn<I, O> =>
	(value: I) => validate(value)
		// CAST: fast path returns value directly (no copy), so O (parser's output type) cannot be inferred from I
		? { success: true, data: value as unknown as O }
		: parse(value);

/**
 * Builds a hybrid parser directly from DNA bytecode (compiles `validate`/`parse`
 * ONCE, then delegates to `combineFast`). See `combineFast` for the full
 * behavior/trade-off documentation.
 */
export const parserFast = <I = unknown, O = any>(dna: tsDnaSeq): tsDnaParserFn<I, O> =>
	combineFast(_validator(dna), _parser(dna));

/**
 * Schvalid builder API - compile schema once, validate many times
 * @param mode - "validation" for boolean result, "parser" for detailed errors,
 * "fast" for the hybrid validate-then-parse (see `parserFast`), "all" for validate + parse + parseFast
 * @returns Compiler function
 */
export function schvalid(mode: "validation"): { compile(schema: any, options?: tsCompileOptions): tsDnaValidatorFn };
export function schvalid(mode: "parser"): { compile(schema: any, options?: tsCompileOptions): tsDnaParserFn };
export function schvalid(mode: "fast"): { compile(schema: any, options?: tsCompileOptions): tsDnaParserFn };
export function schvalid(mode: "all"): { compile(schema: any, options?: tsCompileOptions): { validate: tsDnaValidatorFn; parse: tsDnaParserFn; parseFast: tsDnaParserFn } };
export function schvalid(mode: "validation" | "parser" | "fast" | "all") {
	return {
		/**
		 * Compile a JSON Schema into a validation function
		 * @param schema - JSON Schema object
		 * @param options - Options for schema compilation
		 * @returns Validation function
		 */
		compile(schema: any, options?: tsCompileOptions) {
			const dna = jschemaToDna(schema, "#", options);

			if (mode === "validation") {
				return _validator(dna);
			}
			else if (mode === "parser") {
				return _parser(dna);
			}
			else if (mode === "fast") {
				return parserFast(dna);
			}
			else {
				// Compile `validate`/`parse` ONCE and reuse both instances for
				// `parseFast` (via `combineFast`) — never recompile a third time.
				const validate = _validator(dna);
				const parse = _parser(dna);
				return {
					validate,
					parse,
					parseFast: combineFast(validate, parse)
				};
			}
		}
	};
}


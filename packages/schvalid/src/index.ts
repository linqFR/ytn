
// DNA types now imported from @ytrynot/dna
// export type * from "@ytrynot/dna";
export * from "./jschema-to-dna.js";
// export * from "./zod-to-dna.js"; // deprecated

// Re-export validation functions from @ytrynot/dna for convenience
// Use schvalid-specific versions (canonical DNA opcodes only)
import { validator, parser, toJS } from "@ytrynot/dna/toJs";
import type { tsDnaParserFn, tsDnaValidatorFn, tsDnaSeq } from "@ytrynot/dna/toJs"

// Convenience functions that combine schema conversion and validation
// import { validator as dnaValidator, parser as dnaParser } from "@ytrynot/dna";
import { jschemaToDna } from "./jschema-to-dna.js";
export { validator, parser, toJS };
export type { tsDnaParserFn as DnaParseFn, tsDnaValidatorFn as DnaValidatorFn };


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
		? { success: true, data: value as unknown as O }
		: parse(value);

/**
 * Builds a hybrid parser directly from DNA bytecode (compiles `validate`/`parse`
 * ONCE, then delegates to `combineFast`). See `combineFast` for the full
 * behavior/trade-off documentation.
 */
export const parserFast = <I = unknown, O = any>(dna: tsDnaSeq): tsDnaParserFn<I, O> =>
	combineFast(validator(dna), parser(dna));

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
				return validator(dna);
			}
			else if (mode === "parser") {
				return parser(dna);
			}
			else if (mode === "fast") {
				return parserFast(dna);
			}
			else {
				// Compile `validate`/`parse` ONCE and reuse both instances for
				// `parseFast` (via `combineFast`) — never recompile a third time.
				const validate = validator(dna);
				const parse = parser(dna);
				return {
					validate,
					parse,
					parseFast: combineFast(validate, parse)
				};
			}
		}
	};
}


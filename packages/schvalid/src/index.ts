
// DNA types now imported from @ytn/dna
// export type * from "@ytn/dna";
export * from "./jschema-to-dna.js";
// export * from "./zod-to-dna.js"; // deprecated

// Re-export validation functions from @ytn/dna for convenience
// Use schvalid-specific versions (canonical DNA opcodes only)
import { validator, parser, toJS } from "@ytn/dna/toJs";
import type { tsParserFn, tsValidatorFn } from "@ytn/dna/toJs"

// Convenience functions that combine schema conversion and validation
// import { validator as dnaValidator, parser as dnaParser } from "@ytn/dna";
import { jschemaToDna } from "./jschema-to-dna.js";
export type { tsParserFn, tsValidatorFn };
export { validator, parser, toJS };


/**
 * Schvalid builder API - compile schema once, validate many times
 * @param mode - "validation" for boolean result, "parser" for detailed errors, "both" for both functions
 * @returns Compiler function
 */
export function schvalid(mode: "validation"): { compile(schema: any, options?: { formatAssertion?: boolean }): tsValidatorFn };
export function schvalid(mode: "parser"): { compile(schema: any, options?: { formatAssertion?: boolean }): tsParserFn };
export function schvalid(mode: "both"): { compile(schema: any, options?: { formatAssertion?: boolean }): { validate: tsValidatorFn; parse: tsParserFn } };
export function schvalid(mode: "validation" | "parser" | "both") {
	return {
		/**
		 * Compile a JSON Schema into a validation function
		 * @param schema - JSON Schema object
		 * @param options - Options for schema compilation
		 * @param options.formatAssertion - Enable format validation (default: false, per Draft 2020-12)
		 * @returns Validation function
		 */
		compile(schema: any, options?: { formatAssertion?: boolean }) {
			const dna = jschemaToDna(schema, "#", options);

			if (mode === "validation") {
				return validator(dna);
			}
			else if (mode === "parser") {
				return parser(dna);
			}
			else {
				return {
					validate: validator(dna),
					parse: parser(dna)
				};
			}
		}
	};
}


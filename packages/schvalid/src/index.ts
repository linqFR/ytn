
// DNA types now imported from @ytn/dna
// export type * from "@ytn/dna";
export * from "./jschema-to-dna.js";
// export * from "./zod-to-dna.js"; // deprecated

// Re-export validation functions from @ytn/dna for convenience
// Use schvalid-specific versions (canonical DNA opcodes only)
import { validator, parser, toJS } from "@ytn/dna/toJs";
import type { tsDnaParserFn, tsDnaValidatorFn } from "@ytn/dna/toJs"

// Convenience functions that combine schema conversion and validation
// import { validator as dnaValidator, parser as dnaParser } from "@ytn/dna";
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
 * Schvalid builder API - compile schema once, validate many times
 * @param mode - "validation" for boolean result, "parser" for detailed errors, "both" for both functions
 * @returns Compiler function
 */
export function schvalid(mode: "validation"): { compile(schema: any, options?: tsCompileOptions): tsDnaValidatorFn };
export function schvalid(mode: "parser"): { compile(schema: any, options?: tsCompileOptions): tsDnaParserFn };
export function schvalid(mode: "both"): { compile(schema: any, options?: tsCompileOptions): { validate: tsDnaValidatorFn; parse: tsDnaParserFn } };
export function schvalid(mode: "validation" | "parser" | "both") {
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
			else {
				return {
					validate: validator(dna),
					parse: parser(dna)
				};
			}
		}
	};
}


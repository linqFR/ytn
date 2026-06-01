
// DNA types now imported from @ytn/dna
export type * from "@ytn/dna";
// export * from "./dna-helpers_old.js"; // deprecated, unused
// export * from "./dna-to-js_old.ts"; // moved to @ytn/dna
// export * from "./dna-to-zod.js"; // deprecated
// export * from "./dnaz-processor_deprecated.js";
export * from "./jschema-to-dna.js";
export { dnaToJSchema } from "./dna-to-jschema.js";
// export * from "./zod-to-dna.js"; // deprecated

// Re-export validation functions from @ytn/dna for convenience
export { validator, parser, toJS } from "@ytn/dna";

// Convenience functions that combine schema conversion and validation
import { validator as dnaValidator, parser as dnaParser } from "@ytn/dna";
import { jschemaToDna } from "./jschema-to-dna.js";

/**
 * Validate data against a JSON Schema (fail-fast, boolean result)
 * @param schema - JSON Schema object
 * @param data - Data to validate
 * @returns true if valid, false otherwise
 */
export function validate(schema: any, data: any): boolean {
	const dna = jschemaToDna(schema);
	const validateFn = dnaValidator(dna);
	return validateFn(data);
}

/**
 * Parse data against a JSON Schema (error collection and transformation)
 * @param schema - JSON Schema object
 * @param data - Data to validate
 * @returns Result object with success flag, data, and errors
 */
export function parse(schema: any, data: any): { success: boolean; data?: any; errors?: any[] } {
	const dna = jschemaToDna(schema);
	const parseFn = dnaParser(dna);
	return parseFn(data);
}


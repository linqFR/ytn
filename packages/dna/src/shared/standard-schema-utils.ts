/**
 * Standard Schema Protocol Utilities
 *
 * This module provides utility functions for converting DNA-specific
 * types to Standard Schema Protocol V1 compatible formats.
 */

import type { StandardSchemaV1 } from "./standard-schema.types.js";
import type { tsParserError } from "./error.types.js";

/**
 * Converts a DNA parser error path string to Standard Schema path array format
 * DNA path format: "field.nested[0].item"
 * Standard Schema path format: ["field", "nested", 0, "item"]
 */
function convertPath(dnaPath: string): (string | number)[] {
	if (!dnaPath || dnaPath === "") return [];
	
	const result: (string | number)[] = [];
	const parts = dnaPath.split(/[\.\[\]]+/).filter(Boolean);
	
	for (const part of parts) {
		// Check if it's a numeric array index
		const num = Number(part);
		if (!isNaN(num) && part === num.toString()) {
			result.push(num);
		} else {
			result.push(part);
		}
	}
	
	return result;
}

/**
 * Converts a DNA parser error to a Standard Schema V1 issue
 */
function convertError(dnaError: tsParserError): StandardSchemaV1.Issue {
	return {
		message: dnaError.message,
		path: convertPath(dnaError.path)
	};
}

/**
 * Converts an array of DNA parser errors to a Standard Schema V1 FailureResult
 */
export function convertToStandardFailure(dnaErrors: tsParserError[]): StandardSchemaV1.FailureResult {
	return {
		issues: dnaErrors.map(convertError)
	};
}

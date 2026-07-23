/**
 * DNA Bytecode to JSON Schema Converter
 * 
 * This module converts DNA bytecode sequences to JSON Schema representations.
 * It uses the DNA opcodes as the source of truth, ensuring consistency with
 * the DNA validation engine.
 */

import type { tsDna, tsDnaSeq, tsDnaOpcode } from "../types/core.types.js";

/**
 * JSON Schema representation
 * Can be an object, boolean (true/false schemas), or other valid JSON Schema types
 */
export type JSONSchema = Record<string, unknown> | boolean;

/**
 * Converts a DNA sequence to JSON Schema
 */
export function dnaToJsonSchema(dnaSeq: tsDnaSeq): JSONSchema {
	if (dnaSeq.length === 0) {
		return {};
	}

	// The main schema is the first DNA instruction
	// References are stored in the second array
	const mainDna = dnaSeq[0];
	const refs = dnaSeq[1] as number[];

	// Ensure mainDna is a valid DNA instruction (not a reference array)
	if (Array.isArray(mainDna) && mainDna.length > 0 && typeof mainDna[0] === 'string') {
		return convertDnaNode(mainDna as tsDna, dnaSeq, refs);
	}

	return {};
}

/**
 * Converts a single DNA node to JSON Schema
 */
function convertDnaNode(dna: tsDna, dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const [opcode, ...params] = dna;
	const meta = params[params.length - 1] as Record<string, unknown> | undefined;

	switch (opcode) {
		// Primitives
		case "s":
		case "_s":
			return convertString(params, meta);
		case "n":
		case "_n":
			return convertNumber(params, meta);
		case "i":
			return { type: "integer" };
		case "b":
			return { type: "boolean" };
		case "n0":
			return { type: "null" };
		case "bi":
			return { type: "integer" }; // BigInt as integer
		case "undefined":
			return { type: "null" }; // JSON Schema doesn't have undefined
		case "void":
			return { type: "null" };

		// Complex types
		case "o":
		case "_o":
			return convertObject(params, dnaSeq, refs, meta);
		case "a":
		case "_a":
			return convertArray(params, dnaSeq, refs, meta);
		case "l":
			return convertLiteral(params);
		case "e":
			return convertEnum(params);
		case "template":
			return convertTemplate(params);

		// Unions
		case "anyOf":
			return convertAnyOf(params, dnaSeq, refs);
		case "oneOf":
			return convertOneOf(params, dnaSeq, refs);
		case "allOf":
			return convertAllOf(params, dnaSeq, refs);

		// Wrappers
		case "wrp":
			return convertWrp(params, dnaSeq, refs, meta);
		case "optional":
			return convertOptional(params, dnaSeq, refs);
		case "nullable":
			return convertNullable(params, dnaSeq, refs);
		case "default":
			return convertDefault(params, dnaSeq, refs, meta);
		case "prefault":
			return convertPrefault(params, dnaSeq, refs, meta);

		// References
		case "ref":
			return convertRef(params, dnaSeq, refs);

		// Special cases - T and F represent always-true and always-false schemas
		case "T":
			// T represents a schema that always validates (true schema)
			return true;
		case "F":
			// F represents a schema that never validates (false schema)
			return false;

		// Other types (basic implementations)
		case "coerce":
		case "symbol":
		case "sb":
		case "nan":
		case "map":
		case "set":
		case "json":
		case "date":
		case "url":
		case "codec":
		case "function":
		case "promise":
		case "instanceOf":
		case "mutate":
		case "transform":
		case "pipe":
		case "seq":
		case "check":

		// FIXME: they are not other implementations they exist in json schema
		case "discriminator":
		case "not":
		case "if":
		case "then":
		case "else":
		case "c":
		case "cD":
		case "eD":
			// For complex types, return a basic schema
			// These would need more sophisticated handling
			return { type: "object", description: `DNA opcode: ${opcode}` };

		default:
			return { type: "object", description: `Unknown DNA opcode: ${opcode}` };
	}
}

/**
 * Converts string DNA to JSON Schema
 */
function convertString(params: unknown[], meta?: Record<string, unknown>): JSONSchema {
	const schema: JSONSchema = { type: "string" };

	// Add constraints from params if present
	// This would need to parse the string constraints from DNA params
	if (meta?.minLength !== undefined) {
		schema.minLength = meta.minLength;
	}
	if (meta?.maxLength !== undefined) {
		schema.maxLength = meta.maxLength;
	}
	if (meta?.pattern !== undefined) {
		schema.pattern = meta.pattern;
	}
	if (meta?.format !== undefined) {
		schema.format = meta.format;
	}

	return schema;
}

/**
 * Converts number DNA to JSON Schema
 */
function convertNumber(params: unknown[], meta?: Record<string, unknown>): JSONSchema {
	const schema: JSONSchema = { type: "number" };

	if (meta?.minimum !== undefined) {
		schema.minimum = meta.minimum;
	}
	if (meta?.maximum !== undefined) {
		schema.maximum = meta.maximum;
	}
	if (meta?.exclusiveMinimum !== undefined) {
		schema.exclusiveMinimum = meta.exclusiveMinimum;
	}
	if (meta?.exclusiveMaximum !== undefined) {
		schema.exclusiveMaximum = meta.exclusiveMaximum;
	}
	if (meta?.multipleOf !== undefined) {
		schema.multipleOf = meta.multipleOf;
	}

	return schema;
}

/**
 * Converts object DNA to JSON Schema
 */
function convertObject(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?: Record<string, unknown>): JSONSchema {
	const schema: Record<string, unknown> = {
		type: "object",
		properties: {}
	};

	// Parse params format: [ [ 'properties', [ [ 'key', refId, meta ], ... ] ], ... ]
	const constraints = params[0] as Array<[string, Array<[string, number, Record<string, unknown>]>]> | undefined;
	if (constraints) {
		for (const [key, value] of constraints) {
			if (key === 'properties' && Array.isArray(value)) {
				for (const [propName, refId, propMeta] of value) {
					const propDna = dnaSeq[refId as number];
					if (Array.isArray(propDna) && propDna.length > 0 && typeof propDna[0] === 'string') {
						(schema.properties as Record<string, unknown>)[propName as string] = convertDnaNode(propDna as tsDna, dnaSeq, refs);
					}
				}
			}
		}
	}

	// Handle required keys
	if (meta?.requiredKeys && Array.isArray(meta.requiredKeys)) {
		schema.required = meta.requiredKeys;
	}

	// Handle additionalProperties based on object type
	if (meta?.objType === "strict") {
		schema.additionalProperties = false;
	} else if (meta?.objType === "loose") {
		schema.additionalProperties = true;
	}

	return schema;
}

/**
 * Converts array DNA to JSON Schema
 */
function convertArray(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?: Record<string, unknown>): JSONSchema {
	const schema: Record<string, unknown> = { type: "array" };

	// Parse params format: [ [ 'items', refId ], ... ]
	const constraints = params[0] as Array<[string, number]> | undefined;
	if (constraints) {
		for (const [key, refId] of constraints) {
			if (key === 'items' && refId !== undefined) {
				const itemDna = dnaSeq[refId];
				if (Array.isArray(itemDna) && itemDna.length > 0 && typeof itemDna[0] === 'string') {
					schema.items = convertDnaNode(itemDna as tsDna, dnaSeq, refs);
				}
			}
		}
	}

	// Add constraints from meta if present
	if (meta?.minItems !== undefined) {
		schema.minItems = meta.minItems;
	}
	if (meta?.maxItems !== undefined) {
		schema.maxItems = meta.maxItems;
	}

	return schema;
}

/**
 * Converts literal DNA to JSON Schema
 */
function convertLiteral(params: unknown[]): JSONSchema {
	const values = params[0];
	return values.length > 1 ? { enum: values } : { const: values[0] };
}

/**
 * Converts enum DNA to JSON Schema
 */
function convertEnum(params: unknown[]): JSONSchema {
	const values = params[0] as unknown[];
	return { enum: values };
}

/**
 * Converts template literal DNA to JSON Schema
 */
function convertTemplate(params: unknown[]): JSONSchema {
	// Template literals are complex - for now, treat as string
	return { type: "string" };
}

/**
 * Converts anyOf (union) DNA to JSON Schema
 */
function convertAnyOf(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const options = params[0] as number[];
	return {
		anyOf: options.map(refId => {
			const dna = dnaSeq[refId];
			if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
				return convertDnaNode(dna as tsDna, dnaSeq, refs);
			}
			return {};
		})
	};
}

/**
 * Converts oneOf (xor) DNA to JSON Schema
 */
function convertOneOf(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const options = params[0] as number[];
	return {
		oneOf: options.map(refId => {
			const dna = dnaSeq[refId];
			if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
				return convertDnaNode(dna as tsDna, dnaSeq, refs);
			}
			return {};
		})
	};
}

/**
 * Converts allOf (intersection) DNA to JSON Schema
 */
function convertAllOf(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const schemas = params[0] as number[];
	return {
		allOf: schemas.map(refId => {
			const dna = dnaSeq[refId];
			if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
				return convertDnaNode(dna as tsDna, dnaSeq, refs);
			}
			return {};
		})
	};
}

/**
 * Converts the generic "wrp" wrapper DNA to JSON Schema.
 * Format: ["wrp", [wrptype, innerRef, value?], meta]
 */
function convertWrp(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?: Record<string, unknown>): JSONSchema {
	const [wrptype, innerRef, value] = params[0] as [string, number, any?];
	switch (wrptype) {
		case "optional":
		case "nonoptional":
		case "exactOptional":
			return convertOptional([innerRef, meta], dnaSeq, refs);
		case "nullable":
		case "nullish":
			return convertNullable([innerRef, meta], dnaSeq, refs);
		case "default":
			return convertDefault([innerRef, value], dnaSeq, refs);
		case "prefault":
			return convertPrefault([innerRef, value], dnaSeq, refs);
		case "catch": {
			const innerDna = dnaSeq[innerRef];
			if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
				return convertDnaNode(innerDna as tsDna, dnaSeq, refs);
			}
			return {};
		}
		default:
			return {};
	}
}

/**
 * Converts optional wrapper DNA to JSON Schema
 */
function convertOptional(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const innerRef = params[0] as number;
	const innerDna = dnaSeq[innerRef];
	if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
		return convertDnaNode(innerDna as tsDna, dnaSeq, refs);
	}
	return {};
}

/**
 * Converts nullable wrapper DNA to JSON Schema
 */
function convertNullable(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const innerRef = params[0] as number;
	const innerDna = dnaSeq[innerRef];
	if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
		const innerSchema = convertDnaNode(innerDna as tsDna, dnaSeq, refs);
		return {
			anyOf: [innerSchema, { type: "null" }]
		};
	}
	return { anyOf: [{ type: "null" }] };
}

/**
 * Converts default wrapper DNA to JSON Schema
 */
function convertDefault(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const innerRef = params[0] as number;
	const innerDna = dnaSeq[innerRef];
	if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
		const innerSchema = convertDnaNode(innerDna as tsDna, dnaSeq, refs);
		if (Object.hasOwn(params, 1) && typeof innerSchema === 'object') {
			(innerSchema as Record<string, unknown>).default = params[1];
		}
		return innerSchema;
	}
	return {};
}

/**
 * Converts prefault wrapper DNA to JSON Schema
 */
function convertPrefault(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const innerRef = params[0] as number;
	const innerDna = dnaSeq[innerRef];
	if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
		const innerSchema = convertDnaNode(innerDna as tsDna, dnaSeq, refs);
		if (Object.hasOwn(params, 1) && typeof innerSchema === 'object') {
			(innerSchema as Record<string, unknown>).default = params[1];
		}
		return innerSchema;
	}
	return {};
}

/**
 * Converts reference DNA to JSON Schema
 */
function convertRef(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const refId = params[0] as number;
	const dna = dnaSeq[refId];
	if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
		return convertDnaNode(dna as tsDna, dnaSeq, refs);
	}
	return {};
}

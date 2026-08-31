/**
 * DNA Bytecode to JSON Schema Converter
 * 
 * This module converts DNA bytecode sequences to JSON Schema representations.
 * It uses the DNA opcodes as the source of truth, ensuring consistency with
 * the DNA validation engine.
 */

import type { tsDnaInnerMeta } from "../shared/meta-context.type.js";
import type { tsDna, tsDnaSeq, tsDnaOpcode } from "../types/core.types.js";

/**
 * JSON Schema representation
 * Can be an object, boolean (true/false schemas), or other valid JSON Schema types
 */
export type JSONSchema = Record<string, unknown> | boolean;

/**
 * Converts a DNA sequence to JSON Schema
 */
const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

function jsonTypeOf(value: unknown): "string" | "number" | "boolean" | "object" | "array" | "null" | undefined {
	if (value === null) return "null";
	const t = typeof value;
	if (t === "string" || t === "boolean") return t;
	if (t === "number") return "number";
	if (t === "object") return Array.isArray(value) ? "array" : "object";
	return undefined;
}

function commonJsonType(values: unknown[]): "string" | "number" | "boolean" | "object" | "array" | "null" | undefined {
	if (values.length === 0) return undefined;
	const first = jsonTypeOf(values[0]);
	if (first === undefined) return undefined;
	for (let i = 1; i < values.length; i++) {
		if (jsonTypeOf(values[i]) !== first) return undefined;
	}
	return first;
}

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
	const meta = params[params.length - 1] as tsDnaInnerMeta | undefined;

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
			return convertObject(params, dnaSeq, refs, meta, "object");
		case "$o":
			return convertObject(params, dnaSeq, refs, meta, "strippedObject");
		case "rcd":
			return convertObject(params, dnaSeq, refs, meta, "plainObject");
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
		case "coerce": {
			const coerceParams = params[0] as [string, number];
			const innerRef = coerceParams[1];
			const innerDna = dnaSeq[innerRef];
			if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
				return convertDnaNode(innerDna as tsDna, dnaSeq, refs);
			}
			return { type: "object", description: `DNA opcode: ${opcode}` };
		}
		case "discriminator":
			return convertDiscriminator(params, dnaSeq, refs);

		// Const / enum (deep variants included — JSON Schema const/enum accept objects/arrays)
		case "c":
		case "cD":
			return convertConst(params);
		case "eD":
			return convertEnum(params);

		// Conditional schemas
		case "not":
			return convertNot(params, dnaSeq, refs);
		case "ifThenElse":
			return convertIfThenElse(params, dnaSeq, refs);

		case "symbol":
		case "sb": //stringbool
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
		case "check":
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
function convertObject(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?: Record<string, unknown>, kind: string = "object"): JSONSchema {
	const schema: Record<string, unknown> = {
		type: "object",
		properties: {}
	};

	if (kind !== "object") schema["x-ytrynot-object-kind"] = kind;

	const constraints = params[0] as Array<[string, any]> | undefined;
	if (constraints) {
		for (const [key, value] of constraints) {
			if ((key === 'properties' || key === 'defaultProperties') && Array.isArray(value)) {
				for (const [propName, refId, propMeta] of value) {
					const propDna = dnaSeq[refId as number];
					if (Array.isArray(propDna) && propDna.length > 0 && typeof propDna[0] === 'string') {
						(schema.properties as Record<string, unknown>)[propName as string] = convertDnaNode(propDna as tsDna, dnaSeq, refs);
					}
				}
			} else if (key === 'required' && Array.isArray(value)) {
				schema.required = value;
			} else if (key === 'additionalProperties') {
				if (typeof value === 'number') {
					const addDna = dnaSeq[value];
					if (Array.isArray(addDna) && addDna.length > 0 && typeof addDna[0] === 'string') {
						schema.additionalProperties = convertDnaNode(addDna as tsDna, dnaSeq, refs);
					}
				} else if (value === true) {
					// Zod 2020-12 toJSONSchema uses {} for loose
					schema.additionalProperties = {};
				} else if (value === false) {
					schema.additionalProperties = false;
				}
			} else if (key === 'propertyNames' && typeof value === 'number') {
				const keyDna = dnaSeq[value];
				if (Array.isArray(keyDna) && keyDna.length > 0 && typeof keyDna[0] === 'string') {
					schema.propertyNames = convertDnaNode(keyDna as tsDna, dnaSeq, refs);
				}
			}
		}
	}

	// Fallback for builder objects with no explicit additionalProperties constraint
	if (schema.additionalProperties === undefined && kind !== "plainObject") {
		schema.additionalProperties = false;
	}

	return schema;
}

/**
 * Converts array DNA to JSON Schema
 */
function convertArray(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?: Record<string, unknown>): JSONSchema {
	const schema: Record<string, unknown> = { type: "array" };

	const constraints = params[0] as Array<[string, any]> | undefined;
	if (constraints) {
		for (const [key, value] of constraints) {
			if (key === 'items' && value !== undefined) {
				if (typeof value === 'number') {
					const itemDna = dnaSeq[value];
					if (Array.isArray(itemDna) && itemDna.length > 0 && typeof itemDna[0] === 'string') {
						schema.items = convertDnaNode(itemDna as tsDna, dnaSeq, refs);
					}
				} else if (value === false) {
					schema.items = false;
				}
			} else if (key === 'prefixItems' && Array.isArray(value)) {
				schema.prefixItems = value.map(refId => {
					const itemDna = dnaSeq[refId as number];
					if (Array.isArray(itemDna) && itemDna.length > 0 && typeof itemDna[0] === 'string') {
						return convertDnaNode(itemDna as tsDna, dnaSeq, refs);
					}
					return {};
				});
			} else if (key === 'minItems') {
				schema.minItems = value;
			} else if (key === 'maxItems') {
				schema.maxItems = value;
			}
		}
	}

	if (schema.minItems === undefined && meta?.minItems !== undefined) {
		schema.minItems = meta.minItems;
	}
	if (schema.maxItems === undefined && meta?.maxItems !== undefined) {
		schema.maxItems = meta.maxItems;
	}

	// Tuples: if prefixItems is set and items is false
	if (schema.prefixItems !== undefined && schema.items === false && schema.maxItems === undefined) {
		schema.maxItems = (schema.prefixItems as unknown[]).length;
	}

	return schema;
}

/**
 * Converts literal DNA to JSON Schema
 */
function convertLiteral(params: unknown[]): JSONSchema {
	const values = params[0] as unknown[];
	if (values.length === 1) return { const: values[0] };
	return convertEnum(params);
}

/**
 * Converts enum DNA to JSON Schema
 */
function convertEnum(params: unknown[]): JSONSchema {
	const values = params[0] as unknown[];
	const t = commonJsonType(values);
	const schema: Record<string, unknown> = { enum: values };
	if (t !== undefined) schema.type = t;
	return schema;
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
	const options = (params[0] as unknown[]).slice(1);
	return {
		anyOf: options.map(refId => {
			const dna = dnaSeq[refId as number];
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
	const options = (params[0] as unknown[]).slice(1);
	return {
		oneOf: options.map(refId => {
			const dna = dnaSeq[refId as number];
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
	const schemas = (params[0] as unknown[]).slice(1);
	return {
		allOf: schemas.map(refId => {
			const dna = dnaSeq[refId as number];
			if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
				return convertDnaNode(dna as tsDna, dnaSeq, refs);
			}
			return {};
		})
	};
}

/**
 * Converts discriminator DNA to an OpenAI-compatible JSON Schema.
 * DNA format: ["discriminator", propertyName, discriminKeys, discriminDef, meta]
 */
function convertDiscriminator(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const propertyName = params[0] as string;
	const discriminDef = params[2] as (number | undefined)[];

	if (!Array.isArray(discriminDef) || discriminDef.length < 2) {
		return { type: "object", description: "Invalid discriminator DNA" };
	}

	const branches: JSONSchema[] = [];
	for (let i = 1; i < discriminDef.length; i++) {
		const ref = discriminDef[i];
		if (ref === undefined) {
			branches.push({});
			continue;
		}
		const dna = dnaSeq[ref];
		if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
			branches.push(convertDnaNode(dna as tsDna, dnaSeq, refs));
		} else {
			branches.push({});
		}
	}

	const preRef = discriminDef[0];
	let required: string[] | undefined;
	if (preRef !== undefined) {
		const preDna = dnaSeq[preRef];
		if (Array.isArray(preDna) && preDna.length > 0 && typeof preDna[0] === 'string') {
			const preSchema = convertDnaNode(preDna as tsDna, dnaSeq, refs);
			if (preSchema !== null && typeof preSchema === 'object' && Array.isArray((preSchema as Record<string, unknown>).required)) {
				required = (preSchema as Record<string, unknown>).required as string[];
			}
		}
	}

	const isRequired = Array.isArray(required) && required.includes(propertyName);
	const schema: Record<string, unknown> = { type: "object", oneOf: branches };
	if (isRequired) {
		schema.discriminator = { propertyName };
		schema.required = required;
	}
	return schema;
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
function convertDefault(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?:tsDnaInnerMeta): JSONSchema {
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
function convertPrefault(params: unknown[], dnaSeq: tsDnaSeq, refs: number[], meta?:tsDnaInnerMeta): JSONSchema {
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

/**
 * Converts const DNA (`c` / `cD`) to JSON Schema.
 * DNA format: ["c", value, meta] / ["cD", value, meta]
 * JSON Schema `const` accepts any JSON value including objects and arrays.
 */
function convertConst(params: unknown[]): JSONSchema {
	const value = params[0];
	return { const: value };
}

/**
 * Converts `not` DNA to JSON Schema.
 * DNA format: ["not", [innerRefId], meta]
 */
function convertNot(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const innerRef = (params[0] as unknown[])[0] as number;
	const innerDna = dnaSeq[innerRef];
	if (Array.isArray(innerDna) && innerDna.length > 0 && typeof innerDna[0] === 'string') {
		return { not: convertDnaNode(innerDna as tsDna, dnaSeq, refs) };
	}
	return { not: {} };
}

/**
 * Converts `ifThenElse` DNA to JSON Schema.
 * DNA format: ["ifThenElse", [ifIndex, thenIndex, elseIndex], meta]
 * Indices use -1 for "not applicable".
 */
function convertIfThenElse(params: unknown[], dnaSeq: tsDnaSeq, refs: number[]): JSONSchema {
	const indices = params[0] as [number, number, number];
	const [ifIdx, thenIdx, elseIdx] = indices;
	const schema: Record<string, unknown> = {};

	const convertRefByIdx = (idx: number): JSONSchema => {
		if (idx < 0) return true;
		const dna = dnaSeq[idx];
		if (Array.isArray(dna) && dna.length > 0 && typeof dna[0] === 'string') {
			return convertDnaNode(dna as tsDna, dnaSeq, refs);
		}
		return {};
	};

	schema.if = convertRefByIdx(ifIdx);
	if (thenIdx >= 0) schema.then = convertRefByIdx(thenIdx);
	if (elseIdx >= 0) schema.else = convertRefByIdx(elseIdx);
	return schema;
}

/**
 * Standard Schema Protocol V1 Compatibility Tests
 *
 * Tests for DNA's compliance with the Standard Schema Protocol V1,
 * ensuring interoperability with frameworks that support it.
 */

import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";

describe("Standard Schema Protocol V1", () => {
	describe("~standard property", () => {
		it("should expose ~standard property on schemas", () => {
			const schema = dna.string();
			expect("~standard" in schema).toBe(true);
		});

		it("should have version 1", () => {
			const schema = dna.string();
			const standard = schema["~standard"];
			expect(standard.version).toBe(1);
		});

		it("should have vendor name", () => {
			const schema = dna.string();
			const standard = schema["~standard"];
			expect(standard.vendor).toBe("@ytn/dna");
		});

		it("should have types with input and output", () => {
			const schema = dna.string();
			const standard = schema["~standard"];
			// types is optional in Standard Schema V1
			// TypeScript types are erased at runtime, so input/output will be undefined
			expect(standard.types).toBeDefined();
			// The values are undefined because TypeScript types don't exist at runtime
			expect(standard.types?.input).toBeUndefined();
			expect(standard.types?.output).toBeUndefined();
		});

		it("should have validate function", () => {
			const schema = dna.string();
			const standard = schema["~standard"];
			expect(typeof standard.validate).toBe("function");
		});

		it("should have jsonSchema converter", () => {
			const schema = dna.string();
			const standard = schema["~standard"];
			expect(standard.jsonSchema).toBeDefined();
			expect(typeof standard.jsonSchema.input).toBe("function");
			expect(typeof standard.jsonSchema.output).toBe("function");
		});
	});

	describe("validate function", () => {
		it("should return success for valid data", () => {
			const schema = dna.string();
			const result = schema["~standard"].validate("hello");
			
			expect("value" in result).toBe(true);
			if ("value" in result) {
				expect(result.value).toBe("hello");
			}
		});

		it("should return failure for invalid data", () => {
			const schema = dna.string();
			const result = schema["~standard"].validate(123);
			
			expect("issues" in result).toBe(true);
			if ("issues" in result) {
				expect(result.issues).toBeDefined();
				expect(result.issues).toBeInstanceOf(Array);
			}
		});

		it("should handle number validation", () => {
			const schema = dna.number();
			const validResult = schema["~standard"].validate(42);
			const invalidResult = schema["~standard"].validate("not a number");
			
			expect("value" in validResult).toBe(true);
			expect("issues" in invalidResult).toBe(true);
		});

		it("should handle boolean validation", () => {
			const schema = dna.boolean();
			const validResult = schema["~standard"].validate(true);
			const invalidResult = schema["~standard"].validate("true");
			
			expect("value" in validResult).toBe(true);
			expect("issues" in invalidResult).toBe(true);
		});

		it("should handle object validation", () => {
			const schema = dna.object({
				name: dna.string(),
				age: dna.number()
			});
			
			const validResult = schema["~standard"].validate({ name: "John", age: 30 });
			const invalidResult = schema["~standard"].validate({ name: "John", age: "thirty" });
			
			expect("value" in validResult).toBe(true);
			expect("issues" in invalidResult).toBe(true);
		});

		it("should handle array validation", () => {
			const schema = dna.array(dna.number());
			const validResult = schema["~standard"].validate([1, 2, 3]);
			const invalidResult = schema["~standard"].validate([1, "two", 3]);
			
			expect("value" in validResult).toBe(true);
			expect("issues" in invalidResult).toBe(true);
		});
	});

	describe("error format", () => {
		it("should convert DNA errors to Standard Schema format", () => {
			const schema = dna.string();
			const result = schema["~standard"].validate(123);
			
			expect("issues" in result).toBe(true);
			if ("issues" in result) {
				const failureResult = result as { issues: Array<{message: string, path?: unknown}> };
				expect(failureResult.issues).toBeInstanceOf(Array);
				expect(failureResult.issues.length).toBeGreaterThan(0);
				
				const issue = failureResult.issues[0];
				expect(issue.message).toBeDefined();
				expect(issue.path).toBeInstanceOf(Array);
			}
		});

		it("should handle nested error paths", () => {
			const schema = dna.object({
				user: dna.object({
					name: dna.string()
				})
			});
			
			const result = schema["~standard"].validate({ user: { name: 123 } });
			
			expect("issues" in result).toBe(true);
			if ("issues" in result) {
				const failureResult = result as { issues: Array<{message: string, path?: Array<unknown>}> };
				const issue = failureResult.issues[0];
				expect(issue.path).toBeDefined();
				if (issue.path) {
					expect(issue.path.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("jsonSchema converter", () => {
		it("should generate JSON Schema for string", () => {
			const schema = dna.string();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema).toEqual({ type: "string" });
		});

		it("should generate JSON Schema for number", () => {
			const schema = dna.number();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema).toEqual({ type: "number" });
		});

		it("should generate JSON Schema for boolean", () => {
			const schema = dna.boolean();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema).toEqual({ type: "boolean" });
		});

		it("should generate JSON Schema for null", () => {
			const schema = dna.null();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema).toEqual({ type: "null" });
		});

		it("should generate JSON Schema for literal", () => {
			const schema = dna.literal("hello");
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			// ERROR: DNA generates T opcode instead of 'l' opcode for literals
			// TODO: Fix DnaLiteral._emitSelf() to generate ['l', ['hello'], {}]
			expect(jsonSchema).toEqual({ const: "hello" });
		});

		it("should generate JSON Schema for array", () => {
			const schema = dna.array(dna.string());
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema.type).toBe("array");
		});

		it("should generate JSON Schema for object", () => {
			const schema = dna.object({
				name: dna.string(),
				age: dna.number()
			});
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			expect(jsonSchema.type).toBe("object");
			expect(jsonSchema.properties).toBeDefined();
		});

		it("should handle optional schemas", () => {
			const schema = dna.string().optional();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			// ERROR: DNA generates T opcode instead of 'optional' opcode
			// TODO: Fix DnaOptional DNA generation to generate proper wrapper opcode
			expect(jsonSchema).toEqual({ type: "string" });
		});

		it("should handle nullable schemas", () => {
			const schema = dna.string().nullable();
			const jsonSchema = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
			
			// ERROR: DNA generates T opcode instead of 'nullable' opcode
			// TODO: Fix DnaNullable DNA generation to generate proper wrapper opcode
			expect(jsonSchema.anyOf).toBeDefined();
		});
	});

	describe("integration with safeParse", () => {
		it("should produce consistent results with safeParse", () => {
			const schema = dna.string();
			const testData = "hello";
			
			const standardResult = schema["~standard"].validate(testData);
			const safeParseResult = schema.safeParse(testData);
			
			const standardSuccess = "value" in standardResult;
			expect(standardSuccess).toBe(safeParseResult.success);
			if (standardSuccess && safeParseResult.success) {
				expect(standardResult.value).toBe(safeParseResult.data);
			}
		});

		it("should produce consistent error handling", () => {
			const schema = dna.string();
			const testData = 123;
			
			const standardResult = schema["~standard"].validate(testData);
			const safeParseResult = schema.safeParse(testData);
			
			const standardSuccess = "value" in standardResult;
			expect(standardSuccess).toBe(safeParseResult.success);
			expect(!standardSuccess).toBe(true);
		});
	});
});

import { describe, expect, it } from "vitest";
import { schvalid } from "../../src/index.js";

describe("Discriminator", () => {
	const discriminatorSchema = {
		type: "object",
		discriminator: {
			propertyName: "type"
		},
		required: ["type", "name"],
		oneOf: [
			{
				type: "object",
				properties: {
					type: { const: "cat" },
					name: { type: "string" },
					meows: { type: "boolean" }
				}
			},
			{
				type: "object",
				properties: {
					type: { const: "dog" },
					name: { type: "string" },
					barks: { type: "boolean" }
				}
			}
		]
	};

	const catData = { type: "cat", name: "Whiskers", meows: true };
	const dogData = { type: "dog", name: "Rex", barks: true };
	const invalidData = { type: "bird", name: "Tweety" };

	let validate: any;
	let parse: any;

	it("should compile discriminator schema to validator", () => {
		validate = schvalid("validation").compile(discriminatorSchema);
		expect(typeof validate).toBe("function");
	});

	it("should compile discriminator schema to parser", () => {
		parse = schvalid("parser").compile(discriminatorSchema);
		expect(typeof parse).toBe("function");
	});

	it("should validate cat data correctly", () => {
		expect(validate(catData)).toBe(true);
	});

	it("should validate dog data correctly", () => {
		expect(validate(dogData)).toBe(true);
	});

	it("should reject invalid discriminator value", () => {
		expect(validate(invalidData)).toBe(false);
	});

	it("should parse cat data correctly", () => {
		const result = parse(catData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(catData);
		}
	});

	it("should parse dog data correctly", () => {
		const result = parse(dogData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(dogData);
		}
	});

	it("should return error for invalid discriminator value in parser mode", () => {
		const result = parse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toBeDefined();
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it("should allow discriminator property with additionalProperties: false", () => {
		const strictSchema = { ...discriminatorSchema, additionalProperties: false };
		const validateStrict = schvalid("validation").compile(strictSchema);
		expect(validateStrict({ type: "cat", name: "Whiskers", meows: true })).toBe(true);
		expect(validateStrict({ type: "dog", name: "Rex", barks: true })).toBe(true);
	});

	it("should reject unknown properties with additionalProperties: false", () => {
		const strictSchema = { ...discriminatorSchema, additionalProperties: false };
		const validateStrict = schvalid("validation").compile(strictSchema);
		expect(validateStrict({ type: "cat", name: "Whiskers", meows: true, unknown: true })).toBe(false);
		expect(validateStrict({ type: "dog", name: "Rex", barks: true, unknown: true })).toBe(false);
	});

	describe("enum discriminator values", () => {
		const enumDiscriminatorSchema = {
			type: "object",
			discriminator: {
				propertyName: "type"
			},
			required: ["type", "name"],
			oneOf: [
				{
					type: "object",
					properties: {
						type: { enum: ["cat", "feline"] },
						name: { type: "string" },
						meows: { type: "boolean" }
					}
				},
				{
					type: "object",
					properties: {
						type: { enum: ["dog", "canine"] },
						name: { type: "string" },
						barks: { type: "boolean" }
					}
				}
			]
		};

		it("should compile enum discriminator schema", () => {
			const validate = schvalid("validation").compile(enumDiscriminatorSchema);
			expect(typeof validate).toBe("function");
		});

		it("should validate multiple enum values for the same branch", () => {
			const validate = schvalid("validation").compile(enumDiscriminatorSchema);
			expect(validate({ type: "cat", name: "Whiskers", meows: true })).toBe(true);
			expect(validate({ type: "feline", name: "Felix", meows: false })).toBe(true);
			expect(validate({ type: "dog", name: "Rex", barks: true })).toBe(true);
			expect(validate({ type: "canine", name: "Buddy", barks: false })).toBe(true);
		});

		it("should reject values not in any enum", () => {
			const validate = schvalid("validation").compile(enumDiscriminatorSchema);
			expect(validate({ type: "bird", name: "Tweety" })).toBe(false);
		});

		it("should parse with enum discriminator", () => {
			const parse = schvalid("parser").compile(enumDiscriminatorSchema);
			const feline = parse({ type: "feline", name: "Felix", meows: true });
			expect(feline.success).toBe(true);
			if (feline.success) {
				expect(feline.data).toEqual({ type: "feline", name: "Felix", meows: true });
			}
		});

		it("should reject unknown properties with additionalProperties: false for enum discriminator", () => {
			const strictEnum = { ...enumDiscriminatorSchema, additionalProperties: false };
			const validateStrict = schvalid("validation").compile(strictEnum);
			expect(validateStrict({ type: "cat", name: "Whiskers", meows: true })).toBe(true);
			expect(validateStrict({ type: "feline", name: "Felix", meows: true, unknown: true })).toBe(false);
		});
	});

	describe("unevaluatedProperties with discriminator", () => {
		// unevaluatedProperties: false inside each branch — the only structurally
		// correct way to combine discriminator + unevaluatedProperties per
		// JSON Schema 2020-12 (confirmed by AJV 2020-12 parity testing).
		const branchUnevalSchema = {
			type: "object",
			discriminator: { propertyName: "type" },
			required: ["type", "name"],
			oneOf: [
				{
					type: "object",
					properties: {
						type: { const: "cat" },
						name: { type: "string" },
						meows: { type: "boolean" }
					},
					unevaluatedProperties: false
				},
				{
					type: "object",
					properties: {
						type: { const: "dog" },
						name: { type: "string" },
						barks: { type: "boolean" }
					},
					unevaluatedProperties: false
				}
			]
		};

		it("should compile discriminator + unevaluatedProperties in branches", () => {
			const validate = schvalid("validation").compile(branchUnevalSchema);
			expect(typeof validate).toBe("function");
		});

		it("should validate valid data with unevaluatedProperties: false in branches", () => {
			const validate = schvalid("validation").compile(branchUnevalSchema);
			expect(validate({ type: "cat", name: "Whiskers", meows: true })).toBe(true);
			expect(validate({ type: "dog", name: "Rex", barks: true })).toBe(true);
		});

		it("should reject extra properties with unevaluatedProperties: false in branches", () => {
			const validate = schvalid("validation").compile(branchUnevalSchema);
			expect(validate({ type: "cat", name: "Whiskers", meows: true, extra: 1 })).toBe(false);
			expect(validate({ type: "dog", name: "Rex", barks: true, extra: 1 })).toBe(false);
		});

		it("should reject invalid discriminator value", () => {
			const validate = schvalid("validation").compile(branchUnevalSchema);
			expect(validate({ type: "bird", name: "Tweety" })).toBe(false);
		});

		it("should parse valid data and preserve all properties", () => {
			const parse = schvalid("parser").compile(branchUnevalSchema);
			const result = parse({ type: "cat", name: "Whiskers", meows: true });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ type: "cat", name: "Whiskers", meows: true });
			}
		});

		it("should fail parsing extra properties", () => {
			const parse = schvalid("parser").compile(branchUnevalSchema);
			const result = parse({ type: "cat", name: "Whiskers", meows: true, extra: 1 });
			expect(result.success).toBe(false);
		});

		// Regression test for the innerCount overcount bug:
		// unevaluatedProperties at root level with a discriminator used to
		// produce a self-referential wrpDef → RangeError (infinite recursion
		// in codegen). After the fix, it should compile without crashing.
		// AJV 2020-12 rejects everything in this configuration (discriminator
		// does not propagate eval-sets to a root-level unevaluatedProperties),
		// so we only assert that codegen does not crash — not that validation
		// passes.
		it("should not crash when unevaluatedProperties is at root with discriminator", () => {
			const rootUnevalSchema = {
				type: "object",
				discriminator: { propertyName: "type" },
				required: ["type", "name"],
				oneOf: [
					{
						type: "object",
						properties: {
							type: { const: "cat" },
							name: { type: "string" },
							meows: { type: "boolean" }
						}
					},
					{
						type: "object",
						properties: {
							type: { const: "dog" },
							name: { type: "string" },
							barks: { type: "boolean" }
						}
					}
				],
				unevaluatedProperties: false
			};
			// Regression: previously crashed with RangeError (self-referential
			// wrpDef caused infinite recursion in codegen). After the innerCount
			// fix, approach 1 not only compiles but works correctly — the
			// discriminator propagates evaluated keys to the root-level
			// unevaluatedProperties wrapper, so valid data passes and extras
			// are rejected. This is actually stricter than AJV 2020-12, which
			// rejects everything in this configuration.
			const validate = schvalid("validation").compile(rootUnevalSchema);
			expect(validate({ type: "cat", name: "Whiskers", meows: true })).toBe(true);
			expect(validate({ type: "dog", name: "Rex", barks: true })).toBe(true);
			expect(validate({ type: "cat", name: "Whiskers", meows: true, extra: 1 })).toBe(false);
			expect(validate({ type: "bird", name: "Tweety" })).toBe(false);
		});
	});
});

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
});

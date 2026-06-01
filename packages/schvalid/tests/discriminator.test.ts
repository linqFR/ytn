import { describe, it, expect } from "vitest";
import { jschemaToDna } from "../src/index.js";
import { validator, parser } from "@ytn/dna";

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

	let dna: any;

	it("should convert discriminator schema to DNA", () => {
		dna = jschemaToDna(discriminatorSchema);
		expect(dna).toBeDefined();
		expect(Array.isArray(dna)).toBe(true);
	});

	it("should generate a validator function", () => {
		const validate = validator(dna);
		expect(typeof validate).toBe("function");
	});

	it("should validate cat data correctly", () => {
		const validate = validator(dna);
		expect(validate(catData)).toBe(true);
	});

	it("should validate dog data correctly", () => {
		const validate = validator(dna);
		expect(validate(dogData)).toBe(true);
	});

	it("should reject invalid discriminator value", () => {
		const validate = validator(dna);
		expect(validate(invalidData)).toBe(false);
	});

	it("should generate a parser function", () => {
		const parse = parser(dna);
		expect(typeof parse).toBe("function");
	});

	it("should parse cat data correctly", () => {
		const parse = parser(dna);
		const result = parse(catData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(catData);
		}
	});

	it("should parse dog data correctly", () => {
		const parse = parser(dna);
		const result = parse(dogData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(dogData);
		}
	});

	it("should return error for invalid discriminator value in parser mode", () => {
		const parse = parser(dna);
		const result = parse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toBeDefined();
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});
});

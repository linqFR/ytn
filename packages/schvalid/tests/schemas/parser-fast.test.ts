import { describe, expect, it } from "vitest";
import { schvalid } from "../../src/index.js";

describe("parserFast (schvalid \"fast\" mode)", () => {

	// =============================================================================
	// SIMPLE CASES
	// =============================================================================
	describe("simple cases", () => {
		it("valid string passes and returns the same reference", () => {
			const parse = schvalid("fast").compile({ type: "string", minLength: 2 });
			const input = "hello";
			const result = parse(input);
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toBe(input);
		});

		it("invalid string fails with detailed errors (fallback to full parser)", () => {
			const parse = schvalid("fast").compile({ type: "string", minLength: 2 });
			const result = parse("h");
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});

		it("wrong type fails with detailed errors", () => {
			const parse = schvalid("fast").compile({ type: "number" });
			const result = parse("not a number");
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	// =============================================================================
	// COMMON CASES (typical API object: required + optional properties)
	// =============================================================================
	describe("common cases (object with required + optional properties)", () => {
		const schema = {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				name: { type: "string", minLength: 2 },
				age: { type: "number", minimum: 0 },
				nickname: { type: "string" },
			},
			required: ["id", "name", "age"],
		};

		it("valid object (all required present, optional absent) succeeds", () => {
			const parse = schvalid("fast").compile(schema);
			const input = { id: "u1", name: "John", age: 30 };
			const result = parse(input);
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toEqual(input);
		});

		it("valid object with optional property present succeeds", () => {
			const parse = schvalid("fast").compile(schema);
			const input = { id: "u1", name: "John", age: 30, nickname: "Johnny" };
			const result = parse(input);
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toEqual(input);
		});

		it("missing required property fails with detailed errors", () => {
			const parse = schvalid("fast").compile(schema);
			const result = parse({ id: "u1", name: "John" });
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});

		it("invalid property value fails with detailed errors", () => {
			const parse = schvalid("fast").compile(schema);
			const result = parse({ id: "u1", name: "J", age: -1 });
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});

		// Documents the KNOWN trade-off of the fast path (see JSDoc on `combineFast`):
		// on success, `parse()` returns a FRESH output object (its own copy), while
		// `parseFast()` returns the SAME reference as the input (no copy at all).
		// Both agree on validity — only the identity/freshness of `data` differs.
		it("[TRADE-OFF] fast path returns the raw input reference; full parser returns a fresh copy", () => {
			const parse = schvalid("parser").compile(schema);
			const parseFast = schvalid("fast").compile(schema);
			const input = { id: "u1", name: "John", age: 30 };

			const full = parse(input);
			const fast = parseFast(input);

			expect(full.success).toBe(true);
			expect(fast.success).toBe(true);
			if (full.success) {
				expect(full.data).toEqual(input);
				expect(full.data).not.toBe(input); // fresh object
			}
			if (fast.success) expect(fast.data).toBe(input); // same reference, no copy
		});

		// additionalProperties:false is a VALIDATION-level constraint (checked by
		// validator() too), so both parsers must agree and reject unknown keys —
		// no discrepancy expected here, unlike the reference-identity trade-off above.
		it("additionalProperties:false rejects unknown keys consistently in both parsers", () => {
			const strictSchema = { ...schema, additionalProperties: false };
			const parse = schvalid("parser").compile(strictSchema);
			const parseFast = schvalid("fast").compile(strictSchema);
			const input = { id: "u1", name: "John", age: 30, extra: "not allowed" };

			expect(parse(input).success).toBe(false);
			expect(parseFast(input).success).toBe(false);
		});
	});

	// =============================================================================
	// COMPLEX CASES (nested objects, anyOf, arrays)
	// =============================================================================
	describe("complex cases (nested objects, anyOf, arrays)", () => {
		const schema = {
			type: "object",
			properties: {
				id: { type: "string" },
				contact: {
					anyOf: [
						{ type: "object", properties: { email: { type: "string" } }, required: ["email"] },
						{ type: "object", properties: { phone: { type: "string" } }, required: ["phone"] },
					],
				},
				tags: { type: "array", items: { type: "string" }, minItems: 1 },
			},
			required: ["id", "contact", "tags"],
		};

		it("valid nested object matching first anyOf branch succeeds", () => {
			const parse = schvalid("fast").compile(schema);
			const input = { id: "u1", contact: { email: "a@b.com" }, tags: ["x"] };
			const result = parse(input);
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toEqual(input);
		});

		it("valid nested object matching second anyOf branch succeeds", () => {
			const parse = schvalid("fast").compile(schema);
			const input = { id: "u1", contact: { phone: "0102030405" }, tags: ["x", "y"] };
			const result = parse(input);
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toEqual(input);
		});

		it("nested object matching no anyOf branch fails with detailed errors", () => {
			const parse = schvalid("fast").compile(schema);
			const result = parse({ id: "u1", contact: {}, tags: ["x"] });
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});

		it("empty array fails minItems constraint with detailed errors", () => {
			const parse = schvalid("fast").compile(schema);
			const result = parse({ id: "u1", contact: { email: "a@b.com" }, tags: [] });
			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	// =============================================================================
	// CONSISTENCY: fast must agree with the full validator/parser on success/failure
	// =============================================================================
	describe("consistency with validator() and parser()", () => {
		const schema = {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				name: { type: "string", minLength: 2 },
				age: { type: "number", minimum: 0 },
			},
			required: ["id", "name", "age"],
		};

		const cases = [
			{ id: "u1", name: "John", age: 30 },
			{ id: "u1", name: "J", age: 30 },
			{ id: "u1", name: "John", age: -1 },
			{ id: "u1", name: "John" },
			{},
			null,
			"not an object",
			42,
		];

		for (const input of cases) {
			it(`agrees with validate()/parse() for input: ${JSON.stringify(input)}`, () => {
				const validate = schvalid("validation").compile(schema);
				const parse = schvalid("parser").compile(schema);
				const parseFast = schvalid("fast").compile(schema);

				const expectedValid = validate(input);
				const fullResult = parse(input);
				const fastResult = parseFast(input);

				expect(fastResult.success).toBe(expectedValid);
				expect(fastResult.success).toBe(fullResult.success);
			});
		}
	});
});

import { describe, expect, it } from "vitest";
import { schvalid } from "../../src/index.js";

/**
 * __proto__ safety tests for @ytrynot/schvalid.
 *
 * schvalid's parser uses `Object.create(null)` (plainObject / `_o`) for its
 * output objects, so assigning `data["__proto__"] = ...` does NOT trigger the
 * prototype setter — it is just a harmless own property on a null-prototype
 * object. The validator never copies unknown keys either.
 *
 * These tests verify empirically that `Object.prototype` is not polluted after
 * parsing a malicious input with a `__proto__` key produced by `JSON.parse`.
 */
describe("__proto__ safety — schvalid prototype pollution protection", () => {
	function cleanupProto(): void {
		delete (Object.prototype as Record<string, unknown>).injected;
		delete (Object.prototype as Record<string, unknown>).polluted;
	}
	cleanupProto();

	describe("parser mode (plainObject output)", () => {
		it("should not pollute Object.prototype via JSON.parse input with additionalProperties:true", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: true,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = parse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
				expect(({} as Record<string, unknown>).injected).toBeUndefined();
			}
			cleanupProto();
		});

		it("should not pollute Object.prototype via nested __proto__ in JSON.parse", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: {
					name: { type: "string" },
					nested: {
						type: "object",
						properties: { value: { type: "string" } },
						required: ["value"],
						additionalProperties: true,
					},
				},
				required: ["name", "nested"],
			});
			const malicious = JSON.parse(
				'{"name":"test","nested":{"value":"ok","__proto__":{"polluted":true}}}'
			);
			const result = parse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("polluted");
				expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			}
			cleanupProto();
		});

		it("should not pollute Object.prototype via __proto__ in array items", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: {
					items: {
						type: "array",
						items: {
							type: "object",
							properties: { name: { type: "string" } },
							required: ["name"],
							additionalProperties: true,
						},
					},
				},
				required: ["items"],
			});
			const malicious = JSON.parse(
				'{"items":[{"name":"a","__proto__":{"injected":true}},{"name":"b"}]}'
			);
			const result = parse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
			}
			cleanupProto();
		});

		it("output object should have null prototype (no __proto__ setter)", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: true,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = parse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.getPrototypeOf(result.data)).toBeNull();
			}
			cleanupProto();
		});
	});

	describe("validator mode (no output construction)", () => {
		it("should not pollute Object.prototype via JSON.parse input", () => {
			cleanupProto();
			const validate = schvalid("validation").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: true,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const isValid = validate(malicious);
			expect(isValid).toBe(true);
			expect(Object.prototype).not.toHaveProperty("injected");
			cleanupProto();
		});
	});

	describe("fast mode (parserFast — validate-then-parse)", () => {
		it("should not pollute Object.prototype via JSON.parse input", () => {
			cleanupProto();
			const parseFast = schvalid("fast").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: true,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = parseFast(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
			}
			cleanupProto();
		});
	});

	describe("additionalProperties:false (strict)", () => {
		it("should reject __proto__ as unknown property without pollution", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = parse(malicious);
			expect(result.success).toBe(false);
			expect(Object.prototype).not.toHaveProperty("injected");
			cleanupProto();
		});
	});

	describe("no built-in prototype is polluted", () => {
		it("should not pollute any built-in prototype after parsing", () => {
			cleanupProto();
			const parse = schvalid("parser").compile({
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: true,
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			parse(malicious);
			expect(Object.prototype).not.toHaveProperty("injected");
			expect(Array.prototype).not.toHaveProperty("injected");
			expect(String.prototype).not.toHaveProperty("injected");
			expect(Number.prototype).not.toHaveProperty("injected");
			cleanupProto();
		});
	});
});

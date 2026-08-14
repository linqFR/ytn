import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";

/**
 * __proto__ safety tests — verify that DNA object parsers are not vulnerable
 * to prototype pollution via `__proto__` keys in the input.
 *
 * `JSON.parse('{"__proto__":{"injected":true}}')` produces an object where
 * `__proto__` is an own enumerable property (it does not trigger the prototype
 * setter). If a parser copies this key into an output object that has
 * `Object.prototype` (i.e. `{}`), it would pollute the prototype chain.
 *
 * DNA is protected by two mechanisms:
 *   - `dna.object()` (standard): `keepOnly` loop only copies declared keys,
 *     so `__proto__` is never copied unless it's a declared property.
 *   - `dna.strictObject()`: rejects unknown keys, so `__proto__` is rejected.
 *   - `dna.looseObject()`: uses `Object.create(null)` for output, so
 *     `data["__proto__"] = ...` is just an own property, not the setter.
 *
 * These tests verify empirically that `Object.prototype` is not polluted
 * after parsing a malicious input with `__proto__` key.
 */

describe("__proto__ safety — prototype pollution protection", () => {
	// Clean up any pollution that might leak between tests (defensive).
	function cleanupProto(): void {
		delete (Object.prototype as Record<string, unknown>).injected;
		delete (Object.prototype as Record<string, unknown>).polluted;
	}
	cleanupProto();

	describe("dna.object() (standard, keepOnly)", () => {
		it("should not pollute Object.prototype via JSON.parse input", () => {
			cleanupProto();
			const schema = dna.object({
				name: dna.string(),
				age: dna.number(),
			});
			const malicious = JSON.parse('{"name":"test","age":42,"__proto__":{"injected":true}}');
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
				expect(({} as Record<string, unknown>).injected).toBeUndefined();
			}
			cleanupProto();
		});

		it("should not pollute Object.prototype via direct object input", () => {
			cleanupProto();
			const schema = dna.object({
				name: dna.string(),
			});
			// Object literal — __proto__ here IS the setter, so it won't be an own prop.
			// But we test anyway for robustness.
			const input = { name: "test" };
			Object.defineProperty(input, "__proto__", {
				value: { injected: true },
				enumerable: true,
				configurable: true,
				writable: true,
			});
			const result = schema.safeParse(input);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
			}
			cleanupProto();
		});

		it("should not copy __proto__ into output even if input has it as own property", () => {
			cleanupProto();
			const schema = dna.object({
				name: dna.string(),
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.keys(result.data)).not.toContain("__proto__");
				expect(Object.hasOwn(result.data, "__proto__")).toBe(false);
			}
			cleanupProto();
		});
	});

	describe("dna.strictObject()", () => {
		it("should reject __proto__ as unknown property", () => {
			cleanupProto();
			const schema = dna.strictObject({
				name: dna.string(),
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = schema.safeParse(malicious);
			// strictObject rejects unknown keys — __proto__ is unknown
			expect(result.success).toBe(false);
			expect(Object.prototype).not.toHaveProperty("injected");
			cleanupProto();
		});
	});

	describe("dna.looseObject()", () => {
		it("should not pollute Object.prototype via JSON.parse input", () => {
			cleanupProto();
			const schema = dna.looseObject({
				name: dna.string(),
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				// looseObject uses Object.create(null) — __proto__ is just an own prop, not the setter
				expect(Object.prototype).not.toHaveProperty("injected");
				expect(({} as Record<string, unknown>).injected).toBeUndefined();
			}
			cleanupProto();
		});

		it("should preserve __proto__ as a harmless own property (not the setter)", () => {
			cleanupProto();
			const schema = dna.looseObject({
				name: dna.string(),
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				// __proto__ may be present as an own property (Object.create(null) allows it)
				// but it must NOT have polluted Object.prototype
				expect(Object.prototype).not.toHaveProperty("injected");
				// The output object should have null prototype
				expect(Object.getPrototypeOf(result.data)).toBeNull();
			}
			cleanupProto();
		});
	});

	describe("nested objects", () => {
		it("should not pollute Object.prototype via nested __proto__ in JSON.parse", () => {
			cleanupProto();
			const schema = dna.object({
				name: dna.string(),
				nested: dna.object({
					value: dna.string(),
				}),
			});
			const malicious = JSON.parse(
				'{"name":"test","nested":{"value":"ok","__proto__":{"polluted":true}}}'
			);
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("polluted");
				expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			}
			cleanupProto();
		});

		it("should not pollute Object.prototype via nested __proto__ in looseObject", () => {
			cleanupProto();
			const schema = dna.looseObject({
				name: dna.string(),
				nested: dna.looseObject({
					value: dna.string(),
				}),
			});
			const malicious = JSON.parse(
				'{"name":"test","nested":{"value":"ok","__proto__":{"polluted":true}}}'
			);
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("polluted");
			}
			cleanupProto();
		});
	});

	describe("arrays of objects", () => {
		it("should not pollute Object.prototype via __proto__ in array items", () => {
			cleanupProto();
			const schema = dna.object({
				items: dna.array(dna.object({ name: dna.string() })),
			});
			const malicious = JSON.parse(
				'{"items":[{"name":"a","__proto__":{"injected":true}},{"name":"b"}]}'
			);
			const result = schema.safeParse(malicious);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.prototype).not.toHaveProperty("injected");
			}
			cleanupProto();
		});
	});

	describe("constructor.prototype is not polluted", () => {
		it("should not pollute any built-in prototype", () => {
			cleanupProto();
			const schema = dna.looseObject({
				name: dna.string(),
			});
			const malicious = JSON.parse('{"name":"test","__proto__":{"injected":true}}');
			schema.safeParse(malicious);
			// Check that no built-in prototype is polluted
			expect(Object.prototype).not.toHaveProperty("injected");
			expect(Array.prototype).not.toHaveProperty("injected");
			expect(String.prototype).not.toHaveProperty("injected");
			expect(Number.prototype).not.toHaveProperty("injected");
			cleanupProto();
		});
	});
});

describe("__proto__ as a declared property — JSON Schema spec compliance", () => {
	function cleanupProto(): void {
		delete (Object.prototype as Record<string, unknown>).injected;
		delete (Object.prototype as Record<string, unknown>).polluted;
	}
	cleanupProto();

	// The JSON Schema Test Suite requires that "__proto__" be validated like
	// any other property name when it appears in `properties` or `required`.
	// See draft2020-12/properties.json: "properties whose names are Javascript
	// object property names" and required.json: "required properties whose
	// names are Javascript object property names".
	//
	// DNA's validator already handles this correctly (uses Object.hasOwn).
	// The parser must also preserve the validated value in the output.

	it("validator: __proto__ declared as number validates correctly", () => {
		cleanupProto();
		const schema = dna.object({ ["__proto__" as string]: dna.number() });
		expect(schema.validate({ ["__proto__" as string]: 42 })).toBe(true);
		expect(schema.validate({ ["__proto__" as string]: "foo" })).toBe(false);
		expect(schema.validate(JSON.parse('{"__proto__":42}'))).toBe(true);
		expect(schema.validate(JSON.parse('{"__proto__":"foo"}'))).toBe(false);
		cleanupProto();
	});

	it("parser: __proto__ declared as number is preserved in output", () => {
		cleanupProto();
		const schema = dna.object({ ["__proto__" as string]: dna.number() });
		const result = schema.safeParse(JSON.parse('{"__proto__":42}'));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(Object.hasOwn(result.data, "__proto__")).toBe(true);
			expect((result.data as Record<string, unknown>)["__proto__"]).toBe(42);
			expect(Object.keys(result.data)).toContain("__proto__");
		}
		cleanupProto();
	});

	it("parser: __proto__ declared as string with wrong type fails", () => {
		cleanupProto();
		const schema = dna.object({ ["__proto__" as string]: dna.string() });
		const result = schema.safeParse(JSON.parse('{"__proto__":42}'));
		expect(result.success).toBe(false);
		cleanupProto();
	});

	it("parser: __proto__ declared alongside other properties", () => {
		cleanupProto();
		const schema = dna.object({
			name: dna.string(),
			["__proto__" as string]: dna.number(),
		});
		const result = schema.safeParse(JSON.parse('{"name":"test","__proto__":42}'));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("test");
			expect(Object.hasOwn(result.data, "__proto__")).toBe(true);
			expect((result.data as Record<string, unknown>)["__proto__"]).toBe(42);
		}
		cleanupProto();
	});

	it("parser: __proto__ required but absent fails", () => {
		cleanupProto();
		const schema = dna.object({
			name: dna.string(),
			["__proto__" as string]: dna.number(),
		});
		const result = schema.safeParse(JSON.parse('{"name":"test"}'));
		expect(result.success).toBe(false);
		cleanupProto();
	});

	it("parser: __proto__ declared does not pollute Object.prototype", () => {
		cleanupProto();
		const schema = dna.object({ ["__proto__" as string]: dna.number() });
		schema.safeParse(JSON.parse('{"__proto__":42}'));
		expect(Object.prototype).not.toHaveProperty("injected");
		cleanupProto();
	});

	it("parser: output with __proto__ declared has null prototype", () => {
		cleanupProto();
		const schema = dna.object({
			name: dna.string(),
			["__proto__" as string]: dna.number(),
		});
		const result = schema.safeParse(JSON.parse('{"name":"test","__proto__":42}'));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(Object.getPrototypeOf(result.data)).toBeNull();
		}
		cleanupProto();
	});
});

describe("__proto__ non-declared in loose mode — harmless own property (no skip needed)", () => {
	function cleanupProto(): void {
		delete (Object.prototype as Record<string, unknown>).injected;
		delete (Object.prototype as Record<string, unknown>).polluted;
	}
	cleanupProto();

	// DNA uses Object.create(null) for loose/plainObject outputs, so
	// __proto__ from JSON.parse input is copied as a harmless own property
	// (no prototype setter, no pollution). Unlike Zod/AJV which use {} and
	// must skip __proto__, DNA's null-prototype outputs are inherently safe.
	// No skip is needed — this is an architectural advantage of DNA.

	it("looseObject: __proto__ does not pollute Object.prototype", () => {
		cleanupProto();
		const schema = dna.looseObject({ name: dna.string() });
		schema.safeParse(JSON.parse('{"name":"test","__proto__":{"injected":true}}'));
		expect(Object.prototype).not.toHaveProperty("injected");
		cleanupProto();
	});

	it("looseObject: output has null prototype (no __proto__ setter)", () => {
		cleanupProto();
		const schema = dna.looseObject({ name: dna.string() });
		const result = schema.safeParse(JSON.parse('{"name":"test","__proto__":{"injected":true}}'));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(Object.getPrototypeOf(result.data)).toBeNull();
		}
		cleanupProto();
	});
});

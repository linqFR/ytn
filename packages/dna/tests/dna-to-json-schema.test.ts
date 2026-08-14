import { describe, expect, it } from "vitest";
import { dnaToJsonSchema } from "../src/toJs/dna-to-json-schema.js";
import type { tsDnaSeq } from "../src/types/core.types.js";

const emptyMeta = { path: "#" };

describe("dnaToJsonSchema — const (c)", () => {
	it("converts primitive const", () => {
		const seq: tsDnaSeq = [["c", "hello", emptyMeta], []];
		expect(dnaToJsonSchema(seq)).toEqual({ const: "hello" });
	});

	it("converts numeric const", () => {
		const seq: tsDnaSeq = [["c", 42, emptyMeta], []];
		expect(dnaToJsonSchema(seq)).toEqual({ const: 42 });
	});

	it("converts null const", () => {
		const seq: tsDnaSeq = [["c", null, emptyMeta], []];
		expect(dnaToJsonSchema(seq)).toEqual({ const: null });
	});
});

describe("dnaToJsonSchema — const deep (cD)", () => {
	it("converts object const", () => {
		const value = { a: 1, b: "x" };
		const seq: tsDnaSeq = [["cD", value, emptyMeta], []];
		expect(dnaToJsonSchema(seq)).toEqual({ const: value });
	});

	it("converts array const", () => {
		const value = [1, 2, 3];
		const seq: tsDnaSeq = [["cD", value, emptyMeta], []];
		expect(dnaToJsonSchema(seq)).toEqual({ const: value });
	});
});

describe("dnaToJsonSchema — enum deep (eD)", () => {
	it("converts enum with object values", () => {
		const values = [{ x: 1 }, { y: 2 }];
		const seq: tsDnaSeq = [["eD", values, emptyMeta], []];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.enum).toEqual(values);
	});

	it("converts enum with mixed primitive and object values", () => {
		const values = ["a", { x: 1 }];
		const seq: tsDnaSeq = [["eD", values, emptyMeta], []];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.enum).toEqual(values);
	});
});

describe("dnaToJsonSchema — not", () => {
	it("converts not with inner string schema", () => {
		// dnaSeq[0] = not, dnaSeq[1] = inner string schema
		// not DNA: ["not", [1], meta]  — innerRef = 1
		const seq: tsDnaSeq = [
			["not", [1], emptyMeta],
			["s", [null, null, null, null], emptyMeta],
			[],
		];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.not).toEqual({ type: "string" });
	});

	it("converts not with inner object schema", () => {
		// dnaSeq[0] = not, dnaSeq[1] = inner object schema (empty object)
		// object DNA: ["o", [constraints], meta] where constraints = [["required", []]]
		const seq: tsDnaSeq = [
			["not", [1], emptyMeta],
			["o", [["required", []]], emptyMeta],
			[],
		];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.not).toBeDefined();
		expect((result.not as Record<string, unknown>).type).toBe("object");
	});
});

describe("dnaToJsonSchema — ifThenElse", () => {
	it("converts if/then/else with all branches", () => {
		// dnaSeq[0] = ifThenElse, [1] = if (string), [2] = then (number), [3] = else (boolean)
		// ifThenElse DNA: ["ifThenElse", [1, 2, 3], meta]
		const seq: tsDnaSeq = [
			["ifThenElse", [1, 2, 3], emptyMeta],
			["s", [null, null, null, null], emptyMeta],
			["n", [null, false, null, false, null], emptyMeta],
			["b", emptyMeta],
			[],
		];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.if).toEqual({ type: "string" });
		expect(result.then).toEqual({ type: "number" });
		expect(result.else).toEqual({ type: "boolean" });
	});

	it("converts if/then without else", () => {
		// dnaSeq[0] = ifThenElse, [1] = if (string), [2] = then (number), elseIdx = -1
		const seq: tsDnaSeq = [
			["ifThenElse", [1, 2, -1], emptyMeta],
			["s", [null, null, null, null], emptyMeta],
			["n", [null, false, null, false, null], emptyMeta],
			[],
		];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.if).toEqual({ type: "string" });
		expect(result.then).toEqual({ type: "number" });
		expect(result.else).toBeUndefined();
	});

	it("converts if without then/else", () => {
		// dnaSeq[0] = ifThenElse, [1] = if (string), thenIdx = -1, elseIdx = -1
		const seq: tsDnaSeq = [
			["ifThenElse", [1, -1, -1], emptyMeta],
			["s", [null, null, null, null], emptyMeta],
			[],
		];
		const result = dnaToJsonSchema(seq) as Record<string, unknown>;
		expect(result.if).toEqual({ type: "string" });
		expect(result.then).toBeUndefined();
		expect(result.else).toBeUndefined();
	});
});

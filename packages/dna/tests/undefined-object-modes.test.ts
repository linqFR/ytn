import { describe, it, expect } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";

/**
 * Exhaustive comparison of `undefined` handling in object parsing between
 * Zod v4 and DNA across all three object modes (standard, strict, loose).
 *
 * Tests the SAME inputs on both Zod and DNA in parallel, checking:
 *   - success/reject
 *   - output shape (Object.keys, "key" in data, hasOwnProperty)
 *   - value equality
 *
 * This documents the current behavior (including the DNA standard `keepOnly`
 * bug that strips `undefined`) and will need updating once the fix is applied.
 */

// Helper: run the same input through both Zod and DNA and compare
type ShapeInfo = {
	success: boolean;
	keys: string[];
	hasKey: (k: string) => boolean;
	data: unknown;
};

function runZod(schema: z.ZodType, input: unknown): ShapeInfo {
	const r = schema.safeParse(input);
	return {
		success: r.success,
		keys: r.success ? Object.keys(r.data as object) : [],
		hasKey: (k: string) => r.success && k in (r.data as object),
		data: r.success ? r.data : null,
	};
}

function runDna(schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; errors?: unknown[] } }, input: unknown): ShapeInfo {
	const r = schema.safeParse(input);
	return {
		success: r.success,
		keys: r.success ? Object.keys(r.data as object) : [],
		hasKey: (k: string) => r.success && k in (r.data as object),
		data: r.success ? r.data : null,
	};
}

// Schemas for each mode — identical shape on both sides
const standardZod = z.object({ name: z.string(), age: z.number().optional() });
const standardDna = dna.object({ name: dna.string(), age: dna.number().optional() });

const strictZod = z.strictObject({ name: z.string(), age: z.number().optional() });
const strictDna = dna.strictObject({ name: dna.string(), age: dna.number().optional() });

const looseZod = z.looseObject({ name: z.string(), age: z.number().optional() });
const looseDna = dna.looseObject({ name: dna.string(), age: dna.number().optional() });

// Required-only schemas (no optional)
const reqStandardZod = z.object({ name: z.string(), age: z.number() });
const reqStandardDna = dna.object({ name: dna.string(), age: dna.number() });
const reqStrictZod = z.strictObject({ name: z.string(), age: z.number() });
const reqStrictDna = dna.strictObject({ name: dna.string(), age: dna.number() });
const reqLooseZod = z.looseObject({ name: z.string(), age: z.number() });
const reqLooseDna = dna.looseObject({ name: dna.string(), age: dna.number() });

// =============================================================================
// STANDARD MODE (z.object / dna.object)
// =============================================================================

describe("undefined handling — standard mode (z.object / dna.object)", () => {
	describe("optional key with undefined", () => {
		it("optional present=undefined: both preserve (aligned with Zod)", () => {
			const zr = runZod(standardZod, { name: "x", age: undefined });
			const dr = runDna(standardDna, { name: "x", age: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			// Zod preserves age: undefined
			expect(zr.keys).toEqual(["name", "age"]);
			expect(zr.hasKey("age")).toBe(true);

			// DNA now preserves age: undefined (aligned with Zod)
			expect(dr.keys).toEqual(["name", "age"]);
			expect(dr.hasKey("age")).toBe(true);

			// Both agree
			expect(zr.hasKey("age")).toBe(dr.hasKey("age"));
		});

		it("optional absent: both agree (key absent)", () => {
			const zr = runZod(standardZod, { name: "x" });
			const dr = runDna(standardDna, { name: "x" });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name"]);
			expect(dr.keys).toEqual(["name"]);
			expect(zr.hasKey("age")).toBe(false);
			expect(dr.hasKey("age")).toBe(false);
		});

		it("optional present=42: both agree (key present with value)", () => {
			const zr = runZod(standardZod, { name: "x", age: 42 });
			const dr = runDna(standardDna, { name: "x", age: 42 });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name", "age"]);
			expect(dr.keys).toEqual(["name", "age"]);
			expect(zr.hasKey("age")).toBe(true);
			expect(dr.hasKey("age")).toBe(true);
		});
	});

	describe("required key with undefined", () => {
		it("required present=undefined: both reject", () => {
			const zr = runZod(reqStandardZod, { name: undefined, age: 42 });
			const dr = runDna(reqStandardDna, { name: undefined, age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});

		it("required absent: both reject", () => {
			const zr = runZod(reqStandardZod, { age: 42 });
			const dr = runDna(reqStandardDna, { age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});
	});

	describe("extra key with undefined", () => {
		it("extra=undefined: both strip (standard strips unknowns)", () => {
			const zr = runZod(standardZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(standardDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			// Both strip the extra key
			expect(zr.hasKey("extra")).toBe(false);
			expect(dr.hasKey("extra")).toBe(false);
		});

		it("extra=undefined (no optional): both strip", () => {
			const zr = runZod(reqStandardZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(reqStandardDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.hasKey("extra")).toBe(false);
			expect(dr.hasKey("extra")).toBe(false);
		});
	});
});

// =============================================================================
// STRICT MODE (z.strictObject / dna.strictObject)
// =============================================================================

describe("undefined handling — strict mode (z.strictObject / dna.strictObject)", () => {
	describe("optional key with undefined", () => {
		it("optional present=undefined: both preserve", () => {
			const zr = runZod(strictZod, { name: "x", age: undefined });
			const dr = runDna(strictDna, { name: "x", age: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			// Both preserve age: undefined
			expect(zr.keys).toEqual(["name", "age"]);
			expect(dr.keys).toEqual(["name", "age"]);
			expect(zr.hasKey("age")).toBe(true);
			expect(dr.hasKey("age")).toBe(true);
		});

		it("optional absent: both agree (key absent)", () => {
			const zr = runZod(strictZod, { name: "x" });
			const dr = runDna(strictDna, { name: "x" });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name"]);
			expect(dr.keys).toEqual(["name"]);
			expect(zr.hasKey("age")).toBe(false);
			expect(dr.hasKey("age")).toBe(false);
		});

		it("optional present=42: both agree", () => {
			const zr = runZod(strictZod, { name: "x", age: 42 });
			const dr = runDna(strictDna, { name: "x", age: 42 });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name", "age"]);
			expect(dr.keys).toEqual(["name", "age"]);
		});
	});

	describe("required key with undefined", () => {
		it("required present=undefined: both reject", () => {
			const zr = runZod(reqStrictZod, { name: undefined, age: 42 });
			const dr = runDna(reqStrictDna, { name: undefined, age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});

		it("required absent: both reject", () => {
			const zr = runZod(reqStrictZod, { age: 42 });
			const dr = runDna(reqStrictDna, { age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});
	});

	describe("extra key with undefined", () => {
		it("extra=undefined: both reject (strict rejects unknowns)", () => {
			const zr = runZod(strictZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(strictDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});

		it("extra=undefined (no optional): both reject", () => {
			const zr = runZod(reqStrictZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(reqStrictDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});
	});
});

// =============================================================================
// LOOSE MODE (z.looseObject / dna.looseObject)
// =============================================================================

describe("undefined handling — loose mode (z.looseObject / dna.looseObject)", () => {
	describe("optional key with undefined", () => {
		it("optional present=undefined: both preserve", () => {
			const zr = runZod(looseZod, { name: "x", age: undefined });
			const dr = runDna(looseDna, { name: "x", age: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			// Both preserve age: undefined
			expect(zr.keys).toEqual(["name", "age"]);
			expect(dr.keys).toEqual(["name", "age"]);
			expect(zr.hasKey("age")).toBe(true);
			expect(dr.hasKey("age")).toBe(true);
		});

		it("optional absent: both agree (key absent)", () => {
			const zr = runZod(looseZod, { name: "x" });
			const dr = runDna(looseDna, { name: "x" });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name"]);
			expect(dr.keys).toEqual(["name"]);
			expect(zr.hasKey("age")).toBe(false);
			expect(dr.hasKey("age")).toBe(false);
		});

		it("optional present=42: both agree", () => {
			const zr = runZod(looseZod, { name: "x", age: 42 });
			const dr = runDna(looseDna, { name: "x", age: 42 });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.keys).toEqual(["name", "age"]);
			expect(dr.keys).toEqual(["name", "age"]);
		});
	});

	describe("required key with undefined", () => {
		it("required present=undefined: both reject", () => {
			const zr = runZod(reqLooseZod, { name: undefined, age: 42 });
			const dr = runDna(reqLooseDna, { name: undefined, age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});

		it("required absent: both reject", () => {
			const zr = runZod(reqLooseZod, { age: 42 });
			const dr = runDna(reqLooseDna, { age: 42 });

			expect(zr.success).toBe(false);
			expect(dr.success).toBe(false);
		});
	});

	describe("extra key with undefined", () => {
		it("extra=undefined: both preserve (loose preserves unknowns)", () => {
			const zr = runZod(looseZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(looseDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			// Both preserve the extra key (even with undefined value)
			expect(zr.hasKey("extra")).toBe(true);
			expect(dr.hasKey("extra")).toBe(true);
		});

		it("extra=undefined (no optional): both preserve", () => {
			const zr = runZod(reqLooseZod, { name: "x", age: 42, extra: undefined });
			const dr = runDna(reqLooseDna, { name: "x", age: 42, extra: undefined });

			expect(zr.success).toBe(true);
			expect(dr.success).toBe(true);

			expect(zr.hasKey("extra")).toBe(true);
			expect(dr.hasKey("extra")).toBe(true);
		});
	});
});

// =============================================================================
// CROSS-MODE COMPARISON — same input, different modes
// =============================================================================

describe("undefined handling — cross-mode comparison (same input)", () => {
	it("optional=undefined: all modes preserve (aligned with Zod)", () => {
		const input = { name: "x", age: undefined };

		const stdDr = runDna(standardDna, input);
		const strictDr = runDna(strictDna, input);
		const looseDr = runDna(looseDna, input);

		// Standard preserves (aligned with Zod)
		expect(stdDr.hasKey("age")).toBe(true);
		expect(stdDr.keys).toEqual(["name", "age"]);

		// Strict preserves
		expect(strictDr.hasKey("age")).toBe(true);
		expect(strictDr.keys).toEqual(["name", "age"]);

		// Loose preserves
		expect(looseDr.hasKey("age")).toBe(true);
		expect(looseDr.keys).toEqual(["name", "age"]);

		// All modes agree
		expect(stdDr.hasKey("age")).toBe(strictDr.hasKey("age"));
		expect(stdDr.hasKey("age")).toBe(looseDr.hasKey("age"));
	});

	it("optional=undefined: Zod is consistent across all 3 modes (preserves)", () => {
		const input = { name: "x", age: undefined };

		const stdZr = runZod(standardZod, input);
		const strictZr = runZod(strictZod, input);
		const looseZr = runZod(looseZod, input);

		// All 3 modes preserve age: undefined
		expect(stdZr.hasKey("age")).toBe(true);
		expect(strictZr.hasKey("age")).toBe(true);
		expect(looseZr.hasKey("age")).toBe(true);

		expect(stdZr.keys).toEqual(["name", "age"]);
		expect(strictZr.keys).toEqual(["name", "age"]);
		expect(looseZr.keys).toEqual(["name", "age"]);
	});

	it("extra=undefined: standard strips, strict rejects, loose preserves (both Zod & DNA)", () => {
		const input = { name: "x", age: 42, extra: undefined };

		const stdZr = runZod(standardZod, input);
		const stdDr = runDna(standardDna, input);
		const strictZr = runZod(strictZod, input);
		const strictDr = runDna(strictDna, input);
		const looseZr = runZod(looseZod, input);
		const looseDr = runDna(looseDna, input);

		// Standard: both strip
		expect(stdZr.hasKey("extra")).toBe(false);
		expect(stdDr.hasKey("extra")).toBe(false);

		// Strict: both reject
		expect(strictZr.success).toBe(false);
		expect(strictDr.success).toBe(false);

		// Loose: both preserve
		expect(looseZr.hasKey("extra")).toBe(true);
		expect(looseDr.hasKey("extra")).toBe(true);
	});
});

// =============================================================================
// SUMMARY TABLE — documents current behavior
// =============================================================================

describe("undefined handling — summary documentation", () => {
	it("documents the current behavior matrix", () => {
		const cases = [
			// [label, mode, input, expectedZodSuccess, expectedDnaSuccess, expectedZodHasAge, expectedDnaHasAge]
			["std opt=undef", "standard", { name: "x", age: undefined }, true, true, true, true],
			["std opt absent", "standard", { name: "x" }, true, true, false, false],
			["std opt=42", "standard", { name: "x", age: 42 }, true, true, true, true],
			["strict opt=undef", "strict", { name: "x", age: undefined }, true, true, true, true],
			["strict opt absent", "strict", { name: "x" }, true, true, false, false],
			["strict opt=42", "strict", { name: "x", age: 42 }, true, true, true, true],
			["loose opt=undef", "loose", { name: "x", age: undefined }, true, true, true, true],
			["loose opt absent", "loose", { name: "x" }, true, true, false, false],
			["loose opt=42", "loose", { name: "x", age: 42 }, true, true, true, true],
		] as const;

		for (const [label, mode, input, zSuccess, dSuccess, zHasAge, dHasAge] of cases) {
			const zSchema = mode === "standard" ? standardZod : mode === "strict" ? strictZod : looseZod;
			const dSchema = mode === "standard" ? standardDna : mode === "strict" ? strictDna : looseDna;

			const zr = runZod(zSchema, input);
			const dr = runDna(dSchema, input);

			expect(zr.success, `${label}: Zod success`).toBe(zSuccess);
			expect(dr.success, `${label}: DNA success`).toBe(dSuccess);
			expect(zr.hasKey("age"), `${label}: Zod has age`).toBe(zHasAge);
			expect(dr.hasKey("age"), `${label}: DNA has age`).toBe(dHasAge);
		}
	});

	it("documents extra=undefined behavior matrix", () => {
		const cases = [
			// [label, mode, expectedZodSuccess, expectedDnaSuccess, expectedZodHasExtra, expectedDnaHasExtra]
			["std extra=undef", "standard", true, true, false, false],
			["strict extra=undef", "strict", false, false, false, false],
			["loose extra=undef", "loose", true, true, true, true],
		] as const;

		for (const [label, mode, zSuccess, dSuccess, zHasExtra, dHasExtra] of cases) {
			const zSchema = mode === "standard" ? standardZod : mode === "strict" ? strictZod : looseZod;
			const dSchema = mode === "standard" ? standardDna : mode === "strict" ? strictDna : looseDna;

			const zr = runZod(zSchema, { name: "x", age: 42, extra: undefined });
			const dr = runDna(dSchema, { name: "x", age: 42, extra: undefined });

			expect(zr.success, `${label}: Zod success`).toBe(zSuccess);
			expect(dr.success, `${label}: DNA success`).toBe(dSuccess);
			if (zr.success) expect(zr.hasKey("extra"), `${label}: Zod has extra`).toBe(zHasExtra);
			if (dr.success) expect(dr.hasKey("extra"), `${label}: DNA has extra`).toBe(dHasExtra);
		}
	});
});

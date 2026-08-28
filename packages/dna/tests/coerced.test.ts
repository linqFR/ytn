import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";

describe(".coerced()", () => {
  describe("simple schemas", () => {
    it("clones and enables coercion on dna.number()", () => {
      const s = dna.number();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
      if (c.safeParse("42").success) {
        expect(c.safeParse("42").data).toBe(42);
      }
    });

    it("clones and enables coercion on dna.int()", () => {
      const s = dna.int();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("clones and enables coercion on dna.boolean()", () => {
      const s = dna.boolean();
      const c = s.coerced();
      expect(s.safeParse("true").success).toBe(false);
      expect(c.safeParse("true").success).toBe(true);
    });

    it("clones and enables coercion on dna.bigint()", () => {
      const s = dna.bigint();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("clones and enables coercion on dna.string()", () => {
      const s = dna.string();
      const c = s.coerced();
      expect(s.safeParse(42).success).toBe(false);
      expect(c.safeParse(42).success).toBe(true);
    });
  });

  describe("immutability", () => {
    it("does not mutate the original schema", () => {
      const s = dna.number();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("is idempotent on already-coercible schemas", () => {
      const s = dna.coerce.number();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(true);
      expect(c.safeParse("42").success).toBe(true);
    });
  });

  describe("wrappers", () => {
    it("walks through .optional()", () => {
      const s = dna.number().optional();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("walks through .nullable()", () => {
      const s = dna.number().nullable();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("walks through .nullish()", () => {
      const s = dna.number().nullish();
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });

    it("walks through .default()", () => {
      const s = dna.number().default(() => 0);
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
    });
  });

  describe("pipes", () => {
    it("coerces the first step (input) of a regular pipe", () => {
      const s = dna.number().pipe(dna.number().transform(v => v * 2));
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
      if (c.safeParse("42").success) {
        expect(c.safeParse("42").data).toBe(84);
      }
    });

    it("coerces through wrapper + pipe", () => {
      const s = dna.number().optional().pipe(dna.number().transform(v => v * 2));
      const c = s.coerced();
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
      if (c.safeParse("42").success) {
        expect(c.safeParse("42").data).toBe(84);
      }
    });
  });

  describe("preprocess", () => {
    it("coerces the last step (target) of a preprocess", () => {
      const s = dna.preprocess((v: unknown) => String(v), dna.number());
      const c = s.coerced();
      // Before: preprocess converts to String("42") = "42", then dna.number() rejects "42"
      // After: preprocess converts to "42", then dna.coerce.number() coerces "42" → 42
      expect(s.safeParse("42").success).toBe(false);
      expect(c.safeParse("42").success).toBe(true);
      if (c.safeParse("42").success) {
        expect(c.safeParse("42").data).toBe(42);
      }
    });
  });

  describe("DnaDate — silent no-op", () => {
    it("silently no-ops on dna.date() (no coerceCode)", () => {
      const s = dna.date();
      const c = s.coerced();
      // dna.date() validates Date objects — no coercion available
      expect(s.safeParse("2024-01-01").success).toBe(false);
      expect(c.safeParse("2024-01-01").success).toBe(false);
      // Both reject string input — coercion didn't activate (by design)
    });
  });

  describe("record keys (internal caller)", () => {
    it("record keys are coerced — string keys accepted from numbers", () => {
      const rec = dna.record(dna.number(), dna.string());
      // record keys use .coerced() internally — number keys coerced to strings
      const result = rec.safeParse({ "42": "hello" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data["42"]).toBe("hello");
      }
    });
  });
});

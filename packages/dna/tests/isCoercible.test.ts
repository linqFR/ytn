import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import { isCoercible } from "../src/introspect.js";

describe("isCoercible", () => {
  describe("coercible types", () => {
    it("returns true for dna.coerce.number()", () => {
      expect(isCoercible(dna.coerce.number())).toBe(true);
    });
    it("returns true for dna.coerce.string()", () => {
      expect(isCoercible(dna.coerce.string())).toBe(true);
    });
    it("returns true for dna.coerce.boolean()", () => {
      expect(isCoercible(dna.coerce.boolean())).toBe(true);
    });
    it("returns true for dna.coerce.bigint()", () => {
      expect(isCoercible(dna.coerce.bigint())).toBe(true);
    });
    it("returns true for dna.coerce.date()", () => {
      expect(isCoercible(dna.coerce.date())).toBe(true);
    });
  });

  describe("non-coercible types", () => {
    it("returns false for dna.number()", () => {
      expect(isCoercible(dna.number())).toBe(false);
    });
    it("returns false for dna.string()", () => {
      expect(isCoercible(dna.string())).toBe(false);
    });
    it("returns false for dna.int()", () => {
      expect(isCoercible(dna.int())).toBe(false);
    });
    it("returns false for dna.boolean()", () => {
      expect(isCoercible(dna.boolean())).toBe(false);
    });
    it("returns false for dna.date()", () => {
      expect(isCoercible(dna.date())).toBe(false);
    });
  });

  describe("dna.x({ coerce: true }) syntax", () => {
    it("returns true for dna.number({ coerce: true })", () => {
      expect(isCoercible(dna.number({ coerce: true }))).toBe(true);
    });
    it("returns true for dna.int({ coerce: true })", () => {
      expect(isCoercible(dna.int({ coerce: true }))).toBe(true);
    });
    it("returns true for dna.string({ coerce: true })", () => {
      expect(isCoercible(dna.string({ coerce: true }))).toBe(true);
    });
    it("returns true for dna.boolean({ coerce: true })", () => {
      expect(isCoercible(dna.boolean({ coerce: true }))).toBe(true);
    });
  });

  describe("wrappers: coercion must traverse the chain", () => {
    it("returns true for dna.coerce.number().optional()", () => {
      expect(isCoercible(dna.coerce.number().optional())).toBe(true);
    });
    it("returns true for dna.coerce.number().nullable()", () => {
      expect(isCoercible(dna.coerce.number().nullable())).toBe(true);
    });
    it("returns true for dna.coerce.number().nullish()", () => {
      expect(isCoercible(dna.coerce.number().nullish())).toBe(true);
    });
    it("returns true for dna.coerce.number().default(() => 0)", () => {
      expect(isCoercible(dna.coerce.number().default(() => 0))).toBe(true);
    });
    it("returns false for dna.number().optional()", () => {
      expect(isCoercible(dna.number().optional())).toBe(false);
    });
    it("returns false for dna.string().optional()", () => {
      expect(isCoercible(dna.string().optional())).toBe(false);
    });
  });

  describe("pipe: coercion on the first step (input)", () => {
    it("returns true for dna.coerce.number().pipe(dna.string())", () => {
      expect(isCoercible(dna.coerce.number().pipe(dna.string()))).toBe(true);
    });
    it("returns false for dna.number().pipe(dna.string())", () => {
      expect(isCoercible(dna.number().pipe(dna.string()))).toBe(false);
    });
  });

  describe("preprocess: coercion on the last step (target)", () => {
    it("returns true for preprocess(fn, dna.coerce.number())", () => {
      const s = dna.preprocess((v: unknown) => String(v), dna.coerce.number());
      expect(isCoercible(s)).toBe(true);
    });
    it("returns false for preprocess(fn, dna.number())", () => {
      const s = dna.preprocess((v: unknown) => Number(v), dna.number());
      expect(isCoercible(s)).toBe(false);
    });
  });

  describe("DnaDate: by design non-coercible without coerceCode", () => {
    it("returns false for dna.date()", () => {
      expect(isCoercible(dna.date())).toBe(false);
    });
    it("returns true for dna.coerce.date()", () => {
      expect(isCoercible(dna.coerce.date())).toBe(true);
    });
    it("returns false for dna.iso.date() (extends DnaString, coerce=false)", () => {
      expect(isCoercible(dna.iso.date())).toBe(false);
    });
  });
});

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";

describe("DNA vs Zod: Introspection getters", () => {
  describe("union .options", () => {
    it("returns the same number of options", () => {
      const zodUnion = z.union([z.string(), z.number()]);
      const dnaUnion = dna.union([dna.string(), dna.number()]);
      expect(zodUnion.options.length).toBe(2);
      expect(dnaUnion.options.length).toBe(2);
    });

    it("returns typed options", () => {
      const dnaUnion = dna.union([dna.string(), dna.number()]);
      const opts = dnaUnion.options;
      expect(opts[0].type).toBe("string");
      expect(opts[1].type).toBe("number");
    });
  });

  describe("discriminatedUnion .options and .discriminator", () => {
    it("returns the same number of options", () => {
      const zodDu = z.discriminatedUnion("type", [
        z.object({ type: z.literal("a"), value: z.string() }),
        z.object({ type: z.literal("b"), value: z.number() }),
      ]);
      const dnaDu = dna.discriminatedUnion("type", [
        dna.object({ type: dna.literal("a"), value: dna.string() }),
        dna.object({ type: dna.literal("b"), value: dna.number() }),
      ]);
      expect(zodDu.options.length).toBe(2);
      expect(dnaDu.options.length).toBe(2);
    });

    it("returns the discriminator name", () => {
      const dnaDu = dna.discriminatedUnion("type", [
        dna.object({ type: dna.literal("a"), value: dna.string() }),
        dna.object({ type: dna.literal("b"), value: dna.number() }),
      ]);
      expect(dnaDu.discriminator).toBe("type");
    });
  });

  describe("record .keySchema and .valueSchema", () => {
    it("returns key and value schemas", () => {
      const dnaRec = dna.record(dna.string(), dna.number());
      expect(dnaRec.keySchema.type).toBe("string");
      expect(dnaRec.valueSchema.type).toBe("number");
    });
  });
});

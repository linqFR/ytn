import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zod, safe } from "../index.js";

describe("shared/zod-extended (Functional & Rupture)", () => {
  describe("Safe Parsers", () => {
    it("should transform zod parse to safeResult [null, data]", () => {
      const schema = z.string();
      const res = zod.safe.safeParseZ(schema, "hello");
      expect(safe.isSuccess(res)).toBe(true);
      expect(res[1]).toBe("hello");
    });

    it("should transform failure to safeResult [err, null]", () => {
      const schema = z.string();
      const res = zod.safe.safeParseZ(schema, 123);
      expect(safe.isFailure(res)).toBe(true);
      expect(res[0]).toBeInstanceOf(z.ZodError);
    });
  });

  describe("Zod Case-Sensitive Schemas", () => {
    it("should validate kebab-case", () => {
      expect(zod.strcases.schKebabCase.safeParse("hello-world").success).toBe(true);
      expect(zod.strcases.schKebabCase.safeParse("hello_world").success).toBe(false);
    });

    it("should transform kebab to camel", () => {
      const res = zod.strcases.kebabToCamel("hello-world-123");
      expect(res).toBe("helloWorld123");
    });
  });
});

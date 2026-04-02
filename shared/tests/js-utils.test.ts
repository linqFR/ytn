import { describe, expect, it } from "vitest";
import { str, arr, rec, bitops } from "../index.js";

describe("shared/js-utils (Functional & Rupture)", () => {
  describe("String Cases", () => {
    it("should transform to camelCase", () => {
      expect(str.toCamelCase("hello-world")).toBe("helloWorld");
      expect(str.toCamelCase("Hello World")).toBe("helloWorld");
      expect(str.toCamelCase("hello_world")).toBe("helloWorld");
    });

    it("should transform to kebab-case", () => {
      expect(str.toKebabCase("helloWorld")).toBe("hello-world");
      expect(str.toKebabCase("Hello World")).toBe("hello-world");
    });

    it("should transform to PascalCase", () => {
      expect(str.toPascalCase("hello-world")).toBe("HelloWorld");
    });

    it("should detect casing correctly", () => {
      expect(str.isKebabCase("hello-world-123")).toBe(true);
      expect(str.isKebabCase("helloWorld")).toBe(false);
      expect(str.isSnakeCase("hello_world")).toBe(true);
      expect(str.isScreamingSnakeCase("HELLO_WORLD")).toBe(true);
    });

    it("should handle edge cases in casing (Rupture)", () => {
      // Empty string
      expect(str.toKebabCase("")).toBe("");
      expect(str.isKebabCase("")).toBe(false);

      // Multiple separators
      expect(str.toKebabCase("hello   world")).toBe("hello-world");
      expect(str.toKebabCase("hello___world")).toBe("hello-world");

      // Special characters (should be preserved or handled consistently)
      expect(str.toKebabCase("hello!@#world")).toBe("hello!@#world");
      
      // Numbers
      expect(str.toCamelCase("hello-123-world")).toBe("hello123World");
    });
  });

  describe("Array Ops", () => {
    it("should filter unique values", () => {
      expect(arr.unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
      expect(arr.unique([])).toEqual([]);
    });

    it("should group by key", () => {
      const data = [
        { id: 1, type: "A" },
        { id: 2, type: "B" },
        { id: 3, type: "A" },
      ];
      const grouped = arr.groupBy(data, (i) => i.type);
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });

    it("should handle missing keys in groupBy (Rupture)", () => {
      const data = [
        { id: 1, type: "A" },
        { id: 2 }, // Missing type
      ];
      // @ts-ignore
      const grouped = arr.groupBy(data, (i) => i.type || "unknown");
      expect(grouped.A).toHaveLength(1);
      expect(grouped.unknown).toHaveLength(1);
    });

    it("should ensure array with edge cases (Rupture)", () => {
      expect(arr.ensureArray(null as any)).toEqual([null]);
      expect(arr.ensureArray(undefined)).toEqual([]);
      expect(arr.ensureArray([])).toEqual([]);
    });
  });

  describe("Record Ops", () => {
    it("should convert Record of Sets to Record of Arrays", () => {
      const input = {
        a: new Set([1, 2]),
        b: new Set([3]),
      };
      const output = rec.recordSetToRecordArray(input as any);
      expect(output.a).toEqual([1, 2]);
      expect(output.b).toEqual([3]);
    });
  });

  describe("Bit Ops", () => {
    it("should check and combine bits", () => {
      const bit1 = 1 << 0; // 1
      const bit2 = 1 << 1; // 2
      let mask = bitops.combineBits(0, bit1);
      mask = bitops.combineBits(mask, bit2);
      
      expect(mask).toBe(3);
      expect(bitops.hasBit(mask, bit1)).toBe(true);
      expect(bitops.hasBit(mask, 1 << 2)).toBe(false);
    });

    it("should remove bits", () => {
      const mask = 7; // 111
      const res = bitops.removeBits(mask, 2); // 111 & ~010 = 101
      expect(res).toBe(5);
    });

    it("should format to hex", () => {
      expect(bitops.toHex(255)).toBe("ff");
    });
  });
});

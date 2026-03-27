import { describe, expect, it } from "vitest";
import {
  checkPICO_ATOMIC_FACTORIES,
  dslToZod,
} from "../src/pico-zod/dsl-converter.zod.js";

describe("dsl-converter", () => {
  it("should return the string corresponding to an atomic factory", () => {
    const stringkey = "string";
    expect(checkPICO_ATOMIC_FACTORIES.parse(stringkey)).toBe(stringkey);
  });

  it("should fail to return the string not corresponding to an atomic factory", () => {
    const stringkey = "stringf";
    expect(() => checkPICO_ATOMIC_FACTORIES.parse(stringkey)).toThrow();
  });

  it("should convert atomic types", () => {
    const stringSchema = dslToZod.parse("string");
    expect(stringSchema).toBeDefined();
    expect(stringSchema.parse("hello")).toBe("hello");

    const numberSchema = dslToZod.parse("number");
    expect(numberSchema.parse("123")).toBe(123);
  });

  it("should convert list format (atomics)", () => {
    const listSchema = dslToZod.parse("string, number");
    expect(listSchema).toBeDefined();
    // Expect a tuple [string, number] per current logic
    expect(listSchema.parse("val1, 42")).toEqual(["val1", 42]);
  });

  it("should convert or format (atomics)", () => {
    const orSchema = dslToZod.parse("bool | number");
    // console.log("Generated Schema for 'bool | number':", orSchema);

    expect(orSchema).toBeDefined();

    const res1 = orSchema.parse("true");

    // console.log("Result of parse('true'):", res1);
    expect(res1).toBe(true);

    const res2 = orSchema.parse("99");
    // console.log("Result of parse('99'):", res2);
    expect(res2).toBe(99);
  });

  it("should fail on unknown atomic types in DSL", () => {
    // console.log("Testing failure for 'not_a_type'...");
    expect(() => dslToZod.parse("not_a_type")).toThrow();

    // console.log("Testing failure for 'string, unknown_type'...");
    expect(() => dslToZod.parse("string, unknown_type")).toThrow();
  });

  it("debug: detailed look at unknown parse", () => {
    try {
      const result = dslToZod.parse("not_a_type");
      // console.log("UNEXPECTED SUCCESS (should have thrown):", result);
    } catch (e) {
      // console.log("EXPECTED ERROR CAPTURED:", e instanceof Error ? e.message : e);
    }
  });
});

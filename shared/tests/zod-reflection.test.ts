import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as reflect from "../zod/zod-reflection.js";
import { castArrayValuesToString } from "../js/cast-ops.js";

describe("shared/zod-reflection", () => {
  it("should unwrap nested optional and default schemas (Deep)", () => {
    const schema = z.string().optional().default("foo");
    const unwrapped = reflect.unwrapZodDeep(schema);
    expect(unwrapped).toBeInstanceOf(z.ZodString);
  });

  it("should perform shallow unwrap only with unwrapZod", () => {
    const schema = z.string().optional().default("foo");
    const unwrapped = reflect.unwrapZod(schema);
    // In V4, default wraps optional, so one step unwrap yields the optional
    expect(reflect.isZodOptional(unwrapped)).toBe(true);
    expect(unwrapped).not.toBeInstanceOf(z.ZodString);
  });

  it("should detect ZodOptional and ZodDefault correctly (non-recursive check)", () => {
    const opt = z.string().optional();
    const def = z.string().default("bar");
    const plain = z.string();

    expect(reflect.isZodOptional(opt)).toBe(true);
    expect(reflect.isZodOptional(plain)).toBe(false);
    expect(reflect.isZodOptional(def)).toBe(false);

    expect(reflect.isZodDefault(def)).toBe(true);
    expect(reflect.isZodDefault(plain)).toBe(false);
  });

  it("should identify ZodLiteral and ZodEnum through wrapping", () => {
    const lit = z.literal("hello").optional();
    const enu = z.enum(["a", "b"]).default("a");

    expect(reflect.isZodLiteral(lit)).toBe(true);
    expect(reflect.isZodEnum(enu)).toBe(true);
  });

  it("should extract values from ZodLiteral", () => {
    const lit = z.literal("world");
    expect(reflect.getZodValue(lit)).toEqual(["world"]);
    
    const numLit = z.literal(42);
    // getZodValue returns native types for DDL/QB
    expect(reflect.getZodValue(numLit)).toEqual([42]);
    // castArrayValuesToString converts them for CLI/UI
    expect(castArrayValuesToString(reflect.getZodValue(numLit))).toEqual(["42"]);
  });

  it("should extract values from ZodEnum", () => {
    const enu = z.enum(["red", "green", "blue"]);
    expect(reflect.getZodValue(enu)).toEqual(["red", "green", "blue"]);
  });

  it("should retrieve metadata via .meta()", () => {
    // Note: In Zod V4, .describe() or .meta() might be used.
    // Assuming .meta() as it is standard in this project's AGENTS.md rules for V4.
    const schema = z.string().meta({ title: "username" });
    const meta = reflect.getZodMeta(schema);
    expect(meta.title).toBe("username");
  });

  it("should extract shape from ZodObject", () => {
    const obj = z.object({
      id: z.number(),
      name: z.string(),
    });
    const shape = reflect.getZodShape(obj);
    expect(shape).toBeDefined();
    expect(shape?.id).toBeInstanceOf(z.ZodNumber);
    expect(shape?.name).toBeInstanceOf(z.ZodString);
  });
});

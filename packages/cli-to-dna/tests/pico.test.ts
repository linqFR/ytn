import { describe, expect, it } from "vitest";
import { pico } from "../src/pico.js";

describe("pico DSL", () => {
  it("string with min length", () => {
    const ok = pico.string().min(5).safeParse("hello");
    expect(ok).toEqual({ success: true, data: "hello" });
    const ko = pico.string().min(5).safeParse("hi");
    expect(ko.success).toBe(false);
  });

  it("coerced number with min", () => {
    const ok = pico.number().min(18).safeParse("25");
    expect(ok).toEqual({ success: true, data: 25 });
    const ko = pico.number().min(18).safeParse("12");
    expect(ko.success).toBe(false);
  });

  it("bool from strings", () => {
    expect(pico.bool().safeParse("true")).toEqual({ success: true, data: true });
    expect(pico.bool().safeParse("false")).toEqual({
      success: true,
      data: false,
    });
    expect(pico.bool().safeParse("yes")).toEqual({ success: true, data: true });
  });

  it("number and string lists from CSV", () => {
    expect(pico.numList().safeParse("1,2,3")).toEqual({
      success: true,
      data: [1, 2, 3],
    });
    expect(pico.stringList().safeParse("a,b,c")).toEqual({
      success: true,
      data: ["a", "b", "c"],
    });
    expect(pico.boolList().safeParse("true,false,yes")).toEqual({
      success: true,
      data: [true, false, true],
    });
  });

  it("or union picks a branch", () => {
    const schema = pico.or(pico.string(), pico.number());
    const s = schema.safeParse("42");
    const n = schema.safeParse(42);
    expect(s.success).toBe(true);
    expect(n.success).toBe(true);
  });

  it("xor picks one branch", () => {
    const schema = pico.xor(pico.string(), pico.number());
    const s = schema.safeParse("42");
    const n = schema.safeParse(42);
    expect(s.success).toBe(false);
    expect(n).toEqual({ success: true, data: 42 });
  });

  it("describe and optional", () => {
    const d = pico.string().describe("A name").safeParse("Alice");
    expect(d).toEqual({ success: true, data: "Alice" });
    const o1 = pico.string().optional().safeParse(undefined);
    expect(o1).toEqual({ success: true, data: undefined });
    const o2 = pico.string().optional().safeParse("present");
    expect(o2).toEqual({ success: true, data: "present" });
  });
});

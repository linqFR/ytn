import { describe, it, expect } from "vitest";

import { FN_fCount, FN_dEq, FN_cidrV6, FN_toBigInt, FN_toDate, FN_dMerge } from "../src/toJs/inline-func.js";

// =============================================================================
// Unit tests for inline-func.ts — the helper functions inlined into generated
// validator/parser JS bodies via `new Function`. These are tested directly here
// to cover edge cases that the indirect schema-level tests may not exercise.
//
// Each InlineFunc.body is a string expression assignable to a variable. We
// evaluate it with `new Function("return " + body)()` to get a callable.
// =============================================================================

function evalInline(body: string): (...args: any[]) => any {
  return new Function("return " + body)() as (...args: any[]) => any;
}

describe("inline-func — FN_fCount (Unicode code point count)", () => {
  const fCount = evalInline(FN_fCount.body);

  it("counts BMP characters correctly", () => {
    expect(fCount("abc")).toBe(3);
    expect(fCount("")).toBe(0);
  });

  it("counts astral characters as 1 code point (surrogate pair)", () => {
    expect(fCount("😀")).toBe(1); // 2 UTF-16 units, 1 code point
    expect(fCount("🇫🇷")).toBe(2); // 4 UTF-16 units, 2 code points
  });

  it("counts mixed BMP + astral", () => {
    expect(fCount("a😀b")).toBe(3); // 4 UTF-16 units, 3 code points
  });

  it("counts combining marks as separate code points", () => {
    expect(fCount("e\u0301")).toBe(2); // "é" as e + combining acute
  });

  it("counts ZWJ sequences as multiple code points", () => {
    expect(fCount("🧑‍🍼")).toBe(3); // person + ZWJ + baby bottle
  });
});

describe("inline-func — FN_dEq (deep equality)", () => {
  const dEq = evalInline(FN_dEq.body);

  it("primitives — equal", () => {
    expect(dEq(1, 1)).toBe(true);
    expect(dEq("a", "a")).toBe(true);
    expect(dEq(true, true)).toBe(true);
    expect(dEq(null, null)).toBe(true);
    expect(dEq(undefined, undefined)).toBe(true);
  });

  it("primitives — not equal", () => {
    expect(dEq(1, 2)).toBe(false);
    expect(dEq("a", "b")).toBe(false);
    expect(dEq(1, "1")).toBe(false);
  });

  it("flat objects — equal", () => {
    expect(dEq({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it("flat objects — not equal (different values)", () => {
    expect(dEq({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });

  it("flat objects — not equal (different keys)", () => {
    expect(dEq({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it("flat objects — not equal (different key count)", () => {
    expect(dEq({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("nested objects — equal", () => {
    expect(dEq({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it("nested objects — not equal", () => {
    expect(dEq({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("arrays — equal", () => {
    expect(dEq([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("arrays — not equal (different lengths)", () => {
    expect(dEq([1, 2], [1, 2, 3])).toBe(false);
  });

  it("arrays — not equal (different values)", () => {
    expect(dEq([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it("nested arrays in objects — equal", () => {
    expect(dEq({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
  });

  it("different constructors — not equal", () => {
    class A { x = 1; }
    class B { x = 1; }
    expect(dEq(new A(), new B())).toBe(false);
  });

  it("same constructor — equal", () => {
    class A { x = 1; }
    expect(dEq(new A(), new A())).toBe(true);
  });
});

describe("inline-func — FN_cidrV6 (IPv6 CIDR validation)", () => {
  const cV6 = evalInline(FN_cidrV6.body);

  it("valid IPv6 CIDR", () => {
    expect(cV6("2001:db8::/32")).toBe(true);
    expect(cV6("::1/128")).toBe(true);
    expect(cV6("::/0")).toBe(true);
  });

  it("invalid — missing prefix length", () => {
    expect(cV6("2001:db8::")).toBe(false);
  });

  it("invalid — prefix out of range", () => {
    expect(cV6("::1/129")).toBe(false);
    expect(cV6("::1/-1")).toBe(false);
  });

  it("invalid — bad IPv6 address", () => {
    expect(cV6("notanaddr/32")).toBe(false);
  });

  it("invalid — non-numeric prefix", () => {
    expect(cV6("::1/abc")).toBe(false);
  });
});

describe("inline-func — FN_toBigInt (BigInt coercion)", () => {
  const bI = evalInline(FN_toBigInt.body);

  it("coerces valid number strings", () => {
    expect(bI("42")).toBe(42n);
    expect(bI("0")).toBe(0n);
    expect(bI("-7")).toBe(-7n);
  });

  it("coerces valid numbers", () => {
    expect(bI(42)).toBe(42n);
    expect(bI(0)).toBe(0n);
  });

  it("returns null for invalid input", () => {
    expect(bI("abc")).toBeNull();
    expect(bI("3.14")).toBeNull();
    expect(bI(null)).toBeNull();
    expect(bI(undefined)).toBeNull();
  });
});

describe("inline-func — FN_toDate (Date coercion)", () => {
  const dC = evalInline(FN_toDate.body);

  it("coerces valid date strings", () => {
    const result = dC("2026-01-01T00:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(Date.parse("2026-01-01T00:00:00Z"));
  });

  it("coerces valid timestamps", () => {
    const result = dC(0);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(0);
  });

  it("returns Invalid Date for garbage input", () => {
    const result = dC("notadate");
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(true);
  });
});

describe("inline-func — FN_dMerge (deep merge)", () => {
  const dMrg = evalInline(FN_dMerge.body);

  it("merges flat objects", () => {
    expect(dMrg({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("source overwrites target on conflict", () => {
    expect(dMrg({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges nested objects recursively", () => {
    expect(dMrg({ a: { b: 1, c: 2 } }, { a: { c: 3, d: 4 } })).toEqual({ a: { b: 1, c: 3, d: 4 } });
  });

  it("replaces non-object target with source", () => {
    expect(dMrg(1, { a: 2 })).toEqual({ a: 2 });
  });

  it("replaces non-object source value into object target", () => {
    expect(dMrg({ a: { b: 1 } }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges multiple sources in order", () => {
    expect(dMrg({ a: 1 }, { b: 2 }, { c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("handles empty sources", () => {
    expect(dMrg({ a: 1 })).toEqual({ a: 1 });
  });

  it("does not merge arrays as objects", () => {
    const result = dMrg({ a: [1, 2] }, { a: [3, 4] });
    expect(result).toEqual({ a: [3, 4] });
  });
});

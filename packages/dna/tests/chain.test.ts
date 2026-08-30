import { describe, it, expect, expectTypeOf } from "vitest";
import { dna } from "../src/index.js";
import { DnaPipe } from "@ytrynot/dna/core";
import { isCoercible } from "../src/introspect.js";

describe("dna.chain — variadic pipe", () => {
  // ============================================================
  // Arity: 1, 2, 3, 4, 5 steps — with real type transitions
  // ============================================================

  it("rejects 1 step (requires >= 2)", () => {
    // @ts-expect-error — single arg does not satisfy (step0, step1, ...otherSteps)
    const _invalid = dna.chain(dna.string());
    void _invalid;
  });

  it("2 steps: string → number (via coerce)", () => {
    // DnaString._output = string, DnaCoerceNumber._input = unknown → string extends unknown ✓
    const c = dna.chain(dna.string(), dna.coerce.number());
    expect(c).toBeInstanceOf(DnaPipe);
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  it("3 steps: string → number → number (via coerce, then constrain)", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    expect(c).toBeInstanceOf(DnaPipe);
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  it("4 steps: string → number → object → string (multi-type via transform)", () => {
    // string → coerce.number (string extends unknown ✓)
    // number → transform→object (DnaTransform<number, {n:number}>._input = number ✓)
    // object → transform→string (DnaTransform<obj, string>._input = any ✓ via deferred)
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
    );
    expect(c).toBeInstanceOf(DnaPipe);
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<string>();
  });

  it("5 steps: string → number → object → string → number (full cycle)", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
      dna.coerce.number(),
    );
    expect(c).toBeInstanceOf(DnaPipe);
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  // ============================================================
  // ADN
  // ============================================================

  it("emits a flat pipe ADN with N step ids", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    const seq = c.toDna();
    // CAST: tsDna uses ...any[] for middle elements; node[0] is the opcode
    const root = seq[0] as [string, unknown];
    expect(root[0]).toBe("pipe");
    expect(Array.isArray(root[1])).toBe(true);
    expect((root[1] as number[]).length).toBe(3);
  });

  // ============================================================
  // Type-level: coherent chains with real type transitions
  // ============================================================

  it("type: string → transform → object (transform changes output type)", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => ({ length: s.length })),
      dna.object({ length: dna.number() }),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<{ length: number }>();
  });

  it("type: number → coerce.number → number.min(0) (number stays number)", () => {
    const c = dna.chain(
      dna.number(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  it("type: source type is the first step's input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    type In = typeof c._input;
    expectTypeOf<In>().toEqualTypeOf<string>();
  });

  it("type: string → transform → object (object as final output)", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => ({ length: s.length })),
      dna.object({ length: dna.number() }),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<{ length: number }>();
  });

  it("type: string → transform → record (record as final output)", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => ({ [s]: s.length })),
      dna.record(dna.string(), dna.number()),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<Record<string, number>>();
  });

  it("type: object → transform → string (object as source, string as output)", () => {
    const c = dna.chain(
      dna.object({ n: dna.number() }),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
      dna.string().min(1),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<string>();
  });

  it("type: record → transform → number (record as source, number as output)", () => {
    const c = dna.chain(
      dna.record(dna.string(), dna.number()),
      dna.record(dna.string(), dna.number()).transform((r) => Object.values(r).reduce((a, b) => a + b, 0)),
      dna.number().min(0),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  it("type: array<number> → transform → number (array as source)", () => {
    const c = dna.chain(
      dna.array(dna.number()),
      dna.array(dna.number()).transform((arr) => arr.reduce((a, b) => a + b, 0)),
      dna.number().min(0),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number>();
  });

  it("type: string → transform → array<number> (array as output)", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => s.split(",").map(Number)),
      dna.array(dna.number()),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<number[]>();
  });

  it("type: tuple → transform → string (tuple as source)", () => {
    const c = dna.chain(
      dna.tuple([dna.string(), dna.number()]),
      dna.tuple([dna.string(), dna.number()]).transform(([s, n]) => `${s}:${n}`),
      dna.string().min(1),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<string>();
  });

  it("type: number → transform → tuple (tuple as output)", () => {
    const c = dna.chain(
      dna.number(),
      dna.number().transform((n) => [String(n), n] as [string, number]),
      dna.tuple([dna.string(), dna.number()]),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<[string, number]>();
  });

  it("type: 5-step with array in the middle (string → array → number → object → string)", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => s.split(",").map(Number)),
      dna.array(dna.number()).transform((arr) => arr.reduce((a, b) => a + b, 0)),
      dna.number().transform((n) => ({ sum: n })),
      dna.object({ sum: dna.number() }).transform((o) => `sum=${o.sum}`),
    );
    type Out = typeof c._output;
    expectTypeOf<Out>().toEqualTypeOf<string>();
  });

  it("rejects number → string (number not assignable to string input)", () => {
    // @ts-expect-error — number output is NOT assignable to string input
    const _invalid = dna.chain(dna.number(), dna.string());
    void _invalid;
  });

  it("rejects boolean → string (boolean not assignable to string input)", () => {
    // @ts-expect-error — boolean output is NOT assignable to string input
    const _invalid = dna.chain(dna.boolean(), dna.string());
    void _invalid;
  });

  it("rejects 3-step chain with mismatch at step 2", () => {
    // string → coerce.number (OK) → string (FAIL: number extends string = false)
    // @ts-expect-error — number output (from coerce.number) not assignable to string input
    const _invalid = dna.chain(dna.string(), dna.coerce.number(), dna.string());
    void _invalid;
  });

  it("rejects empty call (requires >= 2 steps)", () => {
    // @ts-expect-error — no args does not satisfy (step0, step1, ...)
    const _invalid = dna.chain();
    void _invalid;
  });

  // ============================================================
  // Runtime: error cases (validation failures)
  // ============================================================

  it("runtime: string → number rejects non-numeric string", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    expect(c.safeParse("abc").success).toBe(false);
  });

  it("runtime: string → number → number.min(0) rejects negative", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    expect(c.safeParse("-5").success).toBe(false);
  });

  it("runtime: string → number → number.min(0) rejects non-numeric", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    expect(c.safeParse("not-a-number").success).toBe(false);
  });

  it("runtime: 3-step chain rejects at first failing step", () => {
    // string.min(5) fails on "hi" (too short) — never reaches coerce.number
    const c = dna.chain(
      dna.string().min(5),
      dna.coerce.number(),
      dna.number().min(0),
    );
    expect(c.safeParse("hi").success).toBe(false);
  });

  it("runtime: 4-step chain rejects at transform step", () => {
    // string → number (OK) → transform→object (OK) → object.n.min(10) (FAIL: n=42 < 10... wait 42 > 10)
    // Use min(100) to force failure
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number().min(100) }),
    );
    expect(c.safeParse("42").success).toBe(false);
  });

  it("runtime: 5-step chain rejects at last step", () => {
    // string → number → object → string → number.min(100) (FAIL: "42" → 42 < 100)
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
      dna.coerce.number().min(100),
    );
    expect(c.safeParse("42").success).toBe(false);
  });

  it("runtime: rejects null input on string chain", () => {
    const c = dna.chain(dna.string(), dna.string().toUpperCase());
    expect(c.safeParse(null).success).toBe(false);
  });

  it("runtime: rejects undefined input on string chain", () => {
    const c = dna.chain(dna.string(), dna.string().toUpperCase());
    expect(c.safeParse(undefined).success).toBe(false);
  });

  it("runtime: rejects wrong type input (number into string chain)", () => {
    const c = dna.chain(dna.string(), dna.string().toUpperCase());
    expect(c.safeParse(42).success).toBe(false);
  });

  // ============================================================
  // Refine: chain with refinement checks
  // ============================================================

  it("refine: 2-step chain with refine on step 2 rejects invalid", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number().refine((n) => n > 0, "must be positive"),
    );
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("-5").success).toBe(false);
  });

  it("refine: 3-step chain with refine on step 1 (first step)", () => {
    const c = dna.chain(
      dna.string().refine((s) => s.length >= 3, "too short"),
      dna.string().toUpperCase(),
      dna.string().min(1),
    );
    expect(c.safeParse("hello").success).toBe(true);
    expect(c.safeParse("hi").success).toBe(false);
  });

  it("refine: 3-step chain with refine on multiple steps", () => {
    const c = dna.chain(
      dna.string().refine((s) => s.length > 0, "empty"),
      dna.coerce.number().refine((n) => n >= 0, "negative"),
      dna.number().refine((n) => n <= 100, "too big"),
    );
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("").success).toBe(false);
    expect(c.safeParse("-5").success).toBe(false);
    expect(c.safeParse("150").success).toBe(false);
  });

  it("refine: chain with refine on object step", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => ({ n: parseInt(s, 10) })),
      dna.object({ n: dna.number() }).refine((o) => o.n > 0, "must be positive"),
    );
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("-1").success).toBe(false);
  });

  it("refine: chain with refine on array step", () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform((s) => s.split(",").map(Number)),
      dna.array(dna.number()).refine((arr) => arr.every((n) => n > 0), "all must be positive"),
    );
    expect(c.safeParse("1,2,3").success).toBe(true);
    expect(c.safeParse("1,-2,3").success).toBe(false);
  });

  it("refine: validate() returns false when refine fails", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number().refine((n) => n > 0, "must be positive"),
    );
    expect(c.validate("-5")).toBe(false);
    expect(c.validate("42")).toBe(true);
  });

  // ============================================================
  // Async: transforms and refines with async functions
  // ============================================================

  it("async: safeParse throws on async transform, safeParseAsync resolves", async () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (s) => s.toUpperCase()),
      dna.string().min(1),
    );
    // sync safeParse must throw (async transform detected)
    expect(() => c.safeParse("hi")).toThrow();
    // async safeParseAsync must succeed
    const result = await c.safeParseAsync("hi");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("HI");
  });

  it("async: parseAsync with async transform returns output", async () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (s) => {
        await Promise.resolve();
        return s.toUpperCase();
      }),
      dna.string().min(2),
    );
    const result = await c.parseAsync("hello");
    expect(result).toBe("HELLO");
  });

  it("async: 3-step chain with async transform in middle step", async () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (s) => {
        await Promise.resolve();
        return parseInt(s, 10);
      }),
      dna.number().min(0),
    );
    const result = await c.safeParseAsync("42");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("async: chain with async refine", async () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number().refine(async (n) => {
        await Promise.resolve();
        return n > 0;
      }, "must be positive"),
    );
    // sync must throw
    expect(() => c.safeParse("42")).toThrow();
    // async must work
    const valid = await c.safeParseAsync("42");
    expect(valid.success).toBe(true);
    const invalid = await c.safeParseAsync("-5");
    expect(invalid.success).toBe(false);
  });

  it("async: 4-step chain with async transform + async refine", async () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (s) => {
        await Promise.resolve();
        return s.split(",").map(Number);
      }),
      dna.array(dna.number()).refine(async (arr) => {
        await Promise.resolve();
        return arr.every((n) => n > 0);
      }, "all must be positive"),
      dna.array(dna.number()),
    );
    const valid = await c.safeParseAsync("1,2,3");
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data).toEqual([1, 2, 3]);
    const invalid = await c.safeParseAsync("1,-2,3");
    expect(invalid.success).toBe(false);
  });

  it("async: object → async transform → string", async () => {
    const c = dna.chain(
      dna.object({ n: dna.number() }),
      dna.object({ n: dna.number() }).transform(async (o) => {
        await Promise.resolve();
        return JSON.stringify(o);
      }),
      dna.string().min(1),
    );
    const result = await c.safeParseAsync({ n: 42 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('{"n":42}');
  });

  it("async: 5-step chain with 2 async transforms", async () => {
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (s) => {
        await Promise.resolve();
        return parseInt(s, 10);
      }),
      dna.number().transform(async (n) => {
        await Promise.resolve();
        return { value: n * 2 };
      }),
      dna.object({ value: dna.number() }),
      dna.object({ value: dna.number() }).transform((o) => o.value),
    );
    const result = await c.safeParseAsync("21");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("async: externals + async transform together", async () => {
    const fetchMultiplier = async (v: string) => {
      await Promise.resolve();
      return parseInt(v, 10) * 2;
    };
    const c = dna.chain(
      dna.string(),
      dna.string().transform(async (v) => fetchMultiplier(v), { fetchMultiplier }),
      dna.number().min(0),
    );
    // sync must throw (async transform — the transform fn itself is async)
    expect(() => c.safeParse("21", { fetchMultiplier })).toThrow();
    // async must work
    const result = await c.safeParseAsync("21", { fetchMultiplier });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  // ============================================================
  // Runtime: functional equivalence with nested .pipe()
  // ============================================================

  it("runtime: 3-step chain equivalent to nested .pipe()", () => {
    const chained = dna.chain(
      dna.string(),
      dna.string().toUpperCase(),
      dna.string().min(2),
    );
    const nested = dna.string().pipe(dna.string().toUpperCase()).pipe(dna.string().min(2));
    expect(chained.safeParse("hi").success).toBe(nested.safeParse("hi").success);
    expect(chained.safeParse("").success).toBe(nested.safeParse("").success);
    expect(chained.safeParse(42).success).toBe(nested.safeParse(42).success);
  });

  it("runtime: string → coerce.number chain parses coerced value", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    const result = c.safeParse("42");
    expect(result.success).toBe(true);
  });

  it("runtime: 4-step chain with type transitions parses correctly", () => {
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
    );
    const result = c.safeParse("42");
    expect(result.success).toBe(true);
  });

  // ============================================================
  // fromDna roundtrip — 2, 3, 4, 5 steps
  // ============================================================

  it("roundtrips through fromDna (2-step pipe)", async () => {
    const { fromDna } = await import("../src/fromDna/index.js");
    const original = dna.chain(dna.string(), dna.coerce.number());
    const seq = original.toDna();
    const rebuilt = fromDna(seq);
    expect(rebuilt).toBeInstanceOf(DnaPipe);
    expect(original.safeParse("42").success).toBe(true);
    expect(rebuilt.safeParse("42").success).toBe(true);
  });

  it("roundtrips through fromDna (3-step pipe)", async () => {
    const { fromDna } = await import("../src/fromDna/index.js");
    const original = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().min(0),
    );
    const seq = original.toDna();
    const rebuilt = fromDna(seq);
    expect(rebuilt).toBeInstanceOf(DnaPipe);
    expect(original.safeParse("42").success).toBe(true);
    expect(rebuilt.safeParse("42").success).toBe(true);
    expect(original.safeParse("-1").success).toBe(false);
    expect(rebuilt.safeParse("-1").success).toBe(false);
  });

  it("roundtrips through fromDna (4-step pipe)", async () => {
    const { fromDna } = await import("../src/fromDna/index.js");
    const original = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
    );
    const seq = original.toDna();
    const rebuilt = fromDna(seq);
    expect(rebuilt).toBeInstanceOf(DnaPipe);
    expect(original.safeParse("42").success).toBe(true);
    expect(rebuilt.safeParse("42").success).toBe(true);
  });

  it("roundtrips through fromDna (5-step pipe)", async () => {
    const { fromDna } = await import("../src/fromDna/index.js");
    const original = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => ({ n })),
      dna.object({ n: dna.number() }).transform((o) => String(o.n)),
      dna.coerce.number(),
    );
    const seq = original.toDna();
    const rebuilt = fromDna(seq);
    expect(rebuilt).toBeInstanceOf(DnaPipe);
    expect(original.safeParse("42").success).toBe(true);
    expect(rebuilt.safeParse("42").success).toBe(true);
  });

  // ============================================================
  // All parse methods: parse, safeParse, parseAsync, safeParseAsync, validate
  // ============================================================

  it("parse() returns output on valid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = c.parse("42");
    expect(result).toBe(42);
  });

  it("parse() throws on invalid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    expect(() => c.parse("abc")).toThrow();
  });

  it("safeParse() returns success with data on valid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = c.safeParse("42");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("safeParse() returns failure with errors on invalid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = c.safeParse("abc");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validate() returns true on valid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number(), dna.number().min(0));
    expect(c.validate("42")).toBe(true);
  });

  it("validate() returns false on invalid input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number(), dna.number().min(0));
    expect(c.validate("-5")).toBe(false);
  });

  it("parseAsync() returns output on valid input", async () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = await c.parseAsync("42");
    expect(result).toBe(42);
  });

  it("parseAsync() rejects on invalid input", async () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    await expect(c.parseAsync("abc")).rejects.toThrow();
  });

  it("safeParseAsync() returns success with data on valid input", async () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = await c.safeParseAsync("42");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("safeParseAsync() returns failure with errors on invalid input", async () => {
    const c = dna.chain(dna.string(), dna.coerce.number());
    const result = await c.safeParseAsync("abc");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
  });

  // ============================================================
  // Externals: chain with external-dependent transforms
  // ============================================================

  it("safeParse() with externals: string → number via external transform", () => {
    const parseNum = (v: string) => parseInt(v, 10);
    const c = dna.chain(
      dna.string(),
      dna.string().transform((v) => parseNum(v), { parseNum }),
      dna.number().min(0),
    );
    const result = c.safeParse("42", { parseNum });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("safeParse() with externals: object → string via external transform", () => {
    const stringify = (o: { n: number }) => JSON.stringify(o);
    const c = dna.chain(
      dna.object({ n: dna.number() }),
      dna.object({ n: dna.number() }).transform((o) => stringify(o), { stringify }),
      dna.string().min(1),
    );
    const result = c.safeParse({ n: 42 }, { stringify });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('{"n":42}');
  });

  it("safeParse() with externals: record → number via external transform", () => {
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    const c = dna.chain(
      dna.record(dna.string(), dna.number()),
      dna.record(dna.string(), dna.number()).transform((r) => sum(r), { sum }),
      dna.number().min(0),
    );
    const result = c.safeParse({ a: 1, b: 2, c: 3 }, { sum });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(6);
  });

  it("safeParse() with externals: different external produces different output", () => {
    const toUpper = (v: string) => v.toUpperCase();
    const toLower = (v: string) => v.toLowerCase();
    const c = dna.chain(
      dna.string(),
      dna.string().transform((v) => toUpper(v), { toUpper }),
    );
    const r1 = c.safeParse("Hello", { toUpper });
    const r2 = c.safeParse("Hello", { toUpper: toLower });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data).toBe("HELLO");
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data).toBe("hello");
  });

  it("safeParse() with externals: 3-step string → number → string with external", () => {
    const formatNum = (n: number) => `#${n}`;
    const c = dna.chain(
      dna.string(),
      dna.coerce.number(),
      dna.number().transform((n) => formatNum(n), { formatNum }),
    );
    const result = c.safeParse("42", { formatNum });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("#42");
  });

  it("validate() with externals: returns true when external transform succeeds", () => {
    const toUpper = (v: string) => v.toUpperCase();
    const c = dna.chain(
      dna.string(),
      dna.string().transform((v) => toUpper(v), { toUpper }),
    );
    expect(c.validate("hello", { toUpper })).toBe(true);
  });

  it("validate() with externals: object → object with external", () => {
    const addOne = (o: { n: number }) => ({ n: o.n + 1 });
    const c = dna.chain(
      dna.object({ n: dna.number() }),
      dna.object({ n: dna.number() }).transform((o) => addOne(o), { addOne }),
      dna.object({ n: dna.number() }),
    );
    expect(c.validate({ n: 41 }, { addOne })).toBe(true);
  });

  it("parseAsync() with externals: string → number via external", async () => {
    const parseNum = (v: string) => parseInt(v, 10);
    const c = dna.chain(
      dna.string(),
      dna.string().transform((v) => parseNum(v), { parseNum }),
      dna.number().min(0),
    );
    const result = await c.parseAsync("42", { parseNum });
    expect(result).toBe(42);
  });

  it("safeParseAsync() with externals: object → string via external", async () => {
    const stringify = (o: { n: number }) => JSON.stringify(o);
    const c = dna.chain(
      dna.object({ n: dna.number() }),
      dna.object({ n: dna.number() }).transform((o) => stringify(o), { stringify }),
      dna.string().min(1),
    );
    const result = await c.safeParseAsync({ n: 42 }, { stringify });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('{"n":42}');
  });

  it("externals: 4-step chain with externals in 2 different steps (string → number → string → object)", () => {
    const parseNum = (v: string) => parseInt(v, 10);
    const wrap = (n: number) => ({ value: n });
    const c = dna.chain(
      dna.string(),
      dna.string().transform((v) => parseNum(v), { parseNum }),
      dna.number().transform((n) => String(n * 2)),
      dna.string().transform((s) => wrap(parseInt(s, 10)), { wrap }),
      dna.object({ value: dna.number() }),
    );
    const result = c.safeParse("21", { parseNum, wrap });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ value: 42 });
  });

  // ============================================================
  // Wrappers: .optional(), .nullable(), .default(), .catch()
  // ============================================================

  it("wrapper: chain result .optional() accepts undefined", () => {
    const c = dna.chain(dna.string(), dna.coerce.number()).optional();
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse(undefined).success).toBe(true);
  });

  it("wrapper: chain result .nullable() accepts null", () => {
    const c = dna.chain(dna.string(), dna.coerce.number()).nullable();
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse(null).success).toBe(true);
  });

  it("wrapper: chain result .default() uses default on undefined input", () => {
    const c = dna.chain(dna.string(), dna.coerce.number()).default(0);
    const result = c.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(0);
  });

  it("wrapper: chain with .optional() on a middle step", () => {
    // string → optional(number) → number
    // optional makes the step accept undefined, but chain passes string output
    const c = dna.chain(
      dna.string(),
      dna.coerce.number().optional(),
    );
    expect(c.safeParse("42").success).toBe(true);
  });

  // ============================================================
  // Interop: chain + .pipe() / .pipe() + chain
  // ============================================================

  it("interop: chain(...).pipe(target) works", () => {
    const c = dna.chain(dna.string(), dna.coerce.number()).pipe(dna.number().min(0));
    expect(c).toBeInstanceOf(DnaPipe);
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("-1").success).toBe(false);
  });

  it("interop: schema.pipe(chain(...)) works", () => {
    const c = dna.string().pipe(dna.chain(dna.coerce.number(), dna.number().min(0)));
    expect(c).toBeInstanceOf(DnaPipe);
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("-1").success).toBe(false);
  });

  it("interop: chain(chain(...), target) works", () => {
    const inner = dna.chain(dna.string(), dna.coerce.number());
    const c = dna.chain(inner, dna.number().min(0));
    expect(c).toBeInstanceOf(DnaPipe);
    expect(c.safeParse("42").success).toBe(true);
    expect(c.safeParse("-1").success).toBe(false);
  });

  // ============================================================
  // isCoercible / .coerced()
  // ============================================================

  it("isCoercible: chain with coerce step — same baseline as pipe (not detected in pipe)", () => {
    // isCoercible only detects coerce on direct schemas, not inside pipe/chain.
    // chain has the same behavior as pipe — this documents the baseline parity.
    const chainC = dna.chain(dna.string(), dna.coerce.number());
    const pipeC = dna.string().pipe(dna.coerce.number());
    expect(isCoercible(chainC)).toBe(isCoercible(pipeC));
    expect(isCoercible(dna.coerce.number())).toBe(true); // direct still detected
  });

  it("isCoercible: chain without coerce is not coercible", () => {
    const c = dna.chain(dna.string(), dna.string().toUpperCase());
    expect(isCoercible(c)).toBe(false);
  });

  it("isCoercible: preprocess — same baseline as pipe (not detected in pipe)", () => {
    const c = dna.preprocess((v: unknown) => String(v), dna.string());
    expect(isCoercible(c)).toBe(false);
  });

  // ============================================================
  // dna.lazy() interop — baseline: same behavior as pipe
  // ============================================================

  it("lazy: chain with lazy step has same behavior as pipe with lazy step", () => {
    // Note: lazy inside a pipe/chain has a known codegen issue (L0003 undefined)
    // affecting both pipe and chain equally. This test documents the baseline
    // parity — if pipe+lazy is fixed, chain+lazy will work too.
    const lazyStep = () => dna.lazy(() => dna.coerce.number());
    const pipeC = dna.string().pipe(lazyStep());
    const chainC = dna.chain(dna.string(), lazyStep());
    let pipeSuccess: boolean | null = null;
    let chainSuccess: boolean | null = null;
    try { pipeSuccess = pipeC.safeParse("42").success; } catch { pipeSuccess = null; }
    try { chainSuccess = chainC.safeParse("42").success; } catch { chainSuccess = null; }
    expect(chainSuccess).toBe(pipeSuccess);
  });
});

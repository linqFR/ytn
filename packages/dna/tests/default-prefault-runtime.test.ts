import { describe, expect, test } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";
import { defaultValue, prefaultValue } from "../src/introspect.js";

// =============================================================================
// Runtime regression: DnaDefault.defaultValue and DnaPrefault.prefaultValue
// getters resolve getter functions (calling them) instead of returning the
// raw function. Aligns with Zod v4's def.defaultValue getter behavior.
// =============================================================================

describe("DnaDefault.defaultValue getter — resolves getter functions", () => {
  test("static default: returned as-is", () => {
    const schema = dna.string().default("hello");
    const dv = defaultValue(schema);
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
  });

  test("function default: resolved to value (not function)", () => {
    const schema = dna.string().default(() => "hello");
    const dv = defaultValue(schema);
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
    expect(typeof dv).not.toBe("function");
  });

  test("function default returning Date: resolved to Date object", () => {
    const schema = dna.date().default(() => new Date("2024-01-01"));
    const dv = defaultValue(schema);
    expect(dv).toBeInstanceOf(Date);
    expect((dv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(typeof dv).not.toBe("function");
  });

  test("function default returning object: resolved to object", () => {
    const schema = dna.object({ x: dna.number() }).default(() => ({ x: 42 }));
    const dv = defaultValue(schema);
    expect(dv).toEqual({ x: 42 });
    expect(typeof dv).toBe("object");
    expect(typeof dv).not.toBe("function");
  });

  test("function default is called on each access (not memoized)", () => {
    let callCount = 0;
    const schema = dna.number().default(() => ++callCount);
    const v1 = defaultValue(schema);
    const v2 = defaultValue(schema);
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(callCount).toBe(2);
  });

  test("Zod v4 parity: function default resolved to value", () => {
    const zodSchema = z.string().default(() => "hello");
    // CAST: Zod v4 stores the default in _zod.def.defaultValue; the public type
    // does not expose it, so a precise cast is needed for the parity test.
    const dv = (zodSchema as unknown as { _zod: { def: { defaultValue: unknown } } })._zod.def.defaultValue;
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
  });

  test("Zod v4 parity: function default returning Date resolved", () => {
    const zodSchema = z.date().default(() => new Date("2024-01-01"));
    // CAST: same as above — Zod v4 _zod.def.defaultValue access.
    const dv = (zodSchema as unknown as { _zod: { def: { defaultValue: unknown } } })._zod.def.defaultValue;
    expect(dv).toBeInstanceOf(Date);
    expect((dv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("DnaPrefault.prefaultValue getter — resolves getter functions", () => {
  test("static prefault: returned as-is", () => {
    const schema = dna.string().prefault("hello");
    const pv = prefaultValue(schema);
    expect(pv).toBe("hello");
    expect(typeof pv).toBe("string");
  });

  test("function prefault: resolved to value (not function)", () => {
    const schema = dna.string().prefault(() => "hello");
    const pv = prefaultValue(schema);
    expect(pv).toBe("hello");
    expect(typeof pv).toBe("string");
    expect(typeof pv).not.toBe("function");
  });

  test("function prefault returning Date: resolved to Date object", () => {
    const schema = dna.date().prefault(() => new Date("2024-01-01"));
    const pv = prefaultValue(schema);
    expect(pv).toBeInstanceOf(Date);
    expect((pv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  test("function prefault is called on each access (not memoized)", () => {
    let callCount = 0;
    const schema = dna.number().prefault(() => ++callCount);
    const v1 = prefaultValue(schema);
    const v2 = prefaultValue(schema);
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(callCount).toBe(2);
  });
});

describe("introspect.defaultValue — delegates to schema getter", () => {
  test("returns undefined for non-default schema", () => {
    const schema = dna.string();
    expect(defaultValue(schema)).toBeUndefined();
  });

  test("returns static default value", () => {
    const schema = dna.string().default("hello");
    expect(defaultValue(schema)).toBe("hello");
  });

  test("resolves function default value", () => {
    const schema = dna.string().default(() => "hello");
    const dv = defaultValue(schema);
    expect(dv).toBe("hello");
    expect(typeof dv).not.toBe("function");
  });

  test("resolves function default returning Date", () => {
    const schema = dna.date().default(() => new Date("2024-01-01"));
    const dv = defaultValue(schema);
    expect(dv).toBeInstanceOf(Date);
    expect((dv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  test("returns undefined for prefault schema (not a default)", () => {
    const schema = dna.string().prefault("hello");
    expect(defaultValue(schema)).toBeUndefined();
  });
});

describe("Runtime parse — getter default applied correctly", () => {
  test("parse with undefined input uses resolved getter default", () => {
    const schema = dna.string().default(() => "resolved");
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("resolved");
    }
  });

  test("parse with defined input ignores getter default", () => {
    const schema = dna.string().default(() => "resolved");
    const result = schema.safeParse("custom");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("custom");
    }
  });

  test("prefault with undefined input uses resolved getter prefault", () => {
    const schema = dna.string().prefault(() => "resolved");
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("resolved");
    }
  });

  test("Zod v4 parity: parse with undefined uses resolved getter default", () => {
    const schema = z.string().default(() => "resolved");
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("resolved");
    }
  });
});

describe("Codegen integrity — raw function preserved for serialization", () => {
  test("seed.value retains the raw function (not resolved)", () => {
    const fn = () => "hello";
    const schema = dna.string().default(fn);
    // The seed stores the raw function — codegen needs it to emit ["fn", ...]
    // CAST: _core.seed.value is the raw wrapper value (function or direct).
    // The static BaseCore type uses `any` for seed, so we cast to a precise shape.
    const seed = (schema._core as unknown as { seed: { value: unknown } }).seed;
    expect(seed.value).toBe(fn);
    expect(typeof seed.value).toBe("function");
  });

  test("prefault seed.value retains the raw function", () => {
    const fn = () => "hello";
    const schema = dna.string().prefault(fn);
    // CAST: same as above — _core.seed.value is the raw wrapper value.
    const seed = (schema._core as unknown as { seed: { value: unknown } }).seed;
    expect(seed.value).toBe(fn);
    expect(typeof seed.value).toBe("function");
  });
});

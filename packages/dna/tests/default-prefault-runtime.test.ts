import { describe, expect, test } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";
import { defaultValue } from "../src/introspect.js";

// =============================================================================
// Runtime regression: DnaDefault.defaultValue and DnaPrefault.prefaultValue
// getters resolve getter functions (calling them) instead of returning the
// raw function. Aligns with Zod v4's def.defaultValue getter behavior.
// =============================================================================

describe("DnaDefault.defaultValue getter — resolves getter functions", () => {
  test("static default: returned as-is", () => {
    const schema = dna.string().default("hello");
    const dv = (schema as any)._core.defaultValue;
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
  });

  test("function default: resolved to value (not function)", () => {
    const schema = dna.string().default(() => "hello");
    const dv = (schema as any)._core.defaultValue;
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
    expect(typeof dv).not.toBe("function");
  });

  test("function default returning Date: resolved to Date object", () => {
    const schema = dna.date().default(() => new Date("2024-01-01"));
    const dv = (schema as any)._core.defaultValue;
    expect(dv).toBeInstanceOf(Date);
    expect((dv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(typeof dv).not.toBe("function");
  });

  test("function default returning object: resolved to object", () => {
    const schema = dna.object({ x: dna.number() }).default(() => ({ x: 42 }));
    const dv = (schema as any)._core.defaultValue;
    expect(dv).toEqual({ x: 42 });
    expect(typeof dv).toBe("object");
    expect(typeof dv).not.toBe("function");
  });

  test("function default is called on each access (not memoized)", () => {
    let callCount = 0;
    const schema = dna.number().default(() => ++callCount);
    const core = (schema as any)._core;
    const v1 = core.defaultValue;
    const v2 = core.defaultValue;
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(callCount).toBe(2);
  });

  test("Zod v4 parity: function default resolved to value", () => {
    const zodSchema = z.string().default(() => "hello");
    const dv = (zodSchema as any)._zod.def.defaultValue;
    expect(dv).toBe("hello");
    expect(typeof dv).toBe("string");
  });

  test("Zod v4 parity: function default returning Date resolved", () => {
    const zodSchema = z.date().default(() => new Date("2024-01-01"));
    const dv = (zodSchema as any)._zod.def.defaultValue;
    expect(dv).toBeInstanceOf(Date);
    expect((dv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("DnaPrefault.prefaultValue getter — resolves getter functions", () => {
  test("static prefault: returned as-is", () => {
    const schema = dna.string().prefault("hello");
    const pv = (schema as any)._core.prefaultValue;
    expect(pv).toBe("hello");
    expect(typeof pv).toBe("string");
  });

  test("function prefault: resolved to value (not function)", () => {
    const schema = dna.string().prefault(() => "hello");
    const pv = (schema as any)._core.prefaultValue;
    expect(pv).toBe("hello");
    expect(typeof pv).toBe("string");
    expect(typeof pv).not.toBe("function");
  });

  test("function prefault returning Date: resolved to Date object", () => {
    const schema = dna.date().prefault(() => new Date("2024-01-01"));
    const pv = (schema as any)._core.prefaultValue;
    expect(pv).toBeInstanceOf(Date);
    expect((pv as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  test("function prefault is called on each access (not memoized)", () => {
    let callCount = 0;
    const schema = dna.number().prefault(() => ++callCount);
    const core = (schema as any)._core;
    const v1 = core.prefaultValue;
    const v2 = core.prefaultValue;
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
    expect((schema as any)._core.seed.value).toBe(fn);
    expect(typeof (schema as any)._core.seed.value).toBe("function");
  });

  test("prefault seed.value retains the raw function", () => {
    const fn = () => "hello";
    const schema = dna.string().prefault(fn);
    expect((schema as any)._core.seed.value).toBe(fn);
    expect(typeof (schema as any)._core.seed.value).toBe("function");
  });
});

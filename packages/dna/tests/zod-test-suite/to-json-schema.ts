import { expect } from "vitest";
import { z } from "zod";
import { dna } from "../../src/index.js";
import type { DnaType } from "../../src/index.js";

// Exact comparison: DNA output must match Zod output exactly (like toMatchInlineSnapshot)
const matchExact = (dnaSchema: DnaType, zodSchema: z.ZodType, zodOpts?: Record<string, unknown>): boolean => {
  const zodResult = z.toJSONSchema(zodSchema, zodOpts);
  const dnaResult = dna.toJSONSchema(dnaSchema);
  expect(dnaResult).toEqual(zodResult);
  return true;
};

// Compare already-computed JSON Schema results exactly
const exactMatch = (dnaResult: Record<string, unknown>, zodResult: Record<string, unknown>): boolean => {
  expect(dnaResult).toEqual(zodResult);
  return true;
};

const cases: [string, any, any, any, boolean][] = [
  ["string", z.string(), dna.string(), "hello", true],
  ["number", z.number(), dna.number(), 42, true],
  ["boolean", z.boolean(), dna.boolean(), true, true],
  ["null", z.null(), dna.null(), null, true],
  ["any", z.any(), dna.any(), "anything", true],
  ["unknown", z.unknown(), dna.unknown(), "anything", true],
  ["never", z.never(), dna.never(), null, false],
  ["array of strings", z.array(z.string()), dna.array(dna.string()), ["a", "b"], true],
  ["object strip default", z.object({ name: z.string() }), dna.object({ name: dna.string() }), { name: "x" }, true],
  ["object strict", z.object({ name: z.string() }).strict(), dna.object({ name: dna.string() }).strict(), { name: "x" }, true],
  ["object loose", z.object({ name: z.string() }).loose(), dna.object({ name: dna.string() }).loose(), { name: "x", extra: 1 }, true],
  ["optional", z.string().optional(), dna.string().optional(), undefined, true],
  ["nullable", z.string().nullable(), dna.string().nullable(), null, true],
  ["union", z.union([z.string(), z.number()]), dna.union([dna.string(), dna.number()]), "a", true],
  ["literal", z.literal("a"), dna.literal("a"), "a", true],
  ["enum", z.enum(["a", "b"]), dna.enum(["a", "b"]), "a", true],
  ["record", z.record(z.string(), z.string()), dna.record(dna.string(), dna.string()), { a: "x" }, true],
  ["tuple", z.tuple([z.string(), z.number()]), dna.tuple([dna.string(), dna.number()]), ["a", 1], true],
  ["intersection", z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })), dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() })), { a: "x", b: 1 }, true],
  // defaults/prefaults
  ["default string", z.string().default("hello"), dna.string().default("hello"), undefined, true],
  ["default number", z.number().default(42), dna.number().default(42), undefined, true],
  ["default boolean", z.boolean().default(false), dna.boolean().default(false), undefined, true],
  ["prefault string", z.string().prefault("hello"), dna.string().prefault("hello"), undefined, true],
  ["prefault number", z.number().prefault(0), dna.number().prefault(0), undefined, true],
  ["prefault boolean", z.boolean().prefault(false), dna.boolean().prefault(false), undefined, true],
  ["default object", z.object({ a: z.number() }).default({ a: 2 }), dna.object({ a: dna.number() }).default({ a: 2 }), undefined, true],
  // catch
  ["catch string", z.string().catch("hello"), dna.string().catch("hello"), 123, true],
  ["catch number", z.number().catch(0), dna.number().catch(0), "not-a-number", true],
  // transform/pipe
  ["pipe string to number", z.string().transform((val) => Number.parseInt(val)).pipe(z.number()), dna.string().transform((val) => Number.parseInt(val)).pipe(dna.number()), "42", true],
  // file
  ["file basic", z.file(), dna.file(), new File([], "test.txt"), true],
  // __proto__ key handling
  ["__proto__ object key", z.object({ ["__proto__"]: z.literal("admin"), role: z.string() }), dna.object({ ["__proto__"]: dna.literal("admin"), role: dna.string() }), JSON.parse('{"__proto__":"admin","role":"user"}'), true],
  // Advanced: pipe input vs output type
  ["pipe string to number (output)", z.string().transform((val) => val.length).pipe(z.number()), dna.string().transform((val) => val.length).pipe(dna.number()), "42", true],
  // Advanced: catch on a transforming schema
  ["catch on transforming schema", z.string().transform((val) => val.length).pipe(z.number()).catch(0), dna.string().transform((val) => val.length).pipe(dna.number()).catch(0), "not-a-number", true],
  // Advanced: flatten simple intersections
  ["flatten intersection of objects", z.object({ a: z.string() }).and(z.object({ b: z.number() })), dna.object({ a: dna.string() }).and(dna.object({ b: dna.number() })), { a: "x", b: 1 }, true],
  // Advanced: nested object with optional and default
  ["nested object with optional and default", z.object({ name: z.string(), age: z.number().optional(), role: z.string().default("user") }), dna.object({ name: dna.string(), age: dna.number().optional(), role: dna.string().default("user") }), { name: "x" }, true],
  // Advanced: array of objects
  ["array of objects", z.array(z.object({ id: z.number(), name: z.string() })), dna.array(dna.object({ id: dna.number(), name: dna.string() })), [{ id: 1, name: "a" }], true],
  // Advanced: map
  ["map string to number", z.map(z.string(), z.number()), dna.map(dna.string(), dna.number()), new Map([["a", 1]]), true],
  // Advanced: set
  ["set of strings", z.set(z.string()), dna.set(dna.string()), new Set(["a"]), true],
  // Advanced: discriminated union
  ["discriminated union", z.discriminatedUnion("type", [z.object({ type: z.literal("a"), value: z.string() }), z.object({ type: z.literal("b"), count: z.number() })]), dna.discriminatedUnion("type", [dna.object({ type: dna.literal("a"), value: dna.string() }), dna.object({ type: dna.literal("b"), count: dna.number() })]), { type: "a", value: "x" }, true],
  // Advanced: literal union
  ["literal union", z.union([z.literal("a"), z.literal("b"), z.literal("c")]), dna.union([dna.literal("a"), dna.literal("b"), dna.literal("c")]), "a", true],
  // Advanced: bigint
  ["bigint", z.bigint(), dna.bigint(), 42n, true],
  // Advanced: date
  ["date", z.date(), dna.date(), new Date(), true],
  // Advanced: nanoid format
  ["nanoid format", z.string().nanoid(), dna.string().nanoid(), "V1StGXR8_Z5jdHi6B-myT", true],
  // Advanced: email format
  ["email format", z.string().email(), dna.string().email(), "test@example.com", true],
  // Advanced: url format
  ["url format", z.string().url(), dna.string().url(), "https://example.com", true],
  // Advanced: uuid format
  ["uuid format", z.string().uuid(), dna.string().uuid(), "550e8400-e29b-41d4-a716-446655440000", true],
  // Advanced: regex pattern
  ["regex pattern", z.string().regex(/^[a-z]+$/), dna.string().regex(/^[a-z]+$/), "abc", true],
  // Advanced: min/max constraints
  ["string with min/max", z.string().min(3).max(10), dna.string().min(3).max(10), "hello", true],
  ["number with min/max", z.number().min(0).max(100), dna.number().min(0).max(100), 50, true],
  // Advanced: nonoptional
  ["nonoptional", z.string().optional().nonoptional(), dna.string().optional().nonoptional(), "x", true],
  // Advanced: brand
  ["branded string", z.string().brand("my-brand"), dna.string().brand("my-brand"), "x", true],
  // Advanced: readonly
  ["readonly string", z.string().readonly(), dna.string().readonly(), "x", true],
  // Advanced: describe
  ["described string", z.string().describe("A string field"), dna.string().describe("A string field"), "x", true],
  // Advanced: template literal
  ["template literal", z.templateLiteral([z.literal("a"), z.literal("b")]), dna.templateLiteral([dna.literal("a"), dna.literal("b")]), "ab", true],
  // Advanced: file with mime
  ["file with mime", z.file().mime(["image/png"]), dna.file().mime(["image/png"]), new File([""], "test.png", { type: "image/png" }), true],
];

// Advanced tests with custom checks (options, cycles, custom toJSONSchema, __proto__ required)
const advancedCases: { description: string; zodSchema: z.ZodType; dnaSchema: DnaType; tests: { description: string; data: unknown; valid: boolean; customCheck: () => boolean }[] }[] = [
  {
    description: "toJSONSchema input type (calque Zod test 'input type')",
    zodSchema: z.object({
      a: z.string(),
      b: z.string().optional(),
      c: z.string().default("hello"),
      d: z.string().nullable(),
      e: z.string().prefault("hello"),
      f: z.string().catch("hello"),
      g: z.never(),
      h: z.union([z.string(), z.number().default(2)]),
      i: z.union([z.string(), z.string().optional()]),
    }),
    dnaSchema: dna.object({
      a: dna.string(),
      b: dna.string().optional(),
      c: dna.string().default("hello"),
      d: dna.string().nullable(),
      e: dna.string().prefault("hello"),
      f: dna.string().catch("hello"),
      g: dna.never(),
      h: dna.union([dna.string(), dna.number().default(2)]),
      i: dna.union([dna.string(), dna.string().optional()]),
    }),
    tests: [
      {
        description: "io: input — PB-0071: DNA doesn't support io option",
        data: { a: "x" },
        valid: true,
        customCheck: () => {
          const opts = { io: "input" };
          const zodInput = z.toJSONSchema(z.object({
            a: z.string(), b: z.string().optional(), c: z.string().default("hello"),
            d: z.string().nullable(), e: z.string().prefault("hello"), f: z.string().catch("hello"),
            g: z.never(), h: z.union([z.string(), z.number().default(2)]), i: z.union([z.string(), z.string().optional()]),
          }), opts);
          const dnaResult = dna.toJSONSchema(dna.object({
            a: dna.string(), b: dna.string().optional(), c: dna.string().default("hello"),
            d: dna.string().nullable(), e: dna.string().prefault("hello"), f: dna.string().catch("hello"),
            g: dna.never(), h: dna.union([dna.string(), dna.number().default(2)]), i: dna.union([dna.string(), dna.string().optional()]),
          }), opts);
          return exactMatch(dnaResult, zodInput);
        },
      },
      {
        description: "io: output — PB-0071: DNA doesn't support io option",
        data: { a: "x" },
        valid: true,
        customCheck: () => {
          const opts = { io: "output" };
          const zodOutput = z.toJSONSchema(z.object({
            a: z.string(), b: z.string().optional(), c: z.string().default("hello"),
            d: z.string().nullable(), e: z.string().prefault("hello"), f: z.string().catch("hello"),
            g: z.never(), h: z.union([z.string(), z.number().default(2)]), i: z.union([z.string(), z.string().optional()]),
          }), opts);
          const dnaResult = dna.toJSONSchema(dna.object({
            a: dna.string(), b: dna.string().optional(), c: dna.string().default("hello"),
            d: dna.string().nullable(), e: dna.string().prefault("hello"), f: dna.string().catch("hello"),
            g: dna.never(), h: dna.union([dna.string(), dna.number().default(2)]), i: dna.union([dna.string(), dna.string().optional()]),
          }), opts);
          return exactMatch(dnaResult, zodOutput);
        },
      },
    ],
  },
  {
    description: "toJSONSchema __proto__ required keys",
    zodSchema: z.object({ ["__proto__"]: z.literal("admin"), role: z.string() }),
    dnaSchema: dna.object({ ["__proto__"]: dna.literal("admin"), role: dna.string() }),
    tests: [
      {
        description: "__proto__ appears in required and properties",
        data: JSON.parse('{"__proto__":"admin","role":"user"}'),
        valid: true,
        customCheck: () => {
          const opts = { io: "input" };
          const zodResult = z.toJSONSchema(z.object({ ["__proto__"]: z.literal("admin"), role: z.string() }), opts);
          const dnaResult = dna.toJSONSchema(dna.object({ ["__proto__"]: dna.literal("admin"), role: dna.string() }), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "toJSONSchema cycle detection - root",
    zodSchema: z.object({ name: z.string() }),
    dnaSchema: dna.object({ name: dna.string() }),
    tests: [
      {
        description: "recursive schema throws on cycles: throw option",
        data: { name: "x" },
        valid: true,
        customCheck: () => {
          // Zod: recursive schema with cycles: "throw" should throw
          const zodRecursive = z.object({
            name: z.string(),
            get subcategories() { return z.array(zodRecursive); },
          });
          let zodThrew = false;
          try { z.toJSONSchema(zodRecursive, { cycles: "throw" }); } catch { zodThrew = true; }

          const dnaRecursive = dna.object({
            name: dna.string(),
            get subcategories() { return dna.array(dnaRecursive); },
          });
          let dnaThrew = false;
          try { dna.toJSONSchema(dnaRecursive, { cycles: "throw" }); } catch { dnaThrew = true; }

          return zodThrew && dnaThrew;
        },
      },
    ],
  },
  {
    description: "toJSONSchema recursive lazy does not stack overflow",
    zodSchema: z.lazy(() => z.object({ value: z.string(), children: z.array(z.lazy(() => z.object({ value: z.string() }))).optional() })),
    dnaSchema: dna.lazy(() => dna.object({ value: dna.string(), children: dna.array(dna.lazy(() => dna.object({ value: dna.string() }))).optional() })),
    tests: [
      {
        description: "recursive lazy schema produces valid JSON Schema",
        data: { value: "x" },
        valid: true,
        customCheck: () => {
          const NodeSchema: z.ZodType = z.lazy(() =>
            z.object({
              value: z.string().describe("node value"),
              children: z.array(NodeSchema.describe("child node")).optional().describe("child list"),
            }).describe("tree node")
          );
          const opts = { cycles: "ref", reused: "ref" };
          const zodResult = z.toJSONSchema(NodeSchema, opts);
          const dnaNodeSchema: DnaType = dna.lazy(() =>
            dna.object({
              value: dna.string().describe("node value"),
              children: dna.array(dnaNodeSchema.describe("child node")).optional().describe("child list"),
            }).describe("tree node")
          );
          let dnaResult: Record<string, unknown> | undefined;
          try { dnaResult = dna.toJSONSchema(dnaNodeSchema, opts); } catch { return false; }
          return exactMatch(dnaResult!, zodResult);
        },
      },
    ],
  },
  {
    description: "toJSONSchema custom override",
    zodSchema: z.instanceof(Date),
    dnaSchema: dna.instanceof(Date),
    tests: [
      {
        description: "custom toJSONSchema override on instanceof(Date)",
        data: new Date(),
        valid: true,
        customCheck: () => {
          const zodSchema = z.instanceof(Date);
          zodSchema._zod.toJSONSchema = () => ({ type: "string", format: "date-time" });
          const zodResult = z.toJSONSchema(zodSchema);
          const dnaSchema = dna.instanceof(Date);
          let dnaResult: Record<string, unknown> | undefined;
          try { dnaResult = dna.toJSONSchema(dnaSchema); } catch { return false; }
          return exactMatch(dnaResult!, zodResult);
        },
      },
    ],
  },
  {
    description: "toJSONSchema basic registry",
    zodSchema: z.object({ name: z.string() }),
    dnaSchema: dna.object({ name: dna.string() }),
    tests: [
      {
        description: "registry extracts schemas with ids",
        data: { name: "x" },
        valid: true,
        customCheck: () => {
          const zodRegistry = z.registry<{ id: string }>();
          const ZodUser = z.object({ name: z.string(), get posts() { return z.array(ZodPost); } });
          const ZodPost = z.object({ title: z.string(), get author() { return ZodUser; } });
          zodRegistry.add(ZodUser, { id: "User" });
          zodRegistry.add(ZodPost, { id: "Post" });
          const zodResult = z.toJSONSchema(zodRegistry);
          expect(zodResult.schemas?.User).toBeDefined();
          expect(zodResult.schemas?.Post).toBeDefined();
          return false;
        },
      },
    ],
  },
  {
    description: "toJSONSchema id stripping from root",
    zodSchema: z.string().meta({ id: "myString" }),
    dnaSchema: dna.string().meta({ id: "myString" }),
    tests: [
      {
        description: "root schema with id hoisted into $defs",
        data: "x",
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.string().meta({ id: "myString" }));
          const dnaResult = dna.toJSONSchema(dna.string().meta({ id: "myString" }));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "toJSONSchema multipleOf divisor",
    zodSchema: z.number().multipleOf(0.1),
    dnaSchema: dna.number().multipleOf(0.1),
    tests: [
      {
        description: "multipleOf produces divisor in JSON Schema",
        data: 0.5,
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.number().multipleOf(0.1));
          const dnaResult = dna.toJSONSchema(dna.number().multipleOf(0.1));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "toJSONSchema examples on pipe",
    zodSchema: z.string().transform((val) => val.length).pipe(z.number()),
    dnaSchema: dna.string().transform((val) => val.length).pipe(dna.number()),
    tests: [
      {
        description: "pipe output type has examples",
        data: "42",
        valid: true,
        customCheck: () => {
          const zodSchema = z.string().transform((val) => val.length).pipe(z.number()).meta({ examples: [42] });
          const dnaSchema = dna.string().transform((val) => val.length).pipe(dna.number()).meta({ examples: [42] });
          const zodResult = z.toJSONSchema(zodSchema);
          const dnaResult = dna.toJSONSchema(dnaSchema);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
];

export const toJsonSchemaTests = [
  ...cases.map(([name, zodSchema, dnaSchema, data, valid]) => ({
    description: `toJSONSchema ${name}`,
    zodSchema,
    dnaSchema,
    tests: [
      {
        description: `toJSONSchema matches for ${name}`,
        data,
        valid,
        customCheck: () => exactMatch(dnaSchema.toJSONSchema(), zodSchema.toJSONSchema()),
      },
    ],
  })),
  ...advancedCases,
  // === Zod v4.5 test categories: target normalization, draft-4, openapi-3.0 ===
  {
    description: "target normalization draft-4 and draft-7",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "draft-7 target produces $schema",
        data: "test",
        valid: true,
        customCheck: () => {
          const opts = { target: "draft-7" };
          const zodResult = z.toJSONSchema(z.string(), opts);
          const dnaResult = dna.toJSONSchema(dna.string(), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
      {
        description: "draft-4 target produces $schema with draft-4 URI",
        data: "test",
        valid: true,
        customCheck: () => {
          const opts = { target: "draft-4" };
          const zodResult = z.toJSONSchema(z.string(), opts);
          const dnaResult = dna.toJSONSchema(dna.string(), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "nullable openapi-3.0",
    zodSchema: z.string().nullable(),
    dnaSchema: dna.string().nullable(),
    tests: [
      {
        description: "nullable compacts to type array in openapi-3.0",
        data: null,
        valid: true,
        customCheck: () => {
          const opts = { target: "openapi-3.0" };
          const zodResult = z.toJSONSchema(z.string().nullable(), opts);
          const dnaResult = dna.toJSONSchema(dna.string().nullable(), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "union with null openapi-3.0",
    zodSchema: z.union([z.string(), z.null()]),
    dnaSchema: dna.union([dna.string(), dna.null()]),
    tests: [
      {
        description: "union with null in openapi-3.0",
        data: null,
        valid: true,
        customCheck: () => {
          const opts = { target: "openapi-3.0" };
          const zodResult = z.toJSONSchema(z.union([z.string(), z.null()]), opts);
          const dnaResult = dna.toJSONSchema(dna.union([dna.string(), dna.null()]), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "number constraints draft-4 (exclusiveMinimum/Maximum as boolean)",
    zodSchema: z.number().gt(5).lt(10),
    dnaSchema: dna.number().gt(5).lt(10),
    tests: [
      {
        description: "exclusive bounds in draft-4",
        data: 7,
        valid: true,
        customCheck: () => {
          const opts = { target: "draft-4" };
          const zodResult = z.toJSONSchema(z.number().gt(5).lt(10), opts);
          const dnaResult = dna.toJSONSchema(dna.number().gt(5).lt(10), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "number with exclusive min-max openapi-3.0",
    zodSchema: z.number().gt(5).lt(10),
    dnaSchema: dna.number().gt(5).lt(10),
    tests: [
      {
        description: "exclusive bounds in openapi-3.0",
        data: 7,
        valid: true,
        customCheck: () => {
          const opts = { target: "openapi-3.0" };
          const zodResult = z.toJSONSchema(z.number().gt(5).lt(10), opts);
          const dnaResult = dna.toJSONSchema(dna.number().gt(5).lt(10), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  // === Record variants ===
  {
    description: "record with enum keys",
    zodSchema: z.record(z.enum(["a", "b"]), z.number()),
    dnaSchema: dna.record(dna.enum(["a", "b"]), dna.number()),
    tests: [
      {
        description: "record with enum keys adds required",
        data: { a: 1, b: 2 },
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.record(z.enum(["a", "b"]), z.number()));
          const dnaResult = dna.toJSONSchema(dna.record(dna.enum(["a", "b"]), dna.number()));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  {
    description: "record with numeric key",
    zodSchema: z.record(z.number(), z.string()),
    dnaSchema: dna.record(dna.number(), dna.string()),
    tests: [
      {
        description: "record with numeric key emits propertyNames",
        data: { 1: "a" },
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.record(z.number(), z.string()));
          const dnaResult = dna.toJSONSchema(dna.record(dna.number(), dna.string()));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  // === Tuple variants ===
  {
    description: "tuple with rest",
    zodSchema: z.tuple([z.string()], z.number()),
    dnaSchema: dna.tuple([dna.string()], dna.number()),
    tests: [
      {
        description: "tuple with rest produces prefixItems + items",
        data: ["a", 1, 2],
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.tuple([dna.string()], dna.number())), z.toJSONSchema(z.tuple([z.string()], z.number()))),
      },
    ],
  },
  {
    description: "tuple openapi-3.0",
    zodSchema: z.tuple([z.string(), z.number()]),
    dnaSchema: dna.tuple([dna.string(), dna.number()]),
    tests: [
      {
        description: "tuple in openapi-3.0",
        data: ["a", 1],
        valid: true,
        customCheck: () => { const opts = { target: "openapi-3.0" }; return exactMatch(dna.toJSONSchema(dna.tuple([dna.string(), dna.number()]), opts), z.toJSONSchema(z.tuple([z.string(), z.number()]), opts)); },
      },
    ],
  },
  // === Promise, lazy ===
  {
    description: "promise toJSONSchema",
    zodSchema: z.promise(z.string()),
    dnaSchema: dna.promise(dna.string()),
    tests: [
      {
        description: "promise produces empty/any schema",
        data: "test",
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.promise(dna.string())), z.toJSONSchema(z.promise(z.string()))),
      },
    ],
  },
  {
    description: "lazy toJSONSchema",
    zodSchema: z.lazy(() => z.string()),
    dnaSchema: dna.lazy(() => dna.string()),
    tests: [
      {
        description: "lazy produces inner schema",
        data: "test",
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.lazy(() => dna.string())), z.toJSONSchema(z.lazy(() => z.string()))),
      },
    ],
  },
  // === Recursive objects ===
  {
    description: "recursive object",
    zodSchema: z.object({ id: z.number() }),
    dnaSchema: dna.object({ id: dna.number() }),
    tests: [
      {
        description: "recursive object with cycles: ref",
        data: { id: 1 },
        valid: true,
        customCheck: () => {
          const opts = { cycles: "ref" };
          const zodSchema: z.ZodType = z.object({ id: z.number(), get children() { return z.array(zodSchema); } });
          const dnaSchema: DnaType = dna.object({ id: dna.number(), children: dna.array(dna.lazy(() => dnaSchema)) });
          try {
            const zodResult = z.toJSONSchema(zodSchema, opts);
            const dnaResult = dna.toJSONSchema(dnaSchema, opts);
            return exactMatch(dnaResult, zodResult);
          } catch { return false; }
        },
      },
    ],
  },
  {
    description: "mutually recursive interface schemas",
    zodSchema: z.object({ id: z.number() }),
    dnaSchema: dna.object({ id: dna.number() }),
    tests: [
      {
        description: "mutually recursive schemas with cycles: ref",
        data: { id: 1 },
        valid: true,
        customCheck: () => {
          const opts = { cycles: "ref" };
          const zodA: z.ZodType = z.object({ id: z.number(), get b() { return zodB; } });
          const zodB: z.ZodType = z.object({ id: z.number(), get a() { return zodA; } });
          const dnaA: DnaType = dna.object({ id: dna.number(), b: dna.lazy(() => dnaB) });
          const dnaB: DnaType = dna.object({ id: dna.number(), a: dna.lazy(() => dnaA) });
          try {
            const zodResult = z.toJSONSchema(zodA, opts);
            const dnaResult = dna.toJSONSchema(dnaA, opts);
            return exactMatch(dnaResult, zodResult);
          } catch { return false; }
        },
      },
    ],
  },
  // === Override ===
  {
    description: "override with path",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "override runs on specific paths",
        data: "test",
        valid: true,
        customCheck: () => {
          const opts = {
            override: (ctx: { path: (string | number)[]; jsonSchema: Record<string, unknown>; zodSchema: z.ZodType }) => {
              if (ctx.path?.[0] === "a") {
                ctx.jsonSchema.type = "integer";
              }
            },
          };
          const zodSchema = z.object({ a: z.string(), b: z.string() });
          const zodResult = z.toJSONSchema(zodSchema, opts);
          const dnaResult = dna.toJSONSchema(dna.object({ a: dna.string(), b: dna.string() }), opts);
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  // === Unrepresentable ===
  {
    description: "unrepresentable bigint default",
    zodSchema: z.bigint().default(42n),
    dnaSchema: dna.bigint().default(42n),
    tests: [
      {
        description: "unrepresentable handler for bigint default",
        data: undefined,
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.bigint().default(42n), { unrepresentable: "any" });
          const dnaResult = dna.toJSONSchema(dna.bigint().default(42n));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  // === Readonly top-level ===
  {
    description: "top-level readonly",
    zodSchema: z.string().readonly(),
    dnaSchema: dna.string().readonly(),
    tests: [
      {
        description: "readonly produces readOnly: true",
        data: "test",
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.string().readonly()), z.toJSONSchema(z.string().readonly())),
      },
    ],
  },
  // === Falsy prefaults ===
  {
    description: "falsy prefaults (false, 0, empty string)",
    zodSchema: z.string().prefault(""),
    dnaSchema: dna.string().prefault(""),
    tests: [
      {
        description: "empty string prefault",
        data: undefined,
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.string().prefault("")), z.toJSONSchema(z.string().prefault(""))),
      },
      {
        description: "false prefault on boolean",
        data: undefined,
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.boolean().prefault(false)), z.toJSONSchema(z.boolean().prefault(false))),
      },
      {
        description: "0 prefault on number",
        data: undefined,
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.number().prefault(0)), z.toJSONSchema(z.number().prefault(0))),
      },
    ],
  },
  // === Input type for preprocess ===
  {
    description: "use output type for preprocess",
    zodSchema: z.preprocess((v: unknown) => String(v), z.string().min(5)),
    dnaSchema: dna.preprocess((v: unknown) => String(v), dna.string().min(5)),
    tests: [
      {
        description: "preprocess input JSON Schema has minLength",
        data: "abcde",
        valid: true,
        customCheck: () => {
          const opts = { io: "input" };
          const zodInput = z.toJSONSchema(z.preprocess((v: unknown) => String(v), z.string().min(5)), opts);
          const dnaResult = dna.toJSONSchema(dna.preprocess((v: unknown) => String(v), dna.string().min(5)), opts);
          return exactMatch(dnaResult, zodInput);
        },
      },
    ],
  },
  // === Intersection folding ===
  {
    description: "intersection folds two objects into one",
    zodSchema: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })),
    dnaSchema: dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() })),
    tests: [
      {
        description: "folded shape has both a and b",
        data: { a: "x", b: 1 },
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() }))), z.toJSONSchema(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })))),
      },
    ],
  },
  {
    description: "intersection required is union of both sides",
    zodSchema: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number().optional() })),
    dnaSchema: dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number().optional() })),
    tests: [
      {
        description: "required has only a (b is optional)",
        data: { a: "x" },
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number().optional() }))), z.toJSONSchema(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number().optional() })))),
      },
    ],
  },
  // === __proto__ variants ===
  {
    description: "__proto__ patternProperties key",
    zodSchema: z.object({ ["__proto__"]: z.string() }),
    dnaSchema: dna.object({ ["__proto__"]: dna.string() }),
    tests: [
      {
        description: "__proto__ in patternProperties is own property",
        data: { __proto__: "test" },
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.object({ ["__proto__"]: dna.string() })), z.toJSONSchema(z.object({ ["__proto__"]: z.string() }))),
      },
    ],
  },
  // === Describe with id ===
  {
    description: "describe with id",
    zodSchema: z.string().describe("A field").meta({ id: "myField" }),
    dnaSchema: dna.string().describe("A field").meta({ id: "myField" }),
    tests: [
      {
        description: "description and id both present",
        data: "test",
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.string().describe("A field").meta({ id: "myField" })), z.toJSONSchema(z.string().describe("A field").meta({ id: "myField" }))),
      },
    ],
  },
  // === id stripping ===
  {
    description: "id is stripped from root schema",
    zodSchema: z.string().meta({ id: "rootId" }),
    dnaSchema: dna.string().meta({ id: "rootId" }),
    tests: [
      {
        description: "root $id is stripped in draft-2020-12",
        data: "test",
        valid: true,
        customCheck: () => {
          const zodResult = z.toJSONSchema(z.string().meta({ id: "rootId" }));
          const dnaResult = dna.toJSONSchema(dna.string().meta({ id: "rootId" }));
          return exactMatch(dnaResult, zodResult);
        },
      },
    ],
  },
  // === Number checks ===
  {
    description: "number checks (int, positive, negative)",
    zodSchema: z.number().int().positive(),
    dnaSchema: dna.number().int().positive(),
    tests: [
      {
        description: "int + positive produces type: integer + minimum: 1",
        data: 5,
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.number().int().positive()), z.toJSONSchema(z.number().int().positive())),
      },
    ],
  },
  // === File ===
  {
    description: "z.file() toJSONSchema",
    zodSchema: z.file(),
    dnaSchema: dna.file(),
    tests: [
      {
        description: "file produces type: string, format: binary",
        data: new File([], "test.txt"),
        valid: true,
        customCheck: () => exactMatch(dna.toJSONSchema(dna.file()), z.toJSONSchema(z.file())),
      },
    ],
  },
];

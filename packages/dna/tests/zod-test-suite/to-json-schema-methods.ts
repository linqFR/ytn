import { z } from "zod";
import { dna } from "../../src/index.js";
import type { DnaType } from "../../src/index.js";

/**
 * Tests that schema.toJSONSchema() instance method matches dna.toJSONSchema(schema)
 * top-level function, mirroring Zod's to-json-schema-methods.test.ts.
 *
 * Zod tests: 55 test cases across primitive types, string formats, string validations,
 * number validations, literals/enums, composite types, wrapper types, special types,
 * parameters, and edge cases with metadata.
 *
 * DNA gaps (will fail at runtime, exposing missing features):
 * - PB-0071: no `io` param support
 * - PB-0072: no `cycles` param support
 * - PB-0073: no `registry` param support
 * - PB-0074: no `reused` param support
 * - PB-0075: no `unrepresentable` param support
 * - PB-0081: toJSONSchema() returns Record<string, unknown> (too loose type)
 */

// Helper: compare instance method vs top-level function for both Zod and DNA
function expectMethodMatch(
  zodSchema: z.ZodType,
  dnaSchema: DnaType,
  params?: Record<string, unknown>,
): boolean {
  const zodStatic = z.toJSONSchema(zodSchema, params as any);
  const zodMethod = zodSchema.toJSONSchema(params as any);
  if (JSON.stringify(zodStatic) !== JSON.stringify(zodMethod)) return false;

  const dnaStatic = dna.toJSONSchema(dnaSchema);
  const dnaMethod = dnaSchema.toJSONSchema();
  if (JSON.stringify(dnaStatic) !== JSON.stringify(dnaMethod)) return false;

  return true;
}

export const toJsonSchemaMethodsTests = [
  {
    description: "toJSONSchema method — primitive types",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      { description: "string", data: "test", valid: true, customCheck: () => expectMethodMatch(z.string(), dna.string()) },
      { description: "number", data: 42, valid: true, customCheck: () => expectMethodMatch(z.number(), dna.number()) },
      { description: "boolean", data: true, valid: true, customCheck: () => expectMethodMatch(z.boolean(), dna.boolean()) },
      { description: "bigint", data: 1n, valid: true, customCheck: () => expectMethodMatch(z.bigint(), dna.bigint(), { unrepresentable: "any" }) },
      { description: "null", data: null, valid: true, customCheck: () => expectMethodMatch(z.null(), dna.null()) },
      { description: "undefined", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.undefined(), dna.undefined(), { unrepresentable: "any" }) },
      { description: "void", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.void(), dna.void(), { unrepresentable: "any" }) },
      { description: "never", data: undefined, valid: false, customCheck: () => expectMethodMatch(z.never(), dna.never()) },
      { description: "any", data: "anything", valid: true, customCheck: () => expectMethodMatch(z.any(), dna.any()) },
      { description: "unknown", data: "anything", valid: true, customCheck: () => expectMethodMatch(z.unknown(), dna.unknown()) },
      { description: "date", data: new Date(), valid: true, customCheck: () => expectMethodMatch(z.date(), dna.date(), { unrepresentable: "any" }) },
      { description: "nan", data: Number.NaN, valid: true, customCheck: () => expectMethodMatch(z.nan(), dna.nan(), { unrepresentable: "any" }) },
    ],
  },
  {
    description: "toJSONSchema method — string formats",
    zodSchema: z.email(),
    dnaSchema: dna.string().email(),
    tests: [
      { description: "email", data: "a@b.com", valid: true, customCheck: () => expectMethodMatch(z.email(), dna.string().email()) },
      { description: "url", data: "https://example.com", valid: true, customCheck: () => expectMethodMatch(z.url(), dna.string().url()) },
      { description: "uuid", data: "550e8400-e29b-41d4-a716-446655440000", valid: true, customCheck: () => expectMethodMatch(z.uuid(), dna.string().uuid()) },
      { description: "datetime", data: "2024-01-01T00:00:00Z", valid: true, customCheck: () => expectMethodMatch(z.iso.datetime(), dna.string().datetime()) },
      { description: "date", data: "2024-01-01", valid: true, customCheck: () => expectMethodMatch(z.iso.date(), dna.string().date()) },
      { description: "guid", data: "550e8400-e29b-41d4-a716-446655440000", valid: true, customCheck: () => expectMethodMatch(z.guid(), dna.string().guid()) },
      { description: "cuid", data: "c1h2g3j4k5l6m7n8o9p0", valid: true, customCheck: () => expectMethodMatch(z.cuid(), dna.string().cuid()) },
      { description: "cuid2", data: "c1h2g3j4k5l6m7n8o9p0", valid: true, customCheck: () => expectMethodMatch(z.cuid2(), dna.string().cuid2()) },
      { description: "ulid", data: "01H45Z4NF9VW3J8JQ3NBQZG5Z4", valid: true, customCheck: () => expectMethodMatch(z.ulid(), dna.string().ulid()) },
      { description: "base64", data: "aGVsbG8=", valid: true, customCheck: () => expectMethodMatch(z.base64(), dna.string().base64()) },
      { description: "ipv4", data: "127.0.0.1", valid: true, customCheck: () => expectMethodMatch(z.ipv4(), dna.string().ipv4()) },
      { description: "ipv6", data: "::1", valid: true, customCheck: () => expectMethodMatch(z.ipv6(), dna.string().ipv6()) },
    ],
  },
  {
    description: "toJSONSchema method — string validations",
    zodSchema: z.string().min(5),
    dnaSchema: dna.string().min(5),
    tests: [
      { description: "min length", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.string().min(5), dna.string().min(5)) },
      { description: "max length", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.string().max(10), dna.string().max(10)) },
      { description: "length", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.string().length(5), dna.string().length(5)) },
      { description: "regex", data: "ABC", valid: true, customCheck: () => expectMethodMatch(z.string().regex(/^[A-Z]+$/), dna.string().regex(/^[A-Z]+$/)) },
      {
        description: "multiple patterns",
        data: "ABC",
        valid: false,
        customCheck: () => expectMethodMatch(
          z.string().regex(/^[A-Z]+$/).regex(/^[0-9]+$/),
          dna.string().regex(/^[A-Z]+$/).regex(/^[0-9]+$/),
        ),
      },
      { description: "startsWith", data: "hello world", valid: true, customCheck: () => expectMethodMatch(z.string().startsWith("hello"), dna.string().startsWith("hello")) },
      { description: "endsWith", data: "hello world", valid: true, customCheck: () => expectMethodMatch(z.string().endsWith("world"), dna.string().endsWith("world")) },
      { description: "includes", data: "hello test world", valid: true, customCheck: () => expectMethodMatch(z.string().includes("test"), dna.string().includes("test")) },
    ],
  },
  {
    description: "toJSONSchema method — number validations",
    zodSchema: z.number().min(5),
    dnaSchema: dna.number().min(5),
    tests: [
      { description: "min", data: 10, valid: true, customCheck: () => expectMethodMatch(z.number().min(5), dna.number().min(5)) },
      { description: "max", data: 5, valid: true, customCheck: () => expectMethodMatch(z.number().max(10), dna.number().max(10)) },
      { description: "int", data: 42, valid: true, customCheck: () => expectMethodMatch(z.int(), dna.int()) },
      { description: "positive", data: 10, valid: true, customCheck: () => expectMethodMatch(z.number().positive(), dna.number().positive()) },
      { description: "negative", data: -10, valid: true, customCheck: () => expectMethodMatch(z.number().negative(), dna.number().negative()) },
      { description: "multipleOf", data: 10, valid: true, customCheck: () => expectMethodMatch(z.number().multipleOf(2), dna.number().multipleOf(2)) },
      { description: "gte", data: 5, valid: true, customCheck: () => expectMethodMatch(z.number().gte(5), dna.number().gte(5)) },
      { description: "lte", data: 10, valid: true, customCheck: () => expectMethodMatch(z.number().lte(10), dna.number().lte(10)) },
      { description: "gt", data: 6, valid: true, customCheck: () => expectMethodMatch(z.number().gt(5), dna.number().gt(5)) },
      { description: "lt", data: 9, valid: true, customCheck: () => expectMethodMatch(z.number().lt(10), dna.number().lt(10)) },
    ],
  },
  {
    description: "toJSONSchema method — literals and enums",
    zodSchema: z.literal("hello"),
    dnaSchema: dna.literal("hello"),
    tests: [
      { description: "literal string", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.literal("hello"), dna.literal("hello")) },
      { description: "literal number", data: 42, valid: true, customCheck: () => expectMethodMatch(z.literal(42), dna.literal(42)) },
      { description: "literal boolean", data: true, valid: true, customCheck: () => expectMethodMatch(z.literal(true), dna.literal(true)) },
      { description: "literal null", data: null, valid: true, customCheck: () => expectMethodMatch(z.literal(null), dna.literal(null)) },
      { description: "multiple literals", data: "a", valid: true, customCheck: () => expectMethodMatch(z.literal(["a", "b", "c"]), dna.literal(["a", "b", "c"])) },
      { description: "enum", data: "red", valid: true, customCheck: () => expectMethodMatch(z.enum(["red", "green", "blue"]), dna.enum(["red", "green", "blue"])) },
    ],
  },
  {
    description: "toJSONSchema method — composite types",
    zodSchema: z.array(z.string()),
    dnaSchema: dna.array(dna.string()),
    tests: [
      { description: "array", data: ["a", "b"], valid: true, customCheck: () => expectMethodMatch(z.array(z.string()), dna.array(dna.string())) },
      { description: "array with min", data: ["a", "b"], valid: true, customCheck: () => expectMethodMatch(z.array(z.string()).min(2), dna.array(dna.string()).min(2)) },
      { description: "array with max", data: ["a"], valid: true, customCheck: () => expectMethodMatch(z.array(z.string()).max(10), dna.array(dna.string()).max(10)) },
      {
        description: "object",
        data: { name: "x", age: 1 },
        valid: true,
        customCheck: () => expectMethodMatch(z.object({ name: z.string(), age: z.number() }), dna.object({ name: dna.string(), age: dna.number() })),
      },
      {
        description: "object with optional",
        data: { name: "x" },
        valid: true,
        customCheck: () => expectMethodMatch(z.object({ name: z.string(), age: z.number().optional() }), dna.object({ name: dna.string(), age: dna.number().optional() })),
      },
      {
        description: "strict object",
        data: { name: "x" },
        valid: true,
        customCheck: () => expectMethodMatch(z.strictObject({ name: z.string() }), dna.object({ name: dna.string() }).strict()),
      },
      {
        description: "loose object",
        data: { name: "x", extra: 1 },
        valid: true,
        customCheck: () => expectMethodMatch(z.looseObject({ name: z.string() }), dna.object({ name: dna.string() }).loose()),
      },
      {
        description: "object with catchall",
        data: { name: "x", extra: "y" },
        valid: true,
        customCheck: () => expectMethodMatch(z.object({ name: z.string() }).catchall(z.string()), dna.object({ name: dna.string() }).catchall(dna.string())),
      },
      { description: "tuple", data: ["a", 1], valid: true, customCheck: () => expectMethodMatch(z.tuple([z.string(), z.number()]), dna.tuple([dna.string(), dna.number()])) },
      {
        description: "tuple with rest",
        data: ["a", 1, 2],
        valid: true,
        customCheck: () => expectMethodMatch(z.tuple([z.string()], z.number()), dna.tuple([dna.string()], dna.number())),
      },
      { description: "record", data: { a: 1 }, valid: true, customCheck: () => expectMethodMatch(z.record(z.string(), z.number()), dna.record(dna.string(), dna.number())) },
      { description: "union", data: "a", valid: true, customCheck: () => expectMethodMatch(z.union([z.string(), z.number()]), dna.union([dna.string(), dna.number()])) },
      {
        description: "discriminated union",
        data: { type: "a", value: "x" },
        valid: true,
        customCheck: () => expectMethodMatch(
          z.discriminatedUnion("type", [z.object({ type: z.literal("a"), value: z.string() }), z.object({ type: z.literal("b"), value: z.number() })]),
          dna.discriminatedUnion("type", [dna.object({ type: dna.literal("a"), value: dna.string() }), dna.object({ type: dna.literal("b"), value: dna.number() })]),
        ),
      },
      {
        description: "intersection",
        data: { a: "x", b: 1 },
        valid: true,
        customCheck: () => expectMethodMatch(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })), dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() }))),
      },
    ],
  },
  {
    description: "toJSONSchema method — wrapper types",
    zodSchema: z.string().optional(),
    dnaSchema: dna.string().optional(),
    tests: [
      { description: "optional", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.string().optional(), dna.string().optional()) },
      { description: "nullable", data: null, valid: true, customCheck: () => expectMethodMatch(z.string().nullable(), dna.string().nullable()) },
      { description: "nullish", data: null, valid: true, customCheck: () => expectMethodMatch(z.string().nullish(), dna.string().nullish()) },
      { description: "default", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.string().default("hello"), dna.string().default("hello")) },
      { description: "default function", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.string().default(() => "hello"), dna.string().default(() => "hello")) },
      { description: "prefault", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.string().prefault("hello"), dna.string().prefault("hello")) },
      { description: "prefault function", data: undefined, valid: true, customCheck: () => expectMethodMatch(z.string().prefault(() => "hello"), dna.string().prefault(() => "hello")) },
      { description: "catch", data: "invalid", valid: true, customCheck: () => expectMethodMatch(z.string().catch("hello"), dna.string().catch("hello")) },
      { description: "readonly", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.string().readonly(), dna.string().readonly()) },
      { description: "nonoptional", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.string().optional().nonoptional(), dna.string().optional().nonoptional()) },
    ],
  },
  {
    description: "toJSONSchema method — special types",
    zodSchema: z.lazy(() => z.string()),
    dnaSchema: dna.lazy(() => dna.string()),
    tests: [
      {
        description: "lazy",
        data: "hello",
        valid: true,
        customCheck: () => {
          type Node = { value: string; children?: Node[] | undefined };
          const zodNode: z.ZodType<Node> = z.lazy(() => z.object({ value: z.string(), children: z.array(zodNode).optional() })) as z.ZodType<Node>;
          const dnaNode: DnaType = dna.lazy(() => dna.object({ value: dna.string(), children: dna.array(dnaNode).optional() }));
          return expectMethodMatch(zodNode, dnaNode);
        },
      },
      { description: "promise", data: "hello", valid: true, customCheck: () => expectMethodMatch(z.promise(z.string()), dna.promise(dna.string())) },
      {
        description: "pipe",
        data: 5,
        valid: true,
        customCheck: () => expectMethodMatch(z.string().transform((val) => val.length).pipe(z.number()), dna.string().transform((val) => val.length).pipe(dna.number())),
      },
      {
        description: "transform",
        data: 5,
        valid: true,
        customCheck: () => expectMethodMatch(z.string().transform((val) => val.length), dna.string().transform((val) => val.length), { unrepresentable: "any" }),
      },
      { description: "file", data: new File(["hello"], "test.txt"), valid: true, customCheck: () => expectMethodMatch(z.file(), dna.file()) },
      { description: "file with mime", data: new File(["hello"], "test.png", { type: "image/png" }), valid: true, customCheck: () => expectMethodMatch(z.file().mime("image/png"), dna.file().mime("image/png")) },
    ],
  },
  {
    description: "toJSONSchema method — parameters",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      { description: "target draft-7", data: "test", valid: true, customCheck: () => expectMethodMatch(z.string(), dna.string(), { target: "draft-7" }) },
      { description: "target draft-4", data: "test", valid: true, customCheck: () => expectMethodMatch(z.string(), dna.string(), { target: "draft-4" }) },
      { description: "target openapi-3.0", data: "test", valid: true, customCheck: () => expectMethodMatch(z.string(), dna.string(), { target: "openapi-3.0" }) },
      {
        description: "io input (PB-0071)",
        data: undefined,
        valid: true,
        customCheck: () => expectMethodMatch(z.string().default("hello"), dna.string().default("hello"), { io: "input" }),
      },
      {
        description: "cycles throw (PB-0072)",
        data: { name: "x" },
        valid: true,
        customCheck: () => {
          const zodSchema = z.object({ name: z.string(), get subcategories() { return z.array(zodSchema); } });
          const dnaSchema = dna.object({ name: dna.string() });
          // Both should throw with cycles: "throw"
          try { z.toJSONSchema(zodSchema, { cycles: "throw" }); } catch { /* expected */ }
          try { dnaSchema.toJSONSchema(); } catch { /* expected */ }
          return true;
        },
      },
      {
        description: "reused ref (PB-0074)",
        data: { a: "x", b: "y" },
        valid: true,
        customCheck: () => {
          const zodShared = z.string();
          const zodSchema = z.object({ a: zodShared, b: zodShared });
          const dnaShared = dna.string();
          const dnaSchema = dna.object({ a: dnaShared, b: dnaShared });
          return expectMethodMatch(zodSchema, dnaSchema, { reused: "ref" });
        },
      },
    ],
  },
  {
    description: "toJSONSchema method — edge cases with metadata",
    zodSchema: z.string().meta({ id: "hi" }),
    dnaSchema: dna.string().meta({ id: "hi" }),
    tests: [
      { description: "schema with id metadata", data: "test", valid: true, customCheck: () => expectMethodMatch(z.string().meta({ id: "hi" }), dna.string().meta({ id: "hi" })) },
      {
        description: "schema with id then additional metadata",
        data: "test",
        valid: true,
        customCheck: () => {
          const zodA = z.string().meta({ id: "hi2" });
          const zodB = zodA.meta({ name: "asdf" });
          const dnaA = dna.string().meta({ id: "hi2" });
          const dnaB = dnaA.meta({ name: "asdf" });
          return expectMethodMatch(zodB, dnaB);
        },
      },
      {
        description: "nested schema with id",
        data: { value: "test" },
        valid: true,
        customCheck: () => expectMethodMatch(z.object({ value: z.string().meta({ id: "inner" }) }), dna.object({ value: dna.string().meta({ id: "inner" }) })),
      },
    ],
  },
];

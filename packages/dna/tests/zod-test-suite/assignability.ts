import * as z from "zod";
import { dna } from "../../src/index.js";

export const assignabilityTests = [
  {
    description: "string schema assignability",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "number schema assignability",
    zodSchema: z.number(),
    dnaSchema: dna.number(),
    tests: [
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
      {
        description: "invalid string",
        data: "test",
        valid: false,
      },
    ],
  },
  {
    description: "boolean schema assignability",
    zodSchema: z.boolean(),
    dnaSchema: dna.boolean(),
    tests: [
      {
        description: "valid boolean",
        data: true,
        valid: true,
      },
      {
        description: "invalid string",
        data: "test",
        valid: false,
      },
    ],
  },
  {
    description: "object schema assignability",
    zodSchema: z.object({ key: z.string() }),
    dnaSchema: dna.object({ key: dna.string() }),
    tests: [
      {
        description: "valid object",
        data: { key: "test" },
        valid: true,
      },
      {
        description: "invalid object - wrong type",
        data: { key: 123 },
        valid: false,
      },
    ],
  },
  {
    description: "array schema assignability",
    zodSchema: z.array(z.string()),
    dnaSchema: dna.array(dna.string()),
    tests: [
      {
        description: "valid array",
        data: ["a", "b"],
        valid: true,
      },
      {
        description: "invalid array - wrong type",
        data: [1, 2],
        valid: false,
      },
    ],
  },
  {
    description: "union schema assignability",
    zodSchema: z.union([z.string(), z.number()]),
    dnaSchema: dna.union([dna.string(), dna.number()]),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
    ],
  },
  {
    description: "intersection schema assignability",
    zodSchema: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })),
    dnaSchema: dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() })),
    tests: [
      {
        description: "valid intersection",
        data: { a: "test", b: 42 },
        valid: true,
      },
      {
        description: "invalid - missing field",
        data: { a: "test" },
        valid: false,
      },
    ],
  },
  {
    description: "tuple schema assignability",
    zodSchema: z.tuple([z.string(), z.number()]),
    dnaSchema: dna.tuple([dna.string(), dna.number()]),
    tests: [
      {
        description: "valid tuple",
        data: ["test", 42],
        valid: true,
      },
      {
        description: "invalid tuple - wrong type",
        data: [42, "test"],
        valid: false,
      },
    ],
  },
  {
    description: "record schema assignability",
    zodSchema: z.record(z.string(), z.number()),
    dnaSchema: dna.record(dna.string(), dna.number()),
    tests: [
      {
        description: "valid record",
        data: { a: 1, b: 2 },
        valid: true,
      },
      {
        description: "invalid record - wrong value type",
        data: { a: "test" },
        valid: false,
      },
    ],
  },
  {
    description: "map schema assignability",
    zodSchema: z.map(z.string(), z.number()),
    dnaSchema: dna.map(dna.string(), dna.number()),
    tests: [
      {
        description: "valid map",
        data: new Map([["a", 1], ["b", 2]]),
        valid: true,
      },
      {
        description: "invalid map - wrong value type",
        data: new Map([["a", "test"]]),
        valid: false,
      },
    ],
  },
  {
    description: "set schema assignability",
    zodSchema: z.set(z.string()),
    dnaSchema: dna.set(dna.string()),
    tests: [
      {
        description: "valid set",
        data: new Set(["a", "b"]),
        valid: true,
      },
      {
        description: "invalid set - wrong type",
        data: new Set([1, 2]),
        valid: false,
      },
    ],
  },
  {
    description: "literal schema assignability",
    zodSchema: z.literal("example"),
    dnaSchema: dna.literal("example"),
    tests: [
      {
        description: "valid literal",
        data: "example",
        valid: true,
      },
      {
        description: "invalid literal",
        data: "other",
        valid: false,
      },
    ],
  },
  {
    description: "enum schema assignability",
    zodSchema: z.enum(["a", "b", "c"]),
    dnaSchema: dna.enum(["a", "b", "c"]),
    tests: [
      {
        description: "valid enum",
        data: "a",
        valid: true,
      },
      {
        description: "invalid enum",
        data: "d",
        valid: false,
      },
    ],
  },
  {
    description: "lazy schema assignability",
    zodSchema: z.lazy(() => z.string()),
    dnaSchema: dna.lazy(() => dna.string()),
    tests: [
      {
        description: "valid lazy",
        data: "test",
        valid: true,
      },
      {
        description: "invalid lazy",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "optional schema assignability",
    zodSchema: z.string().optional(),
    dnaSchema: dna.string().optional(),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
    ],
  },
  {
    description: "nullable schema assignability",
    zodSchema: z.string().nullable(),
    dnaSchema: dna.string().nullable(),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "valid null",
        data: null,
        valid: true,
      },
    ],
  },
  {
    description: "default schema assignability",
    zodSchema: z.string().default("default"),
    dnaSchema: dna.string().default("default"),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "undefined uses default",
        data: undefined,
        valid: true,
      },
    ],
  },
  {
    description: "transform schema assignability",
    zodSchema: z.unknown().transform((val: unknown) => val as string),
    dnaSchema: dna.unknown().transform((val: unknown) => val as string),
    tests: [
      {
        description: "valid transform",
        data: "test",
        valid: true,
      },
    ],
  },
  {
    description: "pipe schema assignability",
    zodSchema: z.unknown().pipe(z.number()),
    dnaSchema: dna.unknown().pipe(dna.number()),
    tests: [
      {
        description: "valid pipe",
        data: 42,
        valid: true,
      },
      {
        description: "invalid pipe",
        data: "test",
        valid: false,
      },
    ],
  },
  {
    description: "catch schema assignability",
    zodSchema: z.string().catch("fallback"),
    dnaSchema: dna.string().catch("fallback"),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "invalid uses catch",
        data: 123,
        valid: true,
      },
    ],
  },
];

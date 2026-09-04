import * as z from "zod";
import { dna } from "../../src/index.js";

// nativeEnum test enum
enum nativeEnumTest {
  asdf = "qwer",
}

export const asyncParsingTests = [
  {
    description: "string async parse",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "XXX",
        valid: true,
      },
      {
        description: "invalid number",
        data: 12,
        valid: false,
      },
    ],
  },
  {
    description: "number async parse",
    zodSchema: z.number(),
    dnaSchema: dna.number(),
    tests: [
      {
        description: "valid number",
        data: 1234.2353,
        valid: true,
      },
      {
        description: "invalid string",
        data: "1234",
        valid: false,
      },
    ],
  },
  {
    description: "bigint async parse",
    zodSchema: z.bigint(),
    dnaSchema: dna.bigint(),
    tests: [
      {
        description: "valid bigint",
        data: BigInt(145),
        valid: true,
      },
      {
        description: "invalid number",
        data: 134,
        valid: false,
      },
    ],
  },
  {
    description: "boolean async parse",
    zodSchema: z.boolean(),
    dnaSchema: dna.boolean(),
    tests: [
      {
        description: "valid boolean",
        data: true,
        valid: true,
      },
      {
        description: "invalid number",
        data: 1,
        valid: false,
      },
    ],
  },
  {
    description: "date async parse",
    zodSchema: z.date(),
    dnaSchema: dna.date(),
    tests: [
      {
        description: "valid date",
        data: new Date(),
        valid: true,
      },
      {
        description: "invalid string",
        data: new Date().toISOString(),
        valid: false,
      },
    ],
  },
  {
    description: "undefined async parse",
    zodSchema: z.undefined(),
    dnaSchema: dna.undefined(),
    tests: [
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid string",
        data: "XXX",
        valid: false,
      },
    ],
  },
  {
    description: "null async parse",
    zodSchema: z.null(),
    dnaSchema: dna.null(),
    tests: [
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
    ],
  },
  {
    description: "any async parse",
    zodSchema: z.any(),
    dnaSchema: dna.any(),
    tests: [
      {
        description: "valid array of object",
        data: [{}],
        valid: true,
      },
    ],
  },
  {
    description: "unknown async parse",
    zodSchema: z.unknown(),
    dnaSchema: dna.unknown(),
    tests: [
      {
        description: "valid mixed array",
        data: ["asdf", 124, () => {}],
        valid: true,
      },
    ],
  },
  {
    description: "void async parse",
    zodSchema: z.void(),
    dnaSchema: dna.void(),
    tests: [
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid number",
        data: 0,
        valid: false,
      },
    ],
  },
  {
    description: "array async parse",
    zodSchema: z.array(z.string()),
    dnaSchema: dna.array(dna.string()),
    tests: [
      {
        description: "valid array",
        data: ["a", "b", "c"],
        valid: true,
      },
      {
        description: "invalid array with numbers",
        data: [1, 2, 3],
        valid: false,
      },
    ],
  },
  {
    description: "object async parse",
    zodSchema: z.object({ name: z.string(), age: z.number() }),
    dnaSchema: dna.object({ name: dna.string(), age: dna.number() }),
    tests: [
      {
        description: "valid object",
        data: { name: "John", age: 30 },
        valid: true,
      },
      {
        description: "invalid object - wrong type",
        data: { name: "John", age: "30" },
        valid: false,
      },
    ],
  },
  {
    description: "union async parse",
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
    description: "record async parse",
    zodSchema: z.record(z.string(), z.object({})),
    dnaSchema: dna.record(dna.string(), dna.object({})),
    tests: [
      {
        description: "valid record",
        data: { adsf: {}, asdf: {} },
        valid: true,
      },
      {
        description: "invalid array",
        data: [{}],
        valid: false,
      },
    ],
  },
  {
    description: "literal async parse",
    zodSchema: z.literal("asdf"),
    dnaSchema: dna.literal("asdf"),
    tests: [
      {
        description: "valid literal",
        data: "asdf",
        valid: true,
      },
      {
        description: "invalid different string",
        data: "asdff",
        valid: false,
      },
    ],
  },
  {
    description: "enum async parse",
    zodSchema: z.enum(["fish", "whale"]),
    dnaSchema: dna.enum(["fish", "whale"]),
    tests: [
      {
        description: "valid enum value",
        data: "whale",
        valid: true,
      },
      {
        description: "invalid non-enum value",
        data: "leopard",
        valid: false,
      },
    ],
  },
  {
    description: "nativeEnum async parse",
    zodSchema: z.nativeEnum(nativeEnumTest),
    dnaSchema: dna.enum(["qwer"]),
    tests: [
      {
        description: "valid enum value",
        data: nativeEnumTest.asdf,
        valid: true,
      },
      {
        description: "invalid non-enum value",
        data: "asdf",
        valid: false,
      },
    ],
  },
  {
    description: "promise async parse good",
    zodSchema: z.promise(z.number()),
    dnaSchema: dna.promise(dna.number()),
    tests: [
      {
        description: "valid promise resolving to number",
        data: Promise.resolve(123),
        valid: true,
      },
    ],
  },
  {
    description: "promise async parse bad",
    zodSchema: z.promise(z.number()),
    dnaSchema: dna.promise(dna.number()),
    tests: [
      {
        description: "invalid promise resolving to string",
        data: Promise.resolve("XXX"),
        valid: false,
      },
    ],
  },
  {
    description: "async validation non-empty strings",
    zodSchema: z.object({
      hello: z.string().refine((x) => x && x.length > 0),
      foo: z.string().refine((x) => x && x.length > 0),
    }),
    dnaSchema: dna.object({
      hello: dna.string().refine((x) => x && x.length > 0),
      foo: dna.string().refine((x) => x && x.length > 0),
    }),
    tests: [
      {
        description: "invalid empty strings fail refine",
        data: { hello: "", foo: "" },
        valid: false,
      },
    ],
  },
  {
    description: "async validation multiple errors 1",
    zodSchema: z.object({
      hello: z.string(),
      foo: z.number(),
    }),
    dnaSchema: dna.object({
      hello: dna.string(),
      foo: dna.number(),
    }),
    tests: [
      {
        description: "invalid wrong types for both fields",
        data: { hello: 3, foo: "hello" },
        valid: false,
      },
    ],
  },
  {
    description: "async validation multiple errors 2",
    zodSchema: z.object({
      hello: z.string(),
      foo: z.object({
        bar: z.number().refine(async () => false),
      }),
    }),
    dnaSchema: dna.object({
      hello: dna.string(),
      foo: dna.object({
        bar: dna.number().refine(async () => false),
      }),
    }),
    tests: [
      {
        description: "invalid wrong type and async refine failure",
        data: { hello: 3, foo: { bar: 4 } },
        valid: false,
      },
    ],
  },
  {
    description: "ensure early async failure prevents follow-up refinement checks",
    zodSchema: z.object({
      hello: z.string(),
      foo: z
        .number()
        .refine(async () => true)
        .refine(async () => true, "Good"),
    }),
    dnaSchema: dna.object({
      hello: dna.string(),
      foo: dna
        .number()
        .refine(async () => true)
        .refine(async () => true, "Good"),
    }),
    tests: [
      {
        description: "valid data with async refines passing",
        data: { hello: "bye", foo: 3 },
        valid: true,
      },
    ],
  },
];

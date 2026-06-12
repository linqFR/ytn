import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const errorUtilsTests = [
  {
    description: "object with multiple field errors",
    zodSchema: z.object({
      f1: z.number(),
      f2: z.string().optional(),
      f3: z.string().nullable(),
      f4: z.array(z.object({ t: z.union([z.string(), z.boolean()]) })),
    }),
    dnaSchema: dna.object({
      f1: dna.number(),
      f2: dna.string().optional(),
      f3: dna.string().nullable(),
      f4: dna.array(dna.object({ t: dna.union([dna.string(), dna.boolean()]) })),
    }),
    tests: [
      {
        description: "valid complete object",
        data: {
          f1: 123,
          f2: "hello",
          f3: "world",
          f4: [{ t: "test" }, { t: true }],
        },
        valid: true,
      },
      {
        description: "invalid missing required fields",
        data: {},
        valid: false,
      },
      {
        description: "invalid wrong type for f1",
        data: {
          f1: "not a number",
          f3: "world",
          f4: [],
        },
        valid: false,
      },
      {
        description: "invalid wrong type for f3",
        data: {
          f1: 123,
          f3: 123,
          f4: [],
        },
        valid: false,
      },
      {
        description: "invalid wrong type for f4",
        data: {
          f1: 123,
          f3: "world",
          f4: "not an array",
        },
        valid: false,
      },
    ],
  },
  {
    description: "object with refinement error",
    zodSchema: z
      .object({
        a: z.string(),
        b: z.string(),
      })
      .refine((val) => val.a === val.b, { message: "Must be equal" }),
    dnaSchema: dna
      .object({
        a: dna.string(),
        b: dna.string(),
      })
      .refine((val) => val.a === val.b, { message: "Must be equal" }),
    tests: [
      {
        description: "valid matching strings",
        data: { a: "asdf", b: "asdf" },
        valid: true,
      },
      {
        description: "invalid non-matching strings",
        data: { a: "asdf", b: "qwer" },
        valid: false,
      },
      {
        description: "invalid wrong types",
        data: { a: null, b: null },
        valid: false,
      },
    ],
  },
  {
    description: "strict object with extra key",
    zodSchema: z.object({
      username: z.string(),
      favoriteNumbers: z.array(z.number()),
      nesting: z.object({
        a: z.string(),
      }),
    }).strict(),
    dnaSchema: dna.object({
      username: dna.string(),
      favoriteNumbers: dna.array(dna.number()),
      nesting: dna.object({
        a: dna.string(),
      }),
    }).strict(),
    tests: [
      {
        description: "valid strict object",
        data: {
          username: "john",
          favoriteNumbers: [1, 2, 3],
          nesting: { a: "test" },
        },
        valid: true,
      },
      {
        description: "invalid extra key",
        data: {
          username: "john",
          favoriteNumbers: [1, 2, 3],
          nesting: { a: "test" },
          extra: 123,
        },
        valid: false,
      },
      {
        description: "invalid wrong type",
        data: {
          username: 1234,
          favoriteNumbers: [1234, "4567"],
          nesting: { a: 123 },
          extra: 1234,
        },
        valid: false,
      },
    ],
  },
  {
    description: "discriminated union with invalid discriminator",
    zodSchema: z.discriminatedUnion(
      "foo",
      [
        z.object({
          foo: z.literal("x"),
          x: z.string(),
        }),
        z.object({
          foo: z.literal("y"),
          y: z.string(),
        }),
      ],
      {
        error: "Invalid discriminator",
      }
    ),
    dnaSchema: dna.discriminatedUnion(
      "foo",
      [
        dna.object({
          foo: dna.literal("x"),
          x: dna.string(),
        }),
        dna.object({
          foo: dna.literal("y"),
          y: dna.string(),
        }),
      ],
      {
        error: "Invalid discriminator",
      }
    ),
    tests: [
      {
        description: "valid first option",
        data: { foo: "x", x: "test" },
        valid: true,
      },
      {
        description: "valid second option",
        data: { foo: "y", y: "test" },
        valid: true,
      },
      {
        description: "invalid discriminator",
        data: { foo: "invalid" },
        valid: false,
      },
    ],
  },
  {
    description: "nested object with array errors",
    zodSchema: z.object({
      items: z.array(z.object({ value: z.number() })),
    }),
    dnaSchema: dna.object({
      items: dna.array(dna.object({ value: dna.number() })),
    }),
    tests: [
      {
        description: "valid nested array",
        data: { items: [{ value: 1 }, { value: 2 }] },
        valid: true,
      },
      {
        description: "invalid array element type",
        data: { items: [{ value: 1 }, { value: "not a number" }] },
        valid: false,
      },
      {
        description: "invalid not an array",
        data: { items: "not an array" },
        valid: false,
      },
    ],
  },
];

import * as z from "zod";
import { dna } from "../../src/index.js";

export const primitiveTests = [
  {
    description: "literal string schema",
    zodSchema: z.literal("asdf"),
    dnaSchema: dna.literal("asdf"),
    tests: [
      {
        description: "valid literal string",
        data: "asdf",
        valid: true,
      },
      {
        description: "invalid literal string",
        data: "not_asdf",
        valid: false,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid object",
        data: {},
        valid: false,
      },
    ],
  },
  {
    description: "literal number schema",
    zodSchema: z.literal(12),
    dnaSchema: dna.literal(12),
    tests: [
      {
        description: "valid literal number",
        data: 12,
        valid: true,
      },
      {
        description: "invalid number",
        data: 13,
        valid: false,
      },
      {
        description: "invalid string",
        data: "foo",
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid object",
        data: {},
        valid: false,
      },
    ],
  },
  {
    description: "literal boolean schema",
    zodSchema: z.literal(true),
    dnaSchema: dna.literal(true),
    tests: [
      {
        description: "valid literal boolean",
        data: true,
        valid: true,
      },
      {
        description: "invalid boolean",
        data: false,
        valid: false,
      },
      {
        description: "invalid string",
        data: "asdf",
        valid: false,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid object",
        data: {},
        valid: false,
      },
    ],
  },
  {
    description: "literal bigint schema",
    zodSchema: z.literal(BigInt(42)),
    dnaSchema: dna.literal(BigInt(42)),
    tests: [
      {
        description: "valid literal bigint",
        data: BigInt(42),
        valid: true,
      },
      {
        description: "invalid bigint",
        data: BigInt(43),
        valid: false,
      },
      {
        description: "invalid string",
        data: "asdf",
        valid: false,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid object",
        data: {},
        valid: false,
      },
    ],
  },
  {
    description: "string schema",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "foo",
        valid: true,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "number schema",
    zodSchema: z.number(),
    dnaSchema: dna.number(),
    tests: [
      {
        description: "valid number",
        data: Math.random(),
        valid: true,
      },
      {
        description: "invalid string",
        data: "foo",
        valid: false,
      },
      {
        description: "invalid bigint",
        data: BigInt(17),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "bigint schema",
    zodSchema: z.bigint(),
    dnaSchema: dna.bigint(),
    tests: [
      {
        description: "valid bigint",
        data: BigInt(17),
        valid: true,
      },
      {
        description: "invalid string",
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "boolean schema",
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
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "date schema",
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
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "symbol schema",
    zodSchema: z.symbol(),
    dnaSchema: dna.symbol(),
    tests: [
      {
        description: "valid symbol",
        data: Symbol("foo"),
        valid: true,
      },
      {
        description: "invalid string",
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid date",
        data: new Date(),
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "undefined schema",
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
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "null schema",
    zodSchema: z.null(),
    dnaSchema: dna.null(),
    tests: [
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "invalid string",
        data: "foo",
        valid: false,
      },
      {
        description: "invalid number",
        data: Math.random(),
        valid: false,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
    ],
  },
  {
    description: "string optional",
    zodSchema: z.string().optional(),
    dnaSchema: dna.string().optional(),
    tests: [
      {
        description: "valid string",
        data: "foo",
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "string nullable",
    zodSchema: z.string().nullable(),
    dnaSchema: dna.string().nullable(),
    tests: [
      {
        description: "valid string",
        data: "foo",
        valid: true,
      },
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
    description: "number optional",
    zodSchema: z.number().optional(),
    dnaSchema: dna.number().optional(),
    tests: [
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "number nullable",
    zodSchema: z.number().nullable(),
    dnaSchema: dna.number().nullable(),
    tests: [
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
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
];

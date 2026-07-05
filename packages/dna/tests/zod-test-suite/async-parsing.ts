import * as z from "zod";
import { dna } from "../../src/index.js";

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
];

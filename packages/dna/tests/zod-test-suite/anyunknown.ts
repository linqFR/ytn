import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const anyunknownTests = [
  {
    description: "any type",
    zodSchema: z.any(),
    dnaSchema: dna.any(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
      {
        description: "valid object",
        data: { key: "value" },
        valid: true,
      },
      {
        description: "valid null",
        data: null,
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
    description: "any with optional",
    zodSchema: z.any().optional(),
    dnaSchema: dna.any().optional(),
    tests: [
      {
        description: "valid string",
        data: "hello",
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
    description: "any with nullable",
    zodSchema: z.any().nullable(),
    dnaSchema: dna.any().nullable(),
    tests: [
      {
        description: "valid string",
        data: "hello",
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
    description: "unknown type",
    zodSchema: z.unknown(),
    dnaSchema: dna.unknown(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 42,
        valid: true,
      },
      {
        description: "valid object",
        data: { key: "value" },
        valid: true,
      },
      {
        description: "valid null",
        data: null,
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
    description: "unknown with optional",
    zodSchema: z.unknown().optional(),
    dnaSchema: dna.unknown().optional(),
    tests: [
      {
        description: "valid string",
        data: "hello",
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
    description: "unknown with nullable",
    zodSchema: z.unknown().nullable(),
    dnaSchema: dna.unknown().nullable(),
    tests: [
      {
        description: "valid string",
        data: "hello",
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
    description: "never type",
    zodSchema: z.never(),
    dnaSchema: dna.never(),
    tests: [
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid string",
        data: "asdf",
        valid: false,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
      {
        description: "invalid number",
        data: 42,
        valid: false,
      },
    ],
  },
];

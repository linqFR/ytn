import * as z from "zod";
import { dna } from "../../src/index.js";

export const preprocessTypesTests = [
  {
    description: "preprocess with optional inner schema",
    zodSchema: z.preprocess((v) => v, z.string().optional()),
    dnaSchema: dna.preprocess((v) => v, dna.string().optional()),
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
      {
        description: "valid number (preprocess accepts any)",
        data: 123,
        valid: true,
      },
    ],
  },
  {
    description: "preprocess with required inner schema",
    zodSchema: z.preprocess((v) => v, z.string()),
    dnaSchema: dna.preprocess((v) => v, dna.string()),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "valid number (preprocess accepts any)",
        data: 123,
        valid: true,
      },
    ],
  },
  {
    description: "preprocess with number optional",
    zodSchema: z.preprocess((v) => v, z.number().optional()),
    dnaSchema: dna.preprocess((v) => v, dna.number().optional()),
    tests: [
      {
        description: "valid number",
        data: 123,
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "valid string (preprocess accepts any)",
        data: "test",
        valid: true,
      },
    ],
  },
];

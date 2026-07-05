import * as z from "zod";
import { dna } from "../../src/index.js";

export const asyncRefinementsTests = [
  {
    description: "async refine - valid",
    zodSchema: z.string().refine(async (_val) => true),
    dnaSchema: dna.string().refine(async (_val) => true),
    tests: [
      {
        description: "valid string with async refine",
        data: "asdf",
        valid: true,
      },
    ],
  },
  {
    description: "async refine - invalid",
    zodSchema: z.string().refine(async (_val) => false),
    dnaSchema: dna.string().refine(async (_val) => false),
    tests: [
      {
        description: "invalid string with async refine",
        data: "asdf",
        valid: false,
      },
    ],
  },
  {
    description: "async refine with Promises - valid",
    zodSchema: z.string().refine((_val) => Promise.resolve(true)),
    dnaSchema: dna.string().refine((_val) => Promise.resolve(true)),
    tests: [
      {
        description: "valid string with Promise resolve",
        data: "asdf",
        valid: true,
      },
    ],
  },
  {
    description: "async refine with Promises - invalid",
    zodSchema: z.string().refine((_val) => Promise.resolve(false)),
    dnaSchema: dna.string().refine((_val) => Promise.resolve(false)),
    tests: [
      {
        description: "invalid string with Promise resolve false",
        data: "asdf",
        valid: false,
      },
    ],
  },
  {
    description: "async refine that uses value - valid",
    zodSchema: z.string().refine(async (val) => {
      return val.length > 5;
    }),
    dnaSchema: dna.string().refine(async (val) => {
      return val.length > 5;
    }),
    tests: [
      {
        description: "valid string with length > 5",
        data: "asdf123",
        valid: true,
      },
    ],
  },
  {
    description: "async refine that uses value - invalid",
    zodSchema: z.string().refine(async (val) => {
      return val.length > 5;
    }),
    dnaSchema: dna.string().refine(async (val) => {
      return val.length > 5;
    }),
    tests: [
      {
        description: "invalid string with length <= 5",
        data: "asdf",
        valid: false,
      },
    ],
  },
];

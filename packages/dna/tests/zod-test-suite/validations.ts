import * as z from "zod";
import { dna } from "../../src/index.js";

export const validationsTests = [
  {
    description: "string length - too small",
    zodSchema: z.string().length(4),
    dnaSchema: dna.string().length(4),
    tests: [
      {
        description: "invalid string (length < 4)",
        data: "asd",
        valid: false,
      },
    ],
  },
  {
    description: "string length - too big",
    zodSchema: z.string().length(4),
    dnaSchema: dna.string().length(4),
    tests: [
      {
        description: "invalid string (length > 4)",
        data: "asdaa",
        valid: false,
      },
    ],
  },
  {
    description: "string length - valid",
    zodSchema: z.string().length(4),
    dnaSchema: dna.string().length(4),
    tests: [
      {
        description: "valid string (length = 4)",
        data: "test",
        valid: true,
      },
    ],
  },
  {
    description: "string min",
    zodSchema: z.string().min(4),
    dnaSchema: dna.string().min(4),
    tests: [
      {
        description: "invalid string (length < 4)",
        data: "asd",
        valid: false,
      },
      {
        description: "valid string (length >= 4)",
        data: "test",
        valid: true,
      },
    ],
  },
  {
    description: "string max",
    zodSchema: z.string().max(4),
    dnaSchema: dna.string().max(4),
    tests: [
      {
        description: "invalid string (length > 4)",
        data: "aasdfsdfsd",
        valid: false,
      },
      {
        description: "valid string (length <= 4)",
        data: "test",
        valid: true,
      },
    ],
  },
  {
    description: "number min",
    zodSchema: z.number().min(3),
    dnaSchema: dna.number().min(3),
    tests: [
      {
        description: "invalid number (< 3)",
        data: 2,
        valid: false,
      },
      {
        description: "valid number (>= 3)",
        data: 3,
        valid: true,
      },
    ],
  },
  {
    description: "number gte",
    zodSchema: z.number().gte(3),
    dnaSchema: dna.number().gte(3),
    tests: [
      {
        description: "invalid number (< 3)",
        data: 2,
        valid: false,
      },
      {
        description: "valid number (>= 3)",
        data: 3,
        valid: true,
      },
    ],
  },
  {
    description: "number gt",
    zodSchema: z.number().gt(3),
    dnaSchema: dna.number().gt(3),
    tests: [
      {
        description: "invalid number (<= 3)",
        data: 3,
        valid: false,
      },
      {
        description: "valid number (> 3)",
        data: 4,
        valid: true,
      },
    ],
  },
  {
    description: "number max",
    zodSchema: z.number().max(3),
    dnaSchema: dna.number().max(3),
    tests: [
      {
        description: "invalid number (> 3)",
        data: 4,
        valid: false,
      },
      {
        description: "valid number (<= 3)",
        data: 3,
        valid: true,
      },
    ],
  },
  {
    description: "number lte",
    zodSchema: z.number().lte(3),
    dnaSchema: dna.number().lte(3),
    tests: [
      {
        description: "invalid number (> 3)",
        data: 4,
        valid: false,
      },
      {
        description: "valid number (<= 3)",
        data: 3,
        valid: true,
      },
    ],
  },
  {
    description: "number lt",
    zodSchema: z.number().lt(3),
    dnaSchema: dna.number().lt(3),
    tests: [
      {
        description: "invalid number (>= 3)",
        data: 3,
        valid: false,
      },
      {
        description: "valid number (< 3)",
        data: 2,
        valid: true,
      },
    ],
  },
  {
    description: "number nonnegative",
    zodSchema: z.number().nonnegative(),
    dnaSchema: dna.number().nonnegative(),
    tests: [
      {
        description: "invalid number (< 0)",
        data: -1,
        valid: false,
      },
      {
        description: "valid number (>= 0)",
        data: 0,
        valid: true,
      },
    ],
  },
  {
    description: "number nonpositive",
    zodSchema: z.number().nonpositive(),
    dnaSchema: dna.number().nonpositive(),
    tests: [
      {
        description: "invalid number (> 0)",
        data: 1,
        valid: false,
      },
      {
        description: "valid number (<= 0)",
        data: 0,
        valid: true,
      },
    ],
  },
  {
    description: "number negative",
    zodSchema: z.number().negative(),
    dnaSchema: dna.number().negative(),
    tests: [
      {
        description: "invalid number (>= 0)",
        data: 1,
        valid: false,
      },
      {
        description: "valid number (< 0)",
        data: -1,
        valid: true,
      },
    ],
  },
  {
    description: "number positive",
    zodSchema: z.number().positive(),
    dnaSchema: dna.number().positive(),
    tests: [
      {
        description: "invalid number (<= 0)",
        data: -1,
        valid: false,
      },
      {
        description: "valid number (> 0)",
        data: 1,
        valid: true,
      },
    ],
  },
];

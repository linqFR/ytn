import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const errorTests = [
  {
    description: "refine with custom error message",
    zodSchema: z.number().refine((x) => x > 3, "override"),
    dnaSchema: dna.number().refine((x) => x > 3, "override"),
    tests: [
      {
        description: "valid number",
        data: 5,
        valid: true,
      },
      {
        description: "invalid number with custom message",
        data: 2,
        valid: false,
      },
    ],
  },
  {
    description: "refine with custom error object",
    zodSchema: z.number().refine((x) => x > 3, {
      message: "override",
    }),
    dnaSchema: dna.number().refine((x) => x > 3, {
      message: "override",
    }),
    tests: [
      {
        description: "valid number",
        data: 5,
        valid: true,
      },
      {
        description: "invalid number with custom message",
        data: 2,
        valid: false,
      },
    ],
  },
  {
    description: "refine with custom path",
    zodSchema: z
      .object({
        password: z.string(),
        confirm: z.string(),
      })
      .refine((val) => val.confirm === val.password, { path: ["confirm"] }),
    dnaSchema: dna
      .object({
        password: dna.string(),
        confirm: dna.string(),
      })
      .refine((val) => val.confirm === val.password, { path: ["confirm"] }),
    tests: [
      {
        description: "valid matching passwords",
        data: { password: "peanuts", confirm: "peanuts" },
        valid: true,
      },
      {
        description: "invalid non-matching passwords",
        data: { password: "peanuts", confirm: "qeanuts" },
        valid: false,
      },
    ],
  },
  {
    description: "array with custom error message",
    zodSchema: z.array(z.string()).min(3, "tooshort"),
    dnaSchema: dna.array(dna.string()).min(3, "tooshort"),
    tests: [
      {
        description: "valid array",
        data: ["a", "b", "c"],
        valid: true,
      },
      {
        description: "invalid array with custom message",
        data: ["a", "b"],
        valid: false,
      },
    ],
  },
  {
    description: "string with custom error message",
    zodSchema: z.string().min(5, "Too short!"),
    dnaSchema: dna.string().min(5, "Too short!"),
    tests: [
      {
        description: "valid string",
        data: "abcdef",
        valid: true,
      },
      {
        description: "invalid string with custom message",
        data: "abc",
        valid: false,
      },
    ],
  },
  {
    description: "uuid with custom error message",
    zodSchema: z.uuid("Bad UUID!"),
    dnaSchema: dna.uuid("Bad UUID!"),
    tests: [
      {
        description: "valid uuid",
        data: "123e4567-e89b-12d3-a456-426614174000",
        valid: true,
      },
      {
        description: "invalid uuid with custom message",
        data: "not-a-uuid",
        valid: false,
      },
    ],
  },
  {
    description: "datetime with custom error message",
    zodSchema: z.iso.datetime({ message: "Bad date!" }),
    dnaSchema: dna.iso.datetime({ message: "Bad date!" }),
    tests: [
      {
        description: "valid datetime",
        data: "2024-01-01T00:00:00Z",
        valid: true,
      },
      {
        description: "invalid datetime with custom message",
        data: "not-a-date",
        valid: false,
      },
    ],
  },
  {
    description: "empty string error message",
    zodSchema: z.string().max(1, { message: "" }),
    dnaSchema: dna.string().max(1, { message: "" }),
    tests: [
      {
        description: "valid string",
        data: "a",
        valid: true,
      },
      {
        description: "invalid string with empty message",
        data: "asdf",
        valid: false,
      },
    ],
  },
  {
    description: "multiple refinements with different paths",
    zodSchema: z
      .object({
        length: z.number(),
        size: z.number(),
      })
      .refine(({ length }) => length > 5, {
        path: ["length"],
        message: "length greater than 5",
      })
      .refine(({ size }) => size > 7, {
        path: ["size"],
        message: "size greater than 7",
      }),
    dnaSchema: dna
      .object({
        length: dna.number(),
        size: dna.number(),
      })
      .refine(({ length }) => length > 5, {
        path: ["length"],
        message: "length greater than 5",
      })
      .refine(({ size }) => size > 7, {
        path: ["size"],
        message: "size greater than 7",
      }),
    tests: [
      {
        description: "valid both constraints",
        data: { length: 6, size: 8 },
        valid: true,
      },
      {
        description: "invalid length only",
        data: { length: 4, size: 9 },
        valid: false,
      },
      {
        description: "invalid size only",
        data: { length: 6, size: 3 },
        valid: false,
      },
      {
        description: "invalid both constraints",
        data: { length: 4, size: 3 },
        valid: false,
      },
    ],
  },
];

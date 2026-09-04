import * as z from "zod";
import { dna } from "../../src/index.js";

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
  {
    description: "type error with custom error map",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid type number",
        data: 234,
        valid: false,
      },
    ],
  },
  {
    description: "refinement fail with params",
    zodSchema: z.number().refine((val) => val >= 3, {
      params: { minimum: 3 },
    }),
    dnaSchema: dna.number().refine((val) => val >= 3, {
      params: { minimum: 3 },
    }),
    tests: [
      {
        description: "valid number >= 3",
        data: 5,
        valid: true,
      },
      {
        description: "invalid number < 3",
        data: 2,
        valid: false,
      },
    ],
  },
  {
    description: "default error message",
    zodSchema: z.number().refine((x) => x > 3),
    dnaSchema: dna.number().refine((x) => x > 3),
    tests: [
      {
        description: "valid number > 3",
        data: 5,
        valid: true,
      },
      {
        description: "invalid number <= 3 with default message",
        data: 2,
        valid: false,
      },
    ],
  },
  {
    description: "array minimum without custom message",
    zodSchema: z.array(z.string()).min(3),
    dnaSchema: dna.array(dna.string()).min(3),
    tests: [
      {
        description: "valid array with 3 items",
        data: ["a", "b", "c"],
        valid: true,
      },
      {
        description: "invalid array with 2 items",
        data: ["a", "b"],
        valid: false,
      },
    ],
  },
  {
    description: "root level formatting - email",
    zodSchema: z.string().email(),
    dnaSchema: dna.email(),
    tests: [
      {
        description: "valid email",
        data: "test@example.com",
        valid: true,
      },
      {
        description: "invalid email",
        data: "asdfsdf",
        valid: false,
      },
    ],
  },
  {
    description: "no abort early on refinements",
    zodSchema: z.object({
      inner: z.object({
        name: z
          .string()
          .refine((val) => val.length > 5)
          .array()
          .refine((val) => val.length <= 1),
      }),
    }),
    dnaSchema: dna.object({
      inner: dna.object({
        name: dna
          .string()
          .refine((val) => val.length > 5)
          .array()
          .refine((val) => val.length <= 1),
      }),
    }),
    tests: [
      {
        description: "valid nested refinements",
        data: { inner: { name: ["abcdef"] } },
        valid: true,
      },
      {
        description: "invalid - short string and too many items",
        data: { inner: { name: ["aasd", "asdfasdfasfd"] } },
        valid: false,
      },
      {
        description: "invalid - too many items only",
        data: { inner: { name: ["abcdef", "ghijkl"] } },
        valid: false,
      },
    ],
  },
  {
    description: "error inheritance",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid - thrown error is instance of Error",
        data: 123,
        valid: false,
        customCheck: () => {
          let zodIsError = false;
          try { z.string().parse(123); } catch (e) { zodIsError = e instanceof Error; }
          let dnaIsError = false;
          try { dna.string().parse(123); } catch (e) { dnaIsError = e instanceof Error; }
          return zodIsError && dnaIsError;
        },
      },
    ],
  },
  {
    description: "error serialization",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid - thrown error can be serialized",
        data: 123,
        valid: false,
        customCheck: () => {
          let zodErr: unknown, dnaErr: unknown;
          try { z.string().parse(123); } catch (e) { zodErr = e; }
          try { dna.string().parse(123); } catch (e) { dnaErr = e; }
          try {
            JSON.stringify(zodErr);
            JSON.stringify(dnaErr);
            return true;
          } catch {
            return false;
          }
        },
      },
    ],
  },
];

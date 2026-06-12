import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const describeMetaChecksTests = [
  {
    description: "string with .describe() check",
    zodSchema: z.string().check(z.describe("A string")),
    dnaSchema: dna.string().check(dna.describe("A string")),
    tests: [
      {
        description: "valid string",
        data: "test",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "number with .meta() check",
    zodSchema: z.number().check(z.meta({ title: "Age", description: "User's age" })),
    dnaSchema: dna.number().check(dna.meta({ title: "Age", description: "User's age" })),
    tests: [
      {
        description: "valid number",
        data: 25,
        valid: true,
      },
      {
        description: "invalid string",
        data: "25",
        valid: false,
      },
    ],
  },
  {
    description: "string with multiple checks including .describe() and .meta()",
    zodSchema: z.string().check(z.describe("Email address"), z.meta({ title: "Email" })),
    dnaSchema: dna.string().check(dna.describe("Email address"), dna.meta({ title: "Email" })),
    tests: [
      {
        description: "valid string",
        data: "test@example.com",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "object with metadata checks on fields",
    zodSchema: z.object({
      email: z.string().check(z.describe("User email"), z.meta({ title: "Email" })),
      age: z.number().check(z.meta({ title: "Age", description: "User's age" })),
    }),
    dnaSchema: dna.object({
      email: dna.string().check(dna.describe("User email"), dna.meta({ title: "Email" })),
      age: dna.number().check(dna.meta({ title: "Age", description: "User's age" })),
    }),
    tests: [
      {
        description: "valid object",
        data: { email: "test@example.com", age: 25 },
        valid: true,
      },
      {
        description: "invalid wrong type for email",
        data: { email: 123, age: 25 },
        valid: false,
      },
      {
        description: "invalid wrong type for age",
        data: { email: "test@example.com", age: "25" },
        valid: false,
      },
    ],
  },
];

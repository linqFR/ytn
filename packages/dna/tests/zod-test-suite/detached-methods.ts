import * as z from "zod";
import { dna } from "../../src/index.js";

export const detachedMethodsTests = [
  {
    description: "detached parse-family methods work",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "parse with detached method",
        data: "hello",
        valid: true,
        customCheck: (zodResult: any, dnaResult: any) => {
          // Test that parse can be called as a detached function
          const zodSchema = z.string();
          const dnaSchema = dna.string();
          const zodParse = zodSchema.parse;
          const dnaParse = dnaSchema.parse;
          
          const zodDetached = zodParse("hello");
          const dnaDetached = dnaParse("hello");
          
          return zodDetached === "hello" && dnaDetached === "hello";
        },
      },
    ],
  },
  {
    description: "detached optional() returns working optional schema",
    zodSchema: z.string().optional(),
    dnaSchema: dna.string().optional(),
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
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "detached nullable() returns working nullable schema",
    zodSchema: z.string().nullable(),
    dnaSchema: dna.string().nullable(),
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
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "detached array() returns working array schema",
    zodSchema: z.string().array(),
    dnaSchema: dna.string().array(),
    tests: [
      {
        description: "valid array of strings",
        data: ["a", "b"],
        valid: true,
      },
      {
        description: "invalid array of numbers",
        data: [1, 2],
        valid: false,
      },
    ],
  },
  {
    description: "detached describe() returns described schema",
    zodSchema: z.string().describe("hello world"),
    dnaSchema: dna.string().describe("hello world"),
    tests: [
      {
        description: "valid string with description",
        data: "hello",
        valid: true,
        customCheck: (zodResult: any, dnaResult: any) => {
          const zodSchema = z.string().describe("hello world");
          const dnaSchema = dna.string().describe("hello world");
          return zodSchema.description === "hello world" && dnaSchema.description === "hello world";
        },
      },
    ],
  },
  {
    description: "detached refine/check still validates",
    zodSchema: z.string().refine((s: string) => s.startsWith("x"), "must start with x"),
    dnaSchema: dna.string().refine((s: string) => s.startsWith("x")),
    tests: [
      {
        description: "valid string starting with x",
        data: "xhello",
        valid: true,
      },
      {
        description: "invalid string not starting with x",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "detached chained calls work - optional then parse",
    zodSchema: z.string().optional(),
    dnaSchema: dna.string().optional(),
    tests: [
      {
        description: "valid string",
        data: "hi",
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
    description: "detached number methods work",
    zodSchema: z.number().min(5).max(10).positive(),
    dnaSchema: dna.number().min(5).max(10).positive(),
    tests: [
      {
        description: "valid number in range",
        data: 7,
        valid: true,
      },
      {
        description: "invalid number too small",
        data: 3,
        valid: false,
      },
      {
        description: "invalid number too large",
        data: 12,
        valid: false,
      },
      {
        description: "invalid negative number",
        data: -1,
        valid: false,
      },
    ],
  },
  {
    description: "detached object methods work",
    zodSchema: z.object({ a: z.string(), b: z.number() }).pick({ a: true }),
    dnaSchema: dna.object({ a: dna.string(), b: dna.number() }).pick({ a: true }),
    tests: [
      {
        description: "valid object with picked field",
        data: { a: "test" },
        valid: true,
      },
      {
        description: "invalid object missing picked field",
        data: {},
        valid: false,
      },
    ],
  },
  {
    description: "detached omit works",
    zodSchema: z.object({ a: z.string(), b: z.number() }).omit({ a: true }),
    dnaSchema: dna.object({ a: dna.string(), b: dna.number() }).omit({ a: true }),
    tests: [
      {
        description: "valid object with omitted field",
        data: { b: 42 },
        valid: true,
      },
      {
        description: "invalid object with omitted field present",
        data: { a: "test", b: 42 },
        valid: false,
      },
    ],
  },
  {
    description: "detached partial works",
    zodSchema: z.object({ a: z.string(), b: z.number() }).partial(),
    dnaSchema: dna.object({ a: dna.string(), b: dna.number() }).partial(),
    tests: [
      {
        description: "valid empty object",
        data: {},
        valid: true,
      },
      {
        description: "valid partial object",
        data: { a: "test" },
        valid: true,
      },
    ],
  },
  {
    description: "detached extend works",
    zodSchema: z.object({ a: z.string() }).extend({ b: z.number() }),
    dnaSchema: dna.object({ a: dna.string() }).extend({ b: dna.number() }),
    tests: [
      {
        description: "valid extended object",
        data: { a: "test", b: 42 },
        valid: true,
      },
      {
        description: "invalid object missing extended field",
        data: { a: "test" },
        valid: false,
      },
    ],
  },
];

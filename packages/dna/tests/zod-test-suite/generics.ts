import * as z from "zod";
import { dna } from "../../src/index.js";

export const genericsTests = [
  {
    description: "generic function wrapping schema",
    zodSchema: z.object({
      nested: z.object({ a: z.string() }),
    }),
    dnaSchema: dna.object({
      nested: dna.object({ a: dna.string() }),
    }),
    tests: [
      {
        description: "valid nested object",
        data: { nested: { a: "test" } },
        valid: true,
      },
      {
        description: "invalid nested object - wrong type",
        data: { nested: { a: 123 } },
        valid: false,
      },
      {
        description: "invalid nested object - missing field",
        data: { nested: {} },
        valid: false,
      },
    ],
  },
  {
    description: "generic with optional nested",
    zodSchema: z.object({
      nested: z.object({ a: z.string() }).optional(),
    }),
    dnaSchema: dna.object({
      nested: dna.object({ a: dna.string() }).optional(),
    }),
    tests: [
      {
        description: "valid nested object",
        data: { nested: { a: "test" } },
        valid: true,
      },
      {
        description: "valid undefined nested",
        data: { nested: undefined },
        valid: true,
      },
      {
        description: "invalid nested object - wrong type",
        data: { nested: { a: 123 } },
        valid: false,
      },
    ],
  },
  {
    description: "nested union - no undefined",
    zodSchema: z.object({
      inner: z.string().or(z.array(z.string())),
    }),
    dnaSchema: dna.object({
      inner: dna.string().or(dna.array(dna.string())),
    }),
    tests: [
      {
        description: "valid string",
        data: { inner: "test" },
        valid: true,
      },
      {
        description: "valid array of strings",
        data: { inner: ["a", "b"] },
        valid: true,
      },
      {
        description: "invalid undefined",
        data: { inner: undefined },
        valid: false,
      },
      {
        description: "invalid number",
        data: { inner: 123 },
        valid: false,
      },
    ],
  },
  {
    description: "generic schema construction",
    zodSchema: z.object({
      name: z.string(),
      age: z.number(),
    }),
    dnaSchema: dna.object({
      name: dna.string(),
      age: dna.number(),
    }),
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
      {
        description: "invalid object - missing field",
        data: { name: "John" },
        valid: false,
      },
    ],
  },
  {
    description: "generic with transform",
    zodSchema: z
      .object({
        nested: z.object({ a: z.string() }).optional(),
      })
      .transform((data) => data.nested),
    dnaSchema: dna
      .object({
        nested: dna.object({ a: dna.string() }).optional(),
      })
      .transform((data) => data.nested),
    tests: [
      {
        description: "valid transform with nested object",
        data: { nested: { a: "test" } },
        valid: true,
      },
      {
        description: "valid transform with undefined",
        data: { nested: undefined },
        valid: true,
      },
    ],
  },
];

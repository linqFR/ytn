import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const applyZod = z.object({ a: z.number(), b: z.string() }).apply((s) => s.omit({ b: true }));
const applyDna = dna.object({ a: dna.number(), b: dna.string() }).apply((s) => s.omit({ b: true }));

export const applyTests = [
  {
    description: "apply basic",
    zodSchema: applyZod,
    dnaSchema: applyDna,
    tests: [
      { description: "valid object", data: { a: 1, b: "test" }, valid: true },
      { description: "invalid missing a", data: { b: "test" }, valid: false },
    ],
  },
  {
    description: "basic apply (number)",
    zodSchema: z.number().apply((s) => s.min(0).max(100)).nullable(),
    dnaSchema: dna.number().apply((s) => s.min(0).max(100)).nullable(),
    tests: [
      { description: "valid number in range", data: 0, valid: true },
      { description: "valid null", data: null, valid: true },
      { description: "invalid negative number", data: -1, valid: false },
      { description: "invalid number too large", data: 101, valid: false },
    ],
  },
  {
    description: "apply forwards extra args to callback",
    zodSchema: z.string().apply((schema, defaultValue) => schema.nullish().transform((x) => x ?? defaultValue), "default-id"),
    dnaSchema: dna.string().apply((schema, defaultValue) => schema.nullish().transform((x) => x ?? defaultValue), "default-id"),
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
      { description: "valid null uses default", data: null, valid: true },
      { description: "valid string value", data: "value", valid: true },
    ],
  },
];

import { z } from "zod";
import { dna } from "../../src/builder/index.js";

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
];

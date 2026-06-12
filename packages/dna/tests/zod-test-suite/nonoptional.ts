import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const nonoptionalZod = z.string().nonoptional();
const nonoptionalDna = dna.string().nonoptional();

const nonoptionalWithDefaultZod = z.string().optional().nonoptional();
const nonoptionalWithDefaultDna = dna.string().optional().nonoptional();

const nonoptionalInObjectZod = z.object({ hi: z.string().optional().nonoptional() });
const nonoptionalInObjectDna = dna.object({ hi: dna.string().optional().nonoptional() });

export const nonoptionalTests = [
  {
    description: "nonoptional basic",
    zodSchema: nonoptionalZod,
    dnaSchema: nonoptionalDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid undefined", data: undefined, valid: false },
    ],
  },
  {
    description: "nonoptional with default",
    zodSchema: nonoptionalWithDefaultZod,
    dnaSchema: nonoptionalWithDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid undefined", data: undefined, valid: false },
    ],
  },
  {
    description: "nonoptional in object",
    zodSchema: nonoptionalInObjectZod,
    dnaSchema: nonoptionalInObjectDna,
    tests: [
      { description: "valid with value", data: { hi: "asdf" }, valid: true },
      { description: "invalid with undefined", data: { hi: undefined }, valid: false },
      { description: "invalid missing key", data: {}, valid: false },
    ],
  },
];

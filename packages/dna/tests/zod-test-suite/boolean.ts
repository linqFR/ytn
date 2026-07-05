import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const booleanZod = z.boolean();
const booleanDna = dna.boolean();

export const booleanTests = [
  {
    description: "boolean basic",
    zodSchema: booleanZod,
    dnaSchema: booleanDna,
    tests: [
      { description: "valid true", data: true, valid: true },
      { description: "valid false", data: false, valid: true },
      { description: "invalid string", data: "true", valid: false },
      { description: "invalid number", data: 1, valid: false },
      { description: "invalid null", data: null, valid: false },
    ],
  },
];

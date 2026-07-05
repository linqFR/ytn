import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const anyZod = z.any();
const anyDna = dna.any();

export const anyTests = [
  {
    description: "any basic",
    zodSchema: anyZod,
    dnaSchema: anyDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid number", data: 123, valid: true },
      { description: "valid boolean", data: true, valid: true },
      { description: "valid null", data: null, valid: true },
      { description: "valid undefined", data: undefined, valid: true },
      { description: "valid object", data: {}, valid: true },
      { description: "valid array", data: [], valid: true },
    ],
  },
];

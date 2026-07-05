import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const unknownZod = z.unknown();
const unknownDna = dna.unknown();

export const unknownTests = [
  {
    description: "unknown basic",
    zodSchema: unknownZod,
    dnaSchema: unknownDna,
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

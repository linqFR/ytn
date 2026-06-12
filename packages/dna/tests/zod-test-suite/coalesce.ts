import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const coalesceZod = z.string().optional().default("hi");
const coalesceDna = dna.string().optional().default("hi");

export const coalesceTests = [
  {
    description: "coalesce basic",
    zodSchema: coalesceZod,
    dnaSchema: coalesceDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
      { description: "invalid null", data: null, valid: false },
    ],
  },
];

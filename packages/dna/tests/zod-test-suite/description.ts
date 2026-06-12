import { z } from "zod";
import { dna } from "../../src/builder/index.js";

export const descriptionTests = [
  {
    description: "description basic",
    zodSchema: z.string().describe("a description"),
    dnaSchema: dna.string().describe("a description"),
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
];

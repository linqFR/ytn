import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const voidZod = z.void();
const voidDna = dna.void();

export const voidTests = [
  {
    description: "void type",
    zodSchema: voidZod,
    dnaSchema: voidDna,
    tests: [
      { description: "valid undefined", data: undefined, valid: true },
      { description: "invalid null", data: null, valid: false },
      { description: "invalid empty string", data: "", valid: false },
      { description: "invalid string", data: "test", valid: false },
      { description: "invalid number", data: 0, valid: false },
    ],
  },
];

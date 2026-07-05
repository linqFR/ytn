import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const nanZod = z.nan();
const nanDna = dna.nan();

export const nanTests = [
  {
    description: "nan basic",
    zodSchema: nanZod,
    dnaSchema: nanDna,
    tests: [
      { description: "valid NaN", data: Number.NaN, valid: true },
      { description: "valid NaN from string", data: Number("Not a number"), valid: true },
      { description: "invalid number", data: 5, valid: false },
      { description: "invalid string", data: "John", valid: false },
      { description: "invalid boolean", data: true, valid: false },
      { description: "invalid null", data: null, valid: false },
      { description: "invalid undefined", data: undefined, valid: false },
      { description: "invalid object", data: {}, valid: false },
      { description: "invalid array", data: [], valid: false },
    ],
  },
];

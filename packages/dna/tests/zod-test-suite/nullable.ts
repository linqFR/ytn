import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const nullableZod = z.string().nullable();
const nullableDna = dna.string().nullable();

const nullZod = z.null();
const nullDna = dna.null();

export const nullableTests = [
  {
    description: ".nullable()",
    zodSchema: nullableZod,
    dnaSchema: nullableDna,
    tests: [
      { description: "valid null", data: null, valid: true },
      { description: "valid string", data: "asdf", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "z.null",
    zodSchema: nullZod,
    dnaSchema: nullDna,
    tests: [
      { description: "valid null", data: null, valid: true },
      { description: "invalid string", data: "asdf", valid: false },
    ],
  },
];

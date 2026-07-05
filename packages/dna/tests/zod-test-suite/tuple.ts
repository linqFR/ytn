import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const testTupleZod = z.tuple([z.string(), z.number()]);
const testTupleDna = dna.tuple([dna.string(), dna.number()]);

const asyncTupleZod = z
  .tuple([z.string().refine(async () => true), z.number().refine(async () => true)])
  .refine(async () => true);
const asyncTupleDna = dna
  .tuple([dna.string().refine(async () => true), dna.number().refine(async () => true)])
  .refine(async () => true);

export const tupleTests = [
  {
    description: "successful validation",
    zodSchema: testTupleZod,
    dnaSchema: testTupleDna,
    tests: [
      { description: "valid tuple", data: ["asdf", 1234], valid: true },
      { description: "invalid wrong type at index 1", data: ["asdf", "asdf"], valid: false },
      { description: "invalid too many items", data: ["asdf", 1234, true], valid: false },
      { description: "invalid not array", data: {}, valid: false },
    ],
  },
  {
    description: "async validation",
    zodSchema: asyncTupleZod,
    dnaSchema: asyncTupleDna,
    tests: [
      { description: "valid tuple", data: ["asdf", 1234], valid: true },
      { description: "invalid wrong type at index 1", data: ["asdf", "asdf"], valid: false },
      { description: "invalid too many items", data: ["asdf", 1234, true], valid: false },
    ],
  },
];

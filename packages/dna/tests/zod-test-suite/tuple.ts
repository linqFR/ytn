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

// Tuple with rest (Zod v4 supports .rest(), DNA supports both 2nd arg and .rest() method)
const restTupleZod = z.tuple([z.string()]).rest(z.number());
const restTupleDna = dna.tuple([dna.string()]).rest(dna.number());

// Tuple with min/max/length constraints (DNA advantage — Zod v4 tuples don't have these)
const minTupleDna = dna.tuple([dna.string()]).rest(dna.number()).min(3);
const maxTupleDna = dna.tuple([dna.string()]).rest(dna.number()).max(3);
const lengthTupleDna = dna.tuple([dna.string()]).rest(dna.number()).length(3);

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
  {
    description: "tuple with rest",
    zodSchema: restTupleZod,
    dnaSchema: restTupleDna,
    tests: [
      { description: "valid prefix only", data: ["a"], valid: true },
      { description: "valid prefix + rest items", data: ["a", 1, 2, 3], valid: true },
      { description: "invalid rest item type", data: ["a", "b"], valid: false },
      { description: "invalid empty array", data: [], valid: false },
    ],
  },
  {
    description: "tuple with rest + min constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: minTupleDna,
    tests: [
      { description: "valid: 3 items (prefix + 2 rest)", data: ["a", 1, 2], valid: true },
      { description: "valid: 4 items (prefix + 3 rest)", data: ["a", 1, 2, 3], valid: true },
      { description: "invalid: only 2 items (below min)", data: ["a", 1], valid: false },
      { description: "invalid: only prefix (below min)", data: ["a"], valid: false },
    ],
  },
  {
    description: "tuple with rest + max constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: maxTupleDna,
    tests: [
      { description: "valid: prefix only", data: ["a"], valid: true },
      { description: "valid: 3 items (at max)", data: ["a", 1, 2], valid: true },
      { description: "invalid: 4 items (above max)", data: ["a", 1, 2, 3], valid: false },
    ],
  },
  {
    description: "tuple with rest + length constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: lengthTupleDna,
    tests: [
      { description: "valid: exactly 3 items", data: ["a", 1, 2], valid: true },
      { description: "invalid: 2 items", data: ["a", 1], valid: false },
      { description: "invalid: 4 items", data: ["a", 1, 2, 3], valid: false },
    ],
  },
];

import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const functionParsingZod = z.union([z.string().refine(() => false), z.number().refine(() => false)]);
const functionParsingDna = dna.union([dna.string().refine(() => false), dna.number().refine(() => false)]);

const union2Zod = z.union([z.number(), z.string().refine(() => false)]);
const union2Dna = dna.union([dna.number(), dna.string().refine(() => false)]);

const returnValidOverInvalidZod = z.union([
  z.object({
    email: z.string().email(),
  }),
  z.string(),
]);
const returnValidOverInvalidDna = dna.union([
  dna.object({
    email: dna.string().email(),
  }),
  dna.string(),
]);

const returnErrorsFromBothZod = z.union([z.number(), z.boolean()]);
const returnErrorsFromBothDna = dna.union([dna.number(), dna.boolean()]);

const readonlyUnionZod = z.union([z.string(), z.number()] as const);
const readonlyUnionDna = dna.union([dna.string(), dna.number()]);

const nonAbortedErrorsZod = z.union([
  z.object({
    date: z.number(),
    startDate: z.optional(z.null()),
    endDate: z.optional(z.null()),
  }),
  z
    .object({
      date: z.optional(z.null()),
      startDate: z.number(),
      endDate: z.number(),
    })
    .refine((data) => data.startDate !== data.endDate, {
      error: "startDate and endDate must be different",
      path: ["endDate"],
    }),
]);
const nonAbortedErrorsDna = dna.union([
  dna.object({
    date: dna.number(),
    startDate: dna.optional(dna.null()),
    endDate: dna.optional(dna.null()),
  }),
  dna
    .object({
      date: dna.optional(dna.null()),
      startDate: dna.number(),
      endDate: dna.number(),
    })
    .refine((data) => data.startDate !== data.endDate, {
      error: "startDate and endDate must be different",
      path: ["endDate"],
    }),
]);

const surfaceContinuableErrorsZod = z.union([z.boolean(), z.uuid(), z.jwt()]);
const surfaceContinuableErrorsDna = dna.union([dna.boolean(), dna.uuid(), dna.jwt()]);

const emptyUnionZod = z.union([]);
const emptyUnionDna = dna.union([]);

// z.xor() - exclusive union (exactly one option must match)
const xorTwoZod = z.xor([z.string(), z.number()]);
const xorTwoDna = dna.string().xor(dna.number());

const xorMultipleMatchZod = z.xor([z.string(), z.any()]);
const xorMultipleMatchDna = dna.string().xor(dna.any());

export const unionTests = [
  {
    description: "function parsing",
    zodSchema: functionParsingZod,
    dnaSchema: functionParsingDna,
    tests: [
      { description: "invalid string with refine", data: "asdf", valid: false },
    ],
  },
  {
    description: "union 2",
    zodSchema: union2Zod,
    dnaSchema: union2Dna,
    tests: [
      { description: "invalid string with refine", data: "a", valid: false },
    ],
  },
  {
    description: "return valid over invalid",
    zodSchema: returnValidOverInvalidZod,
    dnaSchema: returnValidOverInvalidDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "valid object with email", data: { email: "asdlkjf@lkajsdf.com" }, valid: true },
    ],
  },
  {
    description: "return errors from both union arms",
    zodSchema: returnErrorsFromBothZod,
    dnaSchema: returnErrorsFromBothDna,
    tests: [
      { description: "invalid string", data: "a", valid: false },
    ],
  },
  {
    description: "readonly union",
    zodSchema: readonlyUnionZod,
    dnaSchema: readonlyUnionDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "valid number", data: 12, valid: true },
    ],
  },
  {
    description: "non-aborted errors",
    zodSchema: nonAbortedErrorsZod,
    dnaSchema: nonAbortedErrorsDna,
    tests: [
      { description: "invalid equal dates", data: { date: null, startDate: 1, endDate: 1 }, valid: false },
    ],
  },
  {
    description: "surface continuable errors only if they exist",
    zodSchema: surfaceContinuableErrorsZod,
    dnaSchema: surfaceContinuableErrorsDna,
    tests: [
      { description: "invalid string", data: "asdf", valid: false },
    ],
  },
  {
    description: "z.union([]) rejects all input",
    zodSchema: emptyUnionZod,
    dnaSchema: emptyUnionDna,
    tests: [
      { description: "invalid string", data: "anything", valid: false },
      { description: "invalid number", data: 42, valid: false },
    ],
  },
  {
    description: "z.xor() - exactly one match succeeds",
    zodSchema: xorTwoZod,
    dnaSchema: xorTwoDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid number", data: 42, valid: true },
      { description: "invalid boolean (zero matches)", data: true, valid: false },
    ],
  },
  {
    description: "z.xor() - multiple matches fails",
    zodSchema: xorMultipleMatchZod,
    dnaSchema: xorMultipleMatchDna,
    tests: [
      { description: "invalid string (matches both string and any)", data: "hello", valid: false },
    ],
  },
];

import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod validate() runtime tests
const stringZod = z.string();
const stringDna = dna.string();

const intMin0Zod = z.number().int().min(0);
const intMin0Dna = dna.number().int().min(0);

const objectZod = z.object({ a: z.string(), b: z.array(z.number()) });
const objectDna = dna.object({ a: dna.string(), b: dna.array(dna.number()) });

const transformPipeZod = z.string().transform((s) => s.length).pipe(z.number().max(3));
const transformPipeDna = dna.string().transform((s: string) => s.length).pipe(dna.number().max(3));

const coerceNumberZod = z.coerce.number();
const coerceNumberDna = dna.coerce.number();

const asyncRefineZod = z.string().refine(async (s) => s.length > 2);
const asyncRefineDna = dna.string().refine(async (s: string) => s.length > 2);

export const validateTests = [
  {
    description: "validate answers like safeParse.success - string",
    zodSchema: stringZod,
    dnaSchema: stringDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "invalid number", data: 12, valid: false },
    ],
  },
  {
    description: "validate answers like safeParse.success - int min 0",
    zodSchema: intMin0Zod,
    dnaSchema: intMin0Dna,
    tests: [
      { description: "valid positive int", data: 5, valid: true },
      { description: "invalid negative int", data: -5, valid: false },
    ],
  },
  {
    description: "validate answers like safeParse.success - object",
    zodSchema: objectZod,
    dnaSchema: objectDna,
    tests: [
      { description: "valid object", data: { a: "x", b: [1, 2] }, valid: true },
      { description: "invalid mixed array", data: { a: "x", b: [1, "2"] }, valid: false },
      { description: "invalid null", data: null, valid: false },
    ],
  },
  {
    description: "validate runs transforms and refinements for the verdict only",
    zodSchema: transformPipeZod,
    dnaSchema: transformPipeDna,
    tests: [
      { description: "valid short string", data: "ab", valid: true },
      { description: "invalid long string", data: "abcd", valid: false },
    ],
  },
  {
    description: "validate with coerce number",
    zodSchema: coerceNumberZod,
    dnaSchema: coerceNumberDna,
    tests: [
      { description: "valid coerced string", data: "5", valid: true },
    ],
  },
  {
    description: "validate async refine - valid",
    zodSchema: asyncRefineZod,
    dnaSchema: asyncRefineDna,
    tests: [
      { description: "valid long string", data: "asdf", valid: true },
    ],
  },
  {
    description: "validate async refine - invalid",
    zodSchema: asyncRefineZod,
    dnaSchema: asyncRefineDna,
    tests: [
      { description: "invalid short string", data: "a", valid: false },
    ],
  },
];

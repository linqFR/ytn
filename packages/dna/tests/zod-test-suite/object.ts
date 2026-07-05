import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const TestZod = z.object({
  f1: z.number(),
  f2: z.string().optional(),
  f3: z.string().nullable(),
  f4: z.array(z.object({ t: z.union([z.string(), z.boolean()]) })),
});

const TestDna = dna.object({
  f1: dna.number(),
  f2: dna.string().optional(),
  f3: dna.string().nullable(),
  f4: dna.array(dna.object({ t: dna.union([dna.string(), dna.boolean()]) })),
});

const nonstrictZod = z.object({ points: z.number() });
const nonstrictDna = dna.object({ points: dna.number() });

const optionalKeyZod = z.object({ a: z.string().optional() });
const optionalKeyDna = dna.object({ a: dna.string().optional() });

const emptyObjectZod = z.object({});
const emptyObjectDna = dna.object({});

const passthroughZod = z.object({ points: z.number() }).passthrough();
const passthroughDna = dna.object({ points: dna.number() }).passthrough();

const strictZod = z.object({ points: z.number() }).strict();
const strictDna = dna.object({ points: dna.number() }).strict();

const catchallZod = z.object({ name: z.string() }).catchall(z.number());
const catchallDna = dna.object({ name: dna.string() }).catchall(dna.number());

const strictObjectZod = z.strictObject({ name: z.string() });
const strictObjectDna = dna.strictObject({ name: dna.string() });

const looseObjectZod = z.looseObject({ name: z.string() });
const looseObjectDna = dna.looseObject({ name: dna.string() });

export const objectTests = [
  {
    description: "unknown throw",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      { description: "invalid unknown", data: 35, valid: false },
    ],
  },
  {
    description: "correct parsing - with all fields",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      {
        description: "valid complete object",
        data: {
          f1: 12,
          f2: "string",
          f3: "string",
          f4: [{ t: "string" }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "correct parsing - with null",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      {
        description: "valid with null",
        data: {
          f1: 12,
          f3: null,
          f4: [{ t: false }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "nonstrict by default",
    zodSchema: nonstrictZod,
    dnaSchema: nonstrictDna,
    tests: [
      {
        description: "valid with unknown property",
        data: { points: 2314, unknown: "asdf" },
        valid: true,
      },
    ],
  },
  {
    description: "parse optional keys",
    zodSchema: optionalKeyZod,
    dnaSchema: optionalKeyDna,
    tests: [
      { description: "valid with a", data: { a: "asdf" }, valid: true },
    ],
  },
  {
    description: "empty object",
    zodSchema: emptyObjectZod,
    dnaSchema: emptyObjectDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid with properties (stripped)", data: { name: "asdf" }, valid: true },
      { description: "invalid null", data: null, valid: false },
      { description: "invalid string", data: "asdf", valid: false },
    ],
  },
  {
    description: "strip by default",
    zodSchema: nonstrictZod,
    dnaSchema: nonstrictDna,
    tests: [
      { description: "valid with unknown (stripped)", data: { points: 2314, unknown: "asdf" }, valid: true },
    ],
  },
  {
    description: "passthrough unknown",
    zodSchema: passthroughZod,
    dnaSchema: passthroughDna,
    tests: [
      { description: "valid with unknown (preserved)", data: { points: 2314, unknown: "asdf" }, valid: true },
    ],
  },
  {
    description: "strict",
    zodSchema: strictZod,
    dnaSchema: strictDna,
    tests: [
      { description: "invalid with unknown", data: { points: 2314, unknown: "asdf" }, valid: false },
    ],
  },
  {
    description: "catchall parsing",
    zodSchema: catchallZod,
    dnaSchema: catchallDna,
    tests: [
      { description: "valid with extra number", data: { name: "Foo", validExtraKey: 61 }, valid: true },
      { description: "invalid with extra string", data: { name: "Foo", validExtraKey: 61, invalid: "asdf" }, valid: false },
    ],
  },
  {
    description: "strictObject",
    zodSchema: strictObjectZod,
    dnaSchema: strictObjectDna,
    tests: [
      { description: "valid", data: { name: "asdf" }, valid: true },
      { description: "invalid with unexpected", data: { name: "asdf", unexpected: 13 }, valid: false },
    ],
  },
  {
    description: "looseObject",
    zodSchema: looseObjectZod,
    dnaSchema: looseObjectDna,
    tests: [
      { description: "valid", data: { name: "asdf" }, valid: true },
      { description: "valid with unknown", data: { name: "asdf", unknown: 13 }, valid: true },
    ],
  },
];

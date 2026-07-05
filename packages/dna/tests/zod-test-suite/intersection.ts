import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const AZod = z.object({ a: z.string() });
const ADna = dna.object({ a: dna.string() });

const BZod = z.object({ b: z.string() });
const BDna = dna.object({ b: dna.string() });

const CZod = z.intersection(AZod, BZod);
const CDna = dna.intersection(ADna, BDna);

const ALooseZod = z.looseObject({ a: z.string() });
const ALooseDna = dna.looseObject({ a: dna.string() });

const CLooseZod = z.intersection(ALooseZod, BZod);
const CLooseDna = dna.intersection(ALooseDna, BDna);

const AStrictZod = z.strictObject({ a: z.string() });
const AStrictDna = dna.strictObject({ a: dna.string() });

const BStrictZod = z.strictObject({ b: z.string() });
const BStrictDna = dna.strictObject({ b: dna.string() });

const CStrictStripZod = z.intersection(AStrictZod, BZod);
const CStrictStripDna = dna.intersection(AStrictDna, BDna);

const CStrictStrictZod = z.intersection(AStrictZod, BStrictZod);
const CStrictStrictDna = dna.intersection(AStrictDna, BStrictDna);

const AnimalZod = z.object({
  properties: z.object({
    is_animal: z.boolean(),
  }),
});
const AnimalDna = dna.object({
  properties: dna.object({
    is_animal: dna.boolean(),
  }),
});

const CatZod = z.intersection(
  z.object({
    properties: z.object({
      jumped: z.boolean(),
    }),
  }),
  AnimalZod
);
const CatDna = dna.intersection(
  dna.object({
    properties: dna.object({
      jumped: dna.boolean(),
    }),
  }),
  AnimalDna
);

export const intersectionTests = [
  {
    description: "object intersection",
    zodSchema: CZod,
    dnaSchema: CDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "foo" }, valid: true },
      { description: "invalid missing a", data: { a: "foo" }, valid: false },
    ],
  },
  {
    description: "object intersection: loose",
    zodSchema: CLooseZod,
    dnaSchema: CLooseDna,
    tests: [
      { description: "valid with extra property", data: { a: "foo", b: "foo", c: "extra" }, valid: true },
      { description: "invalid missing b", data: { a: "foo" }, valid: false },
    ],
  },
  {
    description: "object intersection: strict + strip",
    zodSchema: CStrictStripZod,
    dnaSchema: CStrictStripDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "bar" }, valid: true },
      { description: "valid with extra (stripped)", data: { a: "foo", b: "bar", c: "extra" }, valid: true },
    ],
  },
  {
    description: "object intersection: strict + strict",
    zodSchema: CStrictStrictZod,
    dnaSchema: CStrictStrictDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "bar" }, valid: true },
      { description: "invalid with extra property", data: { a: "foo", b: "bar", c: "extra" }, valid: false },
    ],
  },
  {
    description: "deep intersection",
    zodSchema: CatZod,
    dnaSchema: CatDna,
    tests: [
      { description: "valid nested properties", data: { properties: { is_animal: true, jumped: true } }, valid: true },
    ],
  },
];

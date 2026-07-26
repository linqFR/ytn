import { z } from "zod";
import { dna } from "../../src/index.js";

const personToExtendZod = z.object({
  firstName: z.string(),
  lastName: z.string(),
});
const PersonWithMinLastNameZod = personToExtendZod.safeExtend({
  lastName: z.string().min(3),
});

const personToExtendDna = dna.object({
  firstName: dna.string(),
  lastName: dna.string(),
});
const PersonWithMinLastNameDna = personToExtendDna.safeExtend({
  lastName: dna.string().min(3),
});

const maintainRefinementsZod = z.object({ name: z.string().min(1) }).safeExtend({
  name: z.string().min(2),
});
const maintainRefinementsDna = dna.object({ name: dna.string().min(1) }).safeExtend({
  name: dna.string().min(2),
});

const schema1Zod = z.object({ email: z.string() });
const schema2Zod = schema1Zod.safeExtend({ email: schema1Zod.shape.email.email() });
const schema3Zod = schema2Zod.safeExtend({
  email: schema2Zod.shape.email.or(z.literal("")),
});

const schema1Dna = dna.object({ email: dna.string() });
const schema2Dna = schema1Dna.safeExtend({ email: schema1Dna.shape.email.email() });
const schema3Dna = schema2Dna.safeExtend({
  email: dna.union([schema2Dna.shape.email, dna.literal("")]),
});

export const safeExtendTests = [
  {
    description: "safeExtend overrides an existing key with a narrower schema",
    zodSchema: PersonWithMinLastNameZod,
    dnaSchema: PersonWithMinLastNameDna,
    tests: [
      { description: "valid lastName with min 3", data: { firstName: "f", lastName: "abc" }, valid: true },
      { description: "invalid lastName too short", data: { firstName: "f", lastName: "ab" }, valid: false },
    ],
  },
  {
    description: "safeExtend maintains refinements when overriding",
    zodSchema: maintainRefinementsZod,
    dnaSchema: maintainRefinementsDna,
    tests: [
      { description: "valid name with min 2", data: { name: "ab" }, valid: true },
      { description: "invalid name too short", data: { name: "" }, valid: false },
    ],
  },
  {
    description: "safeExtend chains preserving and overriding properties",
    zodSchema: schema3Zod,
    dnaSchema: schema3Dna,
    tests: [
      { description: "valid email", data: { email: "test@example.com" }, valid: true },
      { description: "valid empty literal", data: { email: "" }, valid: true },
      { description: "invalid non-email non-empty", data: { email: "not-an-email" }, valid: false },
    ],
  },
];

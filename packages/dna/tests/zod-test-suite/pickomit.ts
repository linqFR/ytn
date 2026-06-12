import * as z from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const pickSingleZod = z
  .object({
    name: z.string(),
    age: z.number(),
    nested: z.object({}),
  })
  .pick({ name: true });
const pickSingleDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    nested: dna.object({}),
  })
  .pick({ name: true });

const pickMultipleZod = z
  .object({
    name: z.string(),
    age: z.number(),
    email: z.string(),
  })
  .pick({ name: true, age: true });
const pickMultipleDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    email: dna.string(),
  })
  .pick({ name: true, age: true });

const omitSingleZod = z
  .object({
    name: z.string(),
    age: z.number(),
    nested: z.object({}),
  })
  .omit({ name: true });
const omitSingleDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    nested: dna.object({}),
  })
  .omit({ name: true });

const omitMultipleZod = z
  .object({
    name: z.string(),
    age: z.number(),
    email: z.string(),
    phone: z.string(),
  })
  .omit({ name: true, age: true });
const omitMultipleDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    email: dna.string(),
    phone: dna.string(),
  })
  .omit({ name: true, age: true });

const pickOptionalZod = z
  .object({
    a: z.string(),
    b: z.string().optional(),
  })
  .pick({ a: true });
const pickOptionalDna = dna
  .object({
    a: dna.string(),
    b: dna.string().optional(),
  })
  .pick({ a: true });

const omitOptionalZod = z
  .object({
    a: z.string(),
    b: z.string().optional(),
  })
  .omit({ a: true });
const omitOptionalDna = dna
  .object({
    a: dna.string(),
    b: dna.string().optional(),
  })
  .omit({ a: true });

const pickPassthroughZod = z
  .looseObject({
    name: z.string(),
    age: z.number(),
  })
  .passthrough()
  .pick({ name: true });
const pickPassthroughDna = dna
  .looseObject({
    name: dna.string(),
    age: dna.number(),
  })
  .passthrough()
  .pick({ name: true });

export const pickomitTests = [
  {
    description: "pick - single key",
    zodSchema: pickSingleZod,
    dnaSchema: pickSingleDna,
    tests: [
      { description: "valid with picked key", data: { name: "bob" }, valid: true },
      { description: "invalid missing picked key", data: {}, valid: false },
      { description: "invalid wrong type for picked key", data: { name: 123 }, valid: false },
    ],
  },
  {
    description: "pick - multiple keys",
    zodSchema: pickMultipleZod,
    dnaSchema: pickMultipleDna,
    tests: [
      { description: "valid with all picked keys", data: { name: "bob", age: 30 }, valid: true },
      { description: "invalid missing one picked key", data: { name: "bob" }, valid: false },
    ],
  },
  {
    description: "omit - single key",
    zodSchema: omitSingleZod,
    dnaSchema: omitSingleDna,
    tests: [
      { description: "valid with remaining keys", data: { age: 30, nested: {} }, valid: true },
      { description: "invalid missing required key", data: { age: 30 }, valid: false },
      { description: "invalid includes omitted key", data: { name: "bob", age: 30, nested: {} }, valid: false },
    ],
  },
  {
    description: "omit - multiple keys",
    zodSchema: omitMultipleZod,
    dnaSchema: omitMultipleDna,
    tests: [
      { description: "valid with remaining keys", data: { email: "test@test.com", phone: "123" }, valid: true },
      { description: "invalid missing one remaining key", data: { email: "test@test.com" }, valid: false },
    ],
  },
  {
    description: "pick with optional field",
    zodSchema: pickOptionalZod,
    dnaSchema: pickOptionalDna,
    tests: [
      { description: "valid with picked key", data: { a: "test" }, valid: true },
      { description: "invalid missing picked key", data: {}, valid: false },
    ],
  },
  {
    description: "omit with optional field",
    zodSchema: omitOptionalZod,
    dnaSchema: omitOptionalDna,
    tests: [
      { description: "valid with remaining optional field", data: {}, valid: true },
      { description: "valid with optional field present", data: { b: "test" }, valid: true },
    ],
  },
  {
    description: "pick with passthrough",
    zodSchema: pickPassthroughZod,
    dnaSchema: pickPassthroughDna,
    tests: [
      { description: "valid with picked key and extra", data: { name: "asdf", whatever: "asdf" }, valid: true },
      { description: "valid with picked key only", data: { name: "asdf" }, valid: true },
    ],
  },
];

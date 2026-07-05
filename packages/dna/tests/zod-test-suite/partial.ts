import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const shallowPartialZod = z
  .object({
    name: z.string(),
    age: z.number(),
    outer: z.object({
      inner: z.string(),
    }),
    array: z.array(z.object({ asdf: z.string() })),
  })
  .partial();
const shallowPartialDna = dna
  .object({
    name: dna.string(),
    age: dna.number(),
    outer: dna.object({
      inner: dna.string(),
    }),
    array: dna.array(dna.object({ asdf: dna.string() })),
  })
  .partial();

const requiredZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    nullableField: z.number().nullable(),
    nullishField: z.string().nullish(),
  })
  .required();
const requiredDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    nullableField: dna.number().nullable(),
    nullishField: dna.string().nullish(),
  })
  .required();

const partialMaskZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    country: z.string(),
  })
  .partial({ age: true, field: true, name: true });
const partialMaskDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    country: dna.string(),
  })
  .partial({ age: true, field: true, name: true });

const requiredMaskZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    field: z.string().optional().default("asdf"),
    country: z.string().optional(),
  })
  .required({ age: true });
const requiredMaskDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    field: dna.string().optional().default("asdf"),
    country: dna.string().optional(),
  })
  .required({ age: true });

const partialDefaultsZod = z
  .object({
    a: z.string().catch("catch value").optional(),
    b: z.string().default("default value").optional(),
    c: z.string().prefault("prefault value").optional(),
    d: z.string().catch("catch value"),
    e: z.string().default("default value"),
    f: z.string().prefault("prefault value"),
  })
  .partial();
const partialDefaultsDna = dna
  .object({
    a: dna.string().catch("catch value").optional(),
    b: dna.string().default("default value").optional(),
    c: dna.string().prefault("prefault value").optional(),
    d: dna.string().catch("catch value"),
    e: dna.string().default("default value"),
    f: dna.string().prefault("prefault value"),
  })
  .partial();

const partialNullableZod = z
  .object({
    name: z.string(),
    age: z.number().optional(),
    nullableField: z.number().nullable(),
  })
  .partial();
const partialNullableDna = dna
  .object({
    name: dna.string(),
    age: dna.number().optional(),
    nullableField: dna.number().nullable(),
  })
  .partial();

export const partialTests = [
  {
    description: "shallow partial - all fields optional",
    zodSchema: shallowPartialZod,
    dnaSchema: shallowPartialDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          outer: { inner: "value" },
          array: [{ asdf: "test" }],
        },
        valid: true,
      },
      { description: "valid with partial fields", data: { name: "John", age: 30 }, valid: true },
    ],
  },
  {
    description: "required - all fields required",
    zodSchema: requiredZod,
    dnaSchema: requiredDna,
    tests: [
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: 42,
          nullishField: "test",
        },
        valid: true,
      },
      {
        description: "valid with null nullable field",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: null,
          nullishField: "test",
        },
        valid: true,
      },
      {
        description: "valid with null nullish field",
        data: {
          name: "John",
          age: 30,
          field: "test",
          nullableField: 42,
          nullishField: null,
        },
        valid: true,
      },
      { description: "invalid missing required field", data: { age: 30 }, valid: false },
    ],
  },
  {
    description: "partial with mask - specific fields optional",
    zodSchema: partialMaskZod,
    dnaSchema: partialMaskDna,
    tests: [
      { description: "valid with only country", data: { country: "US" }, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          country: "US",
        },
        valid: true,
      },
      { description: "invalid missing required country", data: { name: "John" }, valid: false },
    ],
  },
  {
    description: "required with mask - specific fields required",
    zodSchema: requiredMaskZod,
    dnaSchema: requiredMaskDna,
    tests: [
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          field: "test",
          country: "US",
        },
        valid: true,
      },
      { description: "valid with required age", data: { name: "John", age: 30 }, valid: true },
      { description: "invalid missing required age", data: { name: "John" }, valid: false },
    ],
  },
  {
    description: "partial with default values",
    zodSchema: partialDefaultsZod,
    dnaSchema: partialDefaultsDna,
    tests: [
      { description: "valid empty object (defaults applied)", data: {}, valid: true },
      {
        description: "valid with all fields",
        data: {
          a: "test",
          b: "test",
          c: "test",
          d: "test",
          e: "test",
          f: "test",
        },
        valid: true,
      },
    ],
  },
  {
    description: "partial with nullable",
    zodSchema: partialNullableZod,
    dnaSchema: partialNullableDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      { description: "valid with null nullable field", data: { nullableField: null }, valid: true },
      {
        description: "valid with all fields",
        data: {
          name: "John",
          age: 30,
          nullableField: 42,
        },
        valid: true,
      },
    ],
  },
];

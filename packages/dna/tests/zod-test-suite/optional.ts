import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const optionalZod = z.string().optional();
const optionalDna = dna.string().optional();

const defaultZod = z.string().default("asdf");
const defaultDna = dna.string().default("asdf");

const optionalNullableZod = z.string().optional().nullable();
const optionalNullableDna = dna.string().optional().nullable();

const defaultNullableZod = z.string().default("asdf").nullable();
const defaultNullableDna = dna.string().default("asdf").nullable();

const exactOptionalZod = z.string().exactOptional();
const exactOptionalDna = dna.string().exactOptional();

const exactOptionalObjectZod = z.object({
  a: z.string().exactOptional(),
});
const exactOptionalObjectDna = dna.object({
  a: dna.string().exactOptional(),
});

const optionalObjectZod = z.object({ a: z.string().optional() });
const optionalObjectDna = dna.object({ a: dna.string().optional() });

const defaultedObjectZod = z.object({ value: z.string().default("fallback") });
const defaultedObjectDna = dna.object({ value: dna.string().default("fallback") });

export const optionalTests = [
  {
    description: ".optional()",
    zodSchema: optionalZod,
    dnaSchema: optionalDna,
    tests: [
      { description: "valid string", data: "adsf", valid: true },
      { description: "valid undefined", data: undefined, valid: true },
      { description: "invalid null", data: null, valid: false },
    ],
  },
  {
    description: "default behaves as optional input",
    zodSchema: defaultZod,
    dnaSchema: defaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "optional with nullable",
    zodSchema: optionalNullableZod,
    dnaSchema: optionalNullableDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined", data: undefined, valid: true },
      { description: "valid null", data: null, valid: true },
    ],
  },
  {
    description: "default with nullable",
    zodSchema: defaultNullableZod,
    dnaSchema: defaultNullableDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined", data: undefined, valid: true },
      { description: "valid null", data: null, valid: true },
    ],
  },
  {
    description: ".exactOptional()",
    zodSchema: exactOptionalZod,
    dnaSchema: exactOptionalDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "invalid undefined", data: undefined, valid: false },
      { description: "invalid null", data: null, valid: false },
    ],
  },
  {
    description: "exactOptional in objects - absent keys",
    zodSchema: exactOptionalObjectZod,
    dnaSchema: exactOptionalObjectDna,
    tests: [
      { description: "valid absent", data: {}, valid: true },
      { description: "valid present", data: { a: "hello" }, valid: true },
    ],
  },
  {
    description: "exactOptional in objects - explicit undefined rejected",
    zodSchema: exactOptionalObjectZod,
    dnaSchema: exactOptionalObjectDna,
    tests: [
      { description: "invalid explicit undefined", data: { a: undefined }, valid: false },
    ],
  },
  {
    description: "optional vs exactOptional - both accept absent",
    zodSchema: optionalObjectZod,
    dnaSchema: optionalObjectDna,
    tests: [
      { description: "valid absent", data: {}, valid: true },
    ],
  },
  {
    description: "optional vs exactOptional - both accept valid values",
    zodSchema: optionalObjectZod,
    dnaSchema: optionalObjectDna,
    tests: [
      { description: "valid value", data: { a: "hi" }, valid: true },
    ],
  },
  {
    description: "optional accepts explicit undefined",
    zodSchema: optionalObjectZod,
    dnaSchema: optionalObjectDna,
    tests: [
      { description: "valid explicit undefined", data: { a: undefined }, valid: true },
    ],
  },
  {
    description: "defaulted object",
    zodSchema: defaultedObjectZod,
    dnaSchema: defaultedObjectDna,
    tests: [
      { description: "valid absent (defaulted)", data: {}, valid: true },
      { description: "valid present", data: { value: "hello" }, valid: true },
    ],
  },
];

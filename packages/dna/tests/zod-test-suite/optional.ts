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

const optionalPropWithPipeZod = z.object({
  id: z
    .union([z.number(), z.string().nullish()])
    .transform((val) => (val === null || val === undefined ? val : Number(val)))
    .pipe(z.number())
    .optional(),
});
const optionalPropWithPipeDna = dna.object({
  id: dna
    .union([dna.number(), dna.string().nullish()])
    .transform((val) => (val === null || val === undefined ? val : Number(val)))
    .pipe(dna.number())
    .optional(),
});

const objectAbsentKeysZod = z.object({
  value: z.undefined(),
  union: z.union([z.string(), z.undefined()]),
});
const objectAbsentKeysDna = dna.object({
  value: dna.undefined(),
  union: dna.union([dna.string(), dna.undefined()]),
});

const optionalOutOnlyZod = z.object({
  value: z
    .string()
    .transform((val) => (Math.random() ? val : undefined))
    .pipe(z.string().optional()),
});
const optionalOutOnlyDna = dna.object({
  value: dna
    .string()
    .transform((val) => (Math.random() ? val : undefined))
    .pipe(dna.string().optional()),
});

const exactOptionalVsOptionalZod = z.object({ a: z.string().exactOptional() });
const exactOptionalVsOptionalDna = dna.object({ a: dna.string().exactOptional() });

const swallowedIssueZod = z.object({
  a: z
    .string()
    .optional()
    .superRefine((_v, ctx) => {
      ctx.addIssue({ code: "custom", message: "bad" });
      ctx.value = "leaked";
    }),
});
const swallowedIssueDna = dna.object({
  a: dna
    .string()
    .optional()
    .superRefine((_v, ctx) => {
      ctx.addIssue({ code: "custom", message: "bad" });
      ctx.value = "leaked";
    }),
});

const optionalDoesNotSwallowZod = z
  .strictObject({ a: z.string() })
  .transform((): number | undefined => undefined)
  .pipe(z.number().default(5).optional());
const optionalDoesNotSwallowDna = dna
  .strictObject({ a: dna.string() })
  .transform((): number | undefined => undefined)
  .pipe(dna.number().default(5).optional());

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
  {
    description: "optional prop with pipe",
    zodSchema: optionalPropWithPipeZod,
    dnaSchema: optionalPropWithPipeDna,
    tests: [
      { description: "valid absent key", data: {}, valid: true },
    ],
  },
  {
    description: "object absent keys require optin optional",
    zodSchema: objectAbsentKeysZod,
    dnaSchema: objectAbsentKeysDna,
    tests: [
      { description: "invalid absent keys (undefined and union)", data: {}, valid: false },
      { description: "valid present undefined values", data: { value: undefined, union: undefined }, valid: true },
    ],
  },
  {
    description: "object absent keys - optional out only fails on absent",
    zodSchema: optionalOutOnlyZod,
    dnaSchema: optionalOutOnlyDna,
    tests: [
      { description: "invalid absent key (optout only)", data: {}, valid: false },
    ],
  },
  {
    description: "exactOptional vs optional comparison",
    zodSchema: exactOptionalVsOptionalZod,
    dnaSchema: exactOptionalVsOptionalDna,
    tests: [
      { description: "valid absent key", data: {}, valid: true },
      { description: "valid present value", data: { a: "hi" }, valid: true },
      { description: "invalid explicit undefined", data: { a: undefined }, valid: false },
    ],
  },
  {
    description: "swallowed issue on an absent optional key drops its value",
    zodSchema: swallowedIssueZod,
    dnaSchema: swallowedIssueDna,
    tests: [
      { description: "valid absent key (issue swallowed)", data: {}, valid: true },
      { description: "invalid present key (issue surfaces)", data: { a: "x" }, valid: false },
    ],
  },
  {
    description: "optional does not swallow an issue it did not cause",
    zodSchema: optionalDoesNotSwallowZod,
    dnaSchema: optionalDoesNotSwallowDna,
    tests: [
      { description: "invalid unrecognized key survives pipe", data: { a: "x", extra: 1 }, valid: false },
    ],
  },
];

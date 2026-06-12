import * as z from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const obj1Zod = z.object({
  first: z.string(),
  second: z.string(),
});
const obj1Dna = dna.object({
  first: dna.string(),
  second: dna.string(),
});

const obj2Zod = obj1Zod.partial().strict();
const obj2Dna = obj1Dna.partial().strict();

const obj3Zod = obj2Zod.refine((data) => data.first || data.second, "Either first or second should be filled in.");
const obj3Dna = obj2Dna.refine((data) => data.first || data.second, "Either first or second should be filled in.");

const validationSchemaZod = z
  .object({
    email: z.string().email(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, "Both password and confirmation must match");
const validationSchemaDna = dna
  .object({
    email: dna.string().email(),
    password: dna.string(),
    confirmPassword: dna.string(),
  })
  .refine((data) => data.password === data.confirmPassword, "Both password and confirmation must match");

const customPathZod = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((data) => data.confirm === data.password, { path: ["confirm"] });
const customPathDna = dna
  .object({ password: dna.string(), confirm: dna.string() })
  .refine((data) => data.confirm === data.password, { path: ["confirm"] });

const stringsZod = z.array(z.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      input: val,
      code: "too_big",
      origin: "array",
      maximum: 3,
      inclusive: true,
      exact: true,
      message: "Too many items 😡",
    });
  }

  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      input: val,
      code: "custom",
      message: `No duplicates allowed.`,
    });
  }
});
const stringsDna = dna.array(dna.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      input: val,
      code: "too_big",
      origin: "array",
      maximum: 3,
      inclusive: true,
      exact: true,
      message: "Too many items 😡",
    });
  }

  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      input: val,
      code: "custom",
      message: `No duplicates allowed.`,
    });
  }
});

const objectSchemaZod = z
  .object({
    length: z.number(),
    size: z.number(),
  })
  .refine(({ length }) => length > 5, {
    path: ["length"],
    message: "length greater than 5",
  })
  .refine(({ size }) => size > 7, {
    path: ["size"],
    message: "size greater than 7",
  });
const objectSchemaDna = dna
  .object({
    length: dna.number(),
    size: dna.number(),
  })
  .refine(({ length }) => length > 5, {
    path: ["length"],
    message: "length greater than 5",
  })
  .refine(({ size }) => size > 7, {
    path: ["size"],
    message: "size greater than 7",
  });

export const refineTests = [
  {
    description: "should create a new schema instance when refining",
    zodSchema: obj3Zod,
    dnaSchema: obj3Dna,
    tests: [
      { description: "valid with first property", data: { first: "a" }, valid: true },
      { description: "valid with second property", data: { second: "a" }, valid: true },
      { description: "valid with both properties", data: { first: "a", second: "a" }, valid: true },
      { description: "invalid empty object", data: {}, valid: false },
    ],
  },
  {
    description: "should validate strict mode correctly",
    zodSchema: obj2Zod,
    dnaSchema: obj2Dna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid with first", data: { first: "a" }, valid: true },
      { description: "invalid with extra property", data: { third: "adsf" }, valid: false },
    ],
  },
  {
    description: "refinement with custom error messages",
    zodSchema: validationSchemaZod,
    dnaSchema: validationSchemaDna,
    tests: [
      {
        description: "invalid non-matching passwords",
        data: {
          email: "aaaa@gmail.com",
          password: "aaaaaaaa",
          confirmPassword: "bbbbbbbb",
        },
        valid: false,
      },
    ],
  },
  {
    description: "custom error paths",
    zodSchema: customPathZod,
    dnaSchema: customPathDna,
    tests: [
      { description: "invalid mismatch", data: { password: "asdf", confirm: "qewr" }, valid: false },
    ],
  },
  {
    description: "superRefine functionality - multiple validation rules",
    zodSchema: stringsZod,
    dnaSchema: stringsDna,
    tests: [
      { description: "invalid too many items and duplicates", data: ["asfd", "asfd", "asfd", "asfd"], valid: false },
      { description: "valid", data: ["asfd", "qwer"], valid: true },
    ],
  },
  {
    description: "chained refinements - collect all validation errors",
    zodSchema: objectSchemaZod,
    dnaSchema: objectSchemaDna,
    tests: [
      { description: "invalid one error (length)", data: { length: 4, size: 9 }, valid: false },
      { description: "invalid two errors", data: { length: 4, size: 3 }, valid: false },
      { description: "valid", data: { length: 6, size: 8 }, valid: true },
    ],
  },
];

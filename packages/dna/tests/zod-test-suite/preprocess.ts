import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const preprocessArrayZod = z.preprocess((data) => [data], z.string().array());
const preprocessArrayDna = dna.preprocess((data) => [data], dna.string().array());

const preprocessAddIssueZod = z.preprocess((_, ctx) => {
  ctx.addIssue("bad stuff");
}, z.string());
const preprocessAddIssueDna = dna.preprocess((_, ctx) => {
  ctx.addIssue("bad stuff");
}, dna.string());

const preprocessCustomErrorZod = z.preprocess((data, ctx) => {
  ctx.addIssue({
    input: data,
    code: "custom",
    message: `${data} is not one of our allowed strings`,
  });
  return data;
}, z.string());
const preprocessCustomErrorDna = dna.preprocess((data, ctx) => {
  ctx.addIssue({
    input: data,
    code: "custom",
    message: `${data} is not one of our allowed strings`,
  });
  return data;
}, dna.string());

const preprocessNeverZod = z.preprocess((val, ctx) => {
  if (!val) {
    ctx.addIssue({ input: val, code: "custom", message: "bad" });
    return z.NEVER;
  }
  return val;
}, z.number());
const preprocessNeverDna = dna.preprocess((val, ctx) => {
  if (!val) {
    ctx.addIssue({ input: val, code: "custom", message: "bad" });
    return dna.NEVER;
  }
  return val;
}, dna.number());

const preprocessInObjectZod = z.object({
  nonEmptyStr: z.string().min(1),
  positiveNum: z.preprocess((v) => Number(v), z.number().positive()),
});
const preprocessInObjectDna = dna.object({
  nonEmptyStr: dna.string().min(1),
  positiveNum: dna.preprocess((v) => Number(v), dna.number().positive()),
});

const preprocessDefaultZod = z.object({ a: z.preprocess((v) => v ?? "X", z.string()) });
const preprocessDefaultDna = dna.object({ a: dna.preprocess((v) => v ?? "X", dna.string()) });

const preprocessTrimZod = z.object({
  preprocess: z.preprocess((data: any) => data?.trim(), z.string().regex(/asdf/)),
});
const preprocessTrimDna = dna.object({
  preprocess: dna.preprocess((data: any) => data?.trim(), dna.string().regex(/asdf/)),
});

export const preprocessTests = [
  {
    description: "basic preprocess to array",
    zodSchema: preprocessArrayZod,
    dnaSchema: preprocessArrayDna,
    tests: [
      { description: "valid string to array", data: "asdf", valid: true },
      { description: "valid number to array", data: 123, valid: true },
    ],
  },
  {
    description: "preprocess with addIssue",
    zodSchema: preprocessAddIssueZod,
    dnaSchema: preprocessAddIssueDna,
    tests: [{ description: "invalid always fails", data: "asdf", valid: false }],
  },
  {
    description: "preprocess with custom error",
    zodSchema: preprocessCustomErrorZod,
    dnaSchema: preprocessCustomErrorDna,
    tests: [{ description: "invalid custom error", data: "asdf", valid: false }],
  },
  {
    description: "preprocess with NEVER",
    zodSchema: preprocessNeverZod,
    dnaSchema: preprocessNeverDna,
    tests: [
      { description: "valid number", data: 123, valid: true },
      { description: "invalid undefined", data: undefined, valid: false },
    ],
  },
  {
    description: "preprocess in object",
    zodSchema: preprocessInObjectZod,
    dnaSchema: preprocessInObjectDna,
    tests: [
      { description: "valid object", data: { nonEmptyStr: "test", positiveNum: "5" }, valid: true },
      { description: "invalid empty string", data: { nonEmptyStr: "", positiveNum: "5" }, valid: false },
      { description: "invalid non-positive", data: { nonEmptyStr: "test", positiveNum: "-5" }, valid: false },
    ],
  },
  {
    description: "preprocess with default value",
    zodSchema: preprocessDefaultZod,
    dnaSchema: preprocessDefaultDna,
    tests: [
      { description: "valid with value", data: { a: "hi" }, valid: true },
      { description: "valid with default", data: {}, valid: true },
      { description: "valid with undefined", data: { a: undefined }, valid: true },
    ],
  },
  {
    description: "preprocess with trim",
    zodSchema: preprocessTrimZod,
    dnaSchema: preprocessTrimDna,
    tests: [
      { description: "valid with spaces", data: { preprocess: " asdf" }, valid: true },
      { description: "invalid pattern", data: { preprocess: "test" }, valid: false },
    ],
  },
];

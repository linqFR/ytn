import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const strs = ["foo", "bar"];

const transformCtxZod = z.string().transform((data, ctx) => {
  const i = strs.indexOf(data);
  if (i === -1) {
    ctx.addIssue({
      input: data,
      code: "custom",
      message: `${data} is not one of our allowed strings`,
    });
  }
  return data.length;
});
const transformCtxDna = dna.string().transform((data, ctx) => {
  const i = strs.indexOf(data);
  if (i === -1) {
    ctx.addIssue({
      input: data,
      code: "custom",
      message: `${data} is not one of our allowed strings`,
    });
  }
  return data.length;
}, { strs });

const neverZod = z
  .number()
  .optional()
  .transform((val, ctx) => {
    if (!val) {
      ctx.addIssue({
        input: val,
        code: z.ZodIssueCode.custom,
        message: "bad",
      });
      return z.NEVER;
    }
    return val;
  });
const neverDna = dna
  .number()
  .optional()
  .transform((val, ctx) => {
    if (!val) {
      ctx.addIssue({
        input: val,
        code: "custom",
        message: "bad",
      });
      return dna.NEVER;
    }
    return val;
  });

// --- Additional schemas matching Zod official tests ---

const basicTransformZod = z.string().transform((data) => data.length);
const basicTransformDna = dna.string().transform((data: string) => data.length);

const coercionZod = z.object({ id: z.number().transform((n) => String(n)) });
const coercionDna = dna.object({ id: dna.number().transform((n: number) => String(n)) });

const asyncCoercionZod = z.object({ id: z.number().transform(async (n) => String(n)) });
const asyncCoercionDna = dna.object({ id: dna.number().transform(async (n: number) => String(n)) });

const syncCoercionAsyncErrorZod = z.object({ id: z.number().transform(async (n) => String(n)) });
const syncCoercionAsyncErrorDna = dna.object({ id: dna.number().transform(async (n: number) => String(n)) });

const defaultStrZod = z.string().default("asdf");
const defaultStrDna = dna.string().default("asdf");

const dynamicDefaultZod = z.string().default(() => "string");
const dynamicDefaultDna = dna.string().default(() => "string");

const defaultNullUndefZod = z.object({
  foo: z.boolean().nullable().default(true),
  bar: z.boolean().default(true),
});
const defaultNullUndefDna = dna.object({
  foo: dna.boolean().nullable().default(true),
  bar: dna.boolean().default(true),
});

const defaultFalsyZod = z.object({
  emptyStr: z.string().default("def"),
  zero: z.number().default(5),
  falseBoolean: z.boolean().default(true),
});
const defaultFalsyDna = dna.object({
  emptyStr: dna.string().default("def"),
  zero: dna.number().default(5),
  falseBoolean: dna.boolean().default(true),
});

const multipleTransformersZod = z
  .string()
  .transform((arg) => Number.parseFloat(arg))
  .transform((val) => val * 2);
const multipleTransformersDna = dna
  .string()
  .transform((arg: string) => Number.parseFloat(arg))
  .transform((val: number) => val * 2);

const shortCircuitZod = z
  .string()
  .refine(() => false)
  .transform((val) => val.toUpperCase());
const shortCircuitDna = dna
  .string()
  .refine(() => false)
  .transform((val: string) => val.toUpperCase());

const doNotContinueZod = z
  .string()
  .transform((val, ctx) => {
    ctx.addIssue({ code: "custom", message: "custom error" });
    ctx.addIssue({ code: "custom", message: "custom error" });
    return val;
  })
  .pipe(z.string());
const doNotContinueDna = dna
  .string()
  .transform((val, ctx) => {
    ctx.addIssue({ code: "custom", message: "custom error" });
    ctx.addIssue({ code: "custom", message: "custom error" });
    return val;
  })
  .pipe(dna.string());

const asyncTransformAddIssueZod = z.string().transform(async (data, ctx) => {
  ctx.addIssue({
    input: data,
    code: "custom",
    message: `${data} is not one of our allowed strings`,
  });
  return data.length;
});
const asyncTransformAddIssueDna = dna.string().transform(async (data, ctx) => {
  ctx.addIssue({
    input: data,
    code: "custom",
    message: `${data} is not one of our allowed strings`,
  });
  return data.length;
});

const encodeErrorZod = z.string().transform((val) => val.length);
const encodeErrorDna = dna.string().transform((val: string) => val.length);

const transformCtxAddIssueZod = z.transform((val, ctx) => {
  ctx.addIssue({ code: "custom", message: "Not valid" });
  return val;
});
const transformCtxAddIssueDna = dna.transform((val, ctx) => {
  ctx.addIssue({ code: "custom", message: "Not valid" });
  return val;
});

export const transformTests = [
  {
    description: "transform ctx.addIssue with parse",
    zodSchema: transformCtxZod,
    dnaSchema: transformCtxDna,
    externals: { strs },
    tests: [
      { description: "invalid asdf", data: "asdf", valid: false },
    ],
  },
  {
    description: "z or dna..NEVER in transform",
    zodSchema: neverZod,
    dnaSchema: neverDna,
    tests: [
      { description: "invalid undefined", data: undefined, valid: false },
      { description: "valid number", data: 5, valid: true },
    ],
  },
  {
    description: "basic transformations",
    zodSchema: basicTransformZod,
    dnaSchema: basicTransformDna,
    tests: [
      { description: "valid string to length", data: "asdf", valid: true },
    ],
  },
  {
    description: "coercion",
    zodSchema: coercionZod,
    dnaSchema: coercionDna,
    tests: [
      { description: "valid number to string", data: { id: 5 }, valid: true },
    ],
  },
  {
    description: "async coercion",
    zodSchema: asyncCoercionZod,
    dnaSchema: asyncCoercionDna,
    tests: [
      { description: "valid number to string async", data: { id: 5 }, valid: true },
    ],
  },
  {
    description: "sync coercion async error",
    zodSchema: syncCoercionAsyncErrorZod,
    dnaSchema: syncCoercionAsyncErrorDna,
    tests: [
      { description: "valid number to string async fallback", data: { id: 5 }, valid: true },
    ],
  },
  {
    description: "default",
    zodSchema: defaultStrZod,
    dnaSchema: defaultStrDna,
    tests: [
      { description: "valid undefined to default", data: undefined, valid: true },
    ],
  },
  {
    description: "dynamic default",
    zodSchema: dynamicDefaultZod,
    dnaSchema: dynamicDefaultDna,
    tests: [
      { description: "valid undefined to dynamic default", data: undefined, valid: true },
    ],
  },
  {
    description: "default when property is null or undefined",
    zodSchema: defaultNullUndefZod,
    dnaSchema: defaultNullUndefDna,
    tests: [
      { description: "valid foo null bar default", data: { foo: null }, valid: true },
    ],
  },
  {
    description: "default with falsy values",
    zodSchema: defaultFalsyZod,
    dnaSchema: defaultFalsyDna,
    tests: [
      { description: "valid falsy values kept", data: { emptyStr: "", zero: 0, falseBoolean: true }, valid: true },
    ],
  },
  {
    description: "multiple transformers",
    zodSchema: multipleTransformersZod,
    dnaSchema: multipleTransformersDna,
    tests: [
      { description: "valid string to doubled number", data: "5", valid: true },
    ],
  },
  {
    description: "short circuit on dirty",
    zodSchema: shortCircuitZod,
    dnaSchema: shortCircuitDna,
    tests: [
      { description: "invalid string refine fails", data: "asdf", valid: false },
      { description: "invalid number type", data: 1234, valid: false },
    ],
  },
  {
    description: "async short circuit on dirty",
    zodSchema: shortCircuitZod,
    dnaSchema: shortCircuitDna,
    tests: [
      { description: "invalid string refine fails async", data: "asdf", valid: false },
      { description: "invalid number type async", data: 1234, valid: false },
    ],
  },
  {
    description: "do not continue by default",
    zodSchema: doNotContinueZod,
    dnaSchema: doNotContinueDna,
    tests: [
      { description: "invalid with two custom errors", data: "asdf", valid: false },
    ],
  },
  {
    description: "transform ctx.addIssue with parseAsync",
    zodSchema: asyncTransformAddIssueZod,
    dnaSchema: asyncTransformAddIssueDna,
    tests: [
      { description: "invalid asdf async", data: "asdf", valid: false },
    ],
  },
  {
    description: "encode error",
    zodSchema: encodeErrorZod,
    dnaSchema: encodeErrorDna,
    tests: [
      { description: "valid string to length", data: "asdf", valid: true },
    ],
  },
  {
    description: "transform context should have addIssue",
    zodSchema: transformCtxAddIssueZod,
    dnaSchema: transformCtxAddIssueDna,
    tests: [
      { description: "invalid custom error", data: "test", valid: false },
    ],
  },
];

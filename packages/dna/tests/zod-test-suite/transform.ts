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
});

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

export const transformTests = [
  {
    description: "transform ctx.addIssue with parse",
    zodSchema: transformCtxZod,
    dnaSchema: transformCtxDna,
    tests: [
      { description: "invalid asdf", data: "asdf", valid: false },
    ],
  },
  {
    description: "z.NEVER in transform",
    zodSchema: neverZod,
    dnaSchema: neverDna,
    tests: [
      { description: "invalid undefined", data: undefined, valid: false },
      { description: "valid number", data: 5, valid: true },
    ],
  },
];

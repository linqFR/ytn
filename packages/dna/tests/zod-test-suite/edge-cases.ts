import { z } from "zod";
import { dna } from "../../src/index.js";
import { toJS } from "../../src/toJs.js";

const stringsZod = z.array(z.string()).superRefine((val, ctx) => {
  if (val.length > 3) {
    ctx.addIssue({
      code: "too_big",
      message: "Too many items",
      maximum: 3,
      inclusive: true,
      origin: "array",
    });
  }
  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      code: "custom",
      message: "No duplicates allowed",
    });
  }
});

const stringsDna = dna.array(dna.string()).superRefine((val, ctx: any) => {
  if (val.length > 3) {
    ctx.addIssue({
      code: "too_big",
      message: "Too many items",
      maximum: 3,
      inclusive: true,
      origin: "array",
    });
  }
  if (val.length !== new Set(val).size) {
    ctx.addIssue({
      code: "custom",
      message: "No duplicates allowed",
    });
  }
});

export const edgeCasesTests = [
  {
    description: "superRefine accumulates multiple issues",
    zodSchema: stringsZod,
    dnaSchema: stringsDna,
    tests: [
      {
        description: "data triggers two issues",
        data: ["a", "a", "a", "a"],
        valid: false,
        customCheck: (zodResult: any, dnaResult: any) => {
          const zCount = zodResult.error?.issues?.length ?? 0;
          const dCount = dnaResult.errors?.length ?? 0;
          return zCount > 1 && dCount === zCount;
        },
      },
    ],
  },
  {
    description: "toDna and toJS are available",
    zodSchema: z.string(),
    dnaSchema: dna.string(),
    tests: [
      {
        description: "toDna returns a sequence and toJS returns a function",
        data: "hello",
        valid: true,
        customCheck: () => {
          const seq = dna.string().toDna();
          const code = toJS(false, false)(seq);
          return Array.isArray(seq) && Array.isArray(code) && code.length > 0;
        },
      },
    ],
  },
];

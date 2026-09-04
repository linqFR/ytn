import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const args1Zod = z.tuple([z.string()]);
const args1Dna = [dna.string()] as const;

const returns1Zod = z.number();
const returns1Dna = dna.number();

const func1Zod = z.function({
  input: args1Zod,
  output: returns1Zod,
});
const func1Dna = dna.function({
  input: args1Dna,
  output: returns1Dna,
});

const methodObjectZod = z.object({
  property: z.number(),
  method: z
    .function()
    .input(z.tuple([z.string()]))
    .output(z.number()),
});
const methodObjectDna = dna.object({
  property: dna.number(),
  method: dna
    .function()
    .input([dna.string()])
    .output(dna.number()),
});

const asyncMethodObjectZod = z.object({
  property: z.number(),
  method: z.function().input([z.string()]).output(z.promise(z.number())),
});
const asyncMethodObjectDna = dna.object({
  property: dna.number(),
  method: dna.function().input([dna.string()]).output(dna.promise(dna.number())),
});

// --- Additional schemas matching Zod official tests ---

const func2Zod = z.function({
  input: z.tuple([
    z.object({
      f1: z.number(),
      f2: z.string().nullable(),
      f3: z.array(z.boolean().optional()).optional(),
    }),
  ]),
  output: z.union([z.string(), z.number()]),
});
const func2Dna = dna.function({
  input: [
    dna.object({
      f1: dna.number(),
      f2: dna.string().nullable(),
      f3: dna.array(dna.boolean().optional()).optional(),
    }),
  ] as const,
  output: dna.union([dna.string(), dna.number()]),
});

const func3Zod = z.function({
  input: [
    z.object({
      f1: z.number(),
      f2: z.string().nullable(),
      f3: z.array(z.boolean().optional()).optional(),
    }),
  ] as const,
  output: z.union([z.string(), z.number()]),
});
const func3Dna = dna.function({
  input: [
    dna.object({
      f1: dna.number(),
      f2: dna.string().nullable(),
      f3: dna.array(dna.boolean().optional()).optional(),
    }),
  ] as const,
  output: dna.union([dna.string(), dna.number()]),
});

const inputValidationZod = z.function({
  input: z.tuple([z.string()]),
  output: z.void(),
});
const inputValidationDna = dna.function({
  input: [dna.string()] as const,
  output: dna.void(),
});

const arrayInputsZod = z.function({
  input: [
    z.object({
      name: z.string(),
      age: z.number().int(),
    }),
  ],
  output: z.string(),
});
const arrayInputsDna = dna.function({
  input: [
    dna.object({
      name: dna.string(),
      age: dna.number().int(),
    }),
  ] as const,
  output: dna.string(),
});

const outputValidationZod = z.function({
  input: z.tuple([]),
  output: z.string(),
});
const outputValidationDna = dna.function({
  input: [] as const,
  output: dna.string(),
});

const asyncRefineFuncZod = z
  .function()
  .input([z.string().refine(async (val) => val.length > 10)])
  .output(z.promise(z.number().refine(async (val) => val > 10)));
const asyncRefineFuncDna = dna
  .function()
  .input([dna.string().refine(async (val: string) => val.length > 10)])
  .output(dna.promise(dna.number().refine(async (val: number) => val > 10)));

const codeSchemaZod = z.string().transform((data, ctx) => {
  if (data === "1234") return data;
  ctx.addIssue({ code: "custom", message: "Invalid code" });
  return z.NEVER;
});
const codeSchemaDna = dna.string().transform((data, ctx) => {
  if (data === "1234") return data;
  ctx.addIssue({ code: "custom", message: "Invalid code" });
  return dna.NEVER;
});
const asyncTransformInputZod = z.object({ code: codeSchemaZod });
const asyncTransformInputDna = dna.object({ code: codeSchemaDna });
const asyncTransformOutputZod = z.object({ data: z.array(z.string()).default([]) });
const asyncTransformOutputDna = dna.object({ data: dna.array(dna.string()).default([]) });
const asyncTransformFuncZod = z
  .function()
  .input([asyncTransformInputZod])
  .output(asyncTransformOutputZod);
const asyncTransformFuncDna = dna
  .function()
  .input([asyncTransformInputDna])
  .output(asyncTransformOutputDna);

const nonAsyncRefineFuncZod = z
  .function()
  .input([z.string().refine(async (val) => val.length > 10)])
  .output(z.number().refine(async (val) => val > 10));
const nonAsyncRefineFuncDna = dna
  .function()
  .input([dna.string().refine(async (val: string) => val.length > 10)])
  .output(dna.number().refine(async (val: number) => val > 10));

const restFuncZod = z
  .function()
  .input([z.string()], z.unknown())
  .output(z.boolean());
const restFuncDna = dna
  .function()
  .input([dna.string()], dna.unknown())
  .output(dna.boolean());

export const functionTests = [
  {
    description: "function parsing",
    zodSchema: func1Zod,
    dnaSchema: func1Dna,
    tests: [
      { description: "valid function", data: (arg: any) => arg.length, valid: true },
    ],
  },
  {
    description: "method parsing",
    zodSchema: methodObjectZod,
    dnaSchema: methodObjectDna,
    tests: [
      { 
        description: "valid method object", 
        data: {
          property: 3,
          method: function (s: string) {
            return s.length + this.property;
          },
        }, 
        valid: true 
      },
    ],
  },
  {
    description: "async method parsing",
    zodSchema: asyncMethodObjectZod,
    dnaSchema: asyncMethodObjectDna,
    tests: [
      { 
        description: "valid async method object", 
        data: {
          property: 3,
          method: async function (s: string) {
            return s.length + this.property;
          },
        }, 
        valid: true 
      },
    ],
  },
  {
    description: "parsed function fail 1",
    zodSchema: func1Zod,
    dnaSchema: func1Dna,
    tests: [
      {
        description: "output validation fails - returns string instead of number",
        data: () => 0,
        valid: true,
        customCheck: () => {
          // CAST: intentionally returning string to test output validation failure
          const zImpl = func1Zod.implement((x: string) => x as unknown as number);
          // CAST: intentionally returning string to test output validation failure
          const dImpl = func1Dna.implement((x: string) => x as unknown as number);
          let zThrew = false, dThrew = false;
          try { zImpl("asdf"); } catch { zThrew = true; }
          try { dImpl("asdf"); } catch { dThrew = true; }
          return zThrew && dThrew;
        },
      },
    ],
  },
  {
    description: "parsed function fail 2",
    zodSchema: func1Zod,
    dnaSchema: func1Dna,
    tests: [
      {
        description: "input validation fails - passes number instead of string",
        data: () => 0,
        valid: true,
        customCheck: () => {
          // CAST: intentionally returning string to test output validation failure
          const zImpl = func1Zod.implement((x: string) => x as unknown as number);
          // CAST: intentionally returning string to test output validation failure
          const dImpl = func1Dna.implement((x: string) => x as unknown as number);
          let zThrew = false, dThrew = false;
          // CAST: calling with wrong argument type to test input validation
          try { (zImpl as unknown as (a: number) => number)(13); } catch { zThrew = true; }
          // CAST: calling with wrong argument type to test input validation
          try { (dImpl as unknown as (a: number) => number)(13); } catch { dThrew = true; }
          return zThrew && dThrew;
        },
      },
    ],
  },
  {
    description: "valid function run (func2)",
    zodSchema: func2Zod,
    dnaSchema: func2Dna,
    tests: [
      {
        description: "valid func2 run with object arg",
        data: () => 0,
        valid: true,
        customCheck: () => {
          const zImpl = func2Zod.implement((_x) => "adf");
          const dImpl = func2Dna.implement((_x) => "adf");
          let zOk = false, dOk = false;
          try { zImpl({ f1: 21, f2: "asdf", f3: [true, false] }); zOk = true; } catch { zOk = false; }
          try { dImpl({ f1: 21, f2: "asdf", f3: [true, false] }); dOk = true; } catch { dOk = false; }
          return zOk && dOk;
        },
      },
    ],
  },
  {
    description: "valid function run (func3)",
    zodSchema: func3Zod,
    dnaSchema: func3Dna,
    tests: [
      {
        description: "valid func3 run with object arg",
        data: () => 0,
        valid: true,
        customCheck: () => {
          const zImpl = func3Zod.implement((_x) => "adf");
          const dImpl = func3Dna.implement((_x) => "adf");
          let zOk = false, dOk = false;
          try { zImpl({ f1: 21, f2: "asdf", f3: [true, false] }); zOk = true; } catch { zOk = false; }
          try { dImpl({ f1: 21, f2: "asdf", f3: [true, false] }); dOk = true; } catch { dOk = false; }
          return zOk && dOk;
        },
      },
    ],
  },
  {
    description: "input validation error",
    zodSchema: inputValidationZod,
    dnaSchema: inputValidationDna,
    tests: [
      {
        description: "input validation fails - no args provided",
        data: () => 0,
        valid: true,
        customCheck: () => {
          const zImpl = inputValidationZod.implement(() => undefined);
          const dImpl = inputValidationDna.implement(() => undefined);
          let zThrew = false, dThrew = false;
          // CAST: calling with no args to test input validation
          try { (zImpl as unknown as () => void)(); } catch { zThrew = true; }
          // CAST: calling with no args to test input validation
          try { (dImpl as unknown as () => void)(); } catch { dThrew = true; }
          return zThrew && dThrew;
        },
      },
    ],
  },
  {
    description: "array inputs",
    zodSchema: arrayInputsZod,
    dnaSchema: arrayInputsDna,
    tests: [
      {
        description: "valid function with array input",
        data: () => 0,
        valid: true,
        customCheck: () => {
          const zImpl = arrayInputsZod.implement((args) => `${args.age}`);
          const dImpl = arrayInputsDna.implement((args) => `${args.age}`);
          return zImpl({ name: "test", age: 25 }) === "25" && dImpl({ name: "test", age: 25 }) === "25";
        },
      },
    ],
  },
  {
    description: "output validation error",
    zodSchema: outputValidationZod,
    dnaSchema: outputValidationDna,
    tests: [
      {
        description: "output validation fails - returns number instead of string",
        data: () => 0,
        valid: true,
        customCheck: () => {
          // CAST: intentionally returning number to test output validation failure
          const zImpl = outputValidationZod.implement(() => 1234 as unknown as string);
          // CAST: intentionally returning number to test output validation failure
          const dImpl = outputValidationDna.implement(() => 1234 as unknown as string);
          let zThrew = false, dThrew = false;
          try { zImpl(); } catch { zThrew = true; }
          try { dImpl(); } catch { dThrew = true; }
          return zThrew && dThrew;
        },
      },
    ],
  },
  {
    description: "function with async refinements",
    zodSchema: asyncRefineFuncZod,
    dnaSchema: asyncRefineFuncDna,
    tests: [
      {
        description: "async refine - short string fails, long string succeeds",
        data: () => 0,
        valid: true,
        customCheck: async () => {
          const zImpl = asyncRefineFuncZod.implementAsync(async (val) => val.length);
          const dImpl = asyncRefineFuncDna.implementAsync(async (val) => val.length);
          let zShortFail = false, dShortFail = false;
          let zLongOk = false, dLongOk = false;
          try { await zImpl("asdfasdf"); } catch { zShortFail = true; }
          try { await dImpl("asdfasdf"); } catch { dShortFail = true; }
          try { await zImpl("asdflkjasdflkjsf"); zLongOk = true; } catch { zLongOk = false; }
          try { await dImpl("asdflkjasdflkjsf"); dLongOk = true; } catch { dLongOk = false; }
          return zShortFail && dShortFail && zLongOk && dLongOk;
        },
      },
    ],
  },
  {
    description: "implement async with transforms",
    zodSchema: asyncTransformFuncZod,
    dnaSchema: asyncTransformFuncDna,
    tests: [
      {
        description: "valid code succeeds, invalid code fails",
        data: () => 0,
        valid: true,
        customCheck: async () => {
          const zImpl = asyncTransformFuncZod.implementAsync(async (data) => ({ data: [data.code] }));
          const dImpl = asyncTransformFuncDna.implementAsync(async (data) => ({ data: [data.code] }));
          let zValidOk = false, dValidOk = false;
          let zInvalidFail = false, dInvalidFail = false;
          try { await zImpl({ code: "1234" }); zValidOk = true; } catch { zValidOk = false; }
          try { await dImpl({ code: "1234" }); dValidOk = true; } catch { dValidOk = false; }
          // CAST: passing wrong shape to test input validation failure
          try { await (zImpl as unknown as (a: { data: string }) => Promise<unknown>)({ data: "asdflkjasdflkjsf" }); } catch { zInvalidFail = true; }
          // CAST: passing wrong shape to test input validation failure
          try { await (dImpl as unknown as (a: { data: string }) => Promise<unknown>)({ data: "asdflkjasdflkjsf" }); } catch { dInvalidFail = true; }
          return zValidOk && dValidOk && zInvalidFail && dInvalidFail;
        },
      },
    ],
  },
  {
    description: "non async function with async refinements should fail",
    zodSchema: nonAsyncRefineFuncZod,
    dnaSchema: nonAsyncRefineFuncDna,
    tests: [
      {
        description: "implement with async refinements fails",
        data: () => 0,
        valid: true,
        customCheck: async () => {
          let zFail = false, dFail = false;
          try {
            const zImpl = nonAsyncRefineFuncZod.implement((val) => val.length);
            try { await zImpl("asdasdfasdffasdf"); } catch { zFail = true; }
          } catch { zFail = true; }
          try {
            const dImpl = nonAsyncRefineFuncDna.implement((val) => val.length);
            try { await dImpl("asdasdfasdffasdf"); } catch { dFail = true; }
          } catch { dFail = true; }
          return zFail && dFail;
        },
      },
    ],
  },
  {
    description: "extra parameters with rest",
    zodSchema: restFuncZod,
    dnaSchema: restFuncDna,
    tests: [
      {
        description: "filter with rest parameters",
        data: () => 0,
        valid: true,
        customCheck: () => {
          const zImpl = restFuncZod.implement((str, _arg, _qewr) => str.length <= 5);
          const dImpl = restFuncDna.implement((str, _arg, _qewr) => str.length <= 5);
          const zFilter = ["apple", "orange", "pear", "banana", "strawberry"].filter(zImpl);
          const dFilter = ["apple", "orange", "pear", "banana", "strawberry"].filter(dImpl);
          return zFilter.length === 2 && dFilter.length === 2;
        },
      },
    ],
  },
];

import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const args1Zod = z.tuple([z.string()]);
const args1Dna = dna.tuple([dna.string()]);

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
    .input(dna.tuple([dna.string()]))
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
];

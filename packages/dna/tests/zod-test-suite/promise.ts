import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const promSchemaZod = z.promise(
  z.object({
    name: z.string(),
    age: z.number(),
  })
);
const promSchemaDna = dna.promise(
  dna.object({
    name: dna.string(),
    age: dna.number(),
  })
);

const asyncFunctionZod = z.function({
  input: z.tuple([]),
  output: promSchemaZod,
});
const asyncFunctionDna = dna.function({
  input: dna.tuple([]),
  output: promSchemaDna,
});

const promiseStringZod = z.promise(z.string());
const promiseStringDna = dna.promise(dna.string());

const promiseNumberZod = z.promise(z.number());
const promiseNumberDna = dna.promise(dna.number());

const fooZod = z.literal("foo");
const fooDna = dna.literal("foo");

const resZod = z.promise(fooZod);
const resDna = dna.promise(fooDna);

export const promiseTests = [
  {
    description: "promise parsing success",
    zodSchema: promSchemaZod,
    dnaSchema: promSchemaDna,
    tests: [
      { description: "valid promise", data: Promise.resolve({ name: "Bobby", age: 10 }), valid: true },
    ],
  },
  {
    description: "promise parsing fail",
    zodSchema: promSchemaZod,
    dnaSchema: promSchemaDna,
    tests: [
      { description: "invalid age type", data: Promise.resolve({ name: "Bobby", age: "10" }), valid: false },
    ],
  },
  {
    description: "sync promise parsing",
    zodSchema: promiseStringZod,
    dnaSchema: promiseStringDna,
    tests: [
      { description: "invalid sync parse", data: Promise.resolve("asfd"), valid: false },
    ],
  },
  {
    description: "async promise parsing",
    zodSchema: promiseNumberZod,
    dnaSchema: promiseNumberDna,
    tests: [
      { description: "valid promise", data: Promise.resolve(12), valid: true },
    ],
  },
  {
    description: "resolves",
    zodSchema: resZod,
    dnaSchema: resDna,
    tests: [
      { description: "valid promise", data: Promise.resolve("foo"), valid: true },
    ],
  },
];

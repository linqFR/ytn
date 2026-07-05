import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const readonlyStringZod = z.string().readonly();
const readonlyStringDna = dna.string().readonly();

const readonlyNumberZod = z.number().readonly();
const readonlyNumberDna = dna.number().readonly();

const readonlyBooleanZod = z.boolean().readonly();
const readonlyBooleanDna = dna.boolean().readonly();

const readonlyDateZod = z.date().readonly();
const readonlyDateDna = dna.date().readonly();

const readonlyStringArrayZod = z.array(z.string()).readonly();
const readonlyStringArrayDna = dna.array(dna.string()).readonly();

const readonlyTupleZod = z.tuple([z.string(), z.number()]).readonly();
const readonlyTupleDna = dna.tuple([dna.string(), dna.number()]).readonly();

const readonlyMapZod = z.map(z.string(), z.date()).readonly();
const readonlyMapDna = dna.map(dna.string(), dna.date()).readonly();

const readonlySetZod = z.set(z.string()).readonly();
const readonlySetDna = dna.set(dna.string()).readonly();

const readonlyStringRecordZod = z.record(z.string(), z.string()).readonly();
const readonlyStringRecordDna = dna.record(dna.string(), dna.string()).readonly();

const readonlyObjectZod = z.object({ a: z.string(), 1: z.number() }).readonly();
const readonlyObjectDna = dna.object({ a: dna.string(), 1: dna.number() }).readonly();

export const readonlyTests = [
  {
    description: "readonly string",
    zodSchema: readonlyStringZod,
    dnaSchema: readonlyStringDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "valid empty string", data: "", valid: true },
    ],
  },
  {
    description: "readonly number",
    zodSchema: readonlyNumberZod,
    dnaSchema: readonlyNumberDna,
    tests: [
      { description: "valid number", data: 1234, valid: true },
      { description: "valid zero", data: 0, valid: true },
      { description: "valid negative", data: -42, valid: true },
    ],
  },
  {
    description: "readonly boolean",
    zodSchema: readonlyBooleanZod,
    dnaSchema: readonlyBooleanDna,
    tests: [
      { description: "valid true", data: true, valid: true },
      { description: "valid false", data: false, valid: true },
    ],
  },
  {
    description: "readonly date",
    zodSchema: readonlyDateZod,
    dnaSchema: readonlyDateDna,
    tests: [
      { description: "valid date", data: new Date(), valid: true },
    ],
  },
  {
    description: "readonly array",
    zodSchema: readonlyStringArrayZod,
    dnaSchema: readonlyStringArrayDna,
    tests: [
      { description: "valid array", data: ["a", "b", "c"], valid: true },
      { description: "valid empty array", data: [], valid: true },
    ],
  },
  {
    description: "readonly tuple",
    zodSchema: readonlyTupleZod,
    dnaSchema: readonlyTupleDna,
    tests: [
      { description: "valid tuple", data: ["a", 1], valid: true },
    ],
  },
  {
    description: "readonly map",
    zodSchema: readonlyMapZod,
    dnaSchema: readonlyMapDna,
    tests: [
      { description: "valid map", data: new Map([["a", new Date()]]), valid: true },
    ],
  },
  {
    description: "readonly set",
    zodSchema: readonlySetZod,
    dnaSchema: readonlySetDna,
    tests: [
      { description: "valid set", data: new Set(["a", "b"]), valid: true },
    ],
  },
  {
    description: "readonly record",
    zodSchema: readonlyStringRecordZod,
    dnaSchema: readonlyStringRecordDna,
    tests: [
      { description: "valid record", data: { a: "b", c: "d" }, valid: true },
      { description: "valid empty record", data: {}, valid: true },
    ],
  },
  {
    description: "readonly object",
    zodSchema: readonlyObjectZod,
    dnaSchema: readonlyObjectDna,
    tests: [
      { description: "valid object", data: { a: "hello", 1: 42 }, valid: true },
    ],
  },
];

import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const minMaxZod = z.array(z.string()).min(2).max(2);
const minMaxDna = dna.array(dna.string()).min(2).max(2);

const lengthZod = z.array(z.string()).length(2);
const lengthDna = dna.array(dna.string()).length(2);

const nonemptyZod = z.string().array().nonempty();
const nonemptyDna = dna.string().array().nonempty();

const nonemptyMaxZod = z.string().array().nonempty().max(2);
const nonemptyMaxDna = dna.string().array().nonempty().max(2);

const elementZod = z.string().array();
const elementDna = dna.string().array();

const continueParsingZod = z.object({
  people: z.string().array().min(2),
});
const continueParsingDna = dna.object({
  people: dna.string().array().min(2),
});

const sparseArrayZod = z.array(z.string()).nonempty().min(1).max(3);
const sparseArrayDna = dna.array(dna.string()).nonempty().min(1).max(3);

const parseEmptyNonemptyZod = z.array(z.string()).nonempty();
const parseEmptyNonemptyDna = dna.array(dna.string()).nonempty();

export const arrayTests = [
  {
    description: "array min/max - too small",
    zodSchema: minMaxZod,
    dnaSchema: minMaxDna,
    tests: [
      { description: "invalid too small", data: ["asdf"], valid: false },
    ],
  },
  {
    description: "array min/max - too big",
    zodSchema: minMaxZod,
    dnaSchema: minMaxDna,
    tests: [
      { description: "invalid too big", data: ["asdf", "asdf", "asdf"], valid: false },
    ],
  },
  {
    description: "array length - valid",
    zodSchema: lengthZod,
    dnaSchema: lengthDna,
    tests: [
      { description: "valid exact", data: ["asdf", "asdf"], valid: true },
    ],
  },
  {
    description: "array length - too small",
    zodSchema: lengthZod,
    dnaSchema: lengthDna,
    tests: [
      { description: "invalid too small", data: ["asdf"], valid: false },
    ],
  },
  {
    description: "array length - too big",
    zodSchema: lengthZod,
    dnaSchema: lengthDna,
    tests: [
      { description: "invalid too big", data: ["asdf", "asdf", "asdf"], valid: false },
    ],
  },
  {
    description: "array.nonempty()",
    zodSchema: nonemptyZod,
    dnaSchema: nonemptyDna,
    tests: [
      { description: "valid nonempty", data: ["a"], valid: true },
      { description: "invalid empty", data: [], valid: false },
    ],
  },
  {
    description: "parse empty array in nonempty",
    zodSchema: parseEmptyNonemptyZod,
    dnaSchema: parseEmptyNonemptyDna,
    tests: [
      { description: "invalid empty array", data: [], valid: false },
    ],
  },
  {
    description: "array.nonempty().max()",
    zodSchema: nonemptyMaxZod,
    dnaSchema: nonemptyMaxDna,
    tests: [
      { description: "valid single", data: ["a"], valid: true },
      { description: "invalid empty", data: [], valid: false },
      { description: "invalid too many", data: ["a", "a", "a"], valid: false },
    ],
  },
  {
    description: "get element",
    zodSchema: elementZod,
    dnaSchema: elementDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
      { description: "invalid number", data: 12, valid: false },
    ],
  },
  {
    description: "continue parsing despite array size error",
    zodSchema: continueParsingZod,
    dnaSchema: continueParsingDna,
    tests: [
      { description: "invalid array too small with wrong type", data: { people: [123] }, valid: false },
    ],
  },
  {
    description: "parse should fail given sparse array",
    zodSchema: sparseArrayZod,
    dnaSchema: sparseArrayDna,
    tests: [
      { description: "invalid sparse array", data: new Array(3), valid: false },
    ],
  },
];

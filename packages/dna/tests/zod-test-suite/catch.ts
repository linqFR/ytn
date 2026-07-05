import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const basicCatchZod = z.string().catch("default");
const basicCatchDna = dna.string().catch("default");

const catchWithTransformZod = z
  .string()
  .transform((val) => val.toUpperCase())
  .catch("default");
const catchWithTransformDna = dna
  .string()
  .transform((val) => val.toUpperCase())
  .catch("default");

const catchOnExistingOptionalZod = z.string().optional().catch("asdf");
const catchOnExistingOptionalDna = dna.string().optional().catch("asdf");

const optionalOnCatchZod = z.string().catch("asdf").optional();
const optionalOnCatchDna = dna.string().catch("asdf").optional();

export const catchTests = [
  {
    description: "basic catch",
    zodSchema: basicCatchZod,
    dnaSchema: basicCatchDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined uses catch", data: undefined, valid: true },
      { description: "valid number uses catch", data: 123, valid: true },
      { description: "valid boolean uses catch", data: true, valid: true },
      { description: "valid array uses catch", data: [], valid: true },
      { description: "valid map uses catch", data: new Map(), valid: true },
      { description: "valid set uses catch", data: new Set(), valid: true },
      { description: "valid object uses catch", data: {}, valid: true },
    ],
  },
  {
    description: "catch with transform",
    zodSchema: catchWithTransformZod,
    dnaSchema: catchWithTransformDna,
    tests: [
      { description: "valid undefined uses catch", data: undefined, valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
  {
    description: "catch on existing optional",
    zodSchema: catchOnExistingOptionalZod,
    dnaSchema: catchOnExistingOptionalDna,
    tests: [
      { description: "valid undefined", data: undefined, valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
  {
    description: "optional on catch",
    zodSchema: optionalOnCatchZod,
    dnaSchema: optionalOnCatchDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
];

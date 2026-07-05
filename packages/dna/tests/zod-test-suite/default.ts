import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const basicDefaultZod = z.string().default("default");
const basicDefaultDna = dna.string().default("default");

const defaultWithOptionalZod = z.string().optional().default("default");
const defaultWithOptionalDna = dna.string().optional().default("default");

const defaultWithTransformZod = z
  .string()
  .transform((val) => val.toUpperCase())
  .default("default");
const defaultWithTransformDna = dna
  .string()
  .transform((val) => val.toUpperCase())
  .default("default");

const defaultOnExistingOptionalZod = z.string().optional().default("asdf");
const defaultOnExistingOptionalDna = dna.string().optional().default("asdf");

const optionalOnDefaultZod = z.string().default("asdf").optional();
const optionalOnDefaultDna = dna.string().default("asdf").optional();

const stringWithRemovedDefaultZod = z.string().default("asdf").removeDefault();
const stringWithRemovedDefaultDna = dna.string().default("asdf").removeDefault();

const applyDefaultAtOutputZod = z
  .string()
  .transform((_) => (Math.random() > 0 ? undefined : _))
  .default("asdf");
const applyDefaultAtOutputDna = dna
  .string()
  .transform((_) => (Math.random() > 0 ? undefined : _))
  .default("asdf");

export const defaultTests = [
  {
    description: "basic defaults",
    zodSchema: basicDefaultZod,
    dnaSchema: basicDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default with optional",
    zodSchema: defaultWithOptionalZod,
    dnaSchema: defaultWithOptionalDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default with transform",
    zodSchema: defaultWithTransformZod,
    dnaSchema: defaultWithTransformDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default on existing optional",
    zodSchema: defaultOnExistingOptionalZod,
    dnaSchema: defaultOnExistingOptionalDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "optional on default",
    zodSchema: optionalOnDefaultZod,
    dnaSchema: optionalOnDefaultDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "removeDefault",
    zodSchema: stringWithRemovedDefaultZod,
    dnaSchema: stringWithRemovedDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
    ],
  },
  {
    description: "apply default at output",
    zodSchema: applyDefaultAtOutputZod,
    dnaSchema: applyDefaultAtOutputDna,
    tests: [
      { description: "valid string", data: "", valid: true },
    ],
  },
];

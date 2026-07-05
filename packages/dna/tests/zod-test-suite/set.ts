import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const stringSetZod = z.set(z.string());
const stringSetDna = dna.set(dna.string());

const minTwoZod = z.set(z.string()).min(2);
const minTwoDna = dna.set(dna.string()).min(2);

const maxTwoZod = z.set(z.string()).max(2);
const maxTwoDna = dna.set(dna.string()).max(2);

const justTwoZod = z.set(z.string()).size(2);
const justTwoDna = dna.set(dna.string()).size(2);

const nonEmptyZod = z.set(z.string()).nonempty();
const nonEmptyDna = dna.set(dna.string()).nonempty();

const nonEmptyMaxZod = z.set(z.string()).nonempty().max(2);
const nonEmptyMaxDna = dna.set(dna.string()).nonempty().max(2);

export const setTests = [
  {
    description: "valid parse",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "valid set", data: new Set(["first", "second"]), valid: true },
      { description: "valid empty set", data: new Set(), valid: true },
    ],
  },
  {
    description: "valid parse: size-related methods",
    zodSchema: minTwoZod,
    dnaSchema: minTwoDna,
    tests: [
      { description: "valid at min", data: new Set(["a", "b"]), valid: true },
      { description: "valid above min", data: new Set(["a", "b", "c"]), valid: true },
      { description: "invalid below min", data: new Set(["a"]), valid: false },
    ],
  },
  {
    description: "max size",
    zodSchema: maxTwoZod,
    dnaSchema: maxTwoDna,
    tests: [
      { description: "valid at max", data: new Set(["a", "b"]), valid: true },
      { description: "valid below max", data: new Set(["a"]), valid: true },
      { description: "invalid above max", data: new Set(["a", "b", "c"]), valid: false },
    ],
  },
  {
    description: "exact size",
    zodSchema: justTwoZod,
    dnaSchema: justTwoDna,
    tests: [
      { description: "valid exact size", data: new Set(["a", "b"]), valid: true },
      { description: "invalid below size", data: new Set(["a"]), valid: false },
      { description: "invalid above size", data: new Set(["a", "b", "c"]), valid: false },
    ],
  },
  {
    description: "nonempty",
    zodSchema: nonEmptyZod,
    dnaSchema: nonEmptyDna,
    tests: [
      { description: "valid nonempty", data: new Set(["a"]), valid: true },
      { description: "invalid empty", data: new Set(), valid: false },
    ],
  },
  {
    description: "nonempty with max",
    zodSchema: nonEmptyMaxZod,
    dnaSchema: nonEmptyMaxDna,
    tests: [
      { description: "valid nonempty at max", data: new Set(["a"]), valid: true },
    ],
  },
];

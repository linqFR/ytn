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

const minMaxSetZod = z.set(z.string()).min(4).max(5);
const minMaxSetDna = dna.set(dna.string()).min(4).max(5);

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
  {
    description: "valid parse: size-related methods (maxTwo, justTwo, nonEmpty, nonEmptyMax, sizeZeroResult)",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "valid empty set (sizeZeroResult)", data: new Set(), valid: true },
    ],
  },
  {
    description: "failing when set does not match size()",
    zodSchema: justTwoZod,
    dnaSchema: justTwoDna,
    tests: [
      { description: "invalid below size", data: new Set(["one"]), valid: false },
      { description: "invalid above size", data: new Set(["one", "two", "three"]), valid: false },
    ],
  },
  {
    description: "doesn't throw when an empty set is given",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "valid empty set", data: new Set([]), valid: true },
    ],
  },
  {
    description: "throws when a Map is given",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "invalid Map instead of Set", data: new Map([]), valid: false },
    ],
  },
  {
    description: "throws when the given set has invalid input",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "invalid symbol in set", data: new Set([Symbol()]), valid: false },
    ],
  },
  {
    description: "throws when the given set has multiple invalid entries",
    zodSchema: stringSetZod,
    dnaSchema: stringSetDna,
    tests: [
      { description: "invalid numbers in set", data: new Set([1, 2]), valid: false },
    ],
  },
  {
    description: "min/max",
    zodSchema: minMaxSetZod,
    dnaSchema: minMaxSetDna,
    tests: [
      { description: "valid at min", data: new Set(["a", "b", "c", "d"]), valid: true },
      { description: "invalid below min", data: new Set(["a", "b", "c"]), valid: false },
      { description: "invalid above max", data: new Set(["a", "b", "c", "d", "e", "f"]), valid: false },
    ],
  },
];

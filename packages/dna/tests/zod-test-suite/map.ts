import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const stringMapZod = z.map(z.string(), z.string());
const stringMapDna = dna.map(dna.string(), dna.string());

const minTwoZod = stringMapZod.min(2);
const minTwoDna = stringMapDna.min(2);

const maxTwoZod = stringMapZod.max(2);
const maxTwoDna = stringMapDna.max(2);

const justTwoZod = stringMapZod.size(2);
const justTwoDna = stringMapDna.size(2);

const nonEmptyZod = stringMapZod.nonempty();
const nonEmptyDna = stringMapDna.nonempty();

const nonEmptyMaxZod = stringMapZod.nonempty().max(2);
const nonEmptyMaxDna = stringMapDna.nonempty().max(2);

export const mapTests = [
  {
    description: "valid parse",
    zodSchema: stringMapZod,
    dnaSchema: stringMapDna,
    tests: [
      { description: "valid map", data: new Map([["first", "foo"], ["second", "bar"]]), valid: true },
      { description: "valid empty map", data: new Map(), valid: true },
    ],
  },
  {
    description: "valid parse: size-related methods",
    zodSchema: minTwoZod,
    dnaSchema: minTwoDna,
    tests: [
      { description: "valid at min", data: new Map([["a", "b"], ["c", "d"]]), valid: true },
      { description: "valid above min", data: new Map([["a", "b"], ["c", "d"], ["e", "f"]]), valid: true },
      { description: "invalid below min", data: new Map([["a", "b"]]), valid: false },
    ],
  },
  {
    description: "max size",
    zodSchema: maxTwoZod,
    dnaSchema: maxTwoDna,
    tests: [
      { description: "valid at max", data: new Map([["a", "b"], ["c", "d"]]), valid: true },
      { description: "valid below max", data: new Map([["a", "b"]]), valid: true },
      { description: "invalid above max", data: new Map([["a", "b"], ["c", "d"], ["e", "f"]]), valid: false },
    ],
  },
  {
    description: "exact size",
    zodSchema: justTwoZod,
    dnaSchema: justTwoDna,
    tests: [
      { description: "valid exact size", data: new Map([["a", "b"], ["c", "d"]]), valid: true },
      { description: "invalid below size", data: new Map([["a", "b"]]), valid: false },
      { description: "invalid above size", data: new Map([["a", "b"], ["c", "d"], ["e", "f"]]), valid: false },
    ],
  },
  {
    description: "nonempty",
    zodSchema: nonEmptyZod,
    dnaSchema: nonEmptyDna,
    tests: [
      { description: "valid nonempty", data: new Map([["a", "b"]]), valid: true },
      { description: "invalid empty", data: new Map(), valid: false },
    ],
  },
  {
    description: "nonempty with max",
    zodSchema: nonEmptyMaxZod,
    dnaSchema: nonEmptyMaxDna,
    tests: [
      { description: "valid nonempty at max", data: new Map([["a", "b"], ["c", "d"]]), valid: true },
    ],
  },
];

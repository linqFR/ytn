import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const stringDiscriminatorZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const stringDiscriminatorDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a"), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const optionalDiscriminatorZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a").optional(), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const optionalDiscriminatorDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a").optional(), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const variousPrimitivesZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("1"), val: z.string() }),
  z.object({ type: z.literal(1), val: z.string() }),
  z.object({ type: z.literal(BigInt(1)), val: z.string() }),
  z.object({ type: z.literal("true"), val: z.string() }),
  z.object({ type: z.literal(true), val: z.string() }),
  z.object({ type: z.literal("null"), val: z.string() }),
  z.object({ type: z.null(), val: z.string() }),
  z.object({ type: z.literal("undefined"), val: z.string() }),
  z.object({ type: z.undefined(), val: z.string() }),
]);
const variousPrimitivesDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("1"), val: dna.string() }),
  dna.object({ type: dna.literal(1), val: dna.string() }),
  dna.object({ type: dna.literal(BigInt(1)), val: dna.string() }),
  dna.object({ type: dna.literal("true"), val: dna.string() }),
  dna.object({ type: dna.literal(true), val: dna.string() }),
  dna.object({ type: dna.literal("null"), val: dna.string() }),
  dna.object({ type: dna.null(), val: dna.string() }),
  dna.object({ type: dna.literal("undefined"), val: dna.string() }),
  dna.object({ type: dna.undefined(), val: dna.string() }),
]);

export const discriminatedUnionTests = [
  {
    description: "valid parse - object",
    zodSchema: stringDiscriminatorZod,
    dnaSchema: stringDiscriminatorDna,
    tests: [
      { description: "valid type a", data: { type: "a", a: "abc" }, valid: true },
    ],
  },
  {
    description: "valid - optional discriminator (object)",
    zodSchema: optionalDiscriminatorZod,
    dnaSchema: optionalDiscriminatorDna,
    tests: [
      { description: "valid with type a", data: { type: "a", a: "abc" }, valid: true },
      { description: "valid without type", data: { a: "abc" }, valid: true },
    ],
  },
  {
    description: "valid - discriminator value of various primitive types",
    zodSchema: variousPrimitivesZod,
    dnaSchema: variousPrimitivesDna,
    tests: [
      { description: "valid string 1", data: { type: "1", val: "val" }, valid: true },
      { description: "valid number 1", data: { type: 1, val: "val" }, valid: true },
      { description: "valid bigint 1", data: { type: BigInt(1), val: "val" }, valid: true },
      { description: "valid string true", data: { type: "true", val: "val" }, valid: true },
      { description: "valid boolean true", data: { type: true, val: "val" }, valid: true },
      { description: "valid string null", data: { type: "null", val: "val" }, valid: true },
      { description: "valid null", data: { type: null, val: "val" }, valid: true },
      { description: "valid string undefined", data: { type: "undefined", val: "val" }, valid: true },
      { description: "valid undefined", data: { type: undefined, val: "val" }, valid: true },
    ],
  },
];

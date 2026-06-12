import { z } from "zod";
import { dna } from "../../src/builder/index.js";

// Reusable schemas matching Zod official tests
const gtFiveZod = z.bigint().gt(BigInt(5));
const gtFiveDna = dna.bigint().gt(BigInt(5));

const gteFiveZod = z.bigint().gte(BigInt(5));
const gteFiveDna = dna.bigint().gte(BigInt(5));

const ltFiveZod = z.bigint().lt(BigInt(5));
const ltFiveDna = dna.bigint().lt(BigInt(5));

const lteFiveZod = z.bigint().lte(BigInt(5));
const lteFiveDna = dna.bigint().lte(BigInt(5));

const positiveZod = z.bigint().positive();
const positiveDna = dna.bigint().positive();

const negativeZod = z.bigint().negative();
const negativeDna = dna.bigint().negative();

const nonnegativeZod = z.bigint().nonnegative();
const nonnegativeDna = dna.bigint().nonnegative();

const nonpositiveZod = z.bigint().nonpositive();
const nonpositiveDna = dna.bigint().nonpositive();

const multipleOfFiveZod = z.bigint().multipleOf(BigInt(5));
const multipleOfFiveDna = dna.bigint().multipleOf(BigInt(5));

export const bigintTests = [
  {
    description: "passing validations",
    zodSchema: z.bigint(),
    dnaSchema: dna.bigint(),
    tests: [
      { description: "valid positive", data: BigInt(1), valid: true },
      { description: "valid zero", data: BigInt(0), valid: true },
      { description: "valid negative", data: BigInt(-1), valid: true },
    ],
  },
  {
    description: "gt",
    zodSchema: gtFiveZod,
    dnaSchema: gtFiveDna,
    tests: [
      { description: "valid above", data: BigInt(6), valid: true },
      { description: "invalid at", data: BigInt(5), valid: false },
    ],
  },
  {
    description: "gte",
    zodSchema: gteFiveZod,
    dnaSchema: gteFiveDna,
    tests: [
      { description: "valid at", data: BigInt(5), valid: true },
      { description: "valid above", data: BigInt(6), valid: true },
      { description: "invalid below", data: BigInt(4), valid: false },
    ],
  },
  {
    description: "lt",
    zodSchema: ltFiveZod,
    dnaSchema: ltFiveDna,
    tests: [
      { description: "valid below", data: BigInt(4), valid: true },
      { description: "invalid at", data: BigInt(5), valid: false },
    ],
  },
  {
    description: "lte",
    zodSchema: lteFiveZod,
    dnaSchema: lteFiveDna,
    tests: [
      { description: "valid at", data: BigInt(5), valid: true },
      { description: "valid below", data: BigInt(4), valid: true },
      { description: "invalid above", data: BigInt(6), valid: false },
    ],
  },
  {
    description: "positive",
    zodSchema: positiveZod,
    dnaSchema: positiveDna,
    tests: [
      { description: "valid positive", data: BigInt(3), valid: true },
      { description: "invalid zero", data: BigInt(0), valid: false },
      { description: "invalid negative", data: BigInt(-2), valid: false },
    ],
  },
  {
    description: "negative",
    zodSchema: negativeZod,
    dnaSchema: negativeDna,
    tests: [
      { description: "valid negative", data: BigInt(-2), valid: true },
      { description: "invalid zero", data: BigInt(0), valid: false },
      { description: "invalid positive", data: BigInt(3), valid: false },
    ],
  },
  {
    description: "nonnegative",
    zodSchema: nonnegativeZod,
    dnaSchema: nonnegativeDna,
    tests: [
      { description: "valid zero", data: BigInt(0), valid: true },
      { description: "valid positive", data: BigInt(7), valid: true },
      { description: "invalid negative", data: BigInt(-1), valid: false },
    ],
  },
  {
    description: "nonpositive",
    zodSchema: nonpositiveZod,
    dnaSchema: nonpositiveDna,
    tests: [
      { description: "valid zero", data: BigInt(0), valid: true },
      { description: "valid negative", data: BigInt(-12), valid: true },
      { description: "invalid positive", data: BigInt(1), valid: false },
    ],
  },
  {
    description: "multipleOf",
    zodSchema: multipleOfFiveZod,
    dnaSchema: multipleOfFiveDna,
    tests: [
      { description: "valid multiple", data: BigInt(15), valid: true },
      { description: "invalid not multiple", data: BigInt(13), valid: false },
    ],
  },
];

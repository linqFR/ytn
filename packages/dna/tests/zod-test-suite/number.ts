import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const basicNumberZod = z.number();
const basicNumberDna = dna.number();

const gtZod = z.number().gt(0).gt(5);
const gtDna = dna.number().gt(0).gt(5);

const gteZod = z.number().gt(0).gte(1).gte(5);
const gteDna = dna.number().gt(0).gte(1).gte(5);

const minZod = z.number().min(0).min(5);
const minDna = dna.number().min(0).min(5);

const ltZod = z.number().lte(10).lt(5);
const ltDna = dna.number().lte(10).lt(5);

const lteZod = z.number().lte(10).lte(5);
const lteDna = dna.number().lte(10).lte(5);

const maxZod = z.number().max(10).max(5);
const maxDna = dna.number().max(10).max(5);

const intZod = z.number().int();
const intDna = dna.number().int();

const positiveZod = z.number().positive();
const positiveDna = dna.number().positive();

const negativeZod = z.number().negative();
const negativeDna = dna.number().negative();

const nonpositiveZod = z.number().nonpositive();
const nonpositiveDna = dna.number().nonpositive();

const nonnegativeZod = z.number().nonnegative();
const nonnegativeDna = dna.number().nonnegative();

const multipleOfZod = z.number().multipleOf(5);
const multipleOfDna = dna.number().multipleOf(5);

const stepZod = z.number().step(0.1);
const stepDna = dna.number().step(0.1);

const finiteZod = z.number().finite();
const finiteDna = dna.number().finite();

const safeZod = z.number().safe();
const safeDna = dna.number().safe();

const int32Zod = z.int32().min(5);
const int32Dna = dna.int32().min(5);

const multipleOf1e6Zod = z.number().multipleOf(0.000001);
const multipleOf1e6Dna = dna.number().multipleOf(0.000001);

const multipleOf1e7Zod = z.number().multipleOf(0.0000001);
const multipleOf1e7Dna = dna.number().multipleOf(0.0000001);

const multipleOf007Zod = z.number().multipleOf(0.07);
const multipleOf007Dna = dna.number().multipleOf(0.07);

const multipleOfNeg5Zod = z.number().multipleOf(-5);
const multipleOfNeg5Dna = dna.number().multipleOf(-5);

const multipleOf1e10Zod = z.number().multipleOf(1e-10);
const multipleOf1e10Dna = dna.number().multipleOf(1e-10);

const multipleOf1e15Zod = z.number().multipleOf(1e-15);
const multipleOf1e15Dna = dna.number().multipleOf(1e-15);

const multipleOf1e7SmallZod = z.number().multipleOf(1e-7);
const multipleOf1e7SmallDna = dna.number().multipleOf(1e-7);

const stepPointZeroZeroZeroOneZod = z.number().step(0.0001);
const stepPointZeroZeroZeroOneDna = dna.number().step(0.0001);

const stepSixPointFourZod = z.number().step(6.4);
const stepSixPointFourDna = dna.number().step(6.4);

const negativeZeroBasicZod = z.number();
const negativeZeroBasicDna = dna.number();

const negativeZeroPositiveZod = z.number().positive();
const negativeZeroPositiveDna = dna.number().positive();

const negativeZeroNonnegativeZod = z.number().nonnegative();
const negativeZeroNonnegativeDna = dna.number().nonnegative();

export const numberTests = [
  {
    description: "z.number() basic validation",
    zodSchema: basicNumberZod,
    dnaSchema: basicNumberDna,
    tests: [
      { description: "valid 1234", data: 1234, valid: true },
    ],
  },
  {
    description: "NaN validation",
    zodSchema: basicNumberZod,
    dnaSchema: basicNumberDna,
    tests: [
      { description: "invalid NaN", data: Number.NaN, valid: false },
    ],
  },
  {
    description: "Infinity validation - positive",
    zodSchema: basicNumberZod,
    dnaSchema: basicNumberDna,
    tests: [
      { description: "invalid positive infinity", data: Number.POSITIVE_INFINITY, valid: false },
    ],
  },
  {
    description: "Infinity validation - negative",
    zodSchema: basicNumberZod,
    dnaSchema: basicNumberDna,
    tests: [
      { description: "invalid negative infinity", data: Number.NEGATIVE_INFINITY, valid: false },
    ],
  },
  {
    description: ".gt() validation",
    zodSchema: gtZod,
    dnaSchema: gtDna,
    tests: [
      { description: "valid 6", data: 6, valid: true },
      { description: "invalid 5", data: 5, valid: false },
    ],
  },
  {
    description: ".gte() validation",
    zodSchema: gteZod,
    dnaSchema: gteDna,
    tests: [
      { description: "valid 5", data: 5, valid: true },
      { description: "invalid 4", data: 4, valid: false },
    ],
  },
  {
    description: ".min() validation",
    zodSchema: minZod,
    dnaSchema: minDna,
    tests: [
      { description: "valid 5", data: 5, valid: true },
      { description: "invalid 4", data: 4, valid: false },
    ],
  },
  {
    description: ".lt() validation",
    zodSchema: ltZod,
    dnaSchema: ltDna,
    tests: [
      { description: "valid 4", data: 4, valid: true },
      { description: "invalid 5", data: 5, valid: false },
    ],
  },
  {
    description: ".lte() validation",
    zodSchema: lteZod,
    dnaSchema: lteDna,
    tests: [
      { description: "valid 5", data: 5, valid: true },
      { description: "invalid 6", data: 6, valid: false },
    ],
  },
  {
    description: ".max() validation",
    zodSchema: maxZod,
    dnaSchema: maxDna,
    tests: [
      { description: "valid 5", data: 5, valid: true },
      { description: "invalid 6", data: 6, valid: false },
    ],
  },
  {
    description: ".int() validation",
    zodSchema: intZod,
    dnaSchema: intDna,
    tests: [
      { description: "valid 4", data: 4, valid: true },
      { description: "invalid 3.14", data: 3.14, valid: false },
    ],
  },
  {
    description: ".positive() validation",
    zodSchema: positiveZod,
    dnaSchema: positiveDna,
    tests: [
      { description: "valid 1", data: 1, valid: true },
      { description: "invalid 0", data: 0, valid: false },
      { description: "invalid -1", data: -1, valid: false },
    ],
  },
  {
    description: ".negative() validation",
    zodSchema: negativeZod,
    dnaSchema: negativeDna,
    tests: [
      { description: "valid -1", data: -1, valid: true },
      { description: "invalid 0", data: 0, valid: false },
      { description: "invalid 1", data: 1, valid: false },
    ],
  },
  {
    description: ".nonpositive() validation",
    zodSchema: nonpositiveZod,
    dnaSchema: nonpositiveDna,
    tests: [
      { description: "valid 0", data: 0, valid: true },
      { description: "valid -1", data: -1, valid: true },
      { description: "invalid 1", data: 1, valid: false },
    ],
  },
  {
    description: ".nonnegative() validation",
    zodSchema: nonnegativeZod,
    dnaSchema: nonnegativeDna,
    tests: [
      { description: "valid 0", data: 0, valid: true },
      { description: "valid 1", data: 1, valid: true },
      { description: "invalid -1", data: -1, valid: false },
    ],
  },
  {
    description: ".multipleOf() with positive divisor",
    zodSchema: multipleOfZod,
    dnaSchema: multipleOfDna,
    tests: [
      { description: "valid 15", data: 15, valid: true },
      { description: "valid -15", data: -15, valid: true },
      { description: "invalid 7.5", data: 7.5, valid: false },
      { description: "invalid -7.5", data: -7.5, valid: false },
    ],
  },
  {
    description: ".step() validation",
    zodSchema: stepZod,
    dnaSchema: stepDna,
    tests: [
      { description: "valid 6", data: 6, valid: true },
      { description: "valid 6.1", data: 6.1, valid: true },
      { description: "invalid 6.11", data: 6.11, valid: false },
    ],
  },
  {
    description: ".finite() validation",
    zodSchema: finiteZod,
    dnaSchema: finiteDna,
    tests: [
      { description: "valid 123", data: 123, valid: true },
      { description: "invalid positive infinity", data: Number.POSITIVE_INFINITY, valid: false },
      { description: "invalid negative infinity", data: Number.NEGATIVE_INFINITY, valid: false },
    ],
  },
  {
    description: ".safe() validation",
    zodSchema: safeZod,
    dnaSchema: safeDna,
    tests: [
      { description: "valid MIN_SAFE_INTEGER", data: Number.MIN_SAFE_INTEGER, valid: true },
      { description: "valid MAX_SAFE_INTEGER", data: Number.MAX_SAFE_INTEGER, valid: true },
      { description: "invalid MIN_SAFE_INTEGER - 1", data: Number.MIN_SAFE_INTEGER - 1, valid: false },
      { description: "invalid MAX_SAFE_INTEGER + 1", data: Number.MAX_SAFE_INTEGER + 1, valid: false },
    ],
  },
  {
    description: ".int32() with min",
    zodSchema: int32Zod,
    dnaSchema: int32Dna,
    tests: [
      { description: "valid 6", data: 6, valid: true },
      { description: "invalid 1", data: 1, valid: false },
    ],
  },
  {
    description: ".multipleOf() tolerance checks - 0.000001",
    zodSchema: multipleOf1e6Zod,
    dnaSchema: multipleOf1e6Dna,
    tests: [
      { description: "valid 5.123", data: 5.123, valid: true },
      { description: "valid 5.123456", data: 5.123456, valid: true },
      { description: "invalid 5.1234567", data: 5.1234567, valid: false },
      { description: "invalid 5.12345678", data: 5.12345678, valid: false },
    ],
  },
  {
    description: ".multipleOf() tolerance checks - 0.0000001",
    zodSchema: multipleOf1e7Zod,
    dnaSchema: multipleOf1e7Dna,
    tests: [
      { description: "valid 5.123", data: 5.123, valid: true },
      { description: "valid 5.123456", data: 5.123456, valid: true },
      { description: "valid 5.1234567", data: 5.1234567, valid: true },
      { description: "invalid 5.12345678", data: 5.12345678, valid: false },
    ],
  },
  {
    description: ".multipleOf() exact decimal multiples - 0.07",
    zodSchema: multipleOf007Zod,
    dnaSchema: multipleOf007Dna,
    tests: [
      { description: "valid 2.03 (29 * 0.07)", data: 2.03, valid: true },
      { description: "valid 4.06 (58 * 0.07)", data: 4.06, valid: true },
      { description: "valid 8.54 (122 * 0.07)", data: 8.54, valid: true },
      { description: "invalid 2.04 (not a multiple)", data: 2.04, valid: false },
    ],
  },
  {
    description: ".multipleOf() with negative divisor",
    zodSchema: multipleOfNeg5Zod,
    dnaSchema: multipleOfNeg5Dna,
    tests: [
      { description: "valid -15", data: -15, valid: true },
      { description: "valid 15", data: 15, valid: true },
      { description: "invalid -7.5", data: -7.5, valid: false },
      { description: "invalid 7.5", data: 7.5, valid: false },
    ],
  },
  {
    description: ".multipleOf() with scientific notation (multi-digit exponents) - 1e-10",
    zodSchema: multipleOf1e10Zod,
    dnaSchema: multipleOf1e10Dna,
    tests: [
      { description: "valid 1e-10", data: 1e-10, valid: true },
      { description: "valid 5e-10", data: 5e-10, valid: true },
      { description: "valid 1e-9 (10 * 1e-10)", data: 1e-9, valid: true },
    ],
  },
  {
    description: ".multipleOf() with scientific notation - 1e-15",
    zodSchema: multipleOf1e15Zod,
    dnaSchema: multipleOf1e15Dna,
    tests: [
      { description: "valid 1e-15 (exponent = 15, two digits)", data: 1e-15, valid: true },
      { description: "valid 3e-15", data: 3e-15, valid: true },
    ],
  },
  {
    description: ".multipleOf() with small floats (#5792) - 1e-7",
    zodSchema: multipleOf1e7SmallZod,
    dnaSchema: multipleOf1e7SmallDna,
    tests: [
      { description: "valid 0", data: 0, valid: true },
      { description: "valid 1e-7", data: 1e-7, valid: true },
      { description: "valid 2e-7", data: 2e-7, valid: true },
      { description: "valid 3e-7", data: 3e-7, valid: true },
      { description: "invalid 2.5e-7 (not integer multiple)", data: 2.5e-7, valid: false },
      { description: "invalid 1.5e-7 (not integer multiple)", data: 1.5e-7, valid: false },
    ],
  },
  {
    description: ".step() validation - 0.0001",
    zodSchema: stepPointZeroZeroZeroOneZod,
    dnaSchema: stepPointZeroZeroZeroOneDna,
    tests: [
      { description: "valid 3.01", data: 3.01, valid: true },
    ],
  },
  {
    description: ".step() validation - 6.4",
    zodSchema: stepSixPointFourZod,
    dnaSchema: stepSixPointFourDna,
    tests: [
      { description: "valid 12.8", data: 12.8, valid: true },
      { description: "invalid 6.41", data: 6.41, valid: false },
    ],
  },
  {
    description: ".step() validation - 0.1 additional cases",
    zodSchema: stepZod,
    dnaSchema: stepDna,
    tests: [
      { description: "valid 6", data: 6, valid: true },
      { description: "valid 6.1", data: 6.1, valid: true },
      { description: "invalid 6.11", data: 6.11, valid: false },
      { description: "invalid 6.1000000001", data: 6.1000000001, valid: false },
    ],
  },
  {
    description: "negative zero edge case - basic number",
    zodSchema: negativeZeroBasicZod,
    dnaSchema: negativeZeroBasicDna,
    tests: [
      { description: "valid -0", data: -0, valid: true },
      { description: "valid 0", data: 0, valid: true },
    ],
  },
  {
    description: "negative zero edge case - positive() rejects both",
    zodSchema: negativeZeroPositiveZod,
    dnaSchema: negativeZeroPositiveDna,
    tests: [
      { description: "invalid -0 (not positive)", data: -0, valid: false },
      { description: "invalid 0 (not positive)", data: 0, valid: false },
    ],
  },
  {
    description: "negative zero edge case - nonnegative() accepts both",
    zodSchema: negativeZeroNonnegativeZod,
    dnaSchema: negativeZeroNonnegativeDna,
    tests: [
      { description: "valid -0 (non-negative)", data: -0, valid: true },
      { description: "valid 0 (non-negative)", data: 0, valid: true },
    ],
  },
];

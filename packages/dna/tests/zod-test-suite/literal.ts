import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const literalTunaZod = z.literal("tuna");
const literalTunaDna = dna.literal("tuna");

const literalTunaCustomMessageZod = z.literal("tuna", {
  message: "That's not a tuna",
});
const literalTunaCustomMessageDna = dna.literal("tuna", {
  message: "That's not a tuna",
});

const literalFortyTwoZod = z.literal(42);
const literalFortyTwoDna = dna.literal(42);

const literalTrueZod = z.literal(true);
const literalTrueDna = dna.literal(true);

const literalTunaZod2 = z.literal("Tuna");
const literalTunaDna2 = dna.literal("Tuna");

const literalBigIntZod = z.literal(BigInt(12));
const literalBigIntDna = dna.literal(BigInt(12));

export const literalTests = [
  {
    description: "passing validations - tuna",
    zodSchema: literalTunaZod,
    dnaSchema: literalTunaDna,
    tests: [
      { description: "valid tuna", data: "tuna", valid: true },
    ],
  },
  {
    description: "passing validations - 42",
    zodSchema: literalFortyTwoZod,
    dnaSchema: literalFortyTwoDna,
    tests: [
      { description: "valid 42", data: 42, valid: true },
    ],
  },
  {
    description: "passing validations - true",
    zodSchema: literalTrueZod,
    dnaSchema: literalTrueDna,
    tests: [
      { description: "valid true", data: true, valid: true },
    ],
  },
  {
    description: "failing validations - tuna",
    zodSchema: literalTunaZod,
    dnaSchema: literalTunaDna,
    tests: [
      { description: "invalid shark", data: "shark", valid: false },
    ],
  },
  {
    description: "literal with custom message",
    zodSchema: literalTunaCustomMessageZod,
    dnaSchema: literalTunaCustomMessageDna,
    tests: [
      { description: "valid tuna", data: "tuna", valid: true },
      { description: "invalid shark", data: "shark", valid: false },
    ],
  },
  {
    description: "failing validations - 42",
    zodSchema: literalFortyTwoZod,
    dnaSchema: literalFortyTwoDna,
    tests: [
      { description: "invalid 43", data: 43, valid: false },
    ],
  },
  {
    description: "failing validations - true",
    zodSchema: literalTrueZod,
    dnaSchema: literalTrueDna,
    tests: [
      { description: "invalid false", data: false, valid: false },
    ],
  },
  {
    description: "literal default error message",
    zodSchema: literalTunaZod2,
    dnaSchema: literalTunaDna2,
    tests: [
      { description: "invalid Trout", data: "Trout", valid: false },
    ],
  },
  {
    description: "literal bigint default error message",
    zodSchema: literalBigIntZod,
    dnaSchema: literalBigIntDna,
    tests: [
      { description: "invalid 13n", data: BigInt(13), valid: false },
    ],
  },
];

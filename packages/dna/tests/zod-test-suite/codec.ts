import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable codec schemas
const isoDateCodecZod = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

const isoDateCodecDna = dna.codec(dna.iso.datetime(), dna.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

const stringNumberCodecZod = z.codec(z.string(), z.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

const stringNumberCodecDna = dna.codec(dna.string(), dna.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

const stringIntCodecZod = z.codec(z.string(), z.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

const stringIntCodecDna = dna.codec(dna.string(), dna.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

export const codecTests = [
  {
    description: "codec basic functionality - forward decoding (ISO string -> Date)",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "valid ISO string", data: "2024-01-15T10:30:00.000Z", valid: true },
    ],
  },
  {
    description: "codec basic functionality - backward encoding (Date -> ISO string)",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "valid Date", data: new Date("2024-01-15T10:30:00.000Z"), valid: true },
    ],
  },
  {
    description: "codec round trip",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "round trip ISO string", data: "2024-12-25T15:45:30.123Z", valid: true },
    ],
  },
  {
    description: "codec with refinement",
    zodSchema: isoDateCodecZod.refine((val) => val.getFullYear() === 2024, { error: "Year must be 2024" }),
    dnaSchema: isoDateCodecDna.refine((val) => val.getFullYear() === 2024, { error: "Year must be 2024" }),
    tests: [
      { description: "valid 2024 date", data: "2024-01-15T10:30:00.000Z", valid: true },
      { description: "invalid year 2023", data: "2023-01-15T10:30:00.000Z", valid: false },
    ],
  },
  {
    description: "safe codec operations - invalid input",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "invalid date format", data: "invalid-date", valid: false },
    ],
  },
  {
    description: "codec with different types (string -> number)",
    zodSchema: stringNumberCodecZod,
    dnaSchema: stringNumberCodecDna,
    tests: [
      { description: "valid string to number", data: "42.5", valid: true },
    ],
  },
  {
    description: "codec type inference (string -> int)",
    zodSchema: stringIntCodecZod,
    dnaSchema: stringIntCodecDna,
    tests: [
      { description: "valid string to int", data: "123", valid: true },
    ],
  },
];

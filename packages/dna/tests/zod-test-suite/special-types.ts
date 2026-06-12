import { z } from "zod";
import { dna } from "../../src/builder/index.js";

export const specialTypesTests = [
  {
    description: "z.boolean",
    zodSchema: z.boolean(),
    dnaSchema: dna.boolean(),
    tests: [
      { description: "valid true", data: true, valid: true },
      { description: "valid false", data: false, valid: true },
      { description: "invalid number", data: 123, valid: false },
      { description: "invalid string", data: "true", valid: false },
    ],
  },
  {
    description: "z.bigint",
    zodSchema: z.bigint(),
    dnaSchema: dna.bigint(),
    tests: [
      { description: "valid bigint", data: BigInt(123), valid: true },
      { description: "invalid number", data: 123, valid: false },
      { description: "invalid string", data: "123", valid: false },
    ],
  },
  {
    description: "z.symbol",
    zodSchema: z.symbol(),
    dnaSchema: dna.symbol(),
    tests: [
      { description: "valid symbol", data: Symbol(), valid: true },
      { description: "invalid string", data: "symbol", valid: false },
    ],
  },
  {
    description: "z.date",
    zodSchema: z.date(),
    dnaSchema: dna.date(),
    tests: [
      { description: "valid date", data: new Date(), valid: true },
      { description: "invalid string", data: "date", valid: false },
    ],
  },
];

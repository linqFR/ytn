import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const customZod = z.custom<number>((x) => typeof x === "number");
const customDna = dna.custom<number>((x) => typeof x === "number");

const customStringParamsZod = z.custom<number>((x) => typeof x !== "number", "customerr");
const customStringParamsDna = dna.custom<number>((x) => typeof x !== "number", "customerr");

const customNonContinuableZod = z
  .custom<string>((val) => typeof val === "string")
  .transform((_) => {
    throw new Error("Invalid input");
  });
const customNonContinuableDna = dna
  .custom<string>((val) => typeof val === "string")
  .transform((_) => {
    throw new Error("Invalid input");
  });

export const customTests = [
  {
    description: "custom basic",
    zodSchema: customZod,
    dnaSchema: customDna,
    tests: [
      { description: "valid number", data: 1234, valid: true },
      { description: "invalid object", data: {}, valid: false },
    ],
  },
  {
    description: "custom with string params",
    zodSchema: customStringParamsZod,
    dnaSchema: customStringParamsDna,
    tests: [
      { description: "invalid number with custom error", data: 1234, valid: false },
    ],
  },
  {
    description: "custom non-continuable by default",
    zodSchema: customNonContinuableZod,
    dnaSchema: customNonContinuableDna,
    tests: [
      { description: "invalid number", data: 123, valid: false },
    ],
  },
];

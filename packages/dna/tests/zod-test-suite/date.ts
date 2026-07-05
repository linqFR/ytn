import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const beforeBenchmarkDate = new Date(Date.UTC(2022, 10, 4));
const benchmarkDate = new Date(Date.UTC(2022, 10, 5));
const afterBenchmarkDate = new Date(Date.UTC(2022, 10, 6));

const minCheckZod = z.date().min(benchmarkDate);
const minCheckDna = dna.date().min(benchmarkDate);

const maxCheckZod = z.date().max(benchmarkDate);
const maxCheckDna = dna.date().max(benchmarkDate);

export const dateTests = [
  {
    description: "passing validations",
    zodSchema: z.date(),
    dnaSchema: dna.date(),
    tests: [
      { description: "valid date", data: new Date(), valid: true },
    ],
  },
  {
    description: "date min",
    zodSchema: minCheckZod,
    dnaSchema: minCheckDna,
    tests: [
      { description: "valid at min", data: benchmarkDate, valid: true },
      { description: "valid after min", data: afterBenchmarkDate, valid: true },
      { description: "invalid before min", data: beforeBenchmarkDate, valid: false },
    ],
  },
  {
    description: "date max",
    zodSchema: maxCheckZod,
    dnaSchema: maxCheckDna,
    tests: [
      { description: "valid at max", data: benchmarkDate, valid: true },
      { description: "valid before max", data: beforeBenchmarkDate, valid: true },
      { description: "invalid after max", data: afterBenchmarkDate, valid: false },
    ],
  },
];

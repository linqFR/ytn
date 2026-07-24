import { z } from "zod";
import { dna } from "../../src/index.js";

export const pipeTests = [
  {
    description: "string to number pipe",
    zodSchema: z.string().transform((v) => Number(v)).pipe(z.number()),
    dnaSchema: dna.string().transform((v: string) => Number(v)).pipe(dna.number()),
    tests: [{ description: "valid string", data: "1234", valid: true }],
  },
  {
    description: "string to number pipe async",
    zodSchema: z.string().transform(async (val) => Number(val)).pipe(z.number()),
    dnaSchema: dna.string().transform(async (val: string) => Number(val)).pipe(dna.number()),
    tests: [{ description: "valid async string", data: "1234", valid: true }],
  },
  {
    description: "string with default fallback",
    zodSchema: z
      .pipe(
        z.transform((v) => (v === "none" ? undefined : v)),
        z.string()
      )
      .catch("default"),
    dnaSchema: dna
      .pipe(
        dna.transform((v: any) => (v === "none" ? undefined : v)),
        dna.string()
      )
      .catch("default"),
    tests: [
      { description: "ok", data: "ok", valid: true },
      { description: "undefined", data: undefined, valid: true },
      { description: "none", data: "none", valid: true },
      { description: "number", data: 15, valid: true },
    ],
  },
  {
    description: "continue on non-fatal errors",
    zodSchema: z
      .string()
      .refine((c) => c === "1234", "A")
      .transform((val) => Number(val))
      .refine((c) => c === 1234, "B"),
    dnaSchema: dna
      .string()
      .refine((c: string) => c === "1234", "A")
      .transform((val: string) => Number(val))
      .refine((c: number) => c === 1234, "B"),
    tests: [{ description: "4321 reports A and B", data: "4321", valid: false }],
  },
  {
    description: "break on fatal errors",
    zodSchema: z
      .string()
      .refine((c) => c === "1234", { message: "A", abort: true })
      .transform((val) => Number(val))
      .refine((c) => c === 1234, "B"),
    dnaSchema: dna
      .string()
      .refine((c: string) => c === "1234", "A")
      .transform((val: string) => Number(val))
      .refine((c: number) => c === 1234, "B"),
    tests: [{ description: "4321 reports only A", data: "4321", valid: false }],
  },
  {
    description: "reverse parsing with pipe",
    zodSchema: z.string().pipe(z.string()),
    dnaSchema: dna.string().pipe(dna.string()),
    tests: [{ description: "valid string", data: "asdf", valid: true }],
  },
];

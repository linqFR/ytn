import * as z from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const prefaultTrimZod = z.prefault(z.string().trim(), "  default  ");
const prefaultTrimDna = dna.prefault(dna.string().trim(), "  default  ");

const prefaultInsideObjectZod = z.object({
  name: z.string().optional(),
  age: z.number().default(1234),
  email: z.string().prefault("1234"),
});
const prefaultInsideObjectDna = dna.object({
  name: dna.string().optional(),
  age: dna.number().default(1234),
  email: dna.string().prefault("1234"),
});

const prefaultObjectZod = z
  .object({
    a: z.string(),
  })
  .prefault({ a: "x" });
const prefaultObjectDna = dna
  .object({
    a: dna.string(),
  })
  .prefault({ a: "x" });

const prefaultStringZod = z.string().prefault("hello");
const prefaultStringDna = dna.string().prefault("hello");

export const prefaultTests = [
  {
    description: "basic prefault with trim",
    zodSchema: prefaultTrimZod,
    dnaSchema: prefaultTrimDna,
    tests: [
      { description: "valid string with trim", data: "  asdf  ", valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "prefault inside object",
    zodSchema: prefaultInsideObjectZod,
    dnaSchema: prefaultInsideObjectDna,
    tests: [
      { description: "valid complete object", data: { name: "John", age: 30, email: "test@example.com" }, valid: true },
      { description: "valid with prefault applied", data: { name: "John", age: 30 }, valid: true },
      { description: "valid with all optional", data: {}, valid: true },
      { description: "invalid wrong type for name", data: { name: 123, age: 30, email: "test@example.com" }, valid: false },
    ],
  },
  {
    description: "object schema with prefault",
    zodSchema: prefaultObjectZod,
    dnaSchema: prefaultObjectDna,
    tests: [
      { description: "valid object", data: { a: "test" }, valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
      { description: "invalid wrong type", data: 123, valid: false },
    ],
  },
  {
    description: "string prefault",
    zodSchema: prefaultStringZod,
    dnaSchema: prefaultStringDna,
    tests: [
      { description: "valid string", data: "world", valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
];

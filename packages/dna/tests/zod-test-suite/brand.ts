import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const brandZod = z.object({ name: z.string() }).brand<"MyBrand">();
const brandDna = dna.object({ name: dna.string() }).brand<"MyBrand">();

// Additional schemas for expanded test groups
const brandObjectZod = z.object({ name: z.string() }).brand<"superschema">();
const brandObjectDna = dna.object({ name: dna.string() }).brand<"superschema">();

const brandNumberZod = z.number().brand<42>();
const brandNumberDna = dna.number().brand<42>();

const brandRecordZod = z.record(z.string().brand("SomeBrand"), z.number());
const brandRecordDna = dna.record(dna.string().brand("SomeBrand"), dna.number());

const brandOutDefaultZod = z.string().brand<"A">();
const brandOutDefaultDna = dna.string().brand<"A">();

const brandOutExplicitZod = z.string().brand<"A", "out">();
const brandOutExplicitDna = dna.string().brand<"A", "out">();

const brandInZod = z.string().brand<"A", "in">();
const brandInDna = dna.string().brand<"A", "in">();

const brandInoutZod = z.string().brand<"A", "inout">();
const brandInoutDna = dna.string().brand<"A", "inout">();

export const brandTests = [
  {
    description: "brand basic",
    zodSchema: brandZod,
    dnaSchema: brandDna,
    tests: [
      { description: "valid object", data: { name: "hello" }, valid: true },
      { description: "invalid missing field", data: {}, valid: false },
    ],
  },
  {
    description: "branded types (object branding)",
    zodSchema: brandObjectZod,
    dnaSchema: brandObjectDna,
    tests: [
      { description: "valid object", data: { name: "hello there" }, valid: true },
      { description: "invalid missing field", data: {}, valid: false },
    ],
  },
  {
    description: "branded types (number branding)",
    zodSchema: brandNumberZod,
    dnaSchema: brandNumberDna,
    tests: [
      { description: "valid number", data: 42, valid: true },
      { description: "invalid string", data: "42", valid: false },
    ],
  },
  {
    description: "branded record",
    zodSchema: brandRecordZod,
    dnaSchema: brandRecordDna,
    tests: [
      { description: "valid record", data: { a: 1 }, valid: true },
      { description: "invalid value type", data: { a: "1" }, valid: false },
    ],
  },
  {
    description: "brand direction: out (default)",
    zodSchema: brandOutDefaultZod,
    dnaSchema: brandOutDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "brand direction: out (explicit)",
    zodSchema: brandOutExplicitZod,
    dnaSchema: brandOutExplicitDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "brand direction: in",
    zodSchema: brandInZod,
    dnaSchema: brandInDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "brand direction: inout",
    zodSchema: brandInoutZod,
    dnaSchema: brandInoutDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
];

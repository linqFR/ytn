import * as z from "zod";
import { dna } from "../../src/builder/index.js";

export const registriesTests = [
  {
    description: "schema with .meta() method",
    zodSchema: z.string().meta({ name: "hello" }),
    dnaSchema: dna.string().meta({ name: "hello" }),
    tests: [
      {
        description: "valid string with metadata",
        data: "test",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "schema with .describe() method",
    zodSchema: z.string().describe("Hello"),
    dnaSchema: dna.string().describe("Hello"),
    tests: [
      {
        description: "valid string with description",
        data: "test",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "schema with both .meta() and .describe()",
    zodSchema: z.string().meta({ name: "hello" }).describe("Hello"),
    dnaSchema: dna.string().meta({ name: "hello" }).describe("Hello"),
    tests: [
      {
        description: "valid string with both metadata",
        data: "test",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "object with metadata on fields",
    zodSchema: z.object({
      name: z.string().meta({ label: "Name field" }),
      age: z.number().describe("Age in years"),
    }),
    dnaSchema: dna.object({
      name: dna.string().meta({ label: "Name field" }),
      age: dna.number().describe("Age in years"),
    }),
    tests: [
      {
        description: "valid object with metadata",
        data: { name: "John", age: 30 },
        valid: true,
      },
      {
        description: "invalid missing field",
        data: { name: "John" },
        valid: false,
      },
    ],
  },
  {
    description: "schema with complex metadata",
    zodSchema: z.string().meta({
      name: "username",
      description: "User's unique identifier",
      examples: ["john_doe", "jane_smith"],
    }),
    dnaSchema: dna.string().meta({
      name: "username",
      description: "User's unique identifier",
      examples: ["john_doe", "jane_smith"],
    }),
    tests: [
      {
        description: "valid string with complex metadata",
        data: "john_doe",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "metadata does not affect validation",
    zodSchema: z.number().min(5).meta({ label: "Minimum 5" }),
    dnaSchema: dna.number().min(5).meta({ label: "Minimum 5" }),
    tests: [
      {
        description: "valid number >= 5",
        data: 10,
        valid: true,
      },
      {
        description: "invalid number < 5",
        data: 3,
        valid: false,
      },
    ],
  },
];

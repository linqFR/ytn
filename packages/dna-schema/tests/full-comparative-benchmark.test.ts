import { describe, it, expect, beforeAll } from "vitest";
import { jschemaToDna } from "../src/jschema-to-dna.js";
import { validator, parser } from "../src/dna-to-js.js";
import Ajv2020 from "ajv/dist/2020.js";
const Ajv = (Ajv2020 as any).default ?? Ajv2020;
import { z } from "zod";

const testSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    age: { type: "number", minimum: 0, maximum: 150 },
    email: { type: "string", format: "email" },
    tags: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    active: { type: "boolean" },
  },
  required: ["name", "email"],
  additionalProperties: false,
};

const validData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  tags: ["user", "premium"],
  active: true,
};

const invalidData = {
  name: "", // too short
  age: -5, // too low
  email: "invalid-email",
  extraProp: "not allowed",
};

describe("Full Comparative Benchmark: DNA vs AJV vs Zod", () => {
  let ajvValid: any;
  let ajvErrors: any;
  let dnaValid: any;
  let dnaErrors: any;
  let zodSchema: any;

  beforeAll(() => {
    const dna = jschemaToDna(testSchema);
    
    // 1. AJV Validation (minimal)
    ajvValid = new Ajv({ validateFormats: false }).compile(testSchema);
    
    // 2. AJV Errors (detailed)
    ajvErrors = new Ajv({ validateFormats: false, allErrors: true }).compile(testSchema);
    
    // 3. DNA Validation (pure boolean — break on first failure)
    dnaValid = validator(dna);

    // 4. DNA Errors (parser — collects ALL errors, returns {success, data|errors})
    dnaErrors = parser(dna);
    
    // 5. Zod
    zodSchema = z.object({
      name: z.string().min(1).max(100),
      age: z.number().min(0).max(150),
      email: z.string().email(),
      tags: z.array(z.string()).min(1).max(10),
      active: z.boolean()
    });
  });

  describe("Compilation Performance", () => {

    it("Summary - Compilation comparison table", () => {
      const iterations = 1000;

      const schemas = Array.from({ length: iterations }, () => JSON.parse(JSON.stringify(testSchema)));

      let start = performance.now();
      for (let i = 0; i < iterations; i++) validator(jschemaToDna(schemas[i]));
      const dnaValComp = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) parser(jschemaToDna(schemas[i]));
      const dnaParseComp = (performance.now() - start) / iterations;

      const ajv1 = new Ajv({ validateFormats: false });
      start = performance.now();
      for (let i = 0; i < iterations; i++) ajv1.compile(schemas[i]);
      const ajvMinComp = (performance.now() - start) / iterations;

      const ajv2 = new Ajv({ validateFormats: false, allErrors: true });
      start = performance.now();
      for (let i = 0; i < iterations; i++) ajv2.compile(schemas[i]);
      const ajvAllComp = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) {
        z.object({
          name: z.string().min(1).max(100),
          age: z.number().min(0).max(150),
          email: z.string().email(),
          tags: z.array(z.string()).min(1).max(10),
          active: z.boolean()
        });
      }
      const zodComp = (performance.now() - start) / iterations;

      console.log("\n" + "=".repeat(80));
      console.log("COMPILATION PERFORMANCE COMPARISON (ms per compilation)");
      console.log("=".repeat(80));
      console.log(`| Mode               | Time (ms)    |`);
      console.log("|--------------------|--------------|");
      console.log(`| DNA Validation     | ${dnaValComp.toFixed(5)}     |`);
      console.log(`| DNA Parser         | ${dnaParseComp.toFixed(5)}     |`);
      console.log(`| AJV Minimal        | ${ajvMinComp.toFixed(5)}     |`);
      console.log(`| AJV AllErrors      | ${ajvAllComp.toFixed(5)}     |`);
      console.log(`| Zod                | ${zodComp.toFixed(5)}     |`);
      console.log("=".repeat(80));
      console.log("\nSpeedup vs AJV Minimal:");
      console.log(`  DNA Validation: ${(ajvMinComp / dnaValComp).toFixed(2)}x`);
      console.log(`  DNA Parser: ${(ajvMinComp / dnaParseComp).toFixed(2)}x`);
      console.log(`  Zod: ${(ajvMinComp / zodComp).toFixed(2)}x`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });

  const iterations = 100000;

  describe("Validation Performance", () => {
    it("Summary - Validation comparison table", () => {
      const iterations = 100000;

      let start = performance.now();
      for (let i = 0; i < iterations; i++) ajvValid(validData);
      const ajvMinValid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) ajvValid(invalidData);
      const ajvMinInvalid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) ajvErrors(validData);
      const ajvAllValid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) ajvErrors(invalidData);
      const ajvAllInvalid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaValid(validData);
      const dnaValValid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaValid(invalidData);
      const dnaValInvalid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaErrors(validData);
      const dnaParseValid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaErrors(invalidData);
      const dnaParseInvalid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) zodSchema.safeParse(validData);
      const zodValid = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) zodSchema.safeParse(invalidData);
      const zodInvalid = (performance.now() - start) / iterations;

      console.log("\n" + "=".repeat(80));
      console.log("VALIDATION PERFORMANCE COMPARISON (ms per validation)");
      console.log("=".repeat(80));
      console.log("| Mode               | Valid Data  | Invalid Data |");
      console.log("|--------------------|-------------|--------------|");
      console.log(`| AJV Minimal        | ${ajvMinValid.toFixed(5)}     | ${ajvMinInvalid.toFixed(5)}       |`);
      console.log(`| AJV AllErrors      | ${ajvAllValid.toFixed(5)}     | ${ajvAllInvalid.toFixed(5)}       |`);
      console.log(`| DNA Validation     | ${dnaValValid.toFixed(5)}     | ${dnaValInvalid.toFixed(5)}       |`);
      console.log(`| DNA Parser         | ${dnaParseValid.toFixed(5)}     | ${dnaParseInvalid.toFixed(5)}       |`);
      console.log(`| Zod                | ${zodValid.toFixed(5)}     | ${zodInvalid.toFixed(5)}       |`);
      console.log("=".repeat(80));
      console.log("\nSpeedup vs AJV Minimal (valid data):");
      console.log(`  DNA Validation: ${(ajvMinValid / dnaValValid).toFixed(2)}x`);
      console.log(`  DNA Parser: ${(ajvMinValid / dnaParseValid).toFixed(2)}x`);
      console.log(`  Zod: ${(ajvMinValid / zodValid).toFixed(2)}x`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });

  describe("Summary", () => {
    it("Function Sizes", () => {
      console.log("\n" + "=".repeat(80));
      console.log("GENERATED CODE SIZES (bytes)");
      console.log("=".repeat(80));
      console.log(`| Mode               | Size (bytes) |`);
      console.log("|--------------------|--------------|");
      console.log(`| AJV Minimal        | ${ajvValid.toString().length}     |`);
      console.log(`| AJV AllErrors      | ${ajvErrors.toString().length}     |`);
      console.log(`| DNA Validation     | ${dnaValid.toString().length}     |`);
      console.log(`| DNA Parser         | ${dnaErrors.toString().length}     |`);
      console.log(`| Zod Schema         | ${JSON.stringify(zodSchema).length}     |`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });
});

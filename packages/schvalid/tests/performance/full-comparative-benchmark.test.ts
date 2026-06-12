import Ajv2020 from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { jschemaToDna } from "../../dist/index.js";
import { validator as validatorDnaNormal, parser as parserDnaNormal } from "@ytn/dna";
import { schvalid as schvalidNormal } from "../../dist/index.js";
const Ajv = (Ajv2020 as any).default ?? Ajv2020;

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

describe("Full Comparative Benchmark: Schvalid + DNA vs AJV vs Zod", () => {
  let ajvValid: any;
  let ajvErrors: any;
  let dnaValidNormal: any;
  let dnaErrorsNormal: any;
  let schvalidValidNormal: any;
  let schvalidErrorsNormal: any;
  let zodSchema: any;

  beforeAll(() => {
    const dna = jschemaToDna(testSchema);

    // 1. AJV Validation (minimal)
    ajvValid = new Ajv({ validateFormats: false }).compile(testSchema);

    // 2. AJV Errors (detailed)
    ajvErrors = new Ajv({ validateFormats: false, allErrors: true }).compile(testSchema);

    // 3. DNA Validation
    dnaValidNormal = validatorDnaNormal(dna);

    // 4. DNA Parser
    dnaErrorsNormal = parserDnaNormal(dna);

    // 5. Schvalid Validation
    schvalidValidNormal = schvalidNormal("validation").compile(testSchema);

    // 6. Schvalid Parser
    schvalidErrorsNormal = schvalidNormal("parser").compile(testSchema);

    // 7. Zod
    zodSchema = z.object({
      name: z.string().min(1).max(100),
      age: z.number().min(0).max(150),
      email: z.email(),
      tags: z.array(z.string()).min(1).max(10),
      active: z.boolean()
    });
  });

  describe("Compilation Performance", () => {

    it("Summary - Compilation comparison table", () => {
      const iterations = 3000;

      const schemas = Array.from({ length: iterations }, () => JSON.parse(JSON.stringify(testSchema)));

      let start = performance.now();
      for (let i = 0; i < iterations; i++) validatorDnaNormal(jschemaToDna(schemas[i]));
      const dnaValCompNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) parserDnaNormal(jschemaToDna(schemas[i]));
      const dnaParseCompNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidNormal("validation").compile(schemas[i]);
      const schvalidValCompNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidNormal("parser").compile(schemas[i]);
      const schvalidParseCompNormal = (performance.now() - start) / iterations;

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
          email: z.email(),
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
      console.log(`| DNA Validation     | ${dnaValCompNormal.toFixed(5)}     |`);
      console.log(`| DNA Parser         | ${dnaParseCompNormal.toFixed(5)}     |`);
      console.log(`| Schvalid Val       | ${schvalidValCompNormal.toFixed(5)}     |`);
      console.log(`| Schvalid Parse     | ${schvalidParseCompNormal.toFixed(5)}     |`);
      console.log(`| AJV Minimal        | ${ajvMinComp.toFixed(5)}     |`);
      console.log(`| AJV AllErrors      | ${ajvAllComp.toFixed(5)}     |`);
      console.log(`| Zod                | ${zodComp.toFixed(5)}     |`);
      console.log("=".repeat(80));
      console.log("\nSpeedup vs AJV Minimal:");
      console.log(`  DNA Validation: ${(ajvMinComp / dnaValCompNormal).toFixed(2)}x`);
      console.log(`  DNA Parser: ${(ajvMinComp / dnaParseCompNormal).toFixed(2)}x`);
      console.log(`  Schvalid Val: ${(ajvMinComp / schvalidValCompNormal).toFixed(2)}x`);
      console.log(`  Schvalid Parse: ${(ajvMinComp / schvalidParseCompNormal).toFixed(2)}x`);
      console.log(`  Zod: ${(ajvMinComp / zodComp).toFixed(2)}x`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });

  const iterations = 100000;

  describe("Validation Performance", () => {
    it("Summary - Validation comparison table", () => {
      const iterations = 10000;

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
      for (let i = 0; i < iterations; i++) dnaValidNormal(validData);
      const dnaValValidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaValidNormal(invalidData);
      const dnaValInvalidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaErrorsNormal(validData);
      const dnaParseValidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) dnaErrorsNormal(invalidData);
      const dnaParseInvalidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidValidNormal(validData);
      const schvalidValValidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidValidNormal(invalidData);
      const schvalidValInvalidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidErrorsNormal(validData);
      const schvalidParseValidNormal = (performance.now() - start) / iterations;

      start = performance.now();
      for (let i = 0; i < iterations; i++) schvalidErrorsNormal(invalidData);
      const schvalidParseInvalidNormal = (performance.now() - start) / iterations;

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
      console.log(`| DNA Validation     | ${dnaValValidNormal.toFixed(5)}     | ${dnaValInvalidNormal.toFixed(5)}       |`);
      console.log(`| DNA Parser         | ${dnaParseValidNormal.toFixed(5)}     | ${dnaParseInvalidNormal.toFixed(5)}       |`);
      console.log(`| Schvalid Val       | ${schvalidValValidNormal.toFixed(5)}     | ${schvalidValInvalidNormal.toFixed(5)}       |`);
      console.log(`| Schvalid Parse     | ${schvalidParseValidNormal.toFixed(5)}     | ${schvalidParseInvalidNormal.toFixed(5)}       |`);
      console.log(`| Zod                | ${zodValid.toFixed(5)}     | ${zodInvalid.toFixed(5)}       |`);
      console.log("=".repeat(80));
      console.log("\nSpeedup vs AJV Minimal (valid data):");
      console.log(`  DNA Validation: ${(ajvMinValid / dnaValValidNormal).toFixed(2)}x`);
      console.log(`  DNA Parser: ${(ajvMinValid / dnaParseValidNormal).toFixed(2)}x`);
      console.log(`  Schvalid Val: ${(ajvMinValid / schvalidValValidNormal).toFixed(2)}x`);
      console.log(`  Schvalid Parse: ${(ajvMinValid / schvalidParseValidNormal).toFixed(2)}x`);
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
      console.log(`| DNA Validation     | ${dnaValidNormal.toString().length}     |`);
      console.log(`| DNA Parser         | ${dnaErrorsNormal.toString().length}     |`);
      console.log(`| Schvalid Val       | ${schvalidValidNormal.toString().length}     |`);
      console.log(`| Schvalid Parse     | ${schvalidErrorsNormal.toString().length}     |`);
      console.log(`| Zod Schema         | ${JSON.stringify(zodSchema).length}     |`);
      console.log("=".repeat(80));

      expect(true).toBe(true);
    });
  });
});

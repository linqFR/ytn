import { describe, expect, it } from "vitest";
import { jschemaToDna } from "../../src/jschema-to-dna.js";

// Import both versions of @ytn/dna for comparison
import { validator as validatorFull } from "@ytn/dna";
import { validator as validatorMin } from "@ytn/dna/min";

describe("Bundle Performance Comparison (JSON Schema → DNA)", () => {
  const schema = {
    type: "object" as const,
    properties: {
      name: { type: "string", minLength: 2 },
      age: { type: "number", minimum: 0 },
      active: { type: "boolean" },
    },
    required: ["name", "age", "active"],
  };

  const dnaSeq = jschemaToDna(schema);

  it("should compile validator from full bundle", () => {
    const validate = validatorFull(dnaSeq);
    expect(validate).toBeInstanceOf(Function);
  });

  it("should compile validator from minified bundle", () => {
    const validate = validatorMin(dnaSeq);
    expect(validate).toBeInstanceOf(Function);
  });

  it("should validate correctly with full bundle", () => {
    const validate = validatorFull(dnaSeq);
    expect(validate({ name: "John", age: 30, active: true })).toBe(true);
    expect(validate({ name: "J", age: 30, active: true })).toBe(false);
  });

  it("should validate correctly with minified bundle", () => {
    const validate = validatorMin(dnaSeq);
    expect(validate({ name: "John", age: 30, active: true })).toBe(true);
    expect(validate({ name: "J", age: 30, active: true })).toBe(false);
  });

  it("performance comparison - full vs minified", () => {
    const iterations = 10000;
    const testData = { name: "John", age: 30, active: true };

    const validateFull = validatorFull(dnaSeq);
    const validateMin = validatorMin(dnaSeq);

    // Warm up
    for (let i = 0; i < 100; i++) {
      validateFull(testData);
      validateMin(testData);
    }

    // Measure full bundle
    const startFull = performance.now();
    for (let i = 0; i < iterations; i++) {
      validateFull(testData);
    }
    const timeFull = performance.now() - startFull;

    // Measure minified bundle
    const startMin = performance.now();
    for (let i = 0; i < iterations; i++) {
      validateMin(testData);
    }
    const timeMin = performance.now() - startMin;

    console.log(`Full bundle: ${(timeFull / iterations).toFixed(6)}ms per validation`);
    console.log(`Minified bundle: ${(timeMin / iterations).toFixed(6)}ms per validation`);
    console.log(`Difference: ${((timeMin - timeFull) / timeFull * 100).toFixed(2)}%`);

    // Both should be reasonably fast (< 0.01ms per validation)
    expect(timeFull / iterations).toBeLessThan(0.01);
    expect(timeMin / iterations).toBeLessThan(0.01);
  });
});

import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";

describe("Schema Cloning", () => {
  it("schema.min(3) should return a clone with min constraint", () => {
    const schema = dna.string();
    const schemaWithMin = schema.min(3);

    // They should be different instances
    expect(schema).not.toBe(schemaWithMin);

    // Cloned schema should have min constraint
    expect(schemaWithMin._state.min).toBe(3);
  });

  it("schema.meta() should return a clone with custom meta", () => {
    const schema = dna.string();
    const schemaWithMeta = schema.meta({ error: "custom error" });

    // They should be different instances
    expect(schema).not.toBe(schemaWithMeta);

    // The clone should have been created
    expect(schemaWithMeta).toBeDefined();
  });

  it("multiple chained methods should create separate clones", () => {
    const schema = dna.string();
    const schema1 = schema.min(3);
    const schema2 = schema.min(5);
    const schema3 = schema.min(7);

    // All should be different instances
    expect(schema).not.toBe(schema1);
    expect(schema1).not.toBe(schema2);
    expect(schema2).not.toBe(schema3);

    // Each should have its own min value
    expect(schema1._state.min).toBe(3);
    expect(schema2._state.min).toBe(5);
    expect(schema3._state.min).toBe(7);
  });

  it("clone() method should create an independent copy", () => {
    const schema = dna.string().min(3);
    const cloned = schema.clone();

    // They should be different instances
    expect(schema).not.toBe(cloned);

    // They should have the same state
    expect(schema._state.min).toBe(cloned._state.min);
  });

  it("cloning should handle RegExp correctly", () => {
    const schema = dna.string().pattern(/^[a-z]+$/);
    const cloned = schema.clone();

    // They should be different instances
    expect(schema).not.toBe(cloned);

    // The RegExp should be cloned correctly
    expect(schema._state.pattern).toEqual(cloned._state.pattern);
    expect(schema._state.pattern).not.toBe(cloned._state.pattern); // Different RegExp instances
  });
});

describe("Schema Cloning - Validation", () => {
  it("cloned schema should validate correctly with min constraint", () => {
    const schema = dna.string().min(3);
    const result = schema.safeParse("hello");
    expect(result.success).toBe(true);
  });

  it("cloned schema should fail validation with min constraint", () => {
    const schema = dna.string().min(3);
    const result = schema.safeParse("hi");
    expect(result.success).toBe(false);
  });

  it("original schema should not be affected by clone validation", () => {
    const schema = dna.string();
    const schemaWithMin = schema.min(3);
    
    // Original schema should still accept short strings
    const originalResult = schema.safeParse("hi");
    expect(originalResult.success).toBe(true);

    // Cloned schema should reject short strings
    const clonedResult = schemaWithMin.safeParse("hi");
    expect(clonedResult.success).toBe(false);
  });

  it("cloned schema with pattern should validate correctly", () => {
    const schema = dna.string().pattern(/^[a-z]+$/);
    const result = schema.safeParse("hello");
    expect(result.success).toBe(true);
  });

  it("cloned schema with pattern should fail validation", () => {
    const schema = dna.string().pattern(/^[a-z]+$/);
    const result = schema.safeParse("Hello123");
    expect(result.success).toBe(false);
  });

  it("clone() method should produce a schema that validates identically", () => {
    const schema = dna.string().min(3).max(10);
    const cloned = schema.clone();

    const testValues = ["hi", "hello", "thisiswaytoolong"];
    
    testValues.forEach(value => {
      const originalResult = schema.safeParse(value);
      const clonedResult = cloned.safeParse(value);
      expect(originalResult.success).toBe(clonedResult.success);
      expect(originalResult.success && originalResult.data).toBe(clonedResult.success && clonedResult.data);
    });
  });

  it("nested object schemas should clone correctly", () => {
    const schema = dna.object({
      name: dna.string().min(2),
      age: dna.number().min(0)
    });
    const cloned = schema.clone();

    const validData = { name: "John", age: 25 };
    const originalResult = schema.safeParse(validData);
    const clonedResult = cloned.safeParse(validData);

    expect(originalResult.success).toBe(true);
    expect(clonedResult.success).toBe(true);
  });

  it("array schemas should clone correctly", () => {
    const schema = dna.array(dna.string()).min(1);
    const cloned = schema.clone();

    const validData = ["hello"];
    const invalidData:[]= [];

    const originalValid = schema.safeParse(validData);
    const clonedValid = cloned.safeParse(validData);
    expect(originalValid.success).toBe(true);
    expect(clonedValid.success).toBe(true);

    const originalInvalid = schema.safeParse(invalidData);
    const clonedInvalid = cloned.safeParse(invalidData);
    expect(originalInvalid.success).toBe(false);
    expect(clonedInvalid.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { pico } from "../src/index.js";
import { contrat_type_to_arg_type } from "../src/shared/pico-to-args.js";

describe("Pico to Args Technical Mapping Integration", () => {
  it("should detect boolean flag for atomic boolean DSL", () => {
    expect(contrat_type_to_arg_type("boolean", true)).toBe("boolean");
  });

  it("should detect string argument for atomic number DSL", () => {
    expect(contrat_type_to_arg_type("number", true)).toBe("string");
  });

  it("should detect string argument for stringbool DSL (Option mode)", () => {
    expect(contrat_type_to_arg_type("stringbool", true)).toBe("string");
  });

  it("should detect boolean flag for boolean | boolean union DSL", () => {
    expect(contrat_type_to_arg_type("boolean | boolean", true)).toBe("boolean");
  });

  it("should detect string argument for boolean | string union DSL (Positional mode)", () => {
    expect(contrat_type_to_arg_type("boolean | string", false)).toBe("string");
  });

  // Mixed unions are safer as "string" flags to allow capturing valued inputs.
  expect(contrat_type_to_arg_type("boolean | string", true)).toBe("string");

  it("should detect boolean flag for pico.boolean()", () => {
    expect(contrat_type_to_arg_type(pico.boolean(), true)).toBe("boolean");
  });

  it("should detect string argument for pico.number() as a flag", () => {
    expect(contrat_type_to_arg_type(pico.number(), true)).toBe("string");
  });

  it("should detect string argument for pico.number() as a positional", () => {
    expect(contrat_type_to_arg_type(pico.number(), false)).toBe("string");
  });

  it("should detect string argument for pico.stringbool() as a positional", () => {
    expect(contrat_type_to_arg_type(pico.stringbool(), false)).toBe("string");
  });

  it("should detect string argument for pico.stringbool() as a flag", () => {
    expect(contrat_type_to_arg_type(pico.stringbool(), true)).toBe("string");
  });

  it("should correctly detect flag for optional boolean", () => {
    const optionalBool = pico.boolean().toZod.optional();
    expect(contrat_type_to_arg_type(optionalBool as any, true)).toBe("boolean");
  });

  it("should detect string argument for list types", () => {
    expect(contrat_type_to_arg_type("stringList", true)).toBe("string");
    expect(contrat_type_to_arg_type("numList", true)).toBe("string");
    expect(contrat_type_to_arg_type("boolList", true)).toBe("string");
    expect(contrat_type_to_arg_type("list", true)).toBe("string");
  });

  it("should detect string argument for null/undefined constants", () => {
    expect(contrat_type_to_arg_type("null", true)).toBe("string");
    expect(contrat_type_to_arg_type("undefined", true)).toBe("string");
  });
});

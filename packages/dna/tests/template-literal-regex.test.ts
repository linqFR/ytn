import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import * as z from "zod";

describe("Template Literal Regex - Complex cases with optional, nullable, nullish", () => {
  it("handles optional literal with empty string", () => {
    const dnaSchema = dna.templateLiteral(["", dna.literal("yeah").optional()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["", dna.literal("yeah").optional()]);
    const zodSchema = z.templateLiteral(["", z.literal("yeah").optional()]);
    
    // DNA accepts empty string for optional
    expect(dnaSchema.validate("")).toBe(true);
    expect(dnaSchema.validate("yeah")).toBe(true);
    expect(dnaSchema.validate("no")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("");
    expect(dnaValid).toEqual({ success: true, data: "" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("no");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("");
    expect(dnaMutateValid).toEqual({ success: true, data: "" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("no");
    expect(dnaMutateInvalid.success).toBe(false);
    
    // DNA Mutate accepts empty string for optional
    expect(dnaMutateSchema.validate("")).toBe(true);
    expect(dnaMutateSchema.validate("yeah")).toBe(true);
    expect(dnaMutateSchema.validate("no")).toBe(false);
    
    // Zod also accepts empty string for optional
    const zodValid = zodSchema.safeParse("");
    expect(zodValid.success).toBe(true);
    
    // Zod succeeds on literal
    const zodLiteral = zodSchema.safeParse("yeah");
    expect(zodLiteral.success).toBe(true);
  });

  it("handles nullable literal with null string (Zod fails)", () => {
    const dnaSchema = dna.templateLiteral(["", dna.literal("yo").nullable()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["", dna.literal("yo").nullable()]);
    const zodSchema = z.templateLiteral(["", z.literal("yo").nullable()]);
    
    expect(dnaSchema.validate("yo")).toBe(true);
    expect(dnaSchema.validate("null")).toBe(true);
    expect(dnaSchema.validate("no")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("yo");
    expect(dnaValid).toEqual({ success: true, data: "yo" });
    
    const dnaValidNull = dnaSchema.safeParse("null");
    expect(dnaValidNull).toEqual({ success: true, data: "null" }); // DNA doesn't transform "null" string to null
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("no");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("yo");
    expect(dnaMutateValid).toEqual({ success: true, data: "yo" });
    
    // DNA Mutate safeParse succeeds on null
    const dnaMutateNull = dnaMutateSchema.safeParse("null");
    expect(dnaMutateNull).toEqual({ success: true, data: "null" }); // DNA doesn't transform "null" string to null
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("no");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("yo")).toBe(true);
    expect(dnaMutateSchema.validate("null")).toBe(true);
    expect(dnaMutateSchema.validate("no")).toBe(false);
    
    // Zod also accepts "null" string for nullable
    const zodValid = zodSchema.safeParse("null");
    expect(zodValid.success).toBe(true);
    
    // Zod succeeds on literal
    const zodLiteral = zodSchema.safeParse("yo");
    expect(zodLiteral.success).toBe(true);
  });

  it("handles nullish literal with empty string or null (Zod fails)", () => {
    const dnaSchema = dna.templateLiteral(["", dna.literal("test").nullish()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["", dna.literal("test").nullish()]);
    const zodSchema = z.templateLiteral(["", z.literal("test").nullish()]);
    
    expect(dnaSchema.validate("test")).toBe(true);
    expect(dnaSchema.validate("")).toBe(true);
    expect(dnaSchema.validate("null")).toBe(true);
    expect(dnaSchema.validate("no")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("test");
    expect(dnaValid).toEqual({ success: true, data: "test" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("no");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("test");
    expect(dnaMutateValid).toEqual({ success: true, data: "test" });
    
    // DNA Mutate safeParse returns "null" string for "null"
    const dnaMutateNull = dnaMutateSchema.safeParse("null");
    expect(dnaMutateNull).toEqual({ success: true, data: "null" }); // DNA doesn't transform to null
    
    // DNA Mutate safeParse returns empty string for ""
    const dnaMutateEmpty = dnaMutateSchema.safeParse("");
    expect(dnaMutateEmpty).toEqual({ success: true, data: "" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("no");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("test")).toBe(true);
    expect(dnaMutateSchema.validate("")).toBe(true);
    expect(dnaMutateSchema.validate("null")).toBe(true);
    expect(dnaMutateSchema.validate("no")).toBe(false);
    
    // Zod also accepts empty string and "null" string for nullish
    const zodEmpty = zodSchema.safeParse("");
    const zodNull = zodSchema.safeParse("null");
    expect(zodEmpty.success).toBe(true);
    expect(zodNull.success).toBe(true);
    
    // Zod succeeds on literal
    const zodLiteral = zodSchema.safeParse("test");
    expect(zodLiteral.success).toBe(true);
  });

  it("handles number with min/max constraints in template", () => {
    const dnaSchema = dna.templateLiteral(["val:", dna.number().min(0).max(100)]);
    const dnaMutateSchema = dna.templateLiteralMutate(["val:", dna.number().min(0).max(100)]);
    const zodSchema = z.templateLiteral(["val:", z.number().min(0).max(100)]);
    
    expect(dnaSchema.validate("val:50")).toBe(true);
    expect(dnaSchema.validate("val:0")).toBe(true);
    expect(dnaSchema.validate("val:100")).toBe(true);
    expect(dnaSchema.validate("val:-1")).toBe(false);
    expect(dnaSchema.validate("val:101")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("val:50");
    expect(dnaValid).toEqual({ success: true, data: "val:50" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("val:101");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("val:50");
    expect(dnaMutateValid).toEqual({ success: true, data: "val:50" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("val:101");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("val:50")).toBe(true);
    expect(dnaMutateSchema.validate("val:0")).toBe(true);
    expect(dnaMutateSchema.validate("val:100")).toBe(true);
    expect(dnaMutateSchema.validate("val:-1")).toBe(false);
    expect(dnaMutateSchema.validate("val:101")).toBe(false);
    
    // Zod succeeds on valid values
    const zodValid = zodSchema.safeParse("val:50");
    expect(zodValid.success).toBe(true);
  });

  it("handles string with startsWith constraint in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["id:", dna.string().startsWith("USER_")]);
    const dnaMutateSchema = dna.templateLiteralMutate(["id:", dna.string().startsWith("USER_")]);
    const zodSchema = z.templateLiteral(["id:", z.string().startsWith("USER_")]);
    
    expect(dnaSchema.validate("id:USER_123")).toBe(true);
    expect(dnaSchema.validate("id:ADMIN_123")).toBe(false);
    expect(dnaSchema.validate("id:123")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("id:USER_123");
    expect(dnaValid).toEqual({ success: true, data: "id:USER_123" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("id:ADMIN_123");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("id:USER_123");
    expect(dnaMutateValid).toEqual({ success: true, data: "id:USER_123" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("id:ADMIN_123");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("id:USER_123")).toBe(true);
    expect(dnaMutateSchema.validate("id:ADMIN_123")).toBe(false);
    expect(dnaMutateSchema.validate("id:123")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("id:USER_123");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("id:ADMIN_123");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles string with endsWith constraint in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["file:", dna.string().endsWith(".ts")]);
    const dnaMutateSchema = dna.templateLiteralMutate(["file:", dna.string().endsWith(".ts")]);
    const zodSchema = z.templateLiteral(["file:", z.string().endsWith(".ts")]);
    
    expect(dnaSchema.validate("file:test.ts")).toBe(true);
    expect(dnaSchema.validate("file:test.js")).toBe(false);
    expect(dnaSchema.validate("file:test")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("file:test.ts");
    expect(dnaValid).toEqual({ success: true, data: "file:test.ts" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("file:test.js");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("file:test.ts");
    expect(dnaMutateValid).toEqual({ success: true, data: "file:test.ts" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("file:test.js");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("file:test.ts")).toBe(true);
    expect(dnaMutateSchema.validate("file:test.js")).toBe(false);
    expect(dnaMutateSchema.validate("file:test")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("file:test.ts");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("file:test.js");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles string with min/max length in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["code:", dna.string().min(3).max(5)]);
    const dnaMutateSchema = dna.templateLiteralMutate(["code:", dna.string().min(3).max(5)]);
    const zodSchema = z.templateLiteral(["code:", z.string().min(3).max(5)]);
    
    expect(dnaSchema.validate("code:abc")).toBe(true);
    expect(dnaSchema.validate("code:abcde")).toBe(true);
    expect(dnaSchema.validate("code:ab")).toBe(false);
    expect(dnaSchema.validate("code:abcdef")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("code:abc");
    expect(dnaValid).toEqual({ success: true, data: "code:abc" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("code:ab");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("code:abc");
    expect(dnaMutateValid).toEqual({ success: true, data: "code:abc" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("code:ab");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("code:abc")).toBe(true);
    expect(dnaMutateSchema.validate("code:abcde")).toBe(true);
    expect(dnaMutateSchema.validate("code:ab")).toBe(false);
    expect(dnaMutateSchema.validate("code:abcdef")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("code:abc");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("code:ab");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles enum with object literal in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["status:", dna.enum({ ACTIVE: "active", INACTIVE: "inactive" })]);
    const dnaMutateSchema = dna.templateLiteralMutate(["status:", dna.enum({ ACTIVE: "active", INACTIVE: "inactive" })]);
    const zodSchema = z.templateLiteral(["status:", z.enum(["active", "inactive"])]);
    
    expect(dnaSchema.validate("status:active")).toBe(true);
    expect(dnaSchema.validate("status:inactive")).toBe(true);
    expect(dnaSchema.validate("status:pending")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("status:active");
    expect(dnaValid).toEqual({ success: true, data: "status:active" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("status:pending");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("status:active");
    expect(dnaMutateValid).toEqual({ success: true, data: "status:active" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("status:pending");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("status:active")).toBe(true);
    expect(dnaMutateSchema.validate("status:inactive")).toBe(true);
    expect(dnaMutateSchema.validate("status:pending")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("status:active");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("status:pending");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles complex template with multiple constraints (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral([
      "user:",
      dna.string().min(3).max(10).toUpperCase(),
      ":",
      dna.number().min(0).max(100).optional()
    ]);
    const dnaMutateSchema = dna.templateLiteralMutate([
      "user:",
      dna.string().min(3).max(10).toUpperCase(),
      ":",
      dna.number().min(0).max(100).optional()
    ]);
    const zodSchema = z.templateLiteral([
      "user:",
      z.string().min(3).max(10).toUpperCase(),
      ":",
      z.number().min(0).max(100).optional()
    ]);
    
    expect(dnaSchema.validate("user:alice:50")).toBe(true);
    expect(dnaSchema.validate("user:alice:")).toBe(true);
    expect(dnaSchema.validate("user:al:50")).toBe(false);
    expect(dnaSchema.validate("user:aliceverylongname:50")).toBe(false);
    expect(dnaSchema.validate("user:alice:101")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("user:alice:50");
    expect(dnaValid).toEqual({ success: true, data: "user:alice:50" }); // no transformation
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("user:al:50");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds with transformation
    const dnaMutateValid = dnaMutateSchema.safeParse("user:alice:50");
    expect(dnaMutateValid).toEqual({ success: true, data: "user:ALICE:50" }); // toUpperCase transformation
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("user:al:50");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("user:alice:50")).toBe(true);
    expect(dnaMutateSchema.validate("user:alice:")).toBe(true);
    expect(dnaMutateSchema.validate("user:al:50")).toBe(false);
    expect(dnaMutateSchema.validate("user:aliceverylongname:50")).toBe(false);
    expect(dnaMutateSchema.validate("user:alice:101")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("user:alice:50");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("user:al:50");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles email format in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["email:", dna.string().email()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["email:", dna.string().email()]);
    const zodSchema = z.templateLiteral(["email:", z.string().email()]);
    
    expect(dnaSchema.validate("email:test@example.com")).toBe(true);
    expect(dnaSchema.validate("email:invalid")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("email:test@example.com");
    expect(dnaValid).toEqual({ success: true, data: "email:test@example.com" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("email:invalid");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("email:test@example.com");
    expect(dnaMutateValid).toEqual({ success: true, data: "email:test@example.com" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("email:invalid");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("email:test@example.com")).toBe(true);
    expect(dnaMutateSchema.validate("email:invalid")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("email:test@example.com");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("email:invalid");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles uuid format in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["id:", dna.string().uuid()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["id:", dna.string().uuid()]);
    const zodSchema = z.templateLiteral(["id:", z.string().uuid()]);
    
    expect(dnaSchema.validate("id:550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(dnaSchema.validate("id:not-a-uuid")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("id:550e8400-e29b-41d4-a716-446655440000");
    expect(dnaValid).toEqual({ success: true, data: "id:550e8400-e29b-41d4-a716-446655440000" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("id:not-a-uuid");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("id:550e8400-e29b-41d4-a716-446655440000");
    expect(dnaMutateValid).toEqual({ success: true, data: "id:550e8400-e29b-41d4-a716-446655440000" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("id:not-a-uuid");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("id:550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(dnaMutateSchema.validate("id:not-a-uuid")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("id:550e8400-e29b-41d4-a716-446655440000");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("id:not-a-uuid");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles bigint in template", () => {
    const dnaSchema = dna.templateLiteral(["count:", dna.bigint()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["count:", dna.bigint()]);
    const zodSchema = z.templateLiteral(["count:", z.bigint()]);
    
    expect(dnaSchema.validate("count:123n")).toBe(true);
    expect(dnaSchema.validate("count:-456n")).toBe(true);
    expect(dnaSchema.validate("count:123")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("count:123n");
    expect(dnaValid).toEqual({ success: true, data: "count:123n" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("count:123");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("count:123n");
    expect(dnaMutateValid).toEqual({ success: true, data: "count:123n" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("count:123");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("count:123n")).toBe(true);
    expect(dnaMutateSchema.validate("count:-456n")).toBe(true);
    expect(dnaMutateSchema.validate("count:123")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("count:123n");
    expect(zodValid.success).toBe(true);
  });

  it("handles int in template (Zod succeeds)", () => {
    const dnaSchema = dna.templateLiteral(["value:", dna.int()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["value:", dna.int()]);
    const zodSchema = z.templateLiteral(["value:", z.int()]);
    
    expect(dnaSchema.validate("value:123")).toBe(true);
    expect(dnaSchema.validate("value:-456")).toBe(true);
    expect(dnaSchema.validate("value:123.45")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("value:123");
    expect(dnaValid).toEqual({ success: true, data: "value:123" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("value:123.45");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("value:123");
    expect(dnaMutateValid).toEqual({ success: true, data: "value:123" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("value:123.45");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("value:123")).toBe(true);
    expect(dnaMutateSchema.validate("value:-456")).toBe(true);
    expect(dnaMutateSchema.validate("value:123.45")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("value:123");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("value:123.45");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles int32 in template", () => {
    const dnaSchema = dna.templateLiteral(["num:", dna.int32()]);
    const dnaMutateSchema = dna.templateLiteralMutate(["num:", dna.int32()]);
    const zodSchema = z.templateLiteral(["num:", z.int32()]);
    
    expect(dnaSchema.validate("num:2147483647")).toBe(true);
    expect(dnaSchema.validate("num:-2147483648")).toBe(true);
    expect(dnaSchema.validate("num:2147483648")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("num:2147483647");
    expect(dnaValid).toEqual({ success: true, data: "num:2147483647" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("num:2147483648");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("num:2147483647");
    expect(dnaMutateValid).toEqual({ success: true, data: "num:2147483647" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("num:2147483648");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("num:2147483647")).toBe(true);
    expect(dnaMutateSchema.validate("num:-2147483648")).toBe(true);
    expect(dnaMutateSchema.validate("num:2147483648")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("num:2147483647");
    expect(zodValid.success).toBe(true);
  });

  it("handles complex template with string constraints and transformation", () => {
    const dnaSchema = dna.templateLiteral([
      "user:",
      dna.string().min(3).max(10).toUpperCase(),
      ":",
      dna.number().min(0).max(100).optional()
    ]);
    const dnaMutateSchema = dna.templateLiteralMutate([
      "user:",
      dna.string().min(3).max(10).toUpperCase(),
      ":",
      dna.number().min(0).max(100).optional()
    ]);
    const zodSchema = z.templateLiteral([
      "user:",
      z.string().min(3).max(10).toUpperCase(),
      ":",
      z.number().min(0).max(100).optional()
    ]);
    
    expect(dnaSchema.validate("user:ALICE:50")).toBe(true);
    expect(dnaSchema.validate("user:alice:50")).toBe(true);
    expect(dnaSchema.validate("user:al:50")).toBe(false);
    expect(dnaSchema.validate("user:aliceverylongname:50")).toBe(false);
    expect(dnaSchema.validate("user:alice:101")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("user:alice:50");
    expect(dnaValid).toEqual({ success: true, data: "user:alice:50" }); //no transformation
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("user:al:50");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds with transformation
    const dnaMutateValid = dnaMutateSchema.safeParse("user:alice:50");
    expect(dnaMutateValid).toEqual({ success: true, data: "user:ALICE:50" }); // toUpperCase transformation applies
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("user:al:50");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("user:ALICE:50")).toBe(true);
    expect(dnaMutateSchema.validate("user:alice:50")).toBe(true); // Transformation applies
    expect(dnaMutateSchema.validate("user:al:50")).toBe(false);
    expect(dnaMutateSchema.validate("user:aliceverylongname:50")).toBe(false);
    expect(dnaMutateSchema.validate("user:alice:101")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("user:ALICE:50");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("user:al:50");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles complex template with multiple transformations", () => {
    const dnaSchema = dna.templateLiteral([
      "id:",
      dna.string().trim().toLowerCase(),
      "-",
      dna.string().email()
    ]);
    const dnaMutateSchema = dna.templateLiteralMutate([
      "id:",
      dna.string().trim().toLowerCase(),
      "-",
      dna.string().email()
    ]);
    const zodSchema = z.templateLiteral([
      "id:",
      z.string().trim().toLowerCase(),
      "-",
      z.string().email()
    ]);
    
    expect(dnaSchema.validate("id:ALICE-test@example.com")).toBe(true);
    expect(dnaSchema.validate("id: alice-test@example.com")).toBe(true); // Trim applies
    expect(dnaSchema.validate("id:ALICE-invalid")).toBe(false);
    
    // DNA safeParse succeeds on valid with no trasformation
    const dnaValid = dnaSchema.safeParse("id:ALICE-test@example.com");
    expect(dnaValid).toEqual({ success: true, data: "id:ALICE-test@example.com" }); // no transformation
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("id:ALICE-invalid");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds with transformations
    const dnaMutateValid = dnaMutateSchema.safeParse("id:ALICE-test@example.com");
    expect(dnaMutateValid).toEqual({ success: true, data: "id:alice-test@example.com" }); // trim + toLowerCase transformations apply
    
    // DNA Mutate safeParse with trim
    const dnaMutateTrim = dnaMutateSchema.safeParse("id: alice-test@example.com");
    expect(dnaMutateTrim).toEqual({ success: true, data: "id:alice-test@example.com" }); // trim applies
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("id:ALICE-invalid");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("id:ALICE-test@example.com")).toBe(true);
    expect(dnaMutateSchema.validate("id: alice-test@example.com")).toBe(true); // Trim applies
    expect(dnaMutateSchema.validate("id:ALICE-invalid")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("id:ALICE-test@example.com");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("id:ALICE-invalid");
    expect(zodInvalid.success).toBe(false);
  });

  it("handles complex template with enum and number constraints", () => {
    const dnaSchema = dna.templateLiteral([
      "status:",
      dna.enum({ ACTIVE: "active", INACTIVE: "inactive", PENDING: "pending" }),
      ":",
      dna.int().min(0).max(100)
    ]);
    const dnaMutateSchema = dna.templateLiteralMutate([
      "status:",
      dna.enum({ ACTIVE: "active", INACTIVE: "inactive", PENDING: "pending" }),
      ":",
      dna.int().min(0).max(100)
    ]);
    const zodSchema = z.templateLiteral([
      "status:",
      z.enum(["active", "inactive", "pending"]),
      ":",
      z.int().min(0).max(100)
    ]);
    
    expect(dnaSchema.validate("status:active:50")).toBe(true);
    expect(dnaSchema.validate("status:inactive:0")).toBe(true);
    expect(dnaSchema.validate("status:pending:100")).toBe(true);
    expect(dnaSchema.validate("status:active:-1")).toBe(false);
    expect(dnaSchema.validate("status:active:101")).toBe(false);
    expect(dnaSchema.validate("status:unknown:50")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("status:active:50");
    expect(dnaValid).toEqual({ success: true, data: "status:active:50" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("status:active:-1");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("status:active:50");
    expect(dnaMutateValid).toEqual({ success: true, data: "status:active:50" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("status:active:-1");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("status:active:50")).toBe(true);
    expect(dnaMutateSchema.validate("status:inactive:0")).toBe(true);
    expect(dnaMutateSchema.validate("status:pending:100")).toBe(true);
    expect(dnaMutateSchema.validate("status:active:-1")).toBe(false);
    expect(dnaMutateSchema.validate("status:active:101")).toBe(false);
    expect(dnaMutateSchema.validate("status:unknown:50")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("status:active:50");
    expect(zodValid.success).toBe(true);
  });

  it("handles complex template with format and length constraints", () => {
    const dnaSchema = dna.templateLiteral([
      "token:",
      dna.string().uuid().min(36).max(36)
    ]);
    const dnaMutateSchema = dna.templateLiteralMutate([
      "token:",
      dna.string().uuid().min(36).max(36)
    ]);
    const zodSchema = z.templateLiteral([
      "token:",
      z.string().uuid().min(36).max(36)
    ]);
    
    expect(dnaSchema.validate("token:550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(dnaSchema.validate("token:not-a-uuid")).toBe(false);
    expect(dnaSchema.validate("token:550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
    
    // DNA safeParse succeeds on valid
    const dnaValid = dnaSchema.safeParse("token:550e8400-e29b-41d4-a716-446655440000");
    expect(dnaValid).toEqual({ success: true, data: "token:550e8400-e29b-41d4-a716-446655440000" });
    
    // DNA safeParse fails on invalid
    const dnaInvalid = dnaSchema.safeParse("token:not-a-uuid");
    expect(dnaInvalid.success).toBe(false);
    
    // DNA Mutate safeParse succeeds on valid
    const dnaMutateValid = dnaMutateSchema.safeParse("token:550e8400-e29b-41d4-a716-446655440000");
    expect(dnaMutateValid).toEqual({ success: true, data: "token:550e8400-e29b-41d4-a716-446655440000" });
    
    // DNA Mutate safeParse fails on invalid
    const dnaMutateInvalid = dnaMutateSchema.safeParse("token:not-a-uuid");
    expect(dnaMutateInvalid.success).toBe(false);
    
    expect(dnaMutateSchema.validate("token:550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(dnaMutateSchema.validate("token:not-a-uuid")).toBe(false);
    expect(dnaMutateSchema.validate("token:550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
    
    // Zod succeeds on valid
    const zodValid = zodSchema.safeParse("token:550e8400-e29b-41d4-a716-446655440000");
    expect(zodValid.success).toBe(true);
    
    // Zod fails on invalid
    const zodInvalid = zodSchema.safeParse("token:not-a-uuid");
    expect(zodInvalid.success).toBe(false);
  });
});

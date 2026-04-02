import { describe, expect, it } from "vitest";
import { safeParse, safeStringify } from "../js/json.js";
import { isSuccess, isFailure } from "../safe/safemode.js";

describe("shared/json (Functional & Rupture)", () => {
  it("should parse valid JSON", () => {
    const raw = '{"id": 1, "name": "test"}';
    const res = safeParse(raw);
    expect(isSuccess(res)).toBe(true);
    expect(res[1]).toEqual({ id: 1, name: "test" });
  });

  it("should fail on invalid JSON (Rupture)", () => {
    const raw = '{"id": 1, corrupted';
    const res = safeParse(raw);
    expect(isFailure(res)).toBe(true);
    expect(res[0]).toBeDefined();
  });

  it("should stringify objects", () => {
    const obj = { a: 1 };
    const res = safeStringify(obj);
    expect(isSuccess(res)).toBe(true);
    expect(res[1]).toBe("{\n  \"a\": 1\n}");
  });

  it("should handle circular references in stringify (Rupture)", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const res = safeStringify(obj);
    expect(isFailure(res)).toBe(true);
  });
});

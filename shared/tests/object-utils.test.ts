import { describe, expect, it } from "vitest";
import { obj } from "../index.js";

describe("shared/object-utils (Functional & Rupture)", () => {
  describe("isObject", () => {
    it("should detect objects correctly", () => {
      expect(obj.isObject({})).toBe(true);
      expect(obj.isObject([])).toBe(true); // Arrays are objects in JS
      expect(obj.isObject(null)).toBe(false);
      expect(obj.isObject(42)).toBe(false);
    });
  });

  describe("isPureObject", () => {
    it("should detect pure records (not arrays, not nulls)", () => {
      expect(obj.isPureObject({})).toBe(true);
      expect(obj.isPureObject(Object.create(null))).toBe(true);
      expect(obj.isPureObject([])).toBe(false);
      expect(obj.isPureObject(new Date())).toBe(false);
    });
  });

  describe("deepMerge", () => {
    it("should merge nested objects", () => {
      const target = { a: { b: 1 } };
      const source = { a: { c: 2 }, d: 3 };
      const res = obj.deepMerge(target, source);
      expect(res).toEqual({ a: { b: 1, c: 2 }, d: 3 });
      expect(res).toBe(target); // Mutation check
    });

    it("should handle mixed types when deep merging (Rupture)", () => {
      const target = { a: 1 };
      const source = { a: { b: 2 } };
      obj.deepMerge(target, source as any);
      // EXPECTATION: it should be { a: { b: 2 } } but currently it's likely { a: 1 }
      expect(target.a).toEqual({ b: 2 });
    });

    it("should handle null or non-object sources (Rupture)", () => {
      const target = { a: 1 };
      // @ts-ignore
      expect(obj.deepMerge(target, null, undefined, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    it("should avoid deep merging arrays (Rupture/Design Choice)", () => {
      // In current implementation, isPureObject filters out arrays.
      const target = { a: [1] };
      const source = { a: [2] };
      obj.deepMerge(target, source);
      expect(target.a).toEqual([2]); // Replaced, not merged
    });
  });

  describe("deepClone", () => {
    it("should clone objects", () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = obj.deepClone(original);
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
    });

    it("should handle primitives and undefined (Rupture)", () => {
      expect(obj.deepClone(42)).toBe(42);
      expect(obj.deepClone(undefined)).toBe(undefined);
      expect(obj.deepClone(null)).toBe(null);
    });

    it("should fail on circular references using structuredClone (Rupture)", () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      // structuredClone supports circular references in modern JS!
      const clone = obj.deepClone(circular);
      expect(clone.self).toBe(clone);
      expect(clone).not.toBe(circular);
    });
  });
});

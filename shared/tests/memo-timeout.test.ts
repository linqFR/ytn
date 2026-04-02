import { describe, expect, it, vi } from "vitest";
import { memo, timeout } from "../index.js";
import { isFailure, isSuccess } from "../safe/safemode.js";

describe("shared/memo & timeout (Functional & Rupture)", () => {
  describe("Memoization", () => {
    it("should memoize a single argument function", () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoed = memo.memoizeOne(fn);

      expect(memoed(5)).toBe(10);
      expect(memoed(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should memoize multiple primitive arguments", () => {
      const fn = vi.fn((a: string, b: number) => `${a}-${b}`);
      const memoed = memo.memoizePrimitives(fn);

      expect(memoed("val", 1)).toBe("val-1");
      expect(memoed("val", 1)).toBe("val-1");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should re-calculate if function throws (Rupture)", () => {
      // In current implementation, if it throws, it's not cached.
      let count = 0;
      const fn = vi.fn(() => {
        count++;
        if (count === 1) throw new Error("first fail");
        return "success";
      });
      const memoed = memo.memoizeOne(fn);

      expect(() => memoed(1)).toThrow("first fail");
      expect(memoed(1)).toBe("success");
      expect(memoed(1)).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Timeout Utilities", () => {
    it("should resolve before timeout", async () => {
      const p = Promise.resolve("done");
      const res = await timeout.withTimeout(p, 100);
      expect(res).toBe("done");
    });

    it("should throw on timeout (Rupture)", async () => {
      const p = new Promise((res) => setTimeout(() => res("late"), 200));
      await expect(timeout.withTimeout(p, 50, "slowpoke")).rejects.toThrow("slowpoke");
    });

    it("should return safe error on timeout (Functional & Rupture)", async () => {
      const p = new Promise((res) => setTimeout(() => res("late"), 200));
      const res = await timeout.safeTimeout(p, 50, "too slow");
      
      expect(isFailure(res)).toBe(true);
      expect(res[0].message).toBe("too slow");
    });

    it("should succeed with safeTimeout if within time", async () => {
      const p = Promise.resolve("ok");
      const res = await timeout.safeTimeout(p, 100);
      expect(isSuccess(res)).toBe(true);
      expect(res[1]).toBe("ok");
    });
  });
});

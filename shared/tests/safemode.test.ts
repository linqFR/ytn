import { describe, expect, it } from "vitest";
import {
  safeResultOk,
  safeResultErr,
  isSafeResult,
  isSuccess,
  isFailure,
  toObject,
  fromObject,
  catchSafe,
  catchSafeSync,
  failfastBouncer,
  SAFE_MODE_WMARK,
} from "../safe/safemode.js";

describe("shared/safemode (Functional & Rupture)", () => {
  it("should brand SafeResult correctly", () => {
    const ok = safeResultOk(42);
    const err = safeResultErr("failed");

    expect(isSafeResult(ok)).toBe(true);
    expect(isSafeResult(err)).toBe(true);
    expect((ok as any)[SAFE_MODE_WMARK]).toBe(true);
    expect((err as any)[SAFE_MODE_WMARK]).toBe(true);
  });

  it("should detect success and failure states", () => {
    const ok = safeResultOk("success");
    const err = safeResultErr(new Error("oops"));

    expect(isSuccess(ok)).toBe(true);
    expect(isFailure(ok)).toBe(false);

    expect(isSuccess(err)).toBe(false);
    expect(isFailure(err)).toBe(true);
  });

  it("should convert between tuple and object variants", () => {
    const tuple = safeResultOk({ id: 1 });
    const objResult = toObject(tuple);

    expect(objResult.success).toBe(true);
    expect(objResult.data).toEqual({ id: 1 });

    const backToTuple = fromObject(objResult);
    expect(isSafeResult(backToTuple)).toBe(true);
    expect(backToTuple[1]).toEqual({ id: 1 });
  });

  it("should catch async errors using catchSafe", async () => {
    const successfulPromise = Promise.resolve("done");
    const res1 = await catchSafe(successfulPromise);
    expect(isSuccess(res1)).toBe(true);
    expect(res1[1]).toBe("done");

    const failedPromise = Promise.reject(new Error("network error"));
    const res2 = await catchSafe(failedPromise);
    expect(isFailure(res2)).toBe(true);
    expect(res2[0]).toBeInstanceOf(Error);
  });

  it("should recover with sync catchSafeSync", () => {
    const val = { x: 1 };
    const res = catchSafeSync(val);
    expect(isSuccess(res)).toBe(true);
    expect(res[1]).toBe(val);
  });

  it("should handle failfast pipelines correctly", () => {
    const step1 = (x: number) => x + 1;
    const step2 = (x: number) => x * 2;
    const bouncer = failfastBouncer(step1, step2);

    const res = bouncer(10);
    expect(res[1]).toBe(22); // (10 + 1) * 2
  });

  it("should interrupt pipeline when a step fails", () => {
    const step1 = (x: number) => x + 1;
    const failStep = () => { throw new Error("crash"); };
    const step3 = (x: number) => x * 10;

    const bouncer = failfastBouncer(step1, failStep, step3);
    const res = bouncer(10);

    expect(isFailure(res)).toBe(true);
    expect(res[0]).toBeInstanceOf(Error);
    expect(res[0].message).toBe("crash");
  });

  it("should fail to recognize unbranded tuples (Rupture)", () => {
    const unbrandedTuple = [null, "fake"]; // Mimics SafeResult but missing brand
    expect(isSafeResult(unbrandedTuple)).toBe(false);
  });

  it("should handle mixed inputs in catchSafe (Rupture)", async () => {
    // If we pass an already branded result, it should return it as-is
    const original = safeResultOk("original");
    const res = await catchSafe(original);
    expect(res).toBe(original);
  });
});

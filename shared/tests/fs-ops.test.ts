import { describe, expect, it, afterAll } from "vitest";
import { 
  readSafe, 
  writeSafe, 
  removeSafe, 
  ensureDir, 
  removeDeep 
} from "../dirpath/fs-ops.js";
import { isSuccess, isFailure, isSafeResult } from "../safe/safemode.js";
import path from "node:path";

describe("shared/fs-ops (Functional & Rupture)", () => {
  const TMP_DIR = path.resolve("./shared/tests/tmp");
  const TMP_FILE = path.join(TMP_DIR, "test.txt");

  afterAll(() => {
    // Cleanup everything
    removeDeep(TMP_DIR);
  });

  it("should ensure directory exists", async () => {
    const res = ensureDir(TMP_DIR);
    expect(isSuccess(res)).toBe(true);
    expect(isSafeResult(res)).toBe(true); // Official branding check
  });

  it("should write and read files", async () => {
    const content = "hello world";
    const writeRes = await writeSafe(TMP_FILE, content);
    expect(isSuccess(writeRes)).toBe(true);

    const readRes = await readSafe(TMP_FILE);
    expect(isSuccess(readRes)).toBe(true);
    expect(readRes[1]).toBe(content);
  });

  it("should handle non-existent files safely (Rupture)", async () => {
    const res = await readSafe("non-existent-file.xyz");
    expect(isFailure(res)).toBe(true);
    expect(res[0]).toBeDefined();
  });

  it("should delete files safely", async () => {
    const res = await removeSafe(TMP_FILE);
    expect(isSuccess(res)).toBe(true);
  });

  it("should handle non-existent directory during removeDeep (Functional fix test)", () => {
    const nonExistentPath = path.join(TMP_DIR, "ghost-path");
    const res = removeDeep(nonExistentPath);
    expect(isSuccess(res)).toBe(true); // Should return success true
    expect(isSafeResult(res)).toBe(true); // Branding check
    expect(res[1]).toBe(true);
  });
});

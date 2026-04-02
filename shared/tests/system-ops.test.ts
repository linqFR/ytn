import { describe, expect, it } from "vitest";
import { pkg, pathops, dirops } from "../index.js";
import { isFailure, isSuccess } from "../safe/safemode.js";
import path from "node:path";

describe("shared/system-ops (Functional & Rupture)", () => {
  describe("Path Ops", () => {
    it("should resolve the self root from a marker", () => {
      // should find the root of the project by marker
      const res = pathops.resolveSelfRoot(process.cwd(), "package.json");
      expect(res).toBeDefined();
      expect(typeof res).toBe("string");
    });

    it("should transform to relative path", () => {
      const abs = path.resolve("./shared/index.ts");
      const rel = pathops.toRelPath(abs, process.cwd());
      expect(rel).toContain("shared" + path.sep + "index.ts");
    });

    it("should normalize paths to forward slashes", () => {
      expect(pathops.normalizePath("a\\b\\c")).toBe("a/b/c");
      expect(pathops.normalizePath("a/b/c")).toBe("a/b/c");
    });
  });

  describe("Package Loader", () => {
    it("should load the current package.json sync", () => {
      const res = pkg.loadPackageSync(process.cwd());
      expect(isSuccess(res)).toBe(true);
      expect(res[1].name).toBeDefined();
    });

    it("should load a package including name and version async", async () => {
      const pkgPath = path.resolve("./packages/cli-to-zvo");
      const res = await pkg.loadPackage(pkgPath);
      expect(isSuccess(res)).toBe(true);
      expect(res[1].name).toBe("@ytn/czvo");
      expect(res[1].version).toBeDefined();
    });

    it("should fail when package.json is missing in path (Rupture)", () => {
      // Using a path that is guaranteed not to have a package.json above it
      // On Windows, the root of a drive might work, or a temp dir outside the workspace.
      // We try to use a path like "/ghost/path/123"
      const res = pkg.loadPackageSync("/ghost/path/that/does/not/exist"); 
      expect(isFailure(res)).toBe(true);
      expect(res[0].message).toContain("package.json not found");
    });
  });

  describe("Dir Ops", () => {
    it("should detect empty directories properly (Functional)", () => {
       const res = dirops.isEmptyDir("./shared");
       expect(res).toBe(false); // shared directory is definitely not empty
    });

    it("should identify system items", () => {
       expect(dirops.isSystemItem(".git")).toBe(true);
       expect(dirops.isSystemItem("_archive")).toBe(true);
       expect(dirops.isSystemItem("src")).toBe(false);
    });
  });
});

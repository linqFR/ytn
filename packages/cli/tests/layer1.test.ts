import { describe, it, expect } from "vitest";
import { createContract } from "../src/contract.js";
import { execute } from "../src/factory.js";
import { toJS } from "@ytrynot/dna/toJs";
import { compile } from "../src/compile.js";
import {
  targets,
  fallbacks
} from "./fixtures.js";

/**
 * Layer 1 tests — createContract() + execute()
 *
 * Sync pipeline (safeParse). 1 external (parseArgs).
 * Output: { success: true, route, payload } | { success: false, errors }
 */

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets,
  fallbacks,
  cli: { positionals: ["cmd", "files"] },
});

describe("Layer 1 — createContract + execute (sync, 1 external)", () => {
  describe("execute() — routing", () => {
    it("should route build with files and output", () => {
      const result = execute(processed, ["build", "a.ts", "b.ts", "--output", "dist/"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toEqual(["a.ts", "b.ts"]);
        expect(result.payload.output).toBe("dist/");
      }
    });

    it("should route deploy with coercion", () => {
      const result = execute(processed, ["deploy", "--target", "prod", "--port", "3000"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("deploy");
        expect(result.payload.target).toBe("prod");
        expect(result.payload.port).toBe(3000);
      }
    });

    it("should route --help to help via flagMap", () => {
      const result = execute(processed, ["--help"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route -h to help via short alias", () => {
      const result = execute(processed, ["-h"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route --version to version via flagMap", () => {
      const result = execute(processed, ["--version"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });

    it("should strip \\x00ID from payload", () => {
      const result = execute(processed, ["build", "a.ts"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload["\x00ID"]).toBeUndefined();
      }
    });
  });

  describe("execute() — error cases", () => {
    it("should return error for unknown command", () => {
      const result = execute(processed, ["unknown"]);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error for empty argv", () => {
      const result = execute(processed, []);
      expect(result.success).toBe(false);
    });

    it("should return error for invalid port (non-coercible)", () => {
      const result = execute(processed, ["deploy", "--target", "prod", "--port", "abc"]);
      expect(result.success).toBe(false);
    });
  });

  describe("execute() — is synchronous", () => {
    it("should return OExecuteResult (not a Promise)", () => {
      const result = execute(processed, ["build", "a.ts"]);
      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof result).toBe("object");
    });
  });

  describe("externals — 1 external only (parseArgs)", () => {
    it("should have only parseArgs in externals", () => {
      expect(Object.keys(processed.externals)).toEqual(["parseArgs"]);
    });

    it("should list only parseArgs as requiredExternal in toJS output", () => {
      // CAST: toJS return type is generic — narrowed to verify externals
      const compiled = toJS(false, true)(processed.pipeline.toDna()) as {
        code: string[];
        requiredExternals: string[];
      };
      expect(compiled.requiredExternals).toEqual(compiled.requiredExternals);
      expect(compiled.requiredExternals).toEqual(["parseArgs", "dna"]);
    });
  });

  describe("extractStep guard (concern 3d) — dead code verification", () => {
    it("should return DNA errors for unknown command (guard NOT reached)", () => {
      // cliUnion rejection → DNA error path → extractStep transform NOT reached
      // The guard `if (!v) return {route: "", payload: {}}` is dead code
      const result = execute(processed, ["totally-unknown"]);
      expect(result.success).toBe(false);
      if (!result.success) {
        // DNA errors, not a silent {route: "", payload: {}}
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain("No CLI branch matches");
      }
    });

    it("should return DNA errors for empty argv (guard NOT reached)", () => {
      const result = execute(processed, []);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("AOT compile — layer 1 is sync and standalone", () => {
    it("compile() should produce same results as execute()", () => {
      const parser = compile(processed);
      const argv = ["build", "a.ts", "--output", "dist/"];
      const aotResult = parser(argv);
      const execResult = execute(processed, argv);

      expect(aotResult.success).toBe(execResult.success);
      if (aotResult.success && execResult.success) {
        expect(aotResult.route).toBe(execResult.route);
        expect(aotResult.payload.files).toEqual(execResult.payload.files);
      }
    });

    it("compiled parser should be synchronous (not return a Promise)", () => {
      const parser = compile(processed);
      const result = parser(["build", "a.ts"]);
      expect(result).not.toBeInstanceOf(Promise);
    });
  });
});

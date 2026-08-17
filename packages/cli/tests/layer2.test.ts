import { describe, it, expect } from "vitest";
import { createContract } from "../src/contract.js";
import { executeContract } from "../src/factory.js";
import type { IHandlers, OHandlerResult } from "../src/types/contract.types.js";
import { toJS } from "@ytrynot/dna/toJs";
import {
  buildBranch,
  deployBranch,
  helpBranch,
  versionBranch,
  targets,
  fallbacks,
} from "./fixtures.js";

/**
 * Layer 2 tests — executeContract()
 *
 * Async transform (handler dispatch). 2 externals (parseArgs, handlers).
 * safeParseAsync required. Handlers return {success, data?} | {success, error?}.
 * Output: { success: true, data: OHandlerResult } | { success: false, errors }
 */

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets,
  fallbacks,
  cli: { positionals: ["cmd", "files"] },
});

const handlers: IHandlers = {
  build: (payload) => ({ success: true, data: `Built ${JSON.stringify(payload.files)}` }),
  deploy: (payload) => ({ success: true, data: `Deployed to ${payload.target}` }),
  help: () => ({ success: true, data: "Help text" }),
  version: () => ({ success: true, data: "1.0.0" }),
};

const executable = executeContract(processed, handlers);

describe("Layer 2 — executeContract (async, 2 externals)", () => {
  describe("safeParseAsync — handler dispatch", () => {
    it("should dispatch to build handler and return its result", async () => {
      const result = await executable.pipeline.safeParseAsync(
        ["build", "a.ts", "b.ts"],
        executable.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) {
          expect(data.data).toContain("a.ts");
          expect(data.data).toContain("b.ts");
        }
      }
    });

    it("should dispatch to deploy handler with coerced port", async () => {
      const result = await executable.pipeline.safeParseAsync(
        ["deploy", "--target", "prod", "--port", "3000"],
        executable.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) {
          expect(data.data).toBe("Deployed to prod");
        }
      }
    });

    it("should dispatch to help handler via --help flag", async () => {
      const result = await executable.pipeline.safeParseAsync(
        ["--help"],
        executable.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) expect(data.data).toBe("Help text");
      }
    });

    it("should dispatch to version handler via --version flag", async () => {
      const result = await executable.pipeline.safeParseAsync(
        ["--version"],
        executable.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) expect(data.data).toBe("1.0.0");
      }
    });
  });

  describe("handler result contract", () => {
    it("should return {success: false, error} when handler returns nothing", async () => {
      const emptyHandlers: IHandlers = {
        // CAST: intentionally returns undefined to test the default error
        build: (() => undefined) as unknown as IHandlers["build"],
        deploy: handlers.deploy,
        help: handlers.help,
        version: handlers.version,
      };
      const exec = executeContract(processed, emptyHandlers);
      const result = await exec.pipeline.safeParseAsync(
        ["build", "a.ts"],
        exec.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(false);
        if (!data.success) {
          expect(data.error).toContain("Handler returned no result");
        }
      }
    });

    it("should return {success: false, error} when no handler matches route", async () => {
      // Only build handler — deploy has no handler
      const partialHandlers: IHandlers = {
        build: handlers.build,
      };
      const exec = executeContract(processed, partialHandlers);
      const result = await exec.pipeline.safeParseAsync(
        ["deploy", "--target", "prod"],
        exec.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(false);
        if (!data.success) {
          expect(data.error).toContain("No handler for route: deploy");
        }
      }
    });

    it("should support async handlers", async () => {
      const asyncHandlers: IHandlers = {
        build: async (payload) => {
          await new Promise((r) => setTimeout(r, 10));
          return { success: true, data: `Async built ${JSON.stringify(payload.files)}` };
        },
        deploy: handlers.deploy,
        help: handlers.help,
        version: handlers.version,
      };
      const exec = executeContract(processed, asyncHandlers);
      const result = await exec.pipeline.safeParseAsync(
        ["build", "x.ts"],
        exec.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) {
          expect(data.data).toContain("Async built");
          expect(data.data).toContain("x.ts");
        }
      }
    });
  });

  describe("validation errors (cliUnion rejection)", () => {
    it("should return DNA errors for unknown command (handler transform not reached)", async () => {
      const result = await executable.pipeline.safeParseAsync(
        ["unknown"],
        executable.externals,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should return DNA errors for empty argv", async () => {
      const result = await executable.pipeline.safeParseAsync(
        [],
        executable.externals,
      );
      expect(result.success).toBe(false);
    });
  });

  describe("safeParse (sync) should throw on async transform", () => {
    it("should throw 'Schema contains async refinements/transforms'", () => {
      expect(() =>
        executable.pipeline.safeParse(["build", "a.ts"], executable.externals),
      ).toThrow(/async/);
    });
  });

  describe("handler throw behavior (concern 3b)", () => {
    it("should throw when handler throws (safeParseAsync propagates, not {success: false})", async () => {
      const throwingHandlers: IHandlers = {
        build: () => { throw new Error("Handler crashed"); },
        deploy: handlers.deploy,
        help: handlers.help,
        version: handlers.version,
      };
      const exec = executeContract(processed, throwingHandlers);
      // safeParseAsync propagates the throw — it does NOT return {success: false}
      await expect(
        exec.pipeline.safeParseAsync(["build", "a.ts"], exec.externals),
      ).rejects.toThrow("Handler crashed");
    });

    it("should return {success: false, error} when handler catches and returns error", async () => {
      const catchingHandlers: IHandlers = {
        build: () => {
          try { throw new Error("Handler crashed"); }
          catch (e) {
            return { success: false, error: String((e as Error).message) };
          }
        },
        deploy: handlers.deploy,
        help: handlers.help,
        version: handlers.version,
      };
      const exec = executeContract(processed, catchingHandlers);
      const result = await exec.pipeline.safeParseAsync(
        ["build", "a.ts"],
        exec.externals,
      );
      // Handler catches → returns {success: false, error} → formatter path
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(false);
        if (!data.success) {
          expect(data.error).toBe("Handler crashed");
        }
      }
    });
  });

  describe("externals — 2 externals (parseArgs, handlers)", () => {
    it("should have parseArgs and handlers in externals", () => {
      expect(Object.keys(executable.externals).sort()).toEqual(["handlers", "parseArgs"]);
    });

    it("should list parseArgs and handlers as requiredExternals in toJS output", () => {
      // CAST: toJS return type is generic — narrowed to verify externals
      const compiled = toJS(false, true)(executable.pipeline.toDna()) as {
        code: string[];
        requiredExternals: string[];
      };
      expect(compiled.requiredExternals.sort()).toEqual(["handlers", "parseArgs"]);
    });

    it("should generate async function (contains 'async function')", () => {
      // CAST: toJS return type is generic — narrowed to verify code shape
      const compiled = toJS(false, true)(executable.pipeline.toDna()) as {
        code: string[];
        requiredExternals: string[];
      };
      const fullCode = compiled.code.join("\n");
      expect(fullCode).toContain("async function");
      expect(fullCode).toContain("await");
    });
  });
});

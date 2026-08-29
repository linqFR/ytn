import { describe, it, expect } from "vitest";
import { createContract } from "../src/contract.js";
import { executeContract, cliFactory } from "../src/factory.js";
import type { IHandlers, OFormattedResult, FormatterFn } from "../src/types/contract.types.js";
import { toJS } from "@ytrynot/dna/toJs";
import { routes } from "./fixtures.js";

/**
 * Layer 3 tests — cliFactory()
 *
 * Adds formatter transform. 3 externals (parseArgs, handlers, formatter).
 * safeParseAsync required. Output: { exit: 0|1, message: string }.
 */

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  routes,
  cli: { positionals: ["cmd", "files"] },
});

const handlers: IHandlers = {
  build: (payload) => ({ success: true, data: `Built ${JSON.stringify(payload.files)}` }),
  deploy: (payload) => ({ success: true, data: `Deployed to ${payload.target}` }),
  help: () => ({ success: true, data: "Help text" }),
  version: () => ({ success: true, data: "1.0.0" }),
};

const testFormatter: FormatterFn = (result) => {
  if (result.success) {
    return { exit: 0, message: String(result.data ?? "") };
  }
  return { exit: 1, message: `Error: ${result.error}` };
};

const executable = executeContract(processed, handlers);
const formatted = cliFactory(executable, testFormatter);

describe("Layer 3 — cliFactory (async, 3 externals)", () => {
  describe("safeParseAsync — formatter output", () => {
    it("should format build handler result as {exit: 0, message}", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["build", "a.ts"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(0);
        expect(data.message).toContain("Built");
        expect(data.message).toContain("a.ts");
      }
    });

    it("should format deploy handler result as {exit: 0, message}", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["deploy", "--target", "prod"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(0);
        expect(data.message).toBe("Deployed to prod");
      }
    });

    it("should format help handler result as {exit: 0, message}", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["--help"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(0);
        expect(data.message).toBe("Help text");
      }
    });

    it("should format version handler result as {exit: 0, message}", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["--version"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(0);
        expect(data.message).toBe("1.0.0");
      }
    });
  });

  describe("formatter — error cases", () => {
    it("should format handler error as {exit: 1, message}", async () => {
      const partialHandlers: IHandlers = {
        build: handlers.build,
      };
      const exec = executeContract(processed, partialHandlers);
      const fmt = cliFactory(exec, testFormatter);
      const result = await fmt.pipeline.safeParseAsync(
        ["deploy", "--target", "prod"],
        fmt.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(1);
        expect(data.message).toContain("No handler for route: deploy");
      }
    });

    it("should format empty handler result as {exit: 1, message}", async () => {
      const emptyHandlers: IHandlers = {
        // CAST: intentionally returns undefined to test the default error path
        build: (() => undefined) as unknown as IHandlers["build"],
        deploy: handlers.deploy,
        help: handlers.help,
        version: handlers.version,
      };
      const exec = executeContract(processed, emptyHandlers);
      const fmt = cliFactory(exec, testFormatter);
      const result = await fmt.pipeline.safeParseAsync(
        ["build", "a.ts"],
        fmt.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(1);
        expect(data.message).toContain("Handler returned no result");
      }
    });
  });

  describe("validation errors (cliUnion rejection) — formatter NOT reached", () => {
    it("should return DNA errors for unknown command (not formatted)", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["unknown"],
        formatted.externals,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("custom formatter", () => {
    it("should use a JSON formatter", async () => {
      const jsonFormatter: FormatterFn = (result) => {
        if (result.success) {
          return { exit: 0, message: JSON.stringify({ ok: true, data: result.data }) };
        }
        return { exit: 1, message: JSON.stringify({ ok: false, error: result.error }) };
      };
      const exec = executeContract(processed, handlers);
      const fmt = cliFactory(exec, jsonFormatter);
      const result = await fmt.pipeline.safeParseAsync(
        ["build", "a.ts"],
        fmt.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OFormattedResult;
        expect(data.exit).toBe(0);
        const parsed = JSON.parse(data.message);
        expect(parsed.ok).toBe(true);
      }
    });
  });

  describe("externals — 3 externals (parseArgs, handlers, formatter)", () => {
    it("should have parseArgs, handlers, formatter in externals", () => {
      expect(Object.keys(formatted.externals).sort()).toEqual(["formatter", "handlers", "parseArgs"]);
    });

    it("should list 3 requiredExternals in toJS output", () => {
      // CAST: toJS return type is generic — narrowed to verify externals
      const compiled = toJS(false, true)(formatted.pipeline.toDna()) as {
        code: string[];
        requiredExternals: string[];
      };
      expect(compiled.requiredExternals.sort()).toEqual(["dna", "formatter", "handlers", "parseArgs"]);
    });
  });
});

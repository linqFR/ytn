import { describe, it, expect, vi, afterEach } from "vitest";
import { cliFactory, executeContract, fullCli } from "../src/factory.js";
import { createContract } from "../src/contract.js";
import type { IHandlers, OHandlerResult, FormatterFn } from "../src/types/contract.types.js";
import {
  routes
} from "./fixtures.js";

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  routes,
  cli: { positionals: ["cmd", "files"] },
});

// Mock process.exit to prevent vitest from actually exiting
const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
  throw new Error(`process.exit(${code})`);
});

// Mock console.log/console.error to avoid noise
const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  exitSpy.mockClear();
  logSpy.mockClear();
  errSpy.mockClear();
});

// formatter: takes OHandlerResult → OFormattedResult
const testFormatter: FormatterFn = (result) => {
  if (result.success) {
    return { exit: 0, message: String(result.data ?? "") };
  }
  return { exit: 1, message: `Error: ${result.error}` };
};

// Error formatter for DNA validation errors (cliUnion rejection)
const formatDnaErrors = (errors: { message: string }[]): string =>
  errors.map((e) => e.message).join("\n");

describe("cliFactory (with handlers + formatter) — 5-layer architecture", () => {
  describe("dispatch + exit(0)", () => {
    it("should dispatch to build handler and exit(0)", async () => {
      const handlers: IHandlers = {
        build: (data) => {
          expect(data.files).toEqual(["a.ts"]);
          return { success: true, data: "built" };
        },
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "build", "a.ts"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(0)");
      } finally {
        process.argv = origArgv;
      }
    });

    it("should dispatch to deploy handler and exit(0)", async () => {
      const handlers: IHandlers = {
        deploy: (data) => {
          expect(data.target).toBe("prod");
          expect(data.port).toBe(3000);
          return { success: true, data: "deployed" };
        },
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      // Override process.argv for this test
      const origArgv = process.argv;
      process.argv = ["node", "cli", "deploy", "--target", "prod", "--port", "3000"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(0)");
      } finally {
        process.argv = origArgv;
      }
    });

    it("should dispatch to help handler for --help and exit(0)", async () => {
      const handlers: IHandlers = {
        help: (data) => {
          expect(data.files).toEqual([]);
          return { success: true, data: "help text" };
        },
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "--help"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(0)");
      } finally {
        process.argv = origArgv;
      }
    });

    it("should dispatch to help handler for 'build --help' with files=['build']", async () => {
      const handlers: IHandlers = {
        help: (data) => {
          expect(data.files).toEqual(["build"]);
          return { success: true, data: "help build" };
        },
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "build", "--help"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(0)");
      } finally {
        process.argv = origArgv;
      }
    });

    it("should dispatch to version handler for --version and exit(0)", async () => {
      const handlers: IHandlers = {
        version: () => ({ success: true, data: "1.0.0" }),
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "--version"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(0)");
      } finally {
        process.argv = origArgv;
      }
    });
  });

  describe("error handling + exit(1)", () => {
    it("should format errors and exit(1) on validation error", async () => {
      const handlers: IHandlers = {
        build: () => ({ success: true, data: "built" }),
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "unknown"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(1)");
      } finally {
        process.argv = origArgv;
      }
      expect(errSpy).toHaveBeenCalled();
    });

    it("should exit(1) when no handler matches route", async () => {
      const handlers: IHandlers = {
        build: () => ({ success: true, data: "built" }),
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "deploy", "--target", "prod"];
      try {
        await run();
      } catch (e) {
        expect(String(e)).toContain("process.exit(1)");
      } finally {
        process.argv = origArgv;
      }
    });
  });

  describe("exit codes", () => {
    it("should call process.exit(0) on successful handler dispatch", async () => {
      const handlers: IHandlers = {
        build: () => ({ success: true, data: "built" }),
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "build"];
      try {
        await run();
      } catch {
        // mocked exit throws
      } finally {
        process.argv = origArgv;
      }
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("should call process.exit(1) on validation error", async () => {
      const handlers: IHandlers = {
        build: () => ({ success: true, data: "built" }),
      };
      const executable = executeContract(processed, handlers);
      const formatted = cliFactory(executable, testFormatter);
      const run = fullCli(formatted);
      const origArgv = process.argv;
      process.argv = ["node", "cli", "unknown"];
      try {
        await run();
      } catch {
        // mocked exit throws
      } finally {
        process.argv = origArgv;
      }
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handler result contract", () => {
    it("should return error when handler returns nothing", async () => {
      const handlers: IHandlers = {
        // CAST: intentionally returns undefined to test the default error
        build: (() => undefined) as unknown as IHandlers["build"],
      };
      const executable = executeContract(processed, handlers);
      const result = await executable.pipeline.safeParseAsync(
        ["build", "a.ts"],
        executable.externals,
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

    it("should return error when no handler matches route", async () => {
      const handlers: IHandlers = {
        build: () => ({ success: true, data: "built" }),
      };
      // Use a route that has no handler — deploy
      const executable = executeContract(processed, handlers);
      const result = await executable.pipeline.safeParseAsync(
        ["deploy", "--target", "prod"],
        executable.externals,
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
      const handlers: IHandlers = {
        build: async (data) => {
          await new Promise((r) => setTimeout(r, 10));
          return { success: true, data: `Built ${JSON.stringify(data.files)}` };
        },
      };
      const executable = executeContract(processed, handlers);
      const result = await executable.pipeline.safeParseAsync(
        ["build", "a.ts"],
        executable.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as OHandlerResult;
        expect(data.success).toBe(true);
        if (data.success) {
          expect(data.data).toContain("a.ts");
        }
      }
    });
  });
});

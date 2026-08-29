import { describe, it, expect, vi, afterEach } from "vitest";
import { createContract } from "../src/contract.js";
import { executeContract, cliFactory, fullCli } from "../src/factory.js";
import type { IHandlers, FormatterFn } from "../src/types/contract.types.js";
import { routes } from "./fixtures.js";

/**
 * Layer 4 tests — fullCli()
 *
 * Binds to Node.js globals (process.argv, console, process.exit).
 * 3 externals + Node globals. No DNA transform for process.exit.
 */

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  routes,
  cli: { positionals: ["cmd", "files"] },
});

const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
  throw new Error(`process.exit(${code})`);
});
const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  exitSpy.mockClear();
  logSpy.mockClear();
  errSpy.mockClear();
});

const testFormatter: FormatterFn = (result) => {
  if (result.success) {
    return { exit: 0, message: String(result.data ?? "") };
  }
  return { exit: 1, message: `Error: ${result.error}` };
};

function makeCli(handlers: IHandlers) {
  const executable = executeContract(processed, handlers);
  const formatted = cliFactory(executable, testFormatter);
  return fullCli(formatted);
}

function withArgv(argv: string[], fn: () => Promise<void>): Promise<void> {
  const orig = process.argv;
  process.argv = ["node", "cli", ...argv];
  return fn().finally(() => { process.argv = orig; });
}

describe("Layer 4 — fullCli (Node globals, process.exit)", () => {
  describe("successful dispatch — exit(0)", () => {
    it("should console.log message and exit(0) for build", async () => {
      const run = makeCli({
        build: (data) => ({ success: true, data: `Built ${JSON.stringify(data.files)}` }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["build", "a.ts"], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(0)"); }
      });
      expect(logSpy).toHaveBeenCalled();
    });

    it("should console.log message and exit(0) for --help", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "Help text" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["--help"], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(0)"); }
      });
      expect(logSpy).toHaveBeenCalledWith("Help text");
    });
  });

  describe("handler error — exit(1)", () => {
    it("should console.error message and exit(1) when no handler matches", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
      });
      await withArgv(["deploy", "--target", "prod"], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(1)"); }
      });
      expect(errSpy).toHaveBeenCalled();
    });

    it("should console.error message and exit(1) when handler returns nothing", async () => {
      const run = makeCli({
        // CAST: intentionally returns undefined
        build: (() => undefined) as unknown as IHandlers["build"],
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["build", "a.ts"], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(1)"); }
      });
      expect(errSpy).toHaveBeenCalled();
    });
  });

  describe("validation error — exit(1)", () => {
    it("should console.error DNA errors and exit(1) for unknown command", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["unknown"], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(1)"); }
      });
      expect(errSpy).toHaveBeenCalled();
    });

    it("should console.error DNA errors and exit(1) for empty argv", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv([], async () => {
        try { await run(); } catch (e) { expect(String(e)).toContain("process.exit(1)"); }
      });
      expect(errSpy).toHaveBeenCalled();
    });
  });

  describe("exit codes", () => {
    it("should call process.exit(0) on success", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["build"], async () => {
        try { await run(); } catch { /* mocked */ }
      });
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("should call process.exit(1) on validation error", async () => {
      const run = makeCli({
        build: () => ({ success: true, data: "built" }),
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["unknown"], async () => {
        try { await run(); } catch { /* mocked */ }
      });
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handler throw behavior (concern 3b)", () => {
    it("should propagate handler throw (not caught, not exit(1))", async () => {
      // Handlers must return {success, data} | {success, error}.
      // If a handler throws, it's a bug in the handler — fullCli does NOT catch it.
      // safeParseAsync propagates the throw → unhandled rejection.
      const run = makeCli({
        build: () => { throw new Error("Handler crashed"); },
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["build", "a.ts"], async () => {
        await expect(run()).rejects.toThrow("Handler crashed");
      });
      // process.exit should NOT have been called — the throw propagated
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe("async handler support", () => {
    it("should await async handler before process.exit(0)", async () => {
      let handlerCompleted = false;
      const run = makeCli({
        build: async (data) => {
          await new Promise((r) => setTimeout(r, 10));
          handlerCompleted = true;
          return { success: true, data: `Built ${JSON.stringify(data.files)}` };
        },
        deploy: () => ({ success: true, data: "deployed" }),
        help: () => ({ success: true, data: "help" }),
        version: () => ({ success: true, data: "1.0.0" }),
      });
      await withArgv(["build", "a.ts"], async () => {
        try { await run(); } catch { /* mocked exit */ }
      });
      expect(handlerCompleted).toBe(true);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });
});

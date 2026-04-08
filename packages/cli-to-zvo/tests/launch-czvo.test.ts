import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContract, pico } from "../src/editor.js";
import { launchCzvo } from "../src/launcher/czvo-launcher.js";

describe("🚀 launchCzvo: Universal Command Launcher Integration", () => {
  const contract = createContract({
    name: "test-launcher",
    description: "Integration test for the launcher",
    cli: {
      positionals: ["action"],
      flags: {
        verbose: { short: "v", type: "boolean", desc: "Enable logging" },
      },
    },
    targets: {
      greet: {
        action: pico.literal("hello"),
        verbose: pico.boolean().optional(),
      },
    },
  });

  it("should dispatch to the correct handler on success", async () => {
    // We use vi.fn() to track calls
    const greetHandler = vi.fn();
    const errorHandler = vi.fn();

    const handlers = {
      greet: greetHandler,
      error: errorHandler,
    };

    // Simulate "hello -v"
    await launchCzvo(contract, handlers, ["hello", "-v"]);

    // Assertions
    expect(greetHandler).toHaveBeenCalledOnce();
    expect(greetHandler).toHaveBeenCalledWith({
      action: "hello",
      verbose: true,
    });
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it("should dispatch to the error handler on parsing failure", async () => {
    const greetHandler = vi.fn();
    const errorHandler = vi.fn();

    const handlers = {
      greet: greetHandler,
      error: errorHandler,
    };

    // Simulate invalid input: unknown action "jump"
    await launchCzvo(contract, handlers, ["jump"]);

    // Assertions
    expect(greetHandler).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledOnce();

    // Check that we received a Zod error in the handler
    const error = errorHandler.mock.calls[0][0];
    expect(error.issues).toBeDefined();
    expect(JSON.stringify(error.issues)).toContain("invalid_union");
  });

  it("should handle async handlers properly", async () => {
    let resolvedValue = "";
    const asyncGreet = async (data: any) => {
      await new Promise((r) => setTimeout(r, 10));
      resolvedValue = `Handled ${data.action}`;
    };

    await launchCzvo(contract, { greet: asyncGreet }, ["hello"]);
    expect(resolvedValue).toBe("Handled hello");
  });

  describe("🛡️ Resilience & Security (Stress Tests)", () => {
    let exitSpy: any;
    let consoleSpy: any;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        return undefined as never;
      });
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should NOT crash if a matched route has no corresponding handler", async () => {
      await expect(
        launchCzvo(contract, {}, ["hello"]),
      ).resolves.toBeUndefined();
    });

    it("should capture and suppress errors thrown inside a handler", async () => {
      const explodingHandler = () => {
        throw new Error("BOOM!");
      };
      await expect(
        launchCzvo(contract, { greet: explodingHandler }, ["hello"]),
      ).resolves.toBeUndefined();
    });

    it("should still handle the main logic if error handler is missing (CLI mode)", async () => {
      await launchCzvo(contract, {}, ["unknown-action"]);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should be resilient to null/undefined arguments and use default argv", async () => {
      await launchCzvo(contract, {});
      // It might exit or succeed based on environment argv,
      // but the goal is it shouldn't throw a JS exception.
      expect(exitSpy).toBeDefined();
    });
  });
});

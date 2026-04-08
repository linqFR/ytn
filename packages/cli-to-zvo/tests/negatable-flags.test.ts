import { describe, it, expect } from "vitest";
import { createContract, pico } from "../src/editor.js";
import { parseCli } from "../src/runtime/cli-parser.js";

describe("🧪 Negative  Flags (--no-flag) Support", () => {
  const tools = createContract({
    name: "Negative -cli",
    description: "Testing Negative  flags",
    cli: {
      flags: {
        verbose: { type: "boolean", short: "v" },
        "ytn-ui": { type: "boolean" },
      },
    },
    targets: {
      main: {
        verbose: pico.boolean().optional().default(true),
        ytnUi: pico.boolean().optional(),
      },
    },
    options: {
      allowNegative: true, // IMPORTANT: Enable the feature
    },
  });

  const parser = (args: string[]) =>
    parseCli(
      args,
      tools.parsingArgs,
      tools.parseArgsResultParser,
      tools.zvoSchema,
    );

  it("should set the flag to false when --no-prefix is used", () => {
    const res = parser(["--no-verbose"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.data.verbose).toBe(false);
    }
  });

  it("should handle Negative  flags with kebab-case mapping", () => {
    const res = parser(["--no-ytn-ui"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.data.ytnUi).toBe(false);
    }
  });

  it("should maintain default value (true) if the flag is not provided", () => {
    const res = parser([]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.data.verbose).toBe(true);
    }
  });

  it("should set true if the flag is provided normally", () => {
    const res = parser(["--verbose"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.data.verbose).toBe(true);
    }
  });
});

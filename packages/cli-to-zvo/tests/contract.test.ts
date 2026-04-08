import { describe, expect, it } from "vitest";
import { pico, createContract } from "../src/editor.js";

describe("CliContract Validation", () => {
  it("should validate a correct hybrid contract", () => {
    const processed = createContract({
      name: "ytn",
      description: "YT Downloader",
      cli: {
        positionals: ["input-path"],
        flags: {
          retry: { short: "r", type: "string", desc: "Retries" },
        },
      },
      targets: {
        sync: {
          inputPath: pico.filepath(),
          retry: pico.number().min(1).max(5),
        },
      },
    });

    expect(processed.name).toBe("ytn");
  });

  it("should throw on invalid contract", () => {
    expect(() => {
      createContract({
        name: "err",
        description: "err",
        cli: { positionals: [] },
        targets: {
          Wait: { test: pico.string() }, // Uppercase target name
        },
      } as any);
    }).toThrow();
  });
});

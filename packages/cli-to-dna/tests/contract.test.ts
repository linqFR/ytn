import { describe, expect, it } from "vitest";
import { createContract, execute, pico } from "../src/index.js";
import type { IContract } from "../src/contract.js";

type Result = { success: boolean; data?: unknown; errors?: unknown[] };

const contract: IContract = {
  name: "demo",
  description: "Contract sandbox test",
  cli: {
    positionals: ["cmd", "arg"],
    flags: {
      verbose: { short: "v", type: "boolean" },
      quality: { short: "q", type: "string" },
    },
  },
  targets: {
    install: {
      cmd: pico.literal("install"),
      arg: pico.string(),
      verbose: pico.boolean().optional(),
    },
    download: {
      cmd: pico.literal("dl"),
      arg: pico.url(),
      quality: pico.number().optional(),
      verbose: pico.boolean().optional(),
    },
  },
};

const processed = createContract(contract);

describe("createContract + execute", () => {
  it("install target with verbose flag", () => {
    const res = execute(processed, ["install", "~/app", "--verbose"]) as Result;
    expect(res).toMatchObject({
      success: true,
      data: {
        cmd: "install",
        arg: "~/app",
        verbose: true,
      },
    });
  });

  it("download target with quality flag", () => {
    const res = execute(processed, [
      "dl",
      "https://example.com/file",
      "-q",
      "5",
    ]) as Result;
    expect(res).toMatchObject({
      success: true,
      data: {
        cmd: "dl",
        arg: "https://example.com/file",
        quality: 5,
      },
    });
  });

  it("rejects unknown command", () => {
    const res = execute(processed, ["unknown"]) as Result;
    expect(res.success).toBe(false);
  });

  it("rejects missing required positional", () => {
    const res = execute(processed, ["install"]) as Result;
    expect(res.success).toBe(false);
  });
});

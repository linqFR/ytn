import { describe, expect, it } from "vitest";
import { createContract, pico } from "../src/index.js";
import type { IContract } from "../src/contract.js";

describe("DSL Union Support", () => {
  it("should support pipe unions in DSL via createContract", () => {
    const myContract: IContract = {
      name: "test",
      description: "test",
      cli: {
        positionals: ["cmd"],
        flags: {
          age: { short: "a", type: "string" },
        },
      },
      targets: {
        run: {
          cmd: pico.literal("run"),
          age: pico.or(pico.string(), pico.number()),
        },
      },
    };

    expect(() => createContract(myContract)).not.toThrow();
  });
});

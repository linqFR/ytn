import { describe, expect, it } from "vitest";
import { createContract, pico } from "../src/editor.js";

describe("DSL Union Support", () => {
  it("should support pipe unions in DSL via createContract", () => {
    const myContract = {
      name: "test",
      description: "test",
      cli: {
        flags: {
          age: { short: "a", type: "string", desc: "Age" },
        },
      },
      targets: {
        run: {
          age: pico.or(pico.string(), pico.number()),
        },
      },
    };

    expect(() => createContract(myContract as any)).not.toThrow();
  });
});

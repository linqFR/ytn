import { describe, expect, it } from "vitest";
import { cliToZod, pico } from "../src/index.js";

describe("cliToZod DSL Union Support", () => {
  it("should support pipe unions in DSL via cliToZod", () => {
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

    expect(() => cliToZod(myContract as any)).not.toThrow();
  });
});

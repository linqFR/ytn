import { describe, expect, it } from "vitest";
import { createContract, pico } from "../src/editor.js";
import { execute } from "../src/index.js";

describe("mycmd.ts Behavioral Matrix", () => {
  const schemDef = {
    step: pico.string().desc("ID of the step").min(3),
    ytnUI: pico.string().desc("ynt UI").optional(),
  };

  const localHelp = pico.help("Command Step Help");

  const tools = createContract({
    name: "footprint",
    description: "commande system for my footprint",
    cli: {
      positionals: ["step", "ytn-ui"],
      flags: {
        result: { short: "r", type: "string", desc: "result of the step id" },
        verbose: { short: "v", type: "string", desc: "verbosity" },
        ...localHelp.flag,
      },
    },
    targets: {
      stepHint: {
        ...pico.help("Command Step Help"),
        step: schemDef.step,
        verbose: pico.enum("few", "full").optional().default("few"),
      },
      stepResultOk: {
        result: pico.literal("ok"),
        step: schemDef.step,
        ytnUi: schemDef.ytnUI,
      },
      stepResultFail: {
        result: pico.literal("fail"),
        step: schemDef.step,
      },
      stepToto: {
        result: pico.enum("ok", "fail", "zut"),
        step: pico.literal("toto"),
        ytnUi: pico.literal("dark"),
      },
    },
    fallbacks: {
      globalHelp: {
        ...pico.help("Global Command Help"),
      },
      catchAnythingLeft: {},
    },
  });

  const parser = (args: string[]) => execute(tools, args);

  it("should route to globalHelp when only --help is provided", () => {
    const res = parser(["--help"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("globalHelp");
    }
  });

  it("should route to stepHint when a step and --help are provided", () => {
    // Conflict test: 'step --help' could match globalHelp (mask 16)
    // but should match stepHint (mask 17) because it's more specific.
    const res = parser(["mystep", "--help"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepHint");
      expect(res.data.data.step).toBe("mystep");
      // Should pick default value for verbose
      expect(res.data.data.verbose).toBe("few");
    }
  });

  it("should route to stepHint with explicit verbose flag", () => {
    const res = parser(["mystep", "--help", "--verbose", "full"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepHint");
      expect(res.data.data.verbose).toBe("full");
    }
  });

  it("should route to stepResultOk for any step when result is 'ok'", () => {
    const res = parser(["mystep", "-r", "ok"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepResultOk");
      expect(res.data.data.result).toBe("ok");
    }
  });

  it("should route to stepToto for specific 'toto' step and 'dark' UI", () => {
    const res = parser(["toto", "dark", "-r", "ok"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepToto");
      expect(res.data.data.step).toBe("toto");
      expect(res.data.data.ytnUi).toBe("dark");
    }
  });

  it("should fall back to stepResultOk if ytnUi is not 'dark' for step 'toto'", () => {
    const res = parser(["toto", "light", "-r", "ok"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepResultOk");
    }
  });

  it("should route to stepResultFail when result is 'fail'", () => {
    const res = parser(["mystep", "-r", "fail"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepResultFail");
    }
  });

  it("should route to catchAnythingLeft when no other target matches", () => {
    // Input "-r unknown" doesn't match any target literals
    // It should hit 'catchAnythingLeft' (fallback with mask 0)
    const res = parser(["-r", "unknown"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("catchAnythingLeft");
      // Extra values are preserved in catch-all data
      expect(res.data.data.result).toBe("unknown");
    }
  });

  it("should route to catchAnythingLeft even with positionals that match nothing", () => {
    const res = parser(["random", "positional"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("catchAnythingLeft");
      expect(res.data.data.step).toBe("random");
    }
  });

  it("should validate step length (min 3) in stepHint", () => {
    const res = parser(["st", "--help"]);
    // Should route to stepHint but fail validation because 'st' < 3 chars
    expect(res.success).toBe(false);
  });

  it("should route to stepHint and succeed with a valid step name", () => {
    const res = parser(["validstep", "--help"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepHint");
    }
  });

  it("should distinguish between two targets based on bit density", () => {
    // footprint --help => globalHelp (1 bit: help)
    // footprint toto --help => stepHint (2 bits: step + help)

    const res1 = parser(["--help"]);
    expect(res1.success && res1.data.route).toBe("globalHelp");

    const res2 = parser(["toto", "--help"]);
    expect(res2.success && res2.data.route).toBe("stepHint");
  });
});

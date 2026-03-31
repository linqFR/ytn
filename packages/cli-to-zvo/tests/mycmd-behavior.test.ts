import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Contract, pico } from "../src/index.js";

describe("mycmd.ts Behavioral Matrix", () => {
  const schemDef = {
    step: pico.string().desc("ID of the step").min(3),
    ytnUI: pico.string().desc("ynt UI").optional(),
  };

  const localHelp = pico.help("Command Step Help");

  const contract = Contract.create({
    name: "footprint",
    description: "commande system for my footprint",
    cli: {
      positionals: ["step", "ytn-ui"],
      flags: {
        result: { short: "r", type: "string", desc: "result of the step id" },
        ...localHelp.flag,
      },
    },
    targets: {
      stepHint: {
        ...pico.help("Command Step Help"),
        step: schemDef.step,
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
      // catchAnythingLeftTarget: {}
    },
    fallbacks: {
      globalHelp: {
        ...pico.help("Global Command Help")
      },
      catchAnythingLeft: {}
    }
  });

  const parser = (args: string[]) => contract.parseCli(args);

  it("should route to globalHelp when only --help is provided", () => {
    const res = parser(["--help"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("globalHelp");
    }
  });

  it("should route to stepHint when a step and --help are provided", () => {
    const res = parser(["mystep", "--help"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepHint");
      expect(res.data.data.step).toBe("mystep");
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
    // Should match stepToto even if stepResultOk could also match
    // because stepToto is more specific (more literals)
    const res = parser(["toto", "-r", "ok", "--ytn-ui", "dark"]);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("stepToto"); // correct, we dont want stepResultOk
      expect(res.data.route).not.toBe("stepResultOk"); // correct, we dont want stepResultOk
      expect(res.data.data.step).toBe("toto");
      expect(res.data.data.ytnUi).toBe("dark");
    }
  });

  it("should fall back to stepResultOk if ytnUi is not 'dark' for step 'toto'", () => {
    const res = parser(["toto", "-r", "ok", "--ytn-ui", "light"]);
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

  it("should route to catchAnythingLeft when no target matches", () => {
    const res = parser(["-r", "unknown"]);
    if (!res.success) console.error("Zod Error:", JSON.stringify(res.error, null, 2));
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.route).toBe("catchAnythingLeft");
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
      expect(res.data.data.step).toBe("validstep");
    }
  });
});

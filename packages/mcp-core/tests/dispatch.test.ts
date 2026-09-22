import { dna } from "@ytrynot/dna";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createCore,
  createDispatcher,
  dispatchTool,
  isToolInputRequired,
  toolAcceptedContent,
  toolDescription,
  toolError,
  toolInputRequired,
  type IToolCallInfo,
  type IToolEntry,
  type IToolResult,
  type IToolSchema,
  type tsToolOutcome,
} from "../src/index.js";

/** Narrow a tool outcome to its final-result variant — fails on input_required. */
function final(res: tsToolOutcome): IToolResult {
  if (isToolInputRequired(res)) throw new Error("unexpected input_required result");
  return res;
}

interface ICtx {
  prefix: string;
}

const echoInput = dna
  .object({ text: dna.string() })
  .meta({ description: "Echoes the input text back." });

const zodInput = z
  .object({ n: z.number() })
  .meta({ description: "Doubles a number." });

/** Hand-rolled Standard Schema — proves no schema library is required. */
const rawInput: IToolSchema = {
  "~standard": {
    version: 1,
    vendor: "mcp-core-test",
    validate: (value) => ({ value }),
    jsonSchema: {
      input: () => ({ type: "object" }),
      output: () => ({ type: "object" }),
    },
  },
};

const tools: IToolEntry<ICtx>[] = [
  {
    name: "echo",
    args: echoInput,
    handler(ctx, input) {
      const { text } = echoInput.parse(input);
      return {
        content: [{ type: "text", text: ctx.prefix + text }],
        structuredContent: { text: ctx.prefix + text },
        isError: false,
      };
    },
  },
  {
    name: "double",
    args: zodInput,
    handler(ctx, input) {
      const { n } = zodInput.parse(input);
      return {
        content: [{ type: "text", text: ctx.prefix + n * 2 }],
        structuredContent: { n: n * 2 },
        isError: false,
      };
    },
  },
  {
    name: "ping",
    args: rawInput,
    handler() {
      return { content: [{ type: "text", text: "pong" }], isError: false };
    },
  },
];

describe("dispatchTool", () => {
  const ctx: ICtx = { prefix: "> " };

  it("dispatches to the matching handler with ctx and input (DNA schema)", () => {
    const res = final(dispatchTool(tools, ctx, "echo", { text: "hi" }));
    expect(res.isError).toBe(false);
    expect(res.content[0]).toEqual({ type: "text", text: "> hi" });
    expect(res.structuredContent).toEqual({ text: "> hi" });
  });

  it("dispatches Zod-based tools identically", () => {
    const res = final(dispatchTool(tools, ctx, "double", { n: 21 }));
    expect(res.isError).toBe(false);
    expect(res.content[0]).toEqual({ type: "text", text: "> 42" });
    expect(res.structuredContent).toEqual({ n: 42 });
  });

  it("accepts a hand-rolled Standard Schema with no library", () => {
    expect(final(dispatchTool(tools, ctx, "ping", {})).content[0]).toEqual({
      type: "text",
      text: "pong",
    });
  });

  it("returns an error result for unknown tools", () => {
    const res = final(dispatchTool(tools, ctx, "nope", {}));
    expect(res.isError).toBe(true);
    expect(res.content[0]).toEqual({ type: "text", text: "Unknown tool: nope" });
  });

  it("createDispatcher binds tools + ctx", () => {
    const call = createDispatcher(tools, ctx);
    expect(final(call("ping", {})).content[0]).toEqual({ type: "text", text: "pong" });
    expect(final(call("missing", {})).isError).toBe(true);
  });
});

describe("toolDescription", () => {
  it("reads description from a DNA schema meta", () => {
    expect(toolDescription(tools[0])).toBe("Echoes the input text back.");
  });

  it("reads description from a Zod v4 schema meta", () => {
    expect(toolDescription(tools[1])).toBe("Doubles a number.");
  });

  it("prefers an explicit description override", () => {
    const t: IToolEntry<ICtx> = { ...tools[0], description: "Custom" };
    expect(toolDescription(t)).toBe("Custom");
  });

  it("falls back to empty string when the schema has no meta()", () => {
    expect(toolDescription(tools[2])).toBe("");
  });
});

describe("toolError", () => {
  it("builds an isError result", () => {
    const res = toolError("boom");
    expect(res.isError).toBe(true);
    expect(res.content[0]).toEqual({ type: "text", text: "boom" });
  });
});

describe("createCore", () => {
  it("carries tools and ctx; call() dispatches with the bound ctx", () => {
    const ctx: ICtx = { prefix: "# " };
    const core = createCore({ tools, ctx });
    expect(core.ctx).toBe(ctx);
    expect(core.tools).toEqual(tools);
    expect(final(core.call("echo", { text: "hi" })).content[0]).toEqual({
      type: "text",
      text: "# hi",
    });
    expect(final(core.call("nope", {})).isError).toBe(true);
  });

  it("invokes the domain close hook with ctx, exactly once", async () => {
    const closed: ICtx[] = [];
    const ctx: ICtx = { prefix: "" };
    const core = createCore({
      tools,
      ctx,
      close: (c) => {
        closed.push(c);
      },
    });
    await core.close();
    await core.close();
    expect(closed).toEqual([ctx]);
  });

  it("close() without a hook is a no-op", () => {
    const core = createCore({ tools, ctx: { prefix: "" } });
    expect(core.close()).toBeUndefined();
    expect(core.close()).toBeUndefined();
  });

  it("snapshots the tool list — post-construction mutation cannot bypass checkToolNames", () => {
    const list: IToolEntry<ICtx>[] = [...tools];
    const core = createCore({ tools: list, ctx: { prefix: "" } });
    list.push({ ...tools[0], name: "rogue!" });
    expect(core.tools).toHaveLength(tools.length);
    expect(final(core.call("rogue!", { text: "hi" })).isError).toBe(true);
  });

  it("throws on duplicate tool names — the same failure registerTool raises", () => {
    const dup: IToolEntry<ICtx> = { ...tools[0], name: "double" };
    expect(() => createCore({ tools: [...tools, dup], ctx: { prefix: "" } })).toThrow(
      'Duplicate tool name: "double"',
    );
  });

  it("warns on spec-nonconforming names but still creates the core", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const weird: IToolEntry<ICtx> = { ...tools[0], name: "mon outil!" };
    const core = createCore({ tools: [weird], ctx: { prefix: "" } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"mon outil!"'));
    expect(final(core.call("mon outil!", { text: "hi" })).isError).toBe(false);
    warn.mockRestore();
  });
});

describe("input_required (multi-round-trip)", () => {
  const confirmTool: IToolEntry<ICtx> = {
    name: "confirm",
    args: rawInput,
    handler(_ctx, _input, req) {
      const answer = toolAcceptedContent<{ ok: boolean }>(req?.inputResponses, "ok");
      if (answer?.ok !== true) {
        return toolInputRequired({
          inputRequests: {
            ok: {
              kind: "form",
              message: "Proceed?",
              requestedSchema: {
                type: "object",
                properties: { ok: { type: "boolean" } },
                required: ["ok"],
              },
            },
          },
        });
      }
      return { content: [{ type: "text", text: "done" }], isError: false };
    },
  };

  it("isToolInputRequired narrows the outcome union", () => {
    const ir = toolInputRequired({ requestState: "s" });
    expect(isToolInputRequired(ir)).toBe(true);
    expect(isToolInputRequired(toolError("x"))).toBe(false);
  });

  it("toolInputRequired enforces the wire contract (≥1 of inputRequests/requestState)", () => {
    expect(() => toolInputRequired({})).toThrow(TypeError);
    expect(toolInputRequired({ requestState: "opaque" }).requestState).toBe("opaque");
  });

  it("toolAcceptedContent reads only accepted elicitation answers", () => {
    const responses = {
      ok: { action: "accept", content: { name: "Ada" } },
      no: { action: "decline" },
      cancelled: { action: "cancel" },
      other: { roots: [] },
      malformed: "nope",
    };
    expect(toolAcceptedContent(responses, "ok")).toEqual({ name: "Ada" });
    expect(toolAcceptedContent(responses, "no")).toBeUndefined();
    expect(toolAcceptedContent(responses, "cancelled")).toBeUndefined();
    expect(toolAcceptedContent(responses, "other")).toBeUndefined();
    expect(toolAcceptedContent(responses, "malformed")).toBeUndefined();
    expect(toolAcceptedContent(responses, "missing")).toBeUndefined();
    expect(toolAcceptedContent(undefined, "ok")).toBeUndefined();
  });

  it("a handler answers input_required on the first round", () => {
    const res = dispatchTool([confirmTool], { prefix: "" }, "confirm", {});
    expect(isToolInputRequired(res)).toBe(true);
    if (!isToolInputRequired(res)) return;
    expect(Object.keys(res.inputRequests ?? {})).toEqual(["ok"]);
  });

  it("dispatchTool passes req through so a retried round reads inputResponses", () => {
    const req: IToolCallInfo = {
      inputResponses: { ok: { action: "accept", content: { ok: true } } },
    };
    const res = dispatchTool([confirmTool], { prefix: "" }, "confirm", {}, req);
    expect(final(res).content[0]).toEqual({ type: "text", text: "done" });
  });
});

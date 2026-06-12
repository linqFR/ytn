import { expect, test, describe } from "vitest";
import { WFRunner } from "../src/runner/wf-runner.js";
import { z } from "zod";

describe("WFRunner Basic Execution", () => {
  test("Successful linear workflow", async () => {
    const wf = {
      init: {
        schema: z.number(),
        on: { next: "step2" },
        gate: (data: number, tools: any) => tools.send.next(data + 1),
      },
      step2: {
        // schema is omitted, should default to any
        gate: (data: any) => data * 2,
      },
    };

    const runner = WFRunner.create(wf as any);
    const result = await runner.run(10);
    expect(result).toBe(22); // (10 + 1) * 2
  });

  test("Conditional branching", async () => {
    const wf = {
      init: {
        schema: z.object({ val: z.number() }),
        on: { positive: "pos", negative: "neg" },
        gate: (data: any, tools: any) => {
          if (data.val >= 0) return tools.send.positive(data.val);
          return tools.send.negative(data.val);
        },
      },
      pos: {
        gate: (data: any) => `Positive: ${data}`,
      },
      neg: {
        gate: (data: any) => `Negative: ${data}`,
      },
    };

    const runner = WFRunner.create(wf as any);
    expect(await runner.run({ val: 5 })).toBe("Positive: 5");
    expect(await runner.run({ val: -5 })).toBe("Negative: -5");
  });

  test("Execution limit (prevention of too many steps)", async () => {
    const wf = {
      loop: {
        on: { again: "loop", stop: "end" },
        gate: (data: any, tools: any) => tools.send.again(data),
      },
      end: {
        gate: (d: any) => d
      }
    };

    const runner = new WFRunner(wf as any, { init: "loop", maxSteps: 5 });
    
    // The graph is valid (has exit via 'stop'), but the gate always goes 'again'
    await expect(runner.run({})).rejects.toThrow(/Execution limit reached/);
  });

  test("Data validation between steps", async () => {
    const wf = {
      init: {
        on: { ok: "numeric" },
        gate: (data: any, tools: any) => tools.send.ok(data),
      },
      numeric: {
        schema: z.number(), 
        gate: (data: any) => data,
      },
    };

    const runner = WFRunner.create(wf as any);
    await expect(runner.run("hello")).rejects.toThrow();
  });

  test("Serialized gates (AOT mode)", async () => {
    const wf = {
      init: {
        on: { next: "end" },
        gate: `(data, tools) => tools.send.next(data + 100)`,
      },
      end: {
        gate: `(data) => data`,
      },
    };

    const runner = WFRunner.create(wf as any);
    const result = await runner.run(1);
    expect(result).toBe(101);
  });

  test("Cycle detection (static validation)", async () => {
    const wf = {
      loop1: {
        on: { next: "loop2" },
        gate: (d: any, t: any) => t.send.next(d),
      },
      loop2: {
        on: { next: "loop1" },
        gate: (d: any, t: any) => t.send.next(d),
      },
    };

    expect(() => WFRunner.create(wf as any)).toThrow(/Cycle detected/);
  });

  test("Unknown signal fallback to terminal (end)", async () => {
    const wf = {
      init: {
        // No 'on' configuration for 'unknown'
        gate: (data: any, tools: any) => tools.send.unknown(data),
      },
    };

    // By default, unknown signals should lead to "end"
    const runner = WFRunner.create(wf as any);
    const result = await runner.run("start_data");
    expect(result).toBe("start_data"); // Returns the data as is at the end
  });
});

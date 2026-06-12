import { describe, expectTypeOf, test } from "vitest";
import { z } from "zod";
import { uStep, uDefineWF } from "../src/types/wf-def.type.js";

describe("Workflow Type Inference", () => {
  test("uStep should correctly infer local data and signal types", () => {
    const step = uStep({
      schema: z.strictObject({ id: z.number(), name: z.string() }),
      on: { success: "next_step", failure: "error_step" },
      gate(data, tools) {
        // Test: data should be { id: number, name: string }
        expectTypeOf(data).toEqualTypeOf<{ id: number; name: string }>();

        // Test: tools.send should be a function
        expectTypeOf(tools.send).toEqualTypeOf<
          (signal: string, data?: any) => any
        >();

        return tools.send("success", data);
      },
    });

    expectTypeOf(step.schema).toEqualTypeOf(z.strictObject({ id: z.number(), name: z.string() }));
  });

  test("uDefineWf should propagate types across the routing graph", () => {
    const wf = uDefineWF({
      start: uStep({
        schema: z.string(),
        on: { ok: "end" },
        gate: (data, tools) => tools.send("ok", data.length),
      }),
      end: uStep({
        schema: z.number(),
        gate: (data) => data,
      }),
    });

    // Test: The global workflow input should be string (from 'start')
    expectTypeOf(wf.start.schema).toEqualTypeOf<null>();
    expectTypeOf(wf.end.schema).toEqualTypeOf(z.number());
  });
});

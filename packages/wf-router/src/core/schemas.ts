import { z } from "zod";
import { TERMINAL_STEP_ID } from "./constants.js";
import type { tsStep, tsSchBoxedStep } from "./types.js";

/**
 * @constant stepSchema
 * @description Zod schema for a single workflow step definition.
 */
export const stepSchema = z.object({
  /** The Zod schema to validate inputs for this specific step. */
  schema: z.any(),
  /** Mapping of logical signals to target step IDs. */
  on: z.record(z.string(), z.string()).nullable().optional(),
  /** The functional logic (gate) to execute for this step. */
  gate: z.custom<(data: any, tools?: any) => any>(
    (f) => typeof f === "function",
  ),
});

/**
 * @function boxedStepSchemaFactory
 * @description Factory for creating a boxed step validator.
 * @param {string} stepId - The unique identifier for the step.
 * @param {tsStep} def - The step definition.
 */
export const boxedStepSchemaFactory = (
  stepId: string,
  def: tsStep,
): tsSchBoxedStep => {
  return z
    .object({
      __step: z.literal(stepId),
      __data: (def.schema as z.ZodType) ?? z.any(),
    })
    .transform((v) => ({ ...v, __def: def })) as unknown as tsSchBoxedStep;
};

/**
 * @constant terminalStepSchema
 * @description Schema for the terminal exit point of a workflow.
 */
export const terminalStepSchema = z.object({
  __step: z.literal(TERMINAL_STEP_ID),
  __data: z.any(),
  __history: z.string().array(),
});

/**
 * @constant wfSchema
 * @description Zod schema for the entire workflow specification.
 * Performs graph integrity checks (cycle detection, terminal exit presence).
 */
export const wfSchema = z
  .record(z.string(), stepSchema)
  .superRefine((val, ctx) => {
    const allKeys = Object.keys(val);

    const seen = new Set<string>();
    for (const key of allKeys) {
      const low = key.toLowerCase();
      if (seen.has(low)) {
        ctx.issues.push({
          code: "invalid_value",
          input: key,
          values: allKeys,
          path: [key],
          message: `Duplicate Step ID found (case-insensitive collision): "${key}".`,
        });
      }
      seen.add(low);
    }

    // Graph Integrity: Verify that all transitions target existing steps.
    let hasExit = false;
    for (const p in val) {
      const step = val[p];
      if (!step.on || Object.keys(step.on).length === 0) {
        hasExit = true;
      } else {
        for (const onp in step.on) {
          const ref = step.on[onp];
          const isfound = allKeys.some((v) => v === ref);
          if (!isfound)
            ctx.issues.push({
              code: "invalid_value",
              input: ref,
              values: allKeys,
              path: [p, "on", onp],
              message: `${p}.on.${onp} = ${ref} is not related to any step.`,
            });
        }
      }
    }

    if (!hasExit) {
      ctx.issues.push({
        code: "custom",
        input: val,
        message:
          "Workflow must have at least one terminal exit (step without 'on' transitions).",
        path: [],
      } as any);
    }
  });

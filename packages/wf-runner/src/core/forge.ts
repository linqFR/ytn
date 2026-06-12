import { protectObject } from "@ytn/shared/js/guarded_object.js";
import { z } from "zod";
import { TERMINAL_STEP_ID } from "./constants.js";
import { boxedStepSchemaFactory, terminalStepSchema } from "./step-schema.js";
import type {
  tsParsedBoxedStep,
  tsBoxedStep,
  tsSchBoxedStep,
  tsWFSpec,
} from "../types/runtime.types.js";
import { type tsWFContext } from "./wf-context.js";
import { gateWrapper, wrapGateResult } from "../runner/wrappers.js";

/**
 * @function forgeWorkflowEngine
 * @description Forges a live Zod execution engine from a rehydrated workflow specification.
 * This is the functional "heart" of the runner.
 *
 * @param {tsWFSpec} wfData - The rehydrated workflow specification.
 * @param {tsWFContext} config - The runtime configuration (init, maxSteps).
 * @returns {z.ZodType<any, tsBoxedStep>} A Zod engine ready for parsing.
 */
export function forgeWorkflowEngine(
  wfData: tsWFSpec,
  config: tsWFContext,
): z.ZodType<any, tsBoxedStep> {
  const { init, maxSteps } = config;

  // 1. Prepare steps schemas
  const steps: tsSchBoxedStep[] = [];
  for (const p in wfData) {
    steps.push(boxedStepSchemaFactory(p, wfData[p]));
  }

  // 2. Local execution caches (equivalent to WFRunner private members)
  const formattersCache = new Map<string, (d: unknown) => unknown>();
  const sendProxiesCache = new Map<
    string,
    Record<string, (d: unknown) => unknown>
  >();

  const getFormatter = (target: string = TERMINAL_STEP_ID) => {
    let f = formattersCache.get(target);
    if (!f) {
      f = (d: unknown) => wrapGateResult(d, target);
      formattersCache.set(target, f);
    }
    return f;
  };

  const getTools = (bStep: tsParsedBoxedStep) => {
    const stepDef = bStep.__def;
    const stepId = bStep.__step;

    let sendProxy = sendProxiesCache.get(stepId);
    if (!sendProxy) {
      sendProxy = new Proxy(
        {},
        {
          get: (_, signal: string) => {
            if (signal === "end") return getFormatter(TERMINAL_STEP_ID);
            const target = stepDef.on?.[signal];
            return getFormatter(target ?? TERMINAL_STEP_ID);
          },
        },
      );
      sendProxiesCache.set(stepId, sendProxy);
    }

    return protectObject({
      issues: {},
      send: sendProxy as Record<string, (d: unknown) => unknown>,
    });
  };

  // 3. Engine Definition (Recursive Zod Pipe)
  const workflow: z.ZodType<any, tsBoxedStep> = z.lazy(() => {
    const businessModule = z
      .discriminatedUnion(
        "__step",
        steps as [tsSchBoxedStep, ...tsSchBoxedStep[]],
      )
      .transform(async (val: tsParsedBoxedStep, ctx: z.RefinementCtx) => {
        const history = val.__history ?? [];
        if (history.length >= maxSteps) {
          ctx.issues.push({
            code: "custom",
            message: `Execution limit reached.`,
            path: [...history],
            input: val,
          });
          return {
            __step: TERMINAL_STEP_ID,
            __data: val.__data,
            __history: history,
          };
        }
        return await gateWrapper(getTools)(val, ctx);
      })
      .pipe(workflow);

    const terminalModule = terminalStepSchema.transform((v) => v.__data);

    return z.discriminatedUnion("__step", [businessModule, terminalModule]);
  });

  return workflow;
}

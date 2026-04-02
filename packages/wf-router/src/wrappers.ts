import { z } from "zod";
import { pushGateIssue } from "./zod-issues.js";
import { sGateResult, TERMINAL_STEP_ID } from "./core/constants.js";
import type {
  tsBoxedStepHist,
  tsBoxedStep,
  tsBoxedStepDefHist,
  ParsedBoxedStep,
} from "./core/types.js";
import { obj, safe } from "@shared";

/**
 * @typedef {Function} GateWrapperFn
 * @description Type for the gate execution wrapper function.
 */
export type GateWrapperFn = (
  bStep: tsBoxedStepHist | tsBoxedStep,
  ctx: z.RefinementCtx,
) => Promise<tsBoxedStepHist>;

/**
 * @function wrapGateResult
 * @description Wraps gate output into a standard transition signal.
 */
export function wrapGateResult(data: any, nextStep: string = TERMINAL_STEP_ID) {
  return { nextStep, data, [sGateResult]: true };
}
wrapGateResult.is = (res: any) => obj.isPureObject(res) && res[sGateResult];

/**
 * @function gateWrapper
 * @description Orchestrates the safe execution of a step's gate function.
 * Handles async execution, exception catching, and issue reporting.
 */
export const gateWrapper =
  (toolsFactoryFn: (bStep: ParsedBoxedStep) => any): GateWrapperFn =>
  async (bStep: tsBoxedStepHist | tsBoxedStep, ctx: z.RefinementCtx) => {
    const {
      __step,
      __data,
      __def,
      __history = [] as string[],
    } = bStep as tsBoxedStepDefHist;
    const newhist = [...__history, __step];

    const zFn = safe.catchAsyncFn(__def.gate);
    const [err, res] = await zFn(
      __data,
      toolsFactoryFn(bStep as tsBoxedStepDefHist),
    );
    if (err) pushGateIssue(ctx, __data, [...newhist]);

    //checked Result
    const cRes = wrapGateResult.is(res) ? res : wrapGateResult(res);

    return {
      __step: cRes.nextStep,
      __data: cRes.data,
      __history: newhist,
    } as tsBoxedStepHist;
  };

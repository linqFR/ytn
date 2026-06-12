import { isPureObject } from "@ytn/shared/js/object-utils.js";
import { catchAsyncFn } from "@ytn/shared/safe/safemode.js";
import { z } from "zod";
import { sGateResult, TERMINAL_STEP_ID } from "../core/constants.js";
import { pushGateIssue } from "../core/zod-issues.js";
import type { tsGateResultRaw, tsGateResultVoid } from "../types/gate.types.js";
import type {
  tsBoxedStep,
  tsBoxedStepDefHist,
  tsBoxedStepHist,
  tsParsedBoxedStep,
} from "../types/runtime.types.js";
import { tsWFTools } from "../types/tools.type.js";

/**
 * @type {Function} GateWrapperFn
 * @description Type for the gate execution wrapper function.
 */
export type tsGateWrapperFn = (
  bStep: tsBoxedStepHist | tsBoxedStep,
  ctx: z.RefinementCtx,
) => Promise<tsBoxedStepHist>;

/**
 * @function wrapGateResult
 * @description Wraps gate output into a standard transition signal.
 * @param {any} data - The data to wrap.
 * @param {string} nextStep - The next step ID.
 */
export function wrapGateResult<T = any>(
  data: T,
  nextStep: string = TERMINAL_STEP_ID,
) {
  return { nextStep, data, [sGateResult]: true };
}

/**
 * @method is
 * @description Type guard for tsGateResult.
 * @param {any} res - The response to check.
 * @returns {boolean} True if it is a gate result.
 */
wrapGateResult.is = (res: any): res is tsGateResultRaw =>
  isPureObject(res) && res[sGateResult] === true;

/**
 * @function gateWrapper
 * @description Orchestrates the safe execution of a step's gate function.
 * Handles async execution, exception catching, and issue reporting.
 */
export const gateWrapper =
  (toolsFactoryFn: (bStep: tsParsedBoxedStep) => any): tsGateWrapperFn =>
  async (bStep: tsBoxedStepHist | tsBoxedStep, ctx: z.RefinementCtx) => {
    const {
      __step,
      __data,
      __def,
      __history = [],
    } = bStep as tsBoxedStepDefHist;
    const newhist = [...__history, __step];

    const zFn = catchAsyncFn<tsGateResultVoid, [typeof __data, tsWFTools]>(
      __def.gate,
    );
    const [err, res] = await zFn(
      __data,
      toolsFactoryFn(bStep as tsBoxedStepDefHist),
    );
    if (err) pushGateIssue(ctx, __data, [...newhist], err);

    //checked Result
    const cRes = wrapGateResult.is(res) ? res : wrapGateResult(res);

    return {
      __step: cRes.nextStep,
      __data: cRes.data,
      __history: newhist,
    } as tsBoxedStepHist;
  };

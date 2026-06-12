import { ZodType } from "zod";
import type { tsGateResult } from "./gate.types.js";
import type { IWFStepTools } from "./tools.type.js";

/** @type {Object} tsStep */
export type tsWFStep<
  WF,
  StepId extends keyof WF,
  SignalKeys extends string = never,
> = {
  readonly schema?: ZodType<any, any>;
  readonly on?: {
    [Signal in SignalKeys]: keyof WF;
  };
  readonly gate: (
    data: WF[StepId] extends { readonly schema: ZodType<infer Out, any> }
      ? Out
      : WF[StepId] extends { schema: ZodType<infer Out, any> }
      ? Out
      : any,
    tools: IWFStepTools<SignalKeys>,
  ) => tsGateResult<any>;
};

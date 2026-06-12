import { z } from "zod";
import type { tsWFStep } from "../types/step.type.js";
import type { tsWFSendTools } from "../types/tools.type.js";

/** @constant schWFSendTools */
const schWFSendTools = z.custom<tsWFSendTools>(
  (v) => typeof v === "object" && v !== null,
  { error: "Send tools must be an object or Proxy of functions." },
);

/** @constant schWFTools */
export const schWFTools = z.strictObject({
  issues: z.custom<Record<string, unknown>>(
    (v) => typeof v === "object" && v !== null,
  ),
  send: schWFSendTools,
});

/**
 * @constant schGateOutput
 * @description Validation schema for the return value of a gate function.
 */
export const schGateOutput = z.any();

/**
 * @constant wfGateFnFactory
 * @description Functional contract factory for workflow gates.
 * Enforces the (data, tools?) signature at runtime via .implement().
 */
const wfGateFnFactory = z
  .function()
  .input(z.tuple([z.unknown(), schWFTools.optional()]))
  .output(schGateOutput);

/**
 * @constant schWFGateFn
 * @description Structural validator (schema) for the gate property.
 * Verifies that the input is a function with the required minimum arity.
 */
export const schWFGateFn = z.custom<tsWFStep<any, any>['gate']>(
  (v) => typeof v === "function" && (v as Function).length >= 1,
  { error: "Gate must be a function accepting at least (data) argument." },
);

/**
 * @function gate
 * @description Factory to encapsulate a function within the functional wfGateContract.
 */
export const gate = <F extends tsWFStep["gate"]>(fn: F) =>
  wfGateFnFactory.implement(fn as any);


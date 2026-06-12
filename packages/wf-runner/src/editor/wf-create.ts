import { schWFDef } from "../core/wf-schema.js";
import type { tsWFSpec } from "../types/runtime.types.js";
import { type tsValidateWorkflow } from "./wf-create.type.js";

/**
 * @function createWorkflow
 * @description Validates and processes a raw workflow definition.
 * 
 * @param {tsWFSpec} rawWF - The raw workflow specification.
 * @returns {tsWFSpec} The validated workflow specification.
 */
export function createWorkflow<I extends tsWFSpec>(
  wf: tsValidateWorkflow<I>
): tsWFSpec {
  const result = schWFDef.safeParse(wf);

  if (!result.success) {
    throw result.error;
  }

  return result.data as tsWFSpec;
}

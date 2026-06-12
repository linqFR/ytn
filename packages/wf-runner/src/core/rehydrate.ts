import { wfCodec } from "./wf-codec.js";
import type { tsWFSpec } from "../types/runtime.types.js";

/**
 * @function rehydrateWorkflow
 * @description Re-instantiates a living workflow specification from AOT-serialized metadata.
 * Restores gate functions from their source strings.
 * 
 * @param {any} aot - The serialized workflow metadata.
 * @returns {tsWFSpec} The rehydrated living specification.
 */
export function rehydrateWorkflow(aot: any): tsWFSpec {
  // If the input is already a living spec (e.g. from in-memory forge), just return it.
  // Otherwise, use the codec to decode the AOT representation.
  const aotData = aot.steps || aot;
  return wfCodec.decode(aotData) as tsWFSpec;
}

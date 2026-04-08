import { z } from "zod";
import { compileZvoGate } from "../src/core/gate.js";
import { tsGate, IProcessedContract } from "../src/types/contract.types.js";
import { computeRoutingDiscriminant } from "../src/cli-engine/runtime-tools.js";

/**
 * @function compileZvoTestGate
 * @description Specialized gate helper for testing raw objects by auto-computing their routing discriminant.
 * This is a functional refactoring of the previous ZvoTestGate class.
 *
 * @param {IProcessedContract} processed - The fully compiled contract metadata.
 * @returns {tsGate} An enhanced Zod schema with auto-tagging capabilities for testing.
 */
export function compileZvoTestGate(processed: IProcessedContract): tsGate {
  const zvoSchema = compileZvoGate(processed);

  // Return a schema that auto-tags raw objects with their routing discriminant before pipeing to the gate.
  return z
    .record(z.string(), z.unknown())
    .transform((val: any) => {
      // Auto-compute the routing discriminant using the unified signature
      if (!val.discriminant) {
        val.discriminant = computeRoutingDiscriminant(val, processed);
      }
      return val;
    })
    .pipe(zvoSchema) as unknown as tsGate;
}

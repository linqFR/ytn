import { z } from "zod";
import { ZvoGate } from "../src/cli-engine/gate.js";
import { tsGate, IProcessedContract } from "../src/types/contract.types.js";
import { computeRoutingDiscriminant } from "../src/cli-engine/runtime-tools.js";

/**
 * @class ZvoTestGate
 * @extends ZvoGate
 * @description Specialized gate helper for testing raw objects by auto-computing their routing discriminant.
 * Revised to match the current computeRoutingDiscriminant signature and dependency mapping.
 */
export class ZvoTestGate extends ZvoGate {
  /** @property {tsGate} testSchema - Enhanced schema with auto-tagging. */
  public readonly testSchema: tsGate;

  constructor(processed: IProcessedContract) {
    super(processed);

    this.testSchema = z
      .record(z.string(), z.unknown())
      .transform((val: any) => {
        // Auto-compute the routing discriminant using the unified signature
        if (!val.discriminant) {
          val.discriminant = computeRoutingDiscriminant(val, processed);
        }
        return val;
      })
      .pipe(this.zvoSchema) as unknown as tsGate;
  }
}

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

  // Storing necessary routing context for discriminant calculation
  private readonly routerMap: any;
  private readonly availableMasks: any;
  private readonly bitCodes: any;

  constructor(processed: IProcessedContract) {
    super(processed);

    const { routing } = processed;
    this.routerMap = routing.router;
    this.availableMasks = routing.masks;
    this.bitCodes = routing.def;

    this.testSchema = z
      .record(z.string(), z.unknown())
      .transform((val: any) => {
        // Auto-compute the routing discriminant if missing using the revised signature
        if (!val.discriminant) {
          val.discriminant = computeRoutingDiscriminant(
            val,
            this.cli,
            this.discriminantKeys,
            this.routerMap,       // 5th arg: Router Registry
            this.availableMasks,  // 6th arg: Available Routing Masks
            this.bitCodes         // 7th arg: Default Bit Codes
          );
        }
        return val;
      })
      .pipe(this.zvoSchema) as unknown as tsGate;
  }
}

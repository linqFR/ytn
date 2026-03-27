import { z } from "zod";
import { ZvoGate } from "../src/cli-engine/gate.js";
import { computeRoutingDiscriminant } from "../src/cli-engine/tools.js";
import { tsGate, tsProcessedContract } from "../src/types/contract.types.js";

/**
 * @class ZvoTestGate
 * @extends ZvoGate
 * @description Specialized gate helper for testing raw objects.
 */
export class ZvoTestGate extends ZvoGate {
  /** @property {tsGate} testSchema - Enhanced schema with auto-tagging. */
  public readonly testSchema: tsGate;

  constructor(processed: tsProcessedContract) {
    super(processed);

    this.testSchema = z
      .record(z.string(), z.unknown())
      .transform((val: any) => {
        if (!val.discriminant) {
          val.discriminant = computeRoutingDiscriminant(
            val,
            this.cli,
            (this as any).discriminantKeys,
            this.interceptors,
            (this as any).possibleValues,
          );
        }
        return val;
      })
      .pipe(this.zvoSchema) as unknown as tsGate;
  }
}

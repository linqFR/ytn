import { z } from "zod";
import { tsTargetName, type tsTargetFieldName } from "../config/parse-args.js";
import type {
  tsGate,
  tsProcessedCliOUT,
  IProcessedContract,
} from "../types/contract.types.js";
import type { tsPossibleValuesArray } from "../types/bit-router.types.js";

/**
 * @class ZvoGate
 * @description A high-performance runtime orchestrator that translates the compiled
 * routing table into a single native Zod Discriminated Union.
 * 
 * It acts as the "Gate" of the application, ensuring that raw input is routed to the
 * correct target and validated against its specific schema before any business logic runs.
 */
export class ZvoGate {
  /** 
   * @property {tsGate} zvoSchema 
   * @description The pre-compiled Zod Discriminated Union dispatcher. 
   * This is the entry point for all CLI validation.
   */
  public readonly zvoSchema: tsGate;

  /** @protected @property {tsProcessedCliOUT} cli - Local reference to CLI interface metadata. */
  public readonly cli: tsProcessedCliOUT;
  
  /** @protected @property {tsTargetFieldName[]} discriminantKeys - The fields used to build routing signatures. */
  protected readonly discriminantKeys: tsTargetFieldName[];
  
  /** @protected @property {tsPossibleValuesArray} possibleValues - Registry of allowed literal values. */
  protected readonly possibleValues: tsPossibleValuesArray;

  /**
   * @constructor
   * @description Builds the entire routing and validation pipeline.
   * It maps every signature in the routing table to its corresponding Zod schema branch.
   * 
   * @param {IProcessedContract} processed - The fully compiled contract metadata.
   */
  constructor(processed: IProcessedContract) {
    const { targets, cli, routing } = processed;
    this.cli = cli;
    this.discriminantKeys = routing.discriminantKeys;
    this.possibleValues = routing.possibleValues || {};

    /**
     * @inner
     * @function forge
     * @description Wraps a target's Zod schema with its specific routing signature.
     * 
     * @param {string} sig - The unique routing signature.
     * @param {tsTargetName} name - The name of the target to wrap.
     * @returns {z.ZodType} A Zod schema that validates the signature and returns the target payload.
     */
    const forge = (sig: string, name: tsTargetName): z.ZodType =>
      targets[name].zod
        .extend({ discriminant: z.literal(sig) })
        .transform(({ discriminant, ...data }: any) => ({
          route: name,
          data,
        }));

    // Build one Zod branch per signature in the flat routing table.
    const branches = Object.entries(routing.router).map(([sig, names]) => {
      const targetNames = Array.isArray(names) ? names : [names];

      if (targetNames.length === 1) return forge(sig, targetNames[0]!);

      // In case of overlap, use a Zod Union within the signature branch.
      return z
        .looseObject({ discriminant: z.literal(sig) })
        .pipe(z.union(targetNames.map((n) => forge(sig, n)) as any));
    });

    // The final result is a native Discriminated Union for maximum parsing speed.
    this.zvoSchema = z.discriminatedUnion(
      "discriminant",
      branches as any,
    ) as unknown as tsGate;
  }
}

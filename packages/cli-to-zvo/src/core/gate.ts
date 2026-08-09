import { z } from "zod";
import { type tsTargetName, type tsTargetFieldName } from "../config/parse-args.js";
import type { tsPossibleValuesArray } from "../types/bit-router.types.js";
import type {
  IProcessedContract,
  tsGate,
  tsProcessedCliOUT,
} from "../types/contract.types.js";


/**
 * @inner
 * @function forge
 * @description Wraps a target's Zod schema with its specific routing signature.
 * 
 * @param {string} sig - The unique routing signature.
 * @param {tsTargetName} name - The name of the target to wrap.
 * @returns {z.ZodType} A Zod schema that validates the signature and returns the target payload.
 */
const forge = (targets: IProcessedContract["targets"], sig: string, name: tsTargetName, overlap: boolean = false): z.ZodType =>
  targets[name].zod
    .extend({ discriminant: z.literal(sig) })
    .transform(({ discriminant, ...data }: any) => ({
      route: name,
      data,
    }))
    .meta({
      route: name,
      signature: sig,
      overlap,
    });

/**
 * @function compileZvoGate
 * @description A high-performance runtime orchestrator that translates the compiled
 * routing table into a single native Zod Discriminated Union.
 * 
 * @param {IProcessedContract} processed - The fully compiled contract metadata.
 * @returns {tsGate} The pre-compiled Zod Discriminated Union dispatcher.
 */
export function compileZvoGate(processed: IProcessedContract): tsGate {
  const { targets, cli, routing } = processed;

  // Local metadata references (for architectural documentation)
  const _cli: tsProcessedCliOUT = cli;
  const _discriminantKeys: tsTargetFieldName[] = routing.discriminantKeys;
  const _possibleValues: tsPossibleValuesArray = routing.possibleValues || {};

  // Build one Zod branch per signature in the flat routing table.
  const branches = Object.entries(routing.router).map(([sig, names]) => {
    const targetNames = Array.isArray(names) ? names : [names];

    if (targetNames.length === 1) return forge(targets, sig, targetNames[0]!);

    // In case of overlap, use a Zod Union within the signature branch for disambiguation.
    // TODO: extract z.union to a separate result variable for better readability
    // CAST: z.union result input is unknown; .pipe() expects looseObject output shape — double-cast bypasses input type mismatch
    return z
      .looseObject({ discriminant: z.literal(sig) }).meta({ overlap: true , signature: sig })
      .pipe(z.union(targetNames.map((n) => forge(targets, sig, n, true)) as [z.ZodType, ...z.ZodType[]]) as unknown as never);
  });

  // The final result is a native Discriminated Union for maximum parsing speed.
  // CAST: z.discriminatedUnion requires $ZodTypeDiscriminable tuple; forge returns z.ZodType which satisfies the runtime contract but not the discriminable type constraint; $ZodTypeDiscriminable is not publicly exported so we cast through never
  // CAST: discriminated union return type doesn't match tsGate exactly
  return z.discriminatedUnion(
    "discriminant",
    branches as unknown as never,
  ) as unknown as tsGate;
}

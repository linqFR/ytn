import type { tsTargetFieldName } from "../config/parse-args.js";
import { forgeRoutingSignature } from "../shared/router-utils.js";
import type {
  IProcessedContract,
  tsParsedCLI,
} from "../types/contract.types.js";
import { computeBitmask, resolveFromTree } from "./tree-processing.js";
// import { TARGET_FALLBACK_NAME } from "../config/zod-config.js";

/**
 * @function computeRoutingDiscriminant
 * @description The core runtime engine for the CLI router.
 * It resolves a set of parsed arguments into a canonical bitmask-based signature.
 *
 * This signature is then used by the "Gate" Zod schema as a discriminant to jump
 * to the correct target's validation logic.
 *
 * The algorithm:
 * 1. Computes a bitmask representing the presence of CLI flags/positionals.
 * 2. Traverses the pre-compiled decision tree to get a list of target candidates.
 * 3. Sorts targets by specificity (targets with more literal value requirements are checked first).
 * 4. Checks the candidates' literal requirements against the actual input values.
 * 5. Returns a unique string signature for the matching target.
 *
 * @param {tsParsedCLI} res - The object containing parsed CLI arguments.
 * @param {IProcessedContract} contract - The pre-compiled contract metadata.
 * @returns {string} The canonical signature string used for routing at the Zod layer.
 */
export function computeRoutingDiscriminant(
  res: tsParsedCLI,
  contract: IProcessedContract,
): string {
  const { routing, targets } = contract;

  // 1. Compute the bitmask for the current input
  const mask = computeBitmask(res, routing.def);

  // 2. Walk the decision tree to find candidates for this mask
  // We sort candidates by specificity (number of defined literals) so specific targets win first.
  const candidates = resolveFromTree(routing.tree, mask).sort((a, b) => {
    const tA = targets[a]!;
    const tB = targets[b]!;

    // 1. Specificity by literals (more required values = higher priority)
    const litA = Object.keys(tA.targetLiterals ?? {}).length;
    const litB = Object.keys(tB.targetLiterals ?? {}).length;
    if (litA !== litB) return litB - litA;

    // 2. Specificity by bitmask density (more matching bits = higher priority)
    // This resolves collisions when multiple targets allow the same flag (like --help).
    return (mask & tB.targetCode) - (mask & tA.targetCode);
  });

  // 3. Find the first target where literal values match
  for (const targetName of candidates) {
    const target = targets[targetName];
    if (!target) continue;

    let isMatch = true;
    for (const [fieldName, allowedValues] of Object.entries(
      target.targetLiterals,
    )) {
      const val = String(res[fieldName as tsTargetFieldName] ?? "");
      if (!allowedValues.includes(val)) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      // 4. Forge the canonical signature for Zod V4 jumping
      // IMPORTANT: We mask the runtime bitmask with the target's allowed bits
      // to ensure we match the signature generated at build time (which only
      // included bits the target actually knows about).
      const finalMask = mask & target.targetCode;

      const values = routing.discriminantKeys.map((k) =>
        target.targetLiterals[k] ? String(res[k] ?? "") : "",
      );

      // Back to pure Bitmask + Values signature
      const sig = forgeRoutingSignature(finalMask, values);
      // console.log(`[RUNTIME] Target: ${targetName}, Sig: "${sig}"`);
      return sig;
    }
  }

  // 5. If no match, return undefined to trigger Zod validation error
  // console.log(`[RUNTIME] No match found internally for mask ${mask}, candidates: ${candidates.join(",")}`);
  return undefined as any;
}

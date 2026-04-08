import type { tsTargetFieldName, tsTargetName } from "../config/parse-args.js";
import { ROUTER_SEPARATOR } from "../config/router-config.js";
import { forgeRoutingSignature } from "../shared/router-utils.js";
import type { tsBitCodes, tsBitRouter } from "../types/bit-router.types.js";
import type { IProcessedContract, tsParsedCLI } from "../types/contract.types.js";
import type { ITargetMeta, tsDecisionNode } from "../types/tree.types.js";

/**
 * @function buildDecisionTree
 * @description Recursively builds a bit-based decision tree from a set of targets.
 * The tree is used to efficiently narrow down target candidates based on the presence
 * or absence of CLI flags and positionals (represented as bits).
 *
 * It uses a heuristic to pick the "best" bit (pivot) at each level—the one that
 * splits the remaining targets most evenly.
 *
 * @param {ITargetMeta[]} targets - The list of target metadata to partition.
 * @param {number[]} availableBits - The set of bits (arguments) still available to branch on.
 * @returns {tsDecisionNode | tsTargetName[]} A recursive decision tree or an array of target names (leaf node).
 */
export function buildDecisionTree(
  targets: ITargetMeta[],
  availableBits: number[],
): tsDecisionNode | tsTargetName[] {
  // 1. Termination condition: ONLY when no more bits to process or no targets left
  if (availableBits.length === 0 || targets.length === 0) {
    return targets.map((t) => t.name);
  }

  // 2. Optimization: Pick the most discriminating bit (pivot)
  // We look for the bit that splits the targets most effectively toward 50/50.
  let bestBit = availableBits[0];
  let bestScore = -1;
  let bestIndex = 0;

  availableBits.forEach((bit, idx) => {
    const canHaveBit = targets.filter(
      (t) => (t.allowedBits & bit) === bit,
    ).length;
    // const mustHaveBit = targets.filter(
    //   (t) => (t.requiredBits & bit) === bit,
    // ).length;

    // A good bit splits either by 'can' or 'must'. 
    // Here we focus on 'canHave' to divide the search space.
    const score = Math.abs(targets.length / 2 - canHaveBit);
    if (bestScore === -1 || score < bestScore) {
      bestScore = score;
      bestBit = bit;
      bestIndex = idx;
    }
  });

  // 3. Partitioning
  // A target goes to the "True" branch if it ALLOWS the bit to be present.
  const trueBranchTargets = targets.filter(
    (t) => (t.allowedBits & bestBit) === bestBit,
  );
  // A target goes to the "False" branch if it DOES NOT REQUIRE the bit to be present.
  // This allows optional flags to be correctly routed even when missing from the input.
  const falseBranchTargets = targets.filter(
    (t) => (t.requiredBits & bestBit) === 0,
  );

  // 4. Recurse excluding the current bit to avoid infinite loops
  const remainingBits = [
    ...availableBits.slice(0, bestIndex),
    ...availableBits.slice(bestIndex + 1),
  ];

  return {
    bit: bestBit,
    onTrue: buildDecisionTree(trueBranchTargets, remainingBits),
    onFalse: buildDecisionTree(falseBranchTargets, remainingBits),
  };
}

/**
 * @function resolveFromTree
 * @description Traverses the decision tree at runtime for an input bitset.
 * It follows the branches corresponding to the presence of bits in the input.
 * Because of optional arguments, it may explore both branches for a single pivot.
 *
 * @param {tsDecisionNode | tsTargetName[]} node - The current node in the decision tree.
 * @param {number} inputBits - The bitmask representing the user's CLI input.
 * @returns {tsTargetName[]} The list of remaining target candidates after bitwise filtering.
 */
export function resolveFromTree(
  node: tsDecisionNode | tsTargetName[],
  inputBits: number,
): tsTargetName[] {
  if (Array.isArray(node)) {
    return node;
  }

  const hasBit = (inputBits & node.bit) === node.bit;
  const results: tsTargetName[] = [];

  if (hasBit) {
    // If the input HAS the bit, we explore targets that allow it.
    results.push(...resolveFromTree(node.onTrue, inputBits));
  }
  
  // Important: Even if we HAVE the bit, we must check onFalse 
  // for targets that don't REQUIRE it (optional flags).
  results.push(...resolveFromTree(node.onFalse, inputBits));

  // Deduplicate results as multiple paths might lead to the same target.
  return Array.from(new Set(results));
}

/**
 * @function computeBitmask
 * @description Computes a unified bitmask for a given parsed CLI input.
 * Each key in the input that corresponds to a known argument adds its bit to the total.
 *
 * @param {Partial<tsParsedCLI>} input - The parsed CLI arguments (mapped to target field names).
 * @param {tsBitCodes} bitCodes - The mapping of field names to their unique bitmask.
 * @returns {number} The total bitmask representing the present arguments.
 */
export function computeBitmask(
  input: Partial<tsParsedCLI>,
  bitCodes: tsBitCodes,
): number {
  let mask = 0;
  for (const key in input) {
    const bit = bitCodes[key as tsTargetFieldName];
    if (bit !== undefined) {
      mask |= bit;
    }
  }
  return mask;
}

/**
 * @function forgeSignature
 * @description Creates a unique routing signature for the current CLI input.
 * The signature combines the bitmask and any literal discriminant values.
 *
 * @param {number} bitmask - The calculated bitmask for the input.
 * @param {tsTargetFieldName[]} discriminantKeys - The ordered list of fields used for discrimination.
 * @param {Partial<tsParsedCLI>} input - The parsed CLI data.
 * @returns {string} A serialized signature string used for O(1) router lookup.
 */
export function forgeSignature(
  bitmask: number,
  discriminantKeys: tsTargetFieldName[],
  input: Partial<tsParsedCLI>,
): string {
  const values = discriminantKeys.map((k) => String(input[k] ?? ""));
  return [String(bitmask), ...values].join(ROUTER_SEPARATOR);
}

/**
 * @function flattenTreeBySignatures
 * @description Walks the decision tree to collect every possible bitmask that
 * can validly lead to a specific terminal set of targets.
 *
 * @param {tsDecisionNode | tsTargetName[]} node - The starting node.
 * @param {number} [currentMask=0] - The accumulated bitmask for the current path.
 * @returns {Record<number, tsTargetName[]>} A map of bitmasks to lists of target names.
 */
export function flattenTreeBySignatures(
  node: tsDecisionNode | tsTargetName[],
  currentMask: number = 0,
): Record<number, tsTargetName[]> {
  const result: Record<number, tsTargetName[]> = {};

  if (Array.isArray(node)) {
    if (node.length > 0) {
      result[currentMask] = node;
    }
    return result;
  }

  // Recurse on branches
  const onTrueRes = flattenTreeBySignatures(node.onTrue, currentMask | node.bit);
  const onFalseRes = flattenTreeBySignatures(node.onFalse, currentMask);

  // Merge results
  const merged = { ...onTrueRes };
  for (const [mask, names] of Object.entries(onFalseRes)) {
    const m = Number(mask);
    if (merged[m]) {
      merged[m] = Array.from(new Set([...merged[m], ...names]));
    } else {
      merged[m] = names;
    }
  }

  return merged;
}

/**
 * @function generateLiteralCombinations
 * @description Computes all valid literal value combinations for a set of fields.
 * Used to expand a target's signature into every possible routing match.
 *
 * @param {Record<string, string[]>} obj - Mapping of field names to their allowed literal values.
 * @param {string[]} keys - The list of keys (fields) to combine.
 * @returns {Record<string, string>[]} A list of objects representing every possible combination.
 */
function generateLiteralCombinations(
  obj: Record<string, string[]>,
  keys: string[],
): Record<string, string>[] {
  if (keys.length === 0) return [{}];

  const [firstKey, ...restKeys] = keys;
  const restCombinations = generateLiteralCombinations(obj, restKeys as string[]);
  
  // Robust check: if key has no literals, use a single wildcard [""]
  const literalValues = obj[firstKey];
  const firstValues = (literalValues && literalValues.length > 0) ? literalValues : [""];

  const result: Record<string, string>[] = [];
  for (const val of firstValues) {
    for (const rest of restCombinations) {
      result.push({ [firstKey]: val, ...rest });
    }
  }
  return result;
}

/**
 * @function generateRoutingTable
 * @description Compiles the entire decision tree and literal combinations into a
 * flat routing table for O(1) resolution at runtime.
 *
 * @param {IProcessedContract} contract - The compiled contract containing metadata.
 * @returns {tsBitRouter} A flat map of routing signatures to target names.
 */
export function generateRoutingTable(
  contract: IProcessedContract,
): tsBitRouter {
  const router: tsBitRouter = {};
  const { discriminantKeys } = contract.routing;
  const flattened = flattenTreeBySignatures(contract.routing.tree);

  for (const [bitmask, targetNames] of Object.entries(flattened)) {
    const mask = Number(bitmask);

    for (const name of targetNames) {
      const target = contract.targets[name];
      if (!target) continue;

      // Generate all valid literal combinations for this specific target
      const combinations = generateLiteralCombinations(
        target.targetLiterals,
        discriminantKeys as string[],
      );

      for (const combo of combinations) {
        // Prepare values in the global order of discriminantKeys
        const values = discriminantKeys.map((k) => combo[k] ?? "");
        
        // Pure Bitmask + Values signature
        const sig = forgeRoutingSignature(mask, values);

        if (!router[sig]) {
          router[sig] = name;
        } else {
          // In case of collision (same bits, same literals), we keep a list
          const existing = router[sig];
          const names = Array.isArray(existing) ? existing : [existing];
          if (!names.includes(name)) {
            router[sig] = [...names, name];
          }
        }
      }
    }
  }

  return router;
}

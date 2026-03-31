import { forgeRoutingSignature } from "../shared/index.js";
import type {
  tsBitCodes,
  tsBitRouter,
  tsRoutingMasks,
} from "../types/bit-router.types.js";
import type {
  tsParsedCLI,
  tsProcessedCliOUT,
} from "../types/contract.types.js";
import type { tsTargetFieldName } from "../config/parse-args.js";
import { tsDiscriminantKeys } from "./shared-tools.js";
import { TARGET_FALLBACK_NAME } from "../config/zod-config.js";

/**
 * @function computeRoutingDiscriminant
 * @description Runtime tagger that calculates the signature for a parsed object.
 */
export const computeRoutingDiscriminant = (
  res: tsParsedCLI,
  cli: tsProcessedCliOUT,
  discriminantKeys: tsDiscriminantKeys = [],
  router: tsBitRouter = {},
  availableMasks: tsRoutingMasks = {},
  bitCodes: tsBitCodes = {},
): string => {
  let targetCode = 0n;

  // 1. Zero allocation: safely iterate over keys
  for (const key in res) {
    const bPrint =
      cli.positionals[key as tsTargetFieldName] ||
      cli.flags[key as tsTargetFieldName];
    if (bPrint !== undefined) {
      targetCode |= bPrint.bit;
    }
  }

  const shapeKey = String(targetCode);
  const targetMasks = availableMasks[shapeKey] || [0n];

  for (let i = 0; i < targetMasks.length; i++) {
    const mask = targetMasks[i];
    const combo: string[] = [];

    for (let j = 0; j < (discriminantKeys as unknown as string[]).length; j++) {
      const k = (discriminantKeys as unknown as any)[j];
      const bit = bitCodes[k];

      if ((mask & bit) === bit && res[k] !== undefined) {
        combo.push(String(res[k]));
      } else {
        combo.push("");
      }
    }

    const sig = forgeRoutingSignature(targetCode, mask, combo);
    if (router[sig]) {
      return sig;
    }
  }

  // Fallback final : signature universelle pour le _fallback
  if (router[TARGET_FALLBACK_NAME]) return TARGET_FALLBACK_NAME;

  // Sinon signature d'erreur absolue
  const fallbackCombo: string[] = [];
  for (let j = 0; j < (discriminantKeys as unknown as any[]).length; j++) {
    const k = (discriminantKeys as unknown as any)[j];
    fallbackCombo.push(res[k] !== undefined ? String(res[k]) : "");
  }

  return forgeRoutingSignature(targetCode, 0n, fallbackCombo);
};

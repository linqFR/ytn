/**
 * @function forgeRoutingSignature
 * @description Internal utility to create a canonical binary-friendly string routing signature.
 * Uses a NULL byte (`\x00`) separator for maximum performance and to avoid collisions.
 *
 * @param {bigint} targetCode - The raw bitmask of the target.
 * @param {bigint} targetMask - The refinement mask capturing the set of active flags.
 * @param {string[]} values - Sorted literal values for positional/enum arguments.
 * @returns {string} The canonical routing signature.
 */
export const forgeRoutingSignature = (
  targetCode: bigint,
  targetMask: bigint,
  values: string[],
): string => {
  return [String(targetCode), String(targetMask), ...values].join("\x00");
};

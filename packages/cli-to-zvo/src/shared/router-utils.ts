import { ROUTER_SEPARATOR } from "../config/router-config.js";

/**
 * @function forgeRoutingSignature
 * @description Internal utility to create a canonical string routing signature for Zod O(1) jump.
 * 
 * @param {number | string} bitmask - The raw or computed bitmask targeting this route.
 * @param {string[]} values - Sorted literal values for specific discriminant keys.
 * @returns {string} The canonical routing signature used as Zod discriminator.
 */
export const forgeRoutingSignature = (
  bitmask: number | string,
  values: string[],
): string => {
  return [String(bitmask), ...values].join(ROUTER_SEPARATOR);
};

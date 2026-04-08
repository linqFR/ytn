/**
 * Low-level bitwise operations and bitmask helpers.
 */

/**
 * @function toHex
 * @description Standardized hex formatting for bitmasks and codes.
 * @param {number} n - The number to convert to hexadecimal.
 * @returns {string} The hexadecimal string representation.
 */
export const toHex = (n: number): string => n.toString(16);

/**
 * @function hasBit
 * @description Semantic check if a specific bit or bitmask is fully contained within a bitset.
 * @param {number} bitset - The source bitset.
 * @param {number} bit - The bit or mask to check for.
 * @returns {boolean} True if the bitset contains all bits from the mask.
 */
export const hasBit = (bitset: number, bit: number): boolean =>
  (bitset & bit) === bit;

/**
 * @function combineBits
 * @description Combines multiple bits into a single bitset using bitwise OR.
 * @param {number} bitset - The current bitset.
 * @param {number} bit - The bit or mask to add.
 * @returns {number} The updated bitset.
 */
export const combineBits = (bitset: number, bit: number): number =>
  bitset | bit;

/**
 * @function removeBits
 * @description Removes a specific mask from a bitset using bitwise AND NOT.
 * @param {number} bitset - The source bitset.
 * @param {number} mask - The mask to remove.
 * @returns {number} The updated bitset.
 */
export const removeBits = (bitset: number, mask: number): number =>
  bitset & ~mask;

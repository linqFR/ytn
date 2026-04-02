
/**
 * Low-level bitwise operations and bitmask helpers.
 */

/**
 * Standardized hex formatting for bitmasks and codes.
 */
export const toHex = (n: number): string => n.toString(16);

/**
 * Semantic check if a specific bit or bitmask is fully contained within a bitset.
 */
export const hasBit = (bitset: number, bit: number): boolean => 
  (bitset & bit) === bit;

/**
 * Combines multiple bits into a single bitset (OR).
 */
export const combineBits = (bitset: number, bit: number): number => 
  bitset | bit;

/**
 * Removes a specific mask from a bitset (AND NOT).
 */
export const removeBits = (bitset: number, mask: number): number => 
  bitset & ~mask;

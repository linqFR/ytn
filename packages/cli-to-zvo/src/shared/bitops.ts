/**
 * @function toHex
 * @description Standardized hex formatting for bitmasks and codes.
 */
export const toHex = (n: bigint | number): string => n.toString(16);

/**
 * @function hasBit
 * @description Semantic check if a specific bit is set in a bitset.
 */
export const hasBit = (bitset: bigint, bit: bigint): boolean => (bitset & bit) === bit;

/**
 * @function combineBits
 * @description Semantic OR operation for combining bitmasks.
 */
export const combineBits = (bitset: bigint, bit: bigint): bigint => bitset | bit;

/**
 * @function removeBits
 * @description Semantic AND NOT operation for removing bits (e.g. interceptors).
 */
export const removeBits = (bitset: bigint, mask: bigint): bigint => bitset & ~mask;

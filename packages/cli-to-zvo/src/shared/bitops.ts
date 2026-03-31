/**
 * @function toHex
 * @description Standardized hex formatting for bitmasks and codes.
 * 
 * @param {number} n - The numeric bitmask to format.
 * @returns {string} The hexadecimal string representation.
 */
export const toHex = (n: number): string => n.toString(16);

/**
 * @function hasBit
 * @description Semantic check if a specific bit or bitmask is fully contained within a bitset.
 * 
 * @param {number} bitset - The cumulative bitset to check.
 * @param {number} bit - The bit or mask to look for.
 * @returns {boolean} True if every bit in 'bit' is present in 'bitset'.
 */
export const hasBit = (bitset: number, bit: number): boolean => (bitset & bit) === bit;

/**
 * @function combineBits
 * @description Semantic OR operation for combining bitmasks.
 * 
 * @param {number} bitset - The base bitset.
 * @param {number} bit - The new bit(s) to add.
 * @returns {number} The updated bitset containing both original and new bits.
 */
export const combineBits = (bitset: number, bit: number): number => bitset | bit;

/**
 * @function removeBits
 * @description Semantic bitwise subtraction (AND NOT) to remove a specific set of bits.
 * 
 * @param {number} bitset - The cumulative bitset.
 * @param {number} mask - The bits to remove.
 * @returns {number} The updated bitset with the mask bits cleared.
 */
export const removeBits = (bitset: number, mask: number): number => bitset & ~mask;

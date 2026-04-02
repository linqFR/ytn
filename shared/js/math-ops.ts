
/**
 * Mathematical and structural combination utilities.
 */

/**
 * Generates the Cartesian Product of multiple arrays.
 * It takes one element from each array and combines them into all possible tuples.
 *
 * @example
 * // Input: [['a', 'b'], ['1', '2']]
 * // Output: [['a', '1'], ['a', '2'], ['b', '1'], ['b', '2']]
 */
export const allCombinations = <T>(...arrays: T[][]): T[][] => {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
    [[]] as T[][],
  );
};

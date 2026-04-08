/**
 * Mathematical and structural combination utilities.
 */

/**
 * @function allCombinations
 * @description Generates the Cartesian Product of multiple arrays.
 * It takes one element from each array and combines them into all possible tuples.
 *
 * @example
 * // Input: [['a', 'b'], ['1', '2']]
 * // Output: [['a', '1'], ['a', '2'], ['b', '1'], ['b', '2']]
 *
 * @remarks
 * This function is used during the contract compilation phase to generate all possible
 * routing signatures for a Target. If a Target has fields with enumerations
 * (e.g., --env=[prod, dev]), this function creates one signature per possible value
 * so the `bitRouter` can perform O(1) resolution at runtime.
 * @template T
 * @param {...T[][]} arrays - Sets of values to combine.
 * @returns {T[][]} Every possible combination of elements.
 */
export const allCombinations = <T>(...arrays: T[][]): T[][] => {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
    [[]] as T[][],
  );
};

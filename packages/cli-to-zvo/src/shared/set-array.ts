import type { $Entries, $RecordSetToArray } from "../types/ts-utils.js";

/**
 * @function recordSetToRecordArray
 * @description Transforms a Record where values are Sets into a Record where values are Arrays.
 * This is useful for serializing internal collection structures into the final contract.
 * 
 * @template T - A Record where values must be Set instances.
 * @param {T} recordSet - The input record of Sets.
 * @returns {$RecordSetToArray<T>} A new record where each Set has been converted to an Array.
 */
export const recordSetToRecordArray = <T extends Record<string, Set<any>>>(
  recordSet: T,
): $RecordSetToArray<T> =>
  Object.fromEntries(
    (Object.entries(recordSet) as $Entries<T>).map(([k, set]) => [
      k,
      Array.from(set),
    ]),
  ) as $RecordSetToArray<T>;



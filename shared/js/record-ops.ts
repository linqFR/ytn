
import { ts } from "../index.js";

/**
 * Specialized Record and Map manipulation utilities.
 */

/**
 * Transforms a Record where values are Sets into a Record where values are Arrays.
 * This is useful for serializing internal collection structures.
 */
export const recordSetToRecordArray = <T extends Record<string, Set<any>>>(
  recordSet: T,
): ts.$RecordSetToArray<T> =>
  Object.fromEntries(
    (Object.entries(recordSet) as ts.$Entries<T>).map(([k, set]) => [
      k,
      Array.from(set),
    ]),
  ) as ts.$RecordSetToArray<T>;

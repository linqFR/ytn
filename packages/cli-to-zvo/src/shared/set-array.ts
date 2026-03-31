import type { $Entries, $RecordSetToArray } from "../types/ts-utils.js";

export const recordSetToRecordArray = <T extends Record<string, Set<any>>>(
  recordSet: T,
): $RecordSetToArray<T> =>
  Object.fromEntries(
    (Object.entries(recordSet) as $Entries<T>).map(([k, set]) => [
      k,
      Array.from(set),
    ]),
  ) as $RecordSetToArray<T>;



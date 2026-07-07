import type { tsDna, tsDnaId, tsDnaSeq } from "../types/core.types.js";
import type { tsExternals } from "../shared/runtime.types.js";


// Types for the collector
export type tsStoreMark = number;
export type tsStorePosition = number | number[];
// DNA Context type
export interface IDnaCollector {
  setStore(objToStore: any): tsStoreMark; // returns a storeMark / storeId
  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void;
  // getStoreValue(storeMark: number): any;
  storeDNA(dna: tsDna, storeMark?: tsStoreMark, storePosition?: tsStorePosition, discriminant?: any): tsDnaId;
  getDnaSeq(externals?: tsExternals): tsDnaSeq;
  refList: number[];
}


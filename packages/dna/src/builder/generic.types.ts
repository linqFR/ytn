import type { tsDna, tsDnaId, tsDnaSeq } from "../types/dna-core.types.js";
import type { tsExternals } from "../types/dna.types.js";


// Union -> intersection (for allOf member value types)
export type $UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// Exclusive or: a value matches exactly one branch, never both (forbids the T & U overlap).
// Falls back to a plain union for non-object types.
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type $Xor<T, U> = (T | U) extends object ? ($Without<T, U> & U) | ($Without<U, T> & T) : T | U;


// Types for the collector
export type tsStoreMark = number;
export type tsStorePosition = number | number[];
// DNA Context type
export interface IDnaCollector {
  setStore(objToStore: any): tsStoreMark; // returns a storeMark / storeId
  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void;
  // getStoreValue(storeMark: number): any;
  storeDNA(dna: tsDna, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId;
  getDnaSeq(externals?: tsExternals): tsDnaSeq;
}
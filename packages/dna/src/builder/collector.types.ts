import type { tsDna, tsDnaId, tsDnaSeq } from "../types/core.types.js";
import type { tsDnaExternals } from "../shared/runtime.types.js";


// Types for the collector
export type tsStoreMark = number;
export type tsStorePosition = number | number[];
// DNA Context type
export interface IDnaCollector {
  setStore(objToStore: any): tsStoreMark; // returns a storeMark / storeId
  updateStore(storeMark: tsStoreMark, targetIdx: tsDnaId, position?: tsStorePosition): void;
  // getStoreValue(storeMark: number): any;
  storeDNA(dna: tsDna, storeMark?: tsStoreMark, storePosition?: tsStorePosition, discriminant?: any): tsDnaId;
  getDnaSeq(externals?: tsDnaExternals): tsDnaSeq;
  refList: Set<number>;
  /** Node identities (`this._core`) currently mid-build; used by `DnaType#toDnaNode`
   * to detect a cyclic re-entry and emit a `ref` instead of recursing infinitely. */
  inProgress: Set<unknown>;
  /** Node identity (`this._core`) → storeMark of the placeholder `ref` node
   * already emitted for a cyclic re-entry still `inProgress`; used by
   * `DnaType#toDnaNode` to patch the placeholder once the real dnaId is known. */
  pendingRefs: Map<unknown, tsStoreMark>;
  /** storeMark → the DNA node (or node slot) being patched in place; used by
   * `setStore`/`updateStore`/`DnaType#toDnaNode` to resolve forward references. */
  store: Map<number, any>;
}


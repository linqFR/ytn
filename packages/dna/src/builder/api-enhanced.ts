import type { tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsDnaId } from "../types/core.types.js";
import * as dna from "./api-primitives.js";

// Import public API types from api-builder.types.ts
import type { DnaFunctionArgs, DnaFunctionInput, tsDnaTupleSchemaArray } from "../types/api-builder.types.js";
import type { $Input, $Output } from "../types/helpers.types.js";
import type { IDnaCollector, tsStoreMark, tsStorePosition } from "./collector.types.js";
import { BaseCore, initDna, MapSetCore } from "./dna-core.js";
import { cloner, DnaType, DnaTypeWithWrappers } from "./dna-interfaces.js";

// Map implementation
export class DnaMap<K extends DnaType<any, any>, V extends DnaType<any, any>> extends DnaTypeWithWrappers<
  Map<$Output<K>, $Output<V>>,
  Map<$Input<K>, $Input<V>>
// tsStateMap<K, V>
> {

  protected override _core = new MapSetCore("map", { min: null, max: null, size: null, keySchema: null, valueSchema: null })

  // static init<K extends DnaType<any>, V extends DnaType<any>>(keySchema: K, valueSchema: V): tsDnaMap<K, V> {
  //   const inst = this.initCore<Map<$Output<K>, $Output<V>>, Map<$Input<K>, $Input<V>>, tsStateMap<K, V>>("map", { min: null, max: null, size: null, keySchema, valueSchema });
  //   return inst.asAPI;
  // }

  min(n: number): this { return cloner(this, cl => cl._core.seed.min = n); }
  max(n: number): this { return cloner(this, cl => cl._core.seed.max = n); }
  size(n: number): this { return cloner(this, cl => cl._core.seed.size = n); }
  nonempty(): this { return cloner(this, cl => cl._core.seed.min = 1); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // NO CHANGE IS NEGOTIABLE
    // any errors or TS warning in the following lines are a sign that dna types are misformed
    let targetSchema = dna.instanceof(Map, this.meta());
    let constrains;
    const stt = this._core.seed;
    if (stt.min !== null) constrains = (constrains ?? dna.number()).min(stt.min);
    if (stt.max !== null) constrains = (constrains ?? dna.number()).max(stt.max);
    if (stt.size !== null) constrains = (constrains ?? dna.number()).eq(stt.size);

    if (constrains) targetSchema = targetSchema.check(dna.property("size", constrains));

    const keySchema = stt.keySchema;
    const valueSchema = stt.valueSchema;

    // any errors or TS warning in the following line is a sign that dna types are wrong in transform or elsewhere
    const transformed = targetSchema.transform((v) => Object.fromEntries(v)).pipe(dna.record(keySchema, valueSchema)).transform((v) => new Map(Object.entries(v)))

    return transformed.toDna(coll, storeMark!, storePosition);
  }

}

// Set implementation
export class DnaSet<T extends DnaType<any, any>> extends DnaTypeWithWrappers<
  Set<$Output<T>>,
  Set<$Input<T>>
// tsStateSet<T>
> {

  protected override _core = new MapSetCore("set", { min: null, max: null, size: null, itemSchema: null })

  // static init<T extends DnaType<any>>(itemSchema: T): tsDnaSet<T> {
  //   return this.initCore<Set<$Output<T>>, Set<$Input<T>>, tsStateSet<T>>("set", { min: null, max: null, size: null, itemSchema }) as unknown as tsDnaSet<T>;
  // }

  min(n: number): this { return cloner(this, cl => cl._core.seed.min = n); }
  max(n: number): this { return cloner(this, cl => cl._core.seed.max = n); }
  size(n: number): this { return cloner(this, cl => cl._core.seed.size = n); }
  nonempty(): this { return cloner(this, cl => cl._core.seed.min = 1); }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): tsDnaId {
    // NO CHANGE IS NEGOTIABLE
    // any errors or TS warning in the following lines are a sign that dna types are misformed
    let targetSchema = dna.instanceof(Set, this._core.meta);
    let constrains;
    const stt = this._core.seed;
    if (stt.min !== null) constrains = (constrains ?? dna.number()).min(stt.min);
    if (stt.max !== null) constrains = (constrains ?? dna.number()).max(stt.max);
    if (stt.size !== null) constrains = (constrains ?? dna.number()).eq(stt.size);
    if (constrains) targetSchema = targetSchema.check(dna.property("size", constrains));

    // Validate elements: check `instanceof Set` (+ size), then validate the members
    // as an array of `itemSchema` (mirrors MapImpl's record round-trip).
    // any errors or TS warning in the following line is a sign that dna types are wrong in transform or elsewhere
    const transformed = targetSchema.transform(v => [...v]).pipe(dna.array(stt.itemSchema)).transform(v => new Set(v));

    return transformed.toDna(coll, storeMark!, storePosition);
  }
}


export const map = <K extends DnaType<PropertyKey, PropertyKey>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaMap<K,V>, { keySchema, valueSchema }, meta);

export const set = <T extends DnaType<any, any>>(schema: T, meta?: string | tsDnaMeta) =>
  // withMeta(SetImpl.init(schema), meta);
  initDna(DnaSet<T>, { itemSchema: schema }, meta);



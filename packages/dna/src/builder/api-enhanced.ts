import type { tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsDnaId } from "../types/core.types.js";
import * as dna from "./api-primitives.js";
import type {
  tsStateFull,
  tsStateFunction,
  tsStateMap,
  tsStateSet
} from "./state.types.js";

// Import public API types from api-builder.types.ts
import type {
  tsDnaFunction,
  tsDnaFunctionArgs,
  tsDnaFunctionInput, tsDnaMap, tsDnaSet, tsDnaTupleSchemaArray
} from "../types/api-builder.types.js";

import type { IDnaCollector, tsStoreMark, tsStorePosition } from "./collector.types.js";
import { cloner, DnaType, DnaTypeWithWrappers } from "./dna-interfaces.js";
import type { $Input, $Output } from "../types/helpers.types.js";
import { BaseCore, initDna, MapSetCore } from "./dna-core.js";

// Map implementation
export class DnaMap<K extends DnaType<any>, V extends DnaType<any>> extends DnaTypeWithWrappers<
  Map<$Output<K>, $Output<V>>,
  Map<$Input<K>, $Input<V>>
  // tsStateMap<K, V>
> {

  protected override _core = new MapSetCore("map", { min: null, max: null, size: null, keySchema: null, valueSchema: null } )

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

    const transformed = targetSchema.transform((v: any) => Object.fromEntries(v)).pipe(dna.record(keySchema, valueSchema)).transform((v: any) => new Map(Object.entries(v)))

    return transformed.toDna(coll, storeMark!, storePosition);
  }
  
}

// Set implementation
export class DnaSet<T extends DnaType<any>> extends DnaTypeWithWrappers<
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
    let targetSchema = dna.instanceof(Set, this.meta());
    let constrains;
    const stt = this._core.seed;
    if (stt.min !== null) constrains = (constrains ?? dna.number()).min(stt.min);
    if (stt.max !== null) constrains = (constrains ?? dna.number()).max(stt.max);
    if (stt.size !== null) constrains = (constrains ?? dna.number()).eq(stt.size);
    if (constrains) targetSchema = targetSchema.check(dna.property("size", constrains));

    // Validate elements: check `instanceof Set` (+ size), then validate the members
    // as an array of `itemSchema` (mirrors MapImpl's record round-trip).
    // any errors or TS warning in the following line is a sign that dna types are misformed
    const transformed = targetSchema.transform(v => [...v]).pipe(dna.array(stt.itemSchema)).transform(v => new Set(v));

    return transformed.toDna(coll, storeMark!, storePosition);
  }
}


export const map = <K extends DnaType<PropertyKey>, V extends DnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaMap, {keySchema, valueSchema}, meta);

export const set = <T extends DnaType<any>>(schema: T, meta?: string | tsDnaMeta) =>
  // withMeta(SetImpl.init(schema), meta);
  initDna(DnaSet, {itemSchema: schema}, meta);



// ============================================
// Function Schema for function validation
// ============================================
type tsFunctionType<I extends tsDnaFunctionInput, O> = (...args: tsDnaFunctionArgs<I>) => O;

export class FunctionImpl<I extends tsDnaFunctionInput, O> extends DnaTypeWithWrappers<
  tsFunctionType<I, O>,
  tsFunctionType<I, O>
> {
  protected override _core = new BaseCore<{input: I, output: DnaType<O>}>("function");
  declare _output: tsFunctionType<I, O>;
  declare _input: tsFunctionType<I, O>;

  // static init<I extends tsDnaFunctionInput, O>(input: tsDnaFunctionInput, output: DnaType<O>): tsDnaFunction<I, O> {
  //   return this.initCore<tsFunctionType<I, O>, tsFunctionType<I, O>, tsStateFunction<I, O>>("function", { input: input as I, output });
  // }

  input<NewI extends tsDnaFunctionInput>(input: NewI | [tsDnaTupleSchemaArray, DnaType<any>]): any {
    const actualInput = Array.isArray(input) && input.length === 2 && Array.isArray(input[0]) ? input : input;
    const newSchema = FunctionImpl.init<NewI, O>(actualInput as any, this._core.seed.output);
    newSchema._core.rawDna = this._core.rawDna;
    const currentMeta = this.meta();
    if (currentMeta) newSchema.meta(currentMeta);
    return newSchema;
  }

  output<NewO>(output: DnaType<NewO>): any {
    const newSchema = FunctionImpl.init<I, NewO>(this._core.seed.input, output);
    newSchema._core.rawDna = this._core.rawDna;
    const currentMeta = this.meta();
    if (currentMeta) newSchema.meta(currentMeta);
    return newSchema;
  }

  implement<R>(fn: (...args: tsDnaFunctionArgs<I>) => R): (...args: tsDnaFunctionArgs<I>) => R {
    const inputSchema = this._core.seed.input;
    const outputSchema = this._core.seed.output;

    return (...args: tsDnaFunctionArgs<I>): R => {
      // Validate input
      if (inputSchema) {
        const inputValidator = inputSchema.length > 1
          ? dna.tuple(inputSchema)
          : inputSchema.length ? inputSchema[0] : dna.any();

        if (inputValidator) {
          const inputResult = inputValidator.safeParse(args);
          if (!inputResult.success) {
            const error: any = new Error("Input validation failed");
            error.issues = inputResult.errors;
            throw error;
          }
        }
      }

      // Call the implementation
      const result = fn(...args);

      // Validate output
      if (outputSchema) {
        const outputResult = outputSchema.safeParse(result);
        if (!outputResult.success) {
          const error: any = new Error("Output validation failed");
          error.issues = outputResult.errors;
          throw error;
        }
      }

      return result;
    };
  }

  implementAsync<R>(fn: (...args: tsDnaFunctionArgs<I>) => Promise<R>): (...args: tsDnaFunctionArgs<I>) => Promise<R> {
    const inputSchema = this._core.seed.input;
    const outputSchema = this._core.seed.output;

    return async (...args: tsDnaFunctionArgs<I>): Promise<R> => {
      // Validate input
      if (inputSchema) {
        const inputValidator = inputSchema.length > 1
          ? dna.tuple(inputSchema)
          : inputSchema.length ? inputSchema[0] : dna.any();

        if (inputValidator) {
          const inputResult = inputValidator.safeParse(args);
          if (!inputResult.success) {
            const error: any = new Error("Input validation failed");
            error.issues = inputResult.errors;
            throw error;
          }
        }
      }

      // Call the implementation
      const result = await fn(...args);

      // Validate output
      if (outputSchema) {
        const outputResult = await outputSchema.safeParseAsync(result);
        if (!outputResult.success) {
          const error: any = new Error("Output validation failed");
          error.issues = outputResult.errors;
          throw error;
        }
      }

      return result;
    };
  }

  protected override _emitSelf(coll: IDnaCollector, storeMark?: tsStoreMark, storePosition?: tsStorePosition): number {
    const functionDef = [-1, -1];
    const storeId = coll.setStore(functionDef);
    this._core.rawDna = ["function", functionDef];
    const dnaId = coll.storeDNA(this._core.dnaWithMeta, storeMark, storePosition);
    if (this._core.seed.input) {
      // Handle both array of schemas and tuple schema
      if (Array.isArray(this._core.seed.input)) {
        const tupleSchema = dna.tuple(this._core.seed.input as any);
        tupleSchema.toDna(coll, storeId, 0);
      } else {
        // Single schema (tuple schema) - use it directly
        (this._core.seed.input as any).toDna(coll, storeId, 0);
      }
    }
    if (this._core.seed.output) this._core.seed.output.toDna(coll, storeId, 1);
    return dnaId;
  }
}


const _function = <I extends tsDnaFunctionInput, O>(config?: { input?: I, output?: DnaType<O> }, meta?: string | tsDnaMeta): any =>
  withMeta(FunctionImpl.init(config?.input ?? [], config?.output ?? dna.any()), meta);



export { _function as function };


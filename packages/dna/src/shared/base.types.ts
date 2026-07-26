
import type { DnaType } from "../builder/dna-interfaces.js";

// Primitive types excluding DNA schemas (all DNA schemas extend IDnaSchemaBase)
// Base primitives without containers (to avoid circular reference)
export type tsPrimitiveBase =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  | object
  | Date
  | RegExp
  | tsPrimitivePromise
  | URL
  | File;

// Container types (use any for nested values to avoid circular reference)
export type tsPrimitiveTuple = readonly tsPrimitiveAll[];
export type tsPrimitivePromise = Promise<any>
export type tsPrimitiveMap = Map<tsPrimitiveAll, tsPrimitiveAll>;
export type tsPrimitiveSet = Set<tsPrimitive>;
export interface tsPrimitiveRecord extends Record<PropertyKey, tsPrimitiveRecord> { }
export type tsPrimitiveArray = Array<tsPrimitiveAll>;

// Combined primitive type with containers
export type tsPrimitive =
  | tsPrimitiveBase
  | tsPrimitiveArray;

// Other primitive types
export type tsPrimitiveFunction = Function;
export type tsPrimitiveClass<A extends any[] = any[], R = any> = abstract new (...args: A) => R;
export type tsPrimitiveEnum = Enumerator;

export type tsPrimitiveLiteral = string | number | bigint | boolean | null | undefined;
export type tsTmplLitPart = tsPrimitiveLiteral | DnaType<any, any>;


// All primitive types combined
export type tsPrimitiveAll =
  | tsPrimitiveBase
  | tsPrimitiveFunction
  | tsPrimitiveMap
  | tsPrimitiveSet
  | tsPrimitiveClass
  | tsPrimitiveEnum
  | tsPrimitiveLiteral
  | tsPrimitiveRecord
  | tsPrimitiveTuple
  | tsPrimitiveArray;

// Types for the collector
export type tsStoreMark = number;
export type tsStorePosition = number | number[];

/**
 * State Types - Internal State Definitions for DNA Schemas
 *
 * This file contains all the StateDef type definitions used by DNA schemas.
 * These types define the internal state structure for each schema type.
 *
 */

import type { tsDna, tsDnaNoMeta, tsDnaSeq } from "../types/core.types.js";
import type { tsCheckOpt } from "../shared/handlers-builder.types.js";
import type { tsDnaInnerMeta } from "../shared/meta-context.type.js";
import type { tsDnaParserFn, tsDnaValidatorFn } from "../shared/runtime.types.js"
import type { tsDnaEnumInput, tsDnaEnumValues, DnaFunctionInput, tsDnaTupleSchemaBase, tsDnaTupleSchemaRO } from "../types/api-builder.types.js";
import type { $CatchValue, $Output } from "../types/helpers.types.js";
import type { DnaType } from "./dna-interfaces.js";

// ============================================
// Base State Type
// ============================================


// ============================================
// Local Type Definitions
// ============================================

export type tsWrpTypes = "optional" | "nullable" | "nullish" | "default" | "prefault" | "catch" | "nonoptional" | "exactOptional";
export type tsWrpPhase = "pre" | "post" | "around";

// export type tsEnumInput = readonly any[] | Record<string, any>;
// export type tsEnumValues = readonly any[];

// ============================================
// Base State Type
// ============================================

// Layer 1: Pure state declaration (no metadata, no type field)
// This is the core state definition for each schema type
export type tsStateDef = {
  [key: string]: any;
};

// Layer 2: Internal state for StateManager
// Contains StateManager-specific metadata + the pure state declaration
export type tsStateFull<T extends tsStateDef = tsStateDef> = {
  type: string;
  meta: tsDnaInnerMeta;
  coerce?: boolean;
  coerceCode?: string;
  refinerList: tsCheckOpt[];
  rawDna: tsDnaNoMeta;
  templateRegex:string;
  seed: T;
  head?:DnaType<any, any>;
  fullDna?: tsDnaSeq;
  cachedParser?: tsDnaParserFn;
  cachedValidator?: tsDnaValidatorFn;
};



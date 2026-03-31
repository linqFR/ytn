import { z } from "zod";
import { dslSchema, dslToZod, DslType } from "./dsl-converter.zod.js";
import { PICO_FACTORIES } from "./pico-overrides.js";
import {
  type ISealedInterface,
  isSealed,
  sealZod,
  toZod,
  tsPicoFactories,
  bridgeZod,
} from "./sealer.js";
import { isSchemaCompatible } from "./zod-modifiers.js";

// Types
/**
 * @type tsPicoString
 * @description Alias for the CZVO Domain Specific Language (DSL) string type.
 */
export type tsPicoString = DslType;

/**
 * @type tsPico
 * @description The unified union type for all CZVO-compatible argument schemas.
 * It accepts a DSL string (e.g. "string?"), a Sealed Zod schema, or a raw Zod schema.
 */
export type tsPico = tsPicoString | ISealedInterface;

/**
 * @namespace core
 * @description Low-level internal API for manual schema sealing.
 */
export const core = {
  sealZod,
};

/**
 * @constant pico
 * @description The primary factory entry point for building CLI schemas.
 * It provides a bridged API to Zod's native static methods (literal, string, etc.)
 * while enforcing CZVO's safety constraints.
 */
export const pico = bridgeZod({}, PICO_FACTORIES, (v: any) =>
  isSealed(v) || !isSchemaCompatible(v) ? v : sealZod(v),
) as tsPicoFactories;

/**
 * @function isPico
 * @description Runtime type guard that checks if an item is a valid CZVO schema.
 * 
 * @param {unknown} item - The value to test.
 * @returns {boolean} True if the item is a valid CZVO schema (DSL or Sealed).
 */
export const isPico = (item: unknown): item is tsPico => {
  return (
    (typeof item === "string" && dslSchema.safeParse(item).success) ||
    isSealed(item)
  );
};

/**
 * @function picoTypetoZod
 * @description The main conversion engine that translates CZVO schemas (DSL strings or Sealed)
 * into their underlying raw Zod instances.
 * 
 * @param {tsPico} item - The CZVO schema to convert.
 * @returns {z.ZodType} The resulting raw Zod schema.
 */
export const picoTypetoZod = (item: tsPico): z.ZodType =>
  z
    .union([
      dslToZod,
      z
        .any()
        .refine((v) => isSealed(v) || isSchemaCompatible(v))
        .transform((v) => toZod(v)),
    ])
    .parse(item);

/**
 * @function picoSchema
 * @description Creates a custom Zod schema that validates if a value is a valid CZVO schema.
 * 
 * @param {any} [onError] - Optional Zod error handler.
 * @returns {z.ZodType<tsPico>} A Zod validator for CZVO schemas.
 */
export const picoSchema = (onError: any = undefined) =>
  z.custom<tsPico>(isPico, onError);

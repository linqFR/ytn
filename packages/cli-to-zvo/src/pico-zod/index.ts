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
export type tsPicoString = DslType;

/**
 * @type tsPico
 * @description Represents any item convertible to a CLI-compatible Zod schema.
 * Supports DSL strings, Sealed schemas (proxies), or raw Zod schemas.
 */
export type tsPico = tsPicoString | ISealedInterface;

export const core = {
  sealZod,
};

// const basePico = Object.fromEntries(
//   Object.entries(PICO_FACTORIES).map(([key, factory]) => [
//     key,
//     (...args: any[]) => {
//       // for tuples
//       const res = (factory as (...a: any[]) => any)(...args);
//       return isSchemaCompatible(res) ? sealZod(res) : res;
//     },
//   ]),
// ) as tsPicoFactories;

// create the functions into memory with no knownn and certain perspective of being used.
// export const pico = newBridgeZod(basePico, {}, (v: any) =>
//   isSealed(v) || !isSchemaCompatible(v) ? v : sealZod(v),
// ) as tsPicoFactories;

// functions are created on the fly
export const pico = bridgeZod({}, PICO_FACTORIES, (v: any) =>
  isSealed(v) || !isSchemaCompatible(v) ? v : sealZod(v),
) as tsPicoFactories;

// Utilities

export const isPico = (item: unknown): item is tsPico => {
  return (
    (typeof item === "string" && dslSchema.safeParse(item).success) ||
    isSealed(item)
  );
};

// Converters

/**
 * @function picoTypetoZod
 * @description Map of type identifiers to raw Zod schemas for legacy support.
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

export const picoSchema = (onError: any = undefined) =>
  z.custom<tsPico>(isPico, onError);

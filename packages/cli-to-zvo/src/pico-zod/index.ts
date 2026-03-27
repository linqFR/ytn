import { z } from "zod";
import { dslSchema, dslToZod, DslType } from "./dsl-converter.zod.js";
import { PICO_FACTORIES } from "./pico-overrides.js";
import { ISealedSchema, isSealed, sealZod, toZod } from "./sealer.js";
import { type $NamespaceSealed } from "./sealer.types.js";
import { isSchemaCompatible } from "./zod-modifiers.js";

// Types
export type tsPicoString = DslType;

// (moved to sealer.ts)

// Pico Tree Root
type tsPicoFactories = $NamespaceSealed<typeof PICO_FACTORIES>;

/**
 * @type tsPico
 * @description Represents any item convertible to a CLI-compatible Zod schema.
 * Supports DSL strings, Sealed schemas (proxies), or raw Zod schemas.
 */
export type tsPico = tsPicoString | ISealedSchema;

export const pico = Object.fromEntries(
  Object.entries(PICO_FACTORIES).map(([key, factory]) => [
    key,
    (...args: any[]) => {
      // for tuples
      const res = (factory as (...a: any[]) => any)(...args);
      return res instanceof z.ZodType ? sealZod(res) : res;
    },
  ]),
) as tsPicoFactories;

// Utilities

export const isPico = (item: unknown) => {
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

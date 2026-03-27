import { z } from "zod";
import { type $Sealed } from "./sealer.types.js";
import {
  isForbidden,
  isSchemaCompatible,
  isSchemaCompatibleProp,
} from "./zod-modifiers.js";


/**
 * @type tsPicoCompatible
 * @description Any Zod-like schema (raw Zod or Sealed CZVO) supported as sub-items in factories.
 */
export type tsPicoCompatible<O = any, I = any> = ISealedSchema<O, I> | z.ZodType<O, I>;

/**
 * @constant $IS_SEALED
 * @description Unique symbol used as a stamp of authenticity for sealed schemas.
 * It serves four purposes:
 * 1. Branding: Prevents TS structural matching from confusing raw Zod types with Sealed ones.
 * 2. Runtime ID: Allows fast and safe identification of CLI-compatible schemas.
 * 3. Idempotency: Prevents double-wrapping an object that is already sealed.
 * 4. Gateway: Marks the presence of the '.toZod' unwrapper.
 */
const $IS_SEALED = Symbol("is_sealed");

/**
 * Base interface for any sealed schema.
 * Implementing this interface confirms the object has been processed for CLI use,
 * masking forbidden Zod methods while providing an escape hatch to the raw Zod schema.
 * Using a simple covariant interface avoids variance issues in complex recursive types.
 * Stores the original Zod type to allow accurate inference and unwrapping.
 */
export interface ISealedSchema<
  O = any,
  I = any,
  Z extends z.ZodType<O, I, any> = z.ZodType<O, I, any>,
> {
  /** Unwraps the sealed CLI schema back to its original Zod instance */
  readonly toZod: Z;
  /** Internal brand to identify sealed schemas at runtime */
  readonly [$IS_SEALED]: true;
  /** Standard Schema support (Zod v4 compatibility) */
  readonly "~standard": Z["~standard"];
  /** Attach a description to the schema (via .meta({ description })) */
  desc(message: string): $Sealed<Z>;
}

/**
 * @function isSealed
 * @description Type guard to identify sealed CLI schemas (created via CZVO API).
 * These schemas are recognized by the presence of the internal $IS_SEALED symbol.
 */
export const isSealed = (val: unknown): val is ISealedSchema =>
  typeof val === "object" && val !== null && $IS_SEALED in val;

export const toZod = (schema: ISealedSchema | z.ZodType): z.ZodType =>
  isSealed(schema) ? schema.toZod : schema;


/**
 * @function bridgeZod
 * @description Master recursive Proxy engine for both Sealing and Pre-processing.
 * It provides a bridge between a validation entrance (engine) and an API surface (methods).
 */
export function bridgeZod<T extends object, E extends object>(
  engine: E,
  methods: T,
  wrapper: (val: any) => any,
  isForbiddenFn?: (p: string | symbol) => boolean,
): any {
  return new Proxy(engine, {
    has(t, p) {
      return p === $IS_SEALED || Reflect.has(t, p) || Reflect.has(methods, p);
    },
    get(t, p, receiver) {
      // THE FIX: .toZod MUST return the engine (t) so that unwrapping provides the full validation pipeline.
      if (p === "toZod") return t;
      
      // Only report as Sealed if we are actually enforcing a contract (security filter present)
      if (p === $IS_SEALED) return !!isForbiddenFn;

      // --- ALIASES ---
      if (p === "desc") {
        return (msg: string) => wrapper((methods as any).meta({ description: msg }));
      }
      if (p === "toJSON") {
        return () => typeof (methods as any).toJSONSchema === "function" ? (methods as any).toJSONSchema() : methods;
      }

      // --- SECURITY ---
      // We allow '~standard' and '_zod' specifically to bypass the starting pattern check.
      if (typeof p === "string" && !isSchemaCompatibleProp(p) && isForbiddenFn?.(p)) {
        throw new Error(`[CZVO] Access to '${p}' is forbidden.`);
      }

      // --- DELEGATION ---
      // Forces priority to engine (t) for validation, standard schema and core Zod props.
      // Modifiers NOT in engine (like .min) naturally fall back to methods.
      const isZodCore = typeof p === "string" && (p.startsWith("_") || p.startsWith("~") || p === "parse" || p === "safeParse" || p === "spa");
      const useEngine = isZodCore || !(p in methods);
      const target = useEngine ? t : methods;
      
      const val = (target as any)[p];

      if (typeof val === "function") {
        const bound = val.bind(target);
        return (...args: any[]) => {
          const res = bound(...args);
          return isSchemaCompatible(res) ? wrapper(res) : res;
        };
      }

      return isSchemaCompatible(val) ? wrapper(val) : val;
    },
  });
}

/**
 * Recursively seals an object or schema to block the forbidden methods.
 * Uses a Proxy to intercept method calls and automatically wrap the results.
 * This keeps the CLI contract predictable and prevents users from using
 * complex Zod features that would break our bitmask routing or help generation.
 */
export function sealZod<T extends object>(target: T): $Sealed<T> {
  if (isSealed(target)) return target as unknown as $Sealed<T>;
  return bridgeZod(target, target, sealZod, isForbidden);
}

/**
 * @function sealZod_old
 * @description Recursively seals an object or schema to block the forbidden methods.
 * Uses a Proxy to intercept method calls and automatically wrap the results.
 * This keeps the CLI contract predictable and prevents users from using
 * complex Zod features that would break our bitmask routing or help generation.
 */
export function sealZod_old<T extends object>(target: T): $Sealed<T> {
  if (isSealed(target)) return target as unknown as $Sealed<T>;

  return new Proxy(target, {
    has(t, p) {
      return p === $IS_SEALED || Reflect.has(t, p);
    },
    get(t, p, receiver) {
      if (p === "toZod") return t;
      if (p === $IS_SEALED) return true;

      // Special alias: .desc(msg) -> .meta({ description: msg })
      if (p === "desc") {
        return (message: string) => {
          const zod = t as unknown as z.ZodType;
          return sealZod(zod.meta({ description: message }));
        };
      }

      // Handle standard Zod v4 and Standard Schema properties
      if (isSchemaCompatibleProp(p)) {
        return Reflect.get(t, p, receiver);
      }

      // Support for JSON.stringify via Zod v4's native toJSONSchema
      if (p === "toJSON") {
        return () => {
          const obj = t as Record<string, unknown>;
          return typeof obj.toJSONSchema === "function"
            ? (obj as { toJSONSchema: () => unknown }).toJSONSchema()
            : t;
        };
      }

      if (isForbidden(p)) {
        throw new Error(
          `[CZVO] Access to '${String(
            p,
          )}' is forbidden to ensure contract simplicity.`,
        );
      }

      // Proxy Invariant: Non-configurable/non-writable properties must return the original value exactly
      const desc = Object.getOwnPropertyDescriptor(t, p);
      if (desc && (!desc.configurable || !desc.writable)) {
        return Reflect.get(t, p, receiver);
      }

      const val = Reflect.get(t, p, receiver);

      if (typeof val === "function") {
        const bound = val.bind(t);
        return (...args: unknown[]) => {
          const res = bound(...args);
          return isSchemaCompatible(res) ? sealZod(res) : res;
        };
      }

      return isSchemaCompatible(val) ? sealZod(val) : val;
    },
  }) as unknown as $Sealed<T>;
}

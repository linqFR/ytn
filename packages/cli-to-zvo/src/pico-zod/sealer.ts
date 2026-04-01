import { z } from "zod";
import { $NamespaceSealed, type $Sealed } from "./sealer.types.js";
import {
  isForbidden,
  isSchemaCompatible,
  isSchemaCompatibleProp,
} from "./zod-modifiers.js";
import { PICO_FACTORIES } from "./pico-overrides.js";

/**
 * @type tsPicoCompatible
 * @description Any Zod-like schema (raw Zod or Sealed CZVO) supported as sub-items in factories.
 */
export type tsPicoCompatible<O = any, I = any> =
  | ISealedInterface<O, I>
  | z.ZodType<O, I>;

// Pico Tree Root
export type tsPicoFactories = $NamespaceSealed<typeof PICO_FACTORIES> & {
  define: (
    n: string,
    f: (this: tsPicoFactories, ...args: any[]) => any,
  ) => void;
  [k: string]: any;
};

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
 * @interface ISealedInterface
 * @description The common interface for all schemas that have been "Sealed" for CLI use.
 * It provides core metadata and standardized methods while hiding non-compliant Zod internals.
 *
 * @template O - The output type of the schema.
 * @template I - The input type of the schema.
 * @template Z - The underlying Zod type.
 */
export interface ISealedInterface<
  O = any,
  I = any,
  Z extends z.ZodType<O, I, any> = z.ZodType<O, I, any>,
> {
  /**
   * @property toZod
   * @description Unwraps the sealed CLI schema back to its original raw Zod instance.
   * Useful for advanced integrations where the raw Zod API is required.
   */
  readonly toZod: Z;

  /**
   * @property [$IS_SEALED]
   * @description Internal brand to identify sealed schemas at runtime.
   */
  readonly [$IS_SEALED]: true;

  /**
   * @property "~standard"
   * @description Standard Schema support (Zod v4 compatibility).
   */
  readonly "~standard": Z extends { "~standard": infer S } ? S : never;

  /**
   * @method desc
   * @description Attaches a human-readable description to the schema for help generation.
   *
   * @param {string} message - The description text.
   * @returns {$Sealed<Z>} The enriched and sealed schema.
   */
  desc(message: string): $Sealed<Z>;
}

/**
 * @function isSealed
 * @description Type guard to identify sealed CLI schemas (created via CZVO API).
 *
 * @param {unknown} val - The value to check.
 * @returns {boolean} True if the value is a sealed CZVO schema.
 */
export const isSealed = (val: unknown): val is ISealedInterface =>
  typeof val === "object" && val !== null && $IS_SEALED in val;

/**
 * @function toZod
 * @description Safely unwraps a schema if it is sealed, or returns the original if already raw.
 *
 * @param {ISealedInterface | z.ZodType} schema - The schema to unwrap.
 * @returns {z.ZodType} The raw Zod schema.
 */
export const toZod = (schema: ISealedInterface | z.ZodType): z.ZodType =>
  isSealed(schema) ? schema.toZod : schema;

/**
 * @function bridgeZod_old
 * @description Master recursive Proxy engine for both Sealing and Pre-processing.
 * It provides a bridge between a validation entrance (engine) and an API surface (methods).
 */
// export function bridgeZod_old<T extends object, E extends object>(
//   engine: E,
//   methods: T,
//   wrapper: (val: any) => any,
//   isForbiddenFn?: (p: string | symbol) => boolean,
// ): any {
//   return new Proxy(engine, {
//     has(t, p) {
//       return p === $IS_SEALED || Reflect.has(t, p) || Reflect.has(methods, p);
//     },
//     get(t, p, receiver) {
//       // Unwrapping: returning the underlying engine ensures the full validation pipeline is accessible.
//       if (p === "toZod") return t;

//       // Identification: reports as Sealed only when enforcing contract security via filters.
//       if (p === $IS_SEALED) return !!isForbiddenFn;

//       // --- ALIASES ---
//       if (p === "desc") {
//         return (msg: string) =>
//           wrapper((methods as any).meta({ description: msg }));
//       }
//       if (p === "toJSON") {
//         return () =>
//           typeof (methods as any).toJSONSchema === "function"
//             ? (methods as any).toJSONSchema()
//             : methods;
//       }

//       // --- SECURITY ---
//       // Security Bypass: explicitly allow Standard Schema markers to bypass pattern-matching restrictions.
//       if (
//         typeof p === "string" &&
//         !isSchemaCompatibleProp(p) &&
//         isForbiddenFn?.(p)
//       ) {
//         throw new Error(`[CZVO] Access to '${p}' is forbidden.`);
//       }

//       // --- DELEGATION ---
//       // Forces priority to engine (t) for validation, standard schema and core Zod props.
//       // Modifiers NOT in engine (like .min) naturally fall back to methods.
//       const isZodCore =
//         typeof p === "string" &&
//         (p.startsWith("_") ||
//           p.startsWith("~") ||
//           p === "parse" ||
//           p === "safeParse" ||
//           p === "spa");
//       const useEngine = isZodCore || !(p in methods);
//       const target = useEngine ? t : methods;

//       const val = (target as any)[p];

//       if (typeof val === "function") {
//         const bound = val.bind(target);
//         return (...args: any[]) => {
//           const res = bound(...args);
//           return isSchemaCompatible(res) ? wrapper(res) : res;
//         };
//       }

//       return isSchemaCompatible(val) ? wrapper(val) : val;
//     },
//   });
// }

/**
 * @function bridgeZod
 * @description The core recursive Proxy engine for the CZVO ecosystem.
 * It provides a "Bridge" between a static API surface (methods) and a
 * validator instance (engine).
 *
 * Features:
 * - **Security**: Blocks access to non-compliant Zod methods (e.g. .transform) via a blacklist.
 * - **Context**: Handles correct `this` binding for both native Zod methods and dynamic extensions.
 * - **Fluent API**: Supports dynamic method addition via `.define()`.
 * - **Idempotency**: Automatically re-seals results that are Zod schemas.
 *
 * @template T - Type of the static methods object.
 * @template E - Type of the validator engine (usually a Zod schema).
 *
 * @param {E} engine - The underlying Zod schema or engine.
 * @param {T} methods - The static API surface to expose.
 * @param {(val: any) => any} wrapper - The function to call for wrapping results (usually `sealZod`).
 * @param {(p: string | symbol) => boolean} [isForbiddenFn] - Optional blacklist filter for security.
 * @returns {any} A Proxy representing the bridged interface.
 */
export function bridgeZod<T extends object, E extends object>(
  engine: E,
  methods: T,
  wrapper: (val: any) => any,
  isForbiddenFn?: (p: string | symbol) => boolean,
): any {
  // Isolated storage for dynamic extensions specific to this Proxy instance
  const extensions: Record<string, any> = {};

  return new Proxy(engine, {
    has(t, p) {
      return (
        p === $IS_SEALED ||
        Reflect.has(t, p) ||
        Reflect.has(methods, p) ||
        p in extensions
      );
    },

    // Intercepts direct assignments (e.g., pico.help = ...) to populate extensions
    set(t, p, value, receiver) {
      if (typeof value === "function" && typeof p === "string") {
        extensions[p] = value;
        return true;
      }
      // return Reflect.set(t, p, value, receiver);
      throw new Error(`[CZVO] Mutation of internal schema properties is forbidden.`);
    },

    get(t, p, receiver) {
      // Unwrapping: returning the underlying engine ensures the full validation pipeline is accessible.
      if (p === "toZod") return t;

      // Identification: reports as Sealed only when enforcing contract security via filters.
      if (p === $IS_SEALED) return !!isForbiddenFn;

      // Implements the fluent .define() API for method registration
      if (p === "define") {
        return (name: string, factory: Function) => {
          receiver[name] = factory; // Triggers the 'set' trap above
          return receiver;
        };
      }

      // --- ALIASES ---
      if (p === "desc") {
        return (msg: string) =>
          wrapper((methods as any).meta({ description: msg }));
      }
      if (p === "toJSON") {
        return () =>
          typeof (methods as any).toJSONSchema === "function"
            ? (methods as any).toJSONSchema()
            : methods;
      }

      // Security Bypass: explicitly allow Standard Schema markers to bypass pattern-matching restrictions.
      if (
        typeof p === "string" &&
        !isSchemaCompatibleProp(p) &&
        isForbiddenFn?.(p)
      ) {
        throw new Error(`[CZVO] Access to '${p}' is forbidden.`);
      }

      // --- DELEGATION STRATEGY ---
      const isZodCore =
        typeof p === "string" &&
        (p.startsWith("_") ||
          p.startsWith("~") ||
          ["parse", "safeParse", "spa"].includes(p));

      /**
       * Priority Resolution:
       * 1. Zod Core Properties (internal props, parse methods)
       * 2. Dynamic Extensions (added via define or set)
       * 3. Target engine properties (inherited methods)
       * 4. Native methods (static factories provided during initialization)
       */
      const target = isZodCore
        ? t
        : p in extensions
        ? extensions
        : p in methods
        ? methods
        : t;
      const val = (target as any)[p];

      if (typeof val === "function") {
        /**
         * Contextual Binding:
         * - Use 'receiver' (Proxy) for dynamic extensions to allow cross-calls (this.literal, etc.)
         * - Use 'target' (raw object) for native Zod methods to preserve internal state and metadata.
         */
        const bindingContext = target === extensions ? receiver : target;
        const bound = val.bind(isZodCore ? t : bindingContext);

        return (...args: any[]) => {
          const res = bound(...args);
          // Recursively wrap compatible Zod schemas (idempotent sealZod)
          return isSchemaCompatible(res) ? wrapper(res) : res;
        };
      }
      return isSchemaCompatible(val) ? wrapper(val) : val;
    },
  });
}

/**
 * @function sealZod
 * @description Recursively "Seals" a Zod schema to prevent use of CLI-incompatible methods.
 * Sealing acts as a security runtime layer that keeps the contract predictable.
 *
 * @template T - The schema type to seal.
 * @param {T} target - The raw Zod schema or object.
 * @returns {$Sealed<T>} The protected, sealed schema.
 */
export function sealZod<T extends object>(target: T): $Sealed<T> {
  if (isSealed(target)) return target as unknown as $Sealed<T>;
  return bridgeZod(target, target, sealZod, isForbidden);
}

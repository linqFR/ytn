import {
  z,
  ZodType,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodDate,
  ZodSet,
  ZodArray,
  ZodTuple,
} from "zod";
import type { ZodXor } from "zod";
import { jsonCodec, jsonlCodec } from "./zod-codecs.js";

// see https://zod.dev/api

// --- Forbidden Discovery ---

/**
 * Internal Zod properties that should always be hidden (branding, metadata).
 * Uses template literals to automatically match all _prop and ~prop.
 */
type InternalKeys =
  | "def"
  | "~standard"
  | `_${string}`
  | `~${string}`;

/**
 * Zod modifiers that we block to keep the CLI contract predictable.
 * These are the methods that change the structure or flow (e.g., .optional(), .pipe()).
 */
const FORBIDDEN_MODIFIERS = [
  "array",
  "brand",
  "catch",
  "clone",
  "default",
  "describe",
  "intersection",
  "lazy",
  "map",
  "nonoptional",
  "nullable",
  "nullish",
  "object",
  "optional",
  "pipe",
  "prefault",
  "preprocess",
  "readonly",
  "record",
  "refine",
  "superRefine",
  "transform",
  "tuple",
  "union",
  "unwrap",
] as const;

type Forbidden = InternalKeys | (typeof FORBIDDEN_MODIFIERS)[number];

/**
 * Runtime check to identify forbidden access to Zod internals or complex modifiers.
 * @param p Property key to check.
 * @returns True if the property is forbidden in the CLI contract.
 */
function isForbidden(p: string | symbol): boolean {
  if (typeof p !== "string") return false;
  // 1. Block internal props via convention (_prop, ~prop) or explicit 'def'
  if (p.startsWith("_") || p.startsWith("~") || p === "def") return true;
  // 2. Block explicit modifiers that break contract simplicity
  return (FORBIDDEN_MODIFIERS as readonly string[]).includes(p);
}

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
 */
export interface CZVOSchema {
  /** Unwraps the sealed CLI schema back to its original Zod v4 instance */
  readonly toZod: any;
  /** Internal brand to identify sealed schemas at runtime */
  readonly [$IS_SEALED]: true;
}

/**
 * Utility type to "seal" a Zod type or factory.
 * It recursively obscures forbidden methods to prevent contract pollution
 * while preserving the original schema via the `.toZod` escape hatch.
 */
export type Sealed<T> = 0 extends 1 & T
  ? T
  : T extends (...args: infer A) => infer R
  ? (...args: A) => Sealed<R>
  : T extends { parse: any }
  ? {
      [K in keyof T as K extends Forbidden ? never : K]: Sealed<T[K]>;
    } & CZVOSchema
  : T;

/**
 * Specialized sealing for namespaces (objects containing factories).
 * Does not recurse as deeply as Sealed to avoid compiler serialization issues.
 */
export type NamespaceSealed<T> = {
  [K in keyof T as K extends Forbidden ? never : K]: T[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => Sealed<R>
    : T[K];
};

/*
 * Recursively seals an object or schema to block the forbidden methods.
 */
function sealZod<T extends object>(target: T): Sealed<T> {
  if ((target as any)[$IS_SEALED]) return target as any;

  return new Proxy(target, {
    get(t, p, receiver) {
      if (p === "toZod") return t;
      if (p === $IS_SEALED) return true;

      // Support for JSON.stringify via Zod v4's native toJSONSchema
      if (p === "toJSON") {
        return () => {
          const obj = t as Record<string, unknown>;
          return typeof obj.toJSONSchema === "function"
            ? (obj as any).toJSONSchema()
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
          return res !== null &&
            typeof res === "object" &&
            res instanceof z.ZodType
            ? sealZod(res)
            : res;
        };
      }

      return val !== null && typeof val === "object" && val instanceof z.ZodType
        ? sealZod(val)
        : val;
    },
  }) as unknown as Sealed<T>;
}

// --- Utilities ---

/**
 * Utility to parse comma-separated strings into arrays.
 */
const parseCommaSeparated = (val: unknown): string[] =>
  typeof val === "string" ? val.split(",").map((s) => s.trim()) : [];

/**
 * Utility to handle empty or specific strings ("null", "undefined") as null/undefined values.
 */
const makeEmptyTo = <T extends z.ZodTypeAny>(targetStr: string, fallback: T) =>
  z.coerce.string().pipe(
    z.preprocess((v) => {
      const s = typeof v === "string" ? v.toLowerCase() : "";
      return s === targetStr || s === ""
        ? fallback instanceof z.ZodNull
          ? null
          : undefined
        : v;
    }, fallback),
  );

// --- Source of Truth ---

/**
 * @constant RAW_FACTORIES
 * @description Single source of truth for all CLI factories.
 * Combines basic Zod types with CLI coercions and complex types.
 */
/**
 * @constant ATOMIC_FACTORIES
 * @description Parameterless factories usable as simple DSL strings in contracts.
 */
const ATOMIC_FACTORIES = {
  // Primitives & Coercions (Returning JS Objects)
  string: () => z.string(),
  number: () => z.coerce.number(),
  boolean: () => z.coerce.boolean(),
  date: () => z.coerce.date(), // Coerces input to JS Date instance
  bigint: () => z.coerce.bigint(),

  // Special "Empty" Types
  null: () => makeEmptyTo("null", z.null()),
  undefined: () => makeEmptyTo("undefined", z.undefined()),

  // CLI Specialized
  filepath: () =>
    z.coerce
      .string()
      .trim()
      .min(1, "Filepath cannot be empty")
      .refine(
        (p) => !/^(https?|ftp):\/\//i.test(p),
        "Expected a local path, but found a URL",
      ),
  file: () => z.file(),
  stringbool: () => z.coerce.string().pipe(z.stringbool()),
  json: () => jsonCodec,
  jsonl: () => jsonlCodec,

  // Zod v4 Atomics (Specialized strings)
  base64: () => z.base64(),
  cuid: () => z.cuid(),
  cuid2: () => z.cuid2(),
  email: () => z.email(),
  emoji: () => z.emoji(),
  hex: () => z.hex(),
  hostname: () => z.hostname(),
  ipv4: () => z.ipv4(),
  ipv6: () => z.ipv6(),
  dateISO: () => z.iso.date(), // Returns a validated ISO string
  datetime: () => z.iso.datetime(),
  duration: () => z.iso.duration(),
  time: () => z.iso.time(),
  jwt: () => z.jwt(),
  nanoid: () => z.nanoid(),
  ulid: () => z.ulid(),
  url: () => z.url(),
  uuid: () => z.uuid(),
};

/**
 * @constant COMPLEX_FACTORIES
 * @description Parameterized factories that cannot be used as literal DSL strings.
 * Use these via the `CZVO` API (e.g., `CZVO.list(CZVO.string())`).
 */
const COMPLEX_FACTORIES = {
  /** Wraps a raw Zod schema with standard CLI string coercion. */
  zod: (schema: ZodType<any, string>) => z.coerce.string().pipe(schema),
  /** Decodes a JSON string and validates it against a schema. */
  decJSON: (schema: ZodType) => jsonCodec.pipe(schema),
  /** Decodes newline-separated JSON and validates it against a schema. */
  decJSONL: (schema: ZodType<any, string[]>) => jsonlCodec.pipe(schema),

  /** Parses a comma-separated string into a unique Set. */
  set: (itemType: CZVOSchema) =>
    z.coerce
      .string()
      .pipe(
        z.preprocess(
          (v) => (typeof v === "string" ? new Set(parseCommaSeparated(v)) : v),
          z.set(itemType.toZod),
        ) as any,
      ) as unknown as ZodSet,

  /** Parses a comma-separated string into an Array. */
  list: (itemType: CZVOSchema) =>
    z.coerce
      .string()
      .pipe(
        z.preprocess(parseCommaSeparated, z.array(itemType.toZod)) as any,
      ) as unknown as ZodArray<any>,

  /** Parses a comma-separated string into a fixed-size Tuple. */
  tuple: (...args: CZVOSchema[]) => {
    const zodArgs = args.map((a) => a.toZod) as [ZodType, ...ZodType[]];
    return z.coerce
      .string()
      .pipe(
        z.preprocess(parseCommaSeparated, z.tuple(zodArgs)) as any,
      ) as unknown as ZodTuple;
  },

  /** Creates a logical Union of multiple CLI types. */
  or: (...args: CZVOSchema[]) =>
    z.union(args.map((a) => a.toZod) as any) as any as z.ZodUnion<any>,

  /** Creates an exclusive OR (XOR) between multiple CLI types. */
  xor: (...args: CZVOSchema[]) =>
    z.xor(args.map((a) => a.toZod)) as any as ZodXor,
};

/**
 * @constant RAW_FACTORIES
 * @description Combined source of truth.
 */
const RAW_FACTORIES = { ...ATOMIC_FACTORIES, ...COMPLEX_FACTORIES };

/**
 * Type derived automatically from RAW_FACTORIES.
 */
export type ICZVO = NamespaceSealed<typeof RAW_FACTORIES>;

/**
 * @constant CZVO
 * @description The finalized CLI Zod entry point.
 */
export const CZVO = Object.fromEntries(
  Object.entries(RAW_FACTORIES).map(([key, factory]) => [
    key,
    (...args: any[]) => {
      const res = (factory as any)(...args);
      return res instanceof z.ZodType ? sealZod(res) : res;
    },
  ]),
) as unknown as ICZVO;

export type CZVO = typeof CZVO;

/**
 * @constant CZVO_COMPLEX_TYPES
 * @description List of factories that require arguments.
 */
const CZVO_COMPLEX_TYPES = Object.keys(COMPLEX_FACTORIES);

/**
 * @constant CZVO_FACTORIES
 * @description Exhaustive list of all factories.
 */
const CZVO_FACTORIES = Object.keys(RAW_FACTORIES);

/**
 * @constant VALID_CLI_TYPES
 * @description Type names available for contract DSL strings (atomic types).
 */
export const VALID_CLI_TYPES = Object.keys(ATOMIC_FACTORIES);

/**
 * @constant CLI_TYPES
 * @description Map of type identifiers to raw Zod schemas for legacy support.
 */
export const CLI_TYPES: Record<string, ZodType> = Object.fromEntries(
  VALID_CLI_TYPES.map((key) => {
    let val = (CZVO as any)[key];
    if (typeof val === "function") val = val();
    return [key, (val as any).toZod || val];
  }),
);

/**
 * @constant CLI_ARG_TYPES
 * @description Map of identifiers to node:util parseArgs compatible types.
 */
export const CLI_ARG_TYPES: Record<string, "string" | "boolean"> =
  Object.fromEntries(
    VALID_CLI_TYPES.map((key) => [
      key,
      key === "boolean" || key === "stringbool" ? "boolean" : "string",
    ]),
  );

/**
 * @type CliAtomicType
 * @description All atomic type identifiers available as simple strings.
 */
export type CliAtomicType = keyof typeof ATOMIC_FACTORIES;

/**
 * @type CliType
 * @description The core Hybrid V1.1 Contract Type.
 * Supports:
 * - DSL Strings: Atomic identifiers ("filepath", "number", "email") or Pipe-Unions ("string | number").
 * - CZVO Schemas: Sealed Zod instances created via the CZVO API (e.g., CZVO.email()).
 * Identified at runtime by the presence of a '.toZod' unwrapper property.
 */
export type CliType = CliAtomicType | (string & {}) | CZVOSchema;

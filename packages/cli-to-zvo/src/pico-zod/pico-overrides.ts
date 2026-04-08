import { jsonCodec, jsonlCodec, jsonSchemaCodec } from "@ytn/shared/zod/codecs.js";
import { z } from "zod";
import {
  type ISealedInterface, toZod,
  type tsPicoCompatible
} from "./sealer.js";
import {
  csvPreProcess,
  makeEmptyTo,
} from "./zod-codecs.js";

/**
 * @constant PICO_ATOMIC_FACTORIES
 * @description Parameterless factories usable as simple DSL strings in contracts.
 */
export const PICO_ATOMIC_FACTORIES = {
  // Special "Empty" Types
  null: () => makeEmptyTo("null", z.null()),
  undefined: () => makeEmptyTo("undefined", z.undefined()),
  // unknown: () => z.unknown(),
  any: () => z.any(),

  // Primitives
  number: () => z.coerce.number(),
  int: () => z.coerce.number().pipe(z.int()),
  int32: () => z.coerce.number().pipe(z.int32()),
  bigint: () => z.coerce.bigint(),

  string: () => z.coerce.string(),
  stringbool: () => z.stringbool(),

  bool: () => z.union([z.boolean(), z.stringbool()]),
  boolean: () => z.boolean(),

  date: () => z.coerce.date(), // Coerces input to JS Date instance

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
  json: () => jsonCodec,
  jsonl: () => jsonlCodec,
  jsonSchema: () => jsonSchemaCodec,

  /** Parses a comma-separated values into an Array. */
  list: () => csvPreProcess(z.any().array()),
  stringList: () => csvPreProcess(z.coerce.string<string>().array()),
  numList: () => csvPreProcess(z.coerce.number<string>().array()),
  boolList: () => csvPreProcess(z.stringbool().array()),

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
 */
const COMPLEX_FACTORIES = {
  /** Wraps a raw Zod schema with standard CLI string coercion. */
  zod: <T extends z.ZodType<unknown, string | boolean>>(schema: T) =>
    z.any().pipe(schema),

  /** Decodes a JSON string and validates it against a schema. */
  decJSON: <T extends z.ZodType<unknown, string>>(schema: T) =>
    jsonCodec.pipe(schema),

  /** Decodes newline-separated JSON and validates it against a schema. */
  decJSONL: <T extends z.ZodType<unknown, string[]>>(schema: T) =>
    jsonlCodec.pipe(schema),

  /** Parses a comma-separated string into a fixed-size Tuple. */
  tuple: (...args: tsPicoCompatible<any, any>[]) => {
    const zodArgs = args.map((a) => toZod(a)) as [
      z.ZodType<any, any>,
      ...z.ZodType<any, any>[],
    ];
    return csvPreProcess(z.tuple(zodArgs));
  },

  /** Creates a logical Union of multiple CLI types. */
  or: (...args: tsPicoCompatible<any, any>[]) => {
    const zodArgs = args.map((a) => toZod(a)) as [
      z.ZodType<any, any>,
      ...z.ZodType<any, any>[],
    ];
    return z.union(zodArgs);
  },

  /** Creates an exclusive OR (XOR) between multiple CLI types. */
  xor: (...args: tsPicoCompatible<any, any>[]) => {
    const zodArgs = args.map((a) => toZod(a)) as [
      z.ZodType<any, any>,
      ...z.ZodType<any, any>[],
    ];
    return z.xor(zodArgs);
  },

  /** Creates a Zod literal schema. */
  literal: <T extends string | number | boolean>(value: T) => z.literal(value),


  /** Creates a Zod enum schema from an array of strings or an object. */
  enum: <const T extends string, const U extends readonly string[]>(
    val0: T,
    ...rest: U
  ) => z.enum([val0, ...rest]),

};

/**
 * @constant PICO_FACTORIES
 * @description Combined source of truth.
 */
export const PICO_FACTORIES = {
  ...PICO_ATOMIC_FACTORIES,
  ...COMPLEX_FACTORIES,
};

/**
 * @type tsPicoAtomicType
 * @description All atomic type identifiers available as simple strings.
 */
export type tsPicoAtomicType = keyof typeof PICO_ATOMIC_FACTORIES;

/**
 * @type tsPicoInput
 * @description The core Hybrid V1.1 Contract Type (Alias for tsPico).
 */
export type tsPicoInput = tsPicoAtomicType | (string & {}) | ISealedInterface;


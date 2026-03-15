import { z, ZodType, ZodString, ZodBoolean } from "zod";
import { jsonCodec, jsonlCodec, listCodec } from "./zod-codecs.js";
import { ZodTupleItems, ZodUnionOptions } from "./zod-tbx.js";

// see https://zod.dev/codecs
// see https://zod.dev/api
/**
 * @interface CliTypes
 * @description Interface defining the supported CLI argument types.
 */
interface CliTypes {
  /** Standard string type. */
  readonly string: ZodString;
  /** Comma-separated list type. */
  readonly list: typeof listCodec;
  /** JSON object type. */
  readonly json: typeof jsonCodec;
  /** Boolean type (coerced). */
  readonly boolean: ZodType;
  /** Number type (coerced). */
  readonly number: ZodType;
  /** URL type. */
  readonly url: ZodType;
  /** File path type (string). */
  readonly filepath: ZodString;
  /** JSON Lines type (array of objects). */
  readonly jsonl: typeof jsonlCodec;
  /** Tuple type with custom mapping. */
  tuple(arr: readonly ZodType[], params?: string): ZodType;
  /** Union type (OR) between multiple types. */
  "|"(txt: string): ZodType;
  [key: string | symbol]: ZodType | Function;
}

/**
 * @constant {CliTypes} INNER_CLI_TYPES
 * @description Global registry of CLI types that map string identifiers to Zod schemas.
 */
const INNER_CLI_TYPES: CliTypes = {
  get string() {
    return z.string();
  },
  get list() {
    return listCodec;
  },
  get json() {
    return jsonCodec;
  },
  get boolean() {
    return z.coerce.boolean();
  },
  get number() {
    return z.coerce.number();
  },
  get url() {
    return z.url();
  },
  get filepath() {
    return z.string();
  },
  tuple(arr, params) {
    // Use ZodTupleItems to align with Zod's signature without using 'any'
    return z.tuple(arr as ZodTupleItems, params);
  },
  get jsonl() {
    return jsonlCodec;
  },
  "|"(txt = "") {
    const schemas: ZodType[] = txt.split("|").map((t) => {
      const type = this[t.trim()];
      return type instanceof ZodType ? type : z.string();
    });

    if (schemas.length < 2) {
      return schemas[0] || z.string();
    }

    // Use ZodUnionOptions for optimal typing of union schemas
    return z.union(schemas as ZodUnionOptions);
  },
};

/**
 * @constant {any} CLI_TYPES
 * @description Dynamic resolver for CLI types. Supports automatic union resolution for 'type1|type2' keys.
 */
export const CLI_TYPES: any = new Proxy(INNER_CLI_TYPES, {
  get(target, prop) {
    if (typeof prop !== "string") return target[prop as any];
    
    const isUnion = prop.includes("|") && prop !== "|";
    const value = target[isUnion ? "|" : prop];

    return typeof value === "function" && isUnion
      ? value.bind(this)(prop)
      : value;
  },
});

/**
 * @constant {any} CLI_ARG_TYPES
 * @description Automatically maps CLI_TYPES to their base representation ("string" | "boolean") for node:util.parseArgs.
 */
export const CLI_ARG_TYPES: any = new Proxy(CLI_TYPES, {
  get(target, prop) {
    const schema = target[prop];
    // To detect the instance type of functions (like tuple), we invoke them with a dummy value
    const instance = typeof schema === "function" ? schema([]) : schema;
    return instance instanceof ZodBoolean ? "boolean" : "string";
  },
});

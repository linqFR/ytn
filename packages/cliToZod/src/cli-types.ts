import { z, ZodType, ZodString } from "zod";
import { jsonCodec, jsonlCodec, listCodec } from "./zod-codecs.js";
import { ZodTupleItems, ZodUnionOptions } from "./zod-tbx.js";

// see https://zod.dev/codecs
// see https://zod.dev/api
interface CliTypes {
  readonly string: ZodString;
  readonly list: typeof listCodec;
  readonly json: typeof jsonCodec;
  readonly boolean: ZodType;
  readonly number: ZodType;
  readonly url: ZodType;
  readonly filepath: ZodString;
  readonly jsonl: typeof jsonlCodec;
  tuple(arr: readonly ZodType[], params?: string): ZodType;
  "|"(txt: string): ZodType;
  [key: string]: ZodType | Function;
}


export const CLI_TYPES: CliTypes = {
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
  "|"(txt) {
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
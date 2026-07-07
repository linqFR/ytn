// ============================================
// Helper wrapper for meta parameter

import type {
  tsDnaType
} from "../shared/base.types.js";
import { DnaIssueCodes } from "../shared/error-codes.js";
import type { tsDecodeFn, tsEncodeFn, tsTmplLitArg, tsTransformFn } from "../shared/handlers-builder.types.js";
import type { tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsExternalsDecl } from "../shared/runtime.types.js";
import { initDna } from "./dna-core.js";

import type {
  tsDnaCustom,
  tsDnaDescribeCheck,
  tsDnaEnumValues,
  tsDnaEnumValueType,
  tsDnaJson,
  tsDnaMetaCheck,
  tsDnaPropertyCheck
} from "../types/api-builder.types.js";
import type { $EnumKeys, $EnumValues, $EnumObj, $EnumAsObj, $ToEnum, $Input } from "../types/helpers.types.js";

// Import public API types from api-builder.types.ts
import type {
  tsDnaAny,
  tsDnaArray,
  tsDnaBigInt,
  tsDnaBoolean,
  tsDnaCodec,
  tsDnaDate, tsDnaEnumInput, tsDnaInstanceOf, tsDnaLazy, tsDnaNever,
  tsDnaNullable, tsDnaNullish,
  tsDnaNumber, tsDnaOptional, tsDnaPrefault,
  tsDnaRecord, tsDnaTmplLit, tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO, tsDnaUnknown
} from "../types/api-builder.types.js";

import {
  AllOfImpl,
  ArrayImpl,
  DnaBigInt,
  DnaBoolean,
  CodecImpl,
  Coerce, DnaDate,
  DiscriminatorImpl,
  DnaGenericWrapped,
  DnaString,
  DnaEmail,
  DnaHttpUrl,
  DnaHostname,
  DnaUUID,
  DnaE164,
  DnaEmoji,
  DnaBase64,
  DnaBase64Url,
  DnaHex,
  DnaNanoId,
  DnaCuid,
  DnaCuid2,
  DnaUlid,
  DnaXid,
  DnaKsuid,
  DnaIpv4,
  DnaIpv6,
  DnaMac,
  DnaCidrv4,
  DnaCidrv6,
  DnaHash,
  DnaEnum,
  GetterSchemaImpl,
  DnaInt32,
  DnaInt,
  Iso, DnaLiteral,
  NumberImpl,
  ObjectImpl,
  pipeFactory,
  preprocessFactory,
  DnaPromise,
  DnaProperty,
  DnaTemplateLiteral,
  DnaTmplLiteralMutate,
  transformFactory,
  DnaTuple,
  UnionImpl,
  DnaUrl,
  DnaNumber,
  DnaStringBool,
  DnaRecord,
  DnaType,
  DnaPrefault,
  DnaOptional,
  DnaNullable,
  DnaNullish,
  DnaCoerceString,
  DnaCoerceNumber,
  DnaCoerceBoolean,
  DnaCoerceBigInt,
  DnaCoerceDate
} from "./dna-interfaces.js";

// ============================================
// Schema Factory (returns discriminated types, Zod V4 style)
// ============================================

// DNA compatibility: error codes (from DNA error-types.ts)

export { DnaIssueCodes as IssueCodes };


export const stringbool = (options?: string | { truthy?: string[]; falsy?: string[]; case?: "sensitive" | "insensitive"; error?: string; message?: string }, meta?: string | tsDnaMeta) => {
  let _meta, _opt;
  if (typeof options === "string") { _meta = options; _opt = {} }
  else { _opt = options, _meta = meta }
  initDna(DnaStringBool, _opt, _meta);
}

/**
 * Template literal schema - combines string literals and schemas.
 * Validate-only (Zod-compatible): the matched value is returned UNCHANGED; any
 * inner transformations (`.toUpperCase()`, `.trim()`, ...) are ignored for output.
 * Use `templateLiteralMutate` to actually apply them. Alias: `tl`.
 */
export const templateLiteral = (parts: tsTmplLitArg[], meta?: string | tsDnaMeta) => initDna(DnaTemplateLiteral, {parts}, meta);

/** Alias for {@link templateLiteral}. */
export const tl = templateLiteral;

/**
 * Mutating template literal schema: like {@link templateLiteral} but the inner
 * transformations ARE applied, so the parsed output reflects them. Alias: `tlm`.
 */
export const templateLiteralMutate = (parts: tsTmplLitArg[], meta?: string | tsDnaMeta): tsDnaTmplLit =>
  initDna(DnaTmplLiteralMutate,{parts}, meta);

/** Alias for {@link templateLiteralMutate}. */
export const tlm = templateLiteralMutate;

export const coerce = {
  string: (meta?: string | tsDnaMeta) => initDna(DnaCoerceString, undefined, meta),
  number: (meta?: string | tsDnaMeta) => initDna(DnaCoerceNumber, undefined, meta),
  boolean: (meta?: string | tsDnaMeta)=>initDna(DnaCoerceBoolean, undefined, meta),
  bigint: (meta?: string | tsDnaMeta) => initDna(DnaCoerceBigInt, undefined, meta),
  date: (meta?: string | tsDnaMeta): tsDnaDate => initDna(DnaCoerceDate, undefined, meta),
};

export const iso = {
  datetime: (options?: { local?: boolean; offset?: boolean; precision?: number; message?: string; error?: string; }) => Iso.datetime(options),
  date: (meta?: {message?: string; error?: string;}) => Iso.date(meta),
  time: (options?: { precision?: number, message?: string; error?: string;}) => Iso.time(options),
  // duration: (meta?: string | tsDnaMeta) => withMeta(Iso.duration(), meta),
};

export const any = (meta?: string | tsDnaMeta): tsDnaAny => initDna(DnaGenericWrapped, undefined, meta);

export const unknown = (meta?: string | tsDnaMeta): tsDnaUnknown => withMeta(DnaGenericWrapped.init<unknown>("unknown", ["T"]), meta);

export const never = (meta?: string | tsDnaMeta): tsDnaNever => withMeta(DnaGenericWrapped.init<never>("never", ["F"]), meta);

// NEVER EDIT THIS BLOCK
export const json = (meta?: string | tsDnaMeta): tsDnaJson<any> => {
  // FORBIDDEN to cast to hide TS warning : if dna types are well defined, that requires NO CAST
  const jsonSchema: any = lazy(() => union([
    string(),
    number(),
    boolean(),
    _null(),
    array((jsonSchema as any)()),
    record(string() as any, (jsonSchema as any)()),
  ]).meta(meta));
  return jsonSchema;
};

export const string = (meta?: string | tsDnaMeta) => initDna(DnaString, undefined, meta);

export const number = (meta?: string | tsDnaMeta) => initDna(DnaNumber, undefined, meta);

export const bigint = (meta?: string | tsDnaMeta) => initDna(DnaBigInt, undefined, meta);

export const int = (meta?: string | tsDnaMeta) => initDna(DnaInt, undefined, meta);

export const int32 = (meta?: string | tsDnaMeta) => initDna(DnaInt32, undefined, meta);

export const boolean = (meta?: string | tsDnaMeta) => initDna(DnaBoolean, undefined, meta);

export const date = (meta?: string | tsDnaMeta) => initDna(DnaDate, undefined, meta);
const _null = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<null, null>("null", ["n0"]), meta);

export const undefined = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<undefined, undefined>("undefined", ["undefined"]), meta);

export const literal = <T>(value: T, meta?: string | tsDnaMeta) => withMeta(DnaLiteral.init(value), meta);

function _enum<const T extends tsDnaEnumInput>(values: T, error?: string | tsDnaMeta) {
  const enumObj: Record<string, tsDnaEnumValueType> = Array.isArray(values) ? values.reduce((acc, v) => { acc[v] = v; return acc }, {}) : values;
  return initDna(DnaEnum<T extends tsDnaEnumValues ? $ToEnum<T[number]> : T>, enumObj, error);
}

export const union = <S extends tsDnaTupleSchemaBase>(schemas: S, meta?: string | tsDnaMeta) =>
  withMeta(UnionImpl.create<S>(schemas), meta);

export const intersection = <S1 extends tsDnaType<any>, S2 extends tsDnaType<any>>(schema1: S1, schema2: S2, meta?: string | tsDnaMeta) =>
  withMeta(AllOfImpl.create([schema1, schema2]), meta);

export const discriminatedUnion = <K extends string, S extends tsDnaTupleSchemaBase>(discriminator: K, schemas: S, meta?: string | tsDnaMeta) =>
  withMeta(DiscriminatorImpl.init(discriminator, schemas), meta);

export const record = <K extends tsDnaType<PropertyKey>, V extends tsDnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K,V>, {keySchema, valueSchema, type:"standard"}, meta);

export const partialRecord = <K extends tsDnaType<PropertyKey>, V extends tsDnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K,V>, {keySchema, valueSchema, type:"partial"}, meta);

export const looseRecord = <K extends DnaType<PropertyKey, any>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K,V>, {keySchema, valueSchema, type:"loose"}, meta);

// top-level format functions

export const email = (meta?: string | tsDnaMeta) => initDna(DnaEmail, undefined, meta);

export const url = (options?: { normalize?: boolean, protocol?: RegExp, hostname?: RegExp }, meta?: string | tsDnaMeta) => {
  // Always use UrlImpl for proper URL validation with new URL()
  // Options control normalize and constraints
  return withMeta(DnaUrl.init(options), meta);
};

export const httpUrl = (meta?: string | tsDnaMeta) => initDna(DnaHttpUrl, undefined, meta);

export const _instanceof = <T extends abstract new (...args: any[]) => any, O = InstanceType<T>>(constructor: T, meta?: string | tsDnaMeta) =>
  withMeta(DnaGenericWrapped.init<O, O>("instanceOf", ["instanceOf", constructor.name]), meta);

export const symbol = (meta?: string | tsDnaMeta) =>
  withMeta(DnaGenericWrapped.init<symbol, symbol>("symbol", ["symbol"]), meta);

export const _void = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<void, void>("void", ["void"]), meta);

export const nan = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<typeof NaN, typeof NaN>("nan", ["nan"]), meta);

export const file = (meta?: string | tsDnaMeta): tsDnaInstanceOf<File> =>
  withMeta(DnaGenericWrapped.init<File, File>("file", ["instanceOf", "File"]), meta);

export const promise = <T>(schema: tsDnaType<T>, meta?: string | tsDnaMeta): any =>
  withMeta(DnaPromise.init(schema), meta);

export const hostname = (meta?: string | tsDnaMeta) => initDna(DnaHostname, undefined, meta);

export const uuid = (meta?: string | tsDnaMeta) => initDna(DnaUUID, undefined, meta);

export const e164 = (meta?: string | tsDnaMeta) => initDna(DnaE164, undefined, meta);

export const emoji = (meta?: string | tsDnaMeta) => initDna(DnaEmoji, undefined, meta);

export const base64 = (meta?: string | tsDnaMeta) => initDna(DnaBase64, undefined, meta);

export const base64url = (meta?: string | tsDnaMeta) => initDna(DnaBase64Url, undefined, meta);

export const hex = (meta?: string | tsDnaMeta) => initDna(DnaHex, undefined, meta);

// export const jwt = (meta?: string | tsDnaMeta) => withMeta(DnaString.create({ format: "jwt" }), meta);
export const jwt = (meta?: string | tsDnaMeta): tsDnaAny => any(); // DONT TOUCH DONT EDIT

export const nanoid = (meta?: string | tsDnaMeta) => initDna(DnaNanoId, undefined, meta);

export const cuid = (meta?: string | tsDnaMeta) => initDna(DnaCuid, undefined, meta);

export const cuid2 = (meta?: string | tsDnaMeta) => initDna(DnaCuid2, undefined, meta);

export const ulid = (meta?: string | tsDnaMeta) => initDna(DnaUlid, undefined, meta);

export const xid = (meta?: string | tsDnaMeta) => initDna(DnaXid, undefined, meta);

export const ksuid = (meta?: string | tsDnaMeta) => initDna(DnaKsuid, undefined, meta);

export const ipv4 = (meta?: string | tsDnaMeta) => initDna(DnaIpv4, undefined, meta);

export const ipv6 = (meta?: string | tsDnaMeta) => initDna(DnaIpv6, undefined, meta);

export const mac = (meta?: string | tsDnaMeta) => initDna(DnaMac, undefined, meta);

export const cidrv4 = (meta?: string | tsDnaMeta) => initDna(DnaCidrv4, undefined, meta);

export const cidrv6 = (meta?: string | tsDnaMeta) => initDna(DnaCidrv6, undefined, meta);

export const hash = (algorithm: "sha1" | "sha256" | "sha384" | "sha512" | "md5", meta?: string | tsDnaMeta) => initDna(DnaHash, { format: `hash:${algorithm}` }, meta);

export const object = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'standard'), meta);

export const strictObject = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'strict'), meta);

export const looseObject = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'loose'), meta);

export const property = <K extends string | number, S>(key: K, schema: DnaType<S>) => initDna(DnaProperty, {key, schema});

export const array = <T extends tsDnaType<any, any>>(item: T, meta?: string | tsDnaMeta): tsDnaArray<T> => withMeta(ArrayImpl.init(item), meta);

export const tuple = <S extends tsDnaTupleSchemaRO, R = never>(items: S, rest?: tsDnaType<R>, meta?: string | tsDnaMeta) =>
  withMeta(DnaTuple.init(items, rest), meta);


export const codec = <I, O>(inSchema: tsDnaType<I>, outSchema: tsDnaType<O>, options: { decode: tsDecodeFn<I, O>, encode: tsEncodeFn<O, I>, externals?: tsExternalsDecl }, meta?: string | tsDnaMeta): tsDnaCodec<I, O> =>
  withMeta(CodecImpl.init(inSchema, outSchema, options.decode, options.encode, options.externals), meta);


export const transform = <T, R>(fn: tsTransformFn<T, R>, meta?: string | tsDnaMeta) =>
  withMeta(transformFactory<T, R>(fn), meta);

export const pipe = <T, U>(src: tsDnaType<T>, target: tsDnaType<U, T>, meta?: string | tsDnaMeta) => withMeta(pipeFactory(src, target), meta);

export const preprocess = <O>(fn: (value: unknown) => O, target: tsDnaType<O, O>, meta?: string | tsDnaMeta) => withMeta(preprocessFactory(fn, target), meta);

export const lazy = <T extends tsDnaType<any>>(getter: () => T): tsDnaLazy<T> => GetterSchemaImpl.init(getter);


export const custom = <T>(fn: (val: any) => boolean, error?: string): tsDnaCustom<T> => {
  const impl = DnaGenericWrapped.init<T>("custom", ["T"]);
  const errMsg = error ? { error } : {};
  impl.refine(fn, errMsg);
  return impl;
};

// Top-level check functions (Zod V4 style)
export const describe = (description: string): tsDnaDescribeCheck => ({
  kind: "describe",
  description,
});


export const meta = (meta: tsDnaMeta): tsDnaMetaCheck => ({
  kind: "meta",
  meta,
});


// export const validation = (check: tsCheckOpt): IValidationCheck => ({
//   kind: "validation",
//   check,
// });

// Special constant for transform error handling (Zod V4 compatibility)

export const NEVER = undefined as never;


// Top-level utility functions (Zod V4 style)
// default: <T>(schema: ISchemaBase<T>, value: T): ISchemaBase<T> => {
//   const impl = schema as SchemaImpl<T>;
//   impl.default(value)
//   return impl;
// };

export const prefault = <S extends DnaType<any, any>>(schema: S, value: $Input<S>): DnaPrefault<S> => {
  return schema.prefault(value);
};

export const optional = <S extends DnaType<any, any>>(schema: S, value: $Input<S>): DnaOptional<S> => {
  return schema.optional();
};

export const nullable = <S extends DnaType<any, any>>(schema: S): DnaNullable<S> => {
  return schema.nullable();
};

export const nullish = <S extends DnaType<any, any>>(schema: S): DnaNullish<S> => {
  return schema.nullish();
};

export {
  _enum as enum, _instanceof as instanceof, _null as null, _void as void
};


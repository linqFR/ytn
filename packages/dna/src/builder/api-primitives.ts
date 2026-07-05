// ============================================
// Helper wrapper for meta parameter

import type {
  tsDnaType
} from "../shared/base.types.js";
import { DnaIssueCodes } from "../shared/error-codes.js";
import type { tsDecodeFn, tsEncodeFn, tsTmplLitArg, tsTransformFn } from "../shared/handlers-builder.types.js";
import type { tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsExternalsDecl } from "../shared/runtime.types.js";

import type {
  tsDnaCustom,
  tsDnaDescribeCheck,
  tsDnaJson,
  tsDnaMetaCheck,
  tsDnaPropertyCheck
} from "../types/api-builder.types.js";

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
  BigIntImpl,
  BooleanImpl,
  CodecImpl,
  Coerce, DateImpl,
  DiscriminatorImpl,
  DnaGenericWrapped,
  EnumImpl,
  GetterSchemaImpl,
  Int32Impl,
  IntImpl,
  Iso, LiteralImpl,
  NumberImpl,
  ObjectImpl,
  pipeFactory,
  preprocessFactory,
  PromiseImpl,
  PropCheckImpl,
  RecordImpl, StringBoolImpl,
  StringImpl,
  TemplateLiteralImpl,
  TemplateLiteralMutateImpl,
  transformFactory,
  TupleImpl,
  UnionImpl,
  UrlImpl,
  withMeta
} from "./core.js";

// ============================================
// Schema Factory (returns discriminated types, Zod V4 style)
// ============================================

// DNA compatibility: error codes (from DNA error-types.ts)

export { DnaIssueCodes as IssueCodes };


export const stringbool = (options?: string | { truthy?: string[]; falsy?: string[]; case?: "sensitive" | "insensitive"; error?: string; message?: string }, meta?: string | tsDnaMeta): tsDnaBoolean =>
  withMeta(StringBoolImpl.init(options), meta);

/**
 * Template literal schema - combines string literals and schemas.
 * Validate-only (Zod-compatible): the matched value is returned UNCHANGED; any
 * inner transformations (`.toUpperCase()`, `.trim()`, ...) are ignored for output.
 * Use `templateLiteralMutate` to actually apply them. Alias: `tl`.
 */
export const templateLiteral = (parts: tsTmplLitArg[], meta?: string | tsDnaMeta): tsDnaTmplLit =>
  withMeta(TemplateLiteralImpl.init(parts), meta);

/** Alias for {@link templateLiteral}. */
export const tl = templateLiteral;

/**
 * Mutating template literal schema: like {@link templateLiteral} but the inner
 * transformations ARE applied, so the parsed output reflects them. Alias: `tlm`.
 */
export const templateLiteralMutate = (parts: tsTmplLitArg[], meta?: string | tsDnaMeta): tsDnaTmplLit =>
  withMeta(TemplateLiteralMutateImpl.init(parts), meta);

/** Alias for {@link templateLiteralMutate}. */
export const tlm = templateLiteralMutate;

export const coerce = {
  string: (meta?: string | tsDnaMeta) => withMeta(Coerce.string(), meta),
  number: (meta?: string | tsDnaMeta): tsDnaNumber => withMeta(Coerce.number(), meta),
  boolean: (meta?: string | tsDnaMeta): tsDnaBoolean => withMeta(Coerce.boolean(), meta),
  bigint: (meta?: string | tsDnaMeta): tsDnaBigInt => withMeta(Coerce.bigint(), meta),
  date: (meta?: string | tsDnaMeta): tsDnaDate => withMeta(Coerce.date(), meta),
};

export const iso = {
  datetime: (options?: { local?: boolean; offset?: boolean; precision?: number; message?: string; error?: string; }) => Iso.datetime(options),
  date: (meta?: string | tsDnaMeta) => withMeta(Iso.date(), meta),
  time: (options?: { precision?: number }, meta?: string | tsDnaMeta) => withMeta(Iso.time(options), meta),
  duration: (meta?: string | tsDnaMeta) => withMeta(Iso.duration(), meta),
};

export const any = (meta?: string | tsDnaMeta): tsDnaAny => withMeta(DnaGenericWrapped.init<any>("any", ["T"]), meta);

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
  ]));
  return withMeta(jsonSchema, meta);
};

export const string = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create(), meta);

export const number = (meta?: string | tsDnaMeta) => withMeta(NumberImpl.init(), meta);

export const bigint = (meta?: string | tsDnaMeta) => withMeta(BigIntImpl.create(), meta);

export const int = (meta?: string | tsDnaMeta) => withMeta(IntImpl.create(), meta);

export const int32 = (meta?: string | tsDnaMeta) => withMeta(Int32Impl.create(), meta);

export const boolean = (meta?: string | tsDnaMeta) => withMeta(BooleanImpl.create(), meta);

export const date = (meta?: string | tsDnaMeta) => withMeta(DateImpl.create(), meta);
const _null = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<null, null>("null", ["n0"]), meta);

export const undefined = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<undefined, undefined>("undefined", ["undefined"]), meta);

export const literal = <T>(value: T, meta?: string | tsDnaMeta) => withMeta(LiteralImpl.init(value), meta);
const _enum = <T extends tsDnaEnumInput>(values: T, error?: string | tsDnaMeta) => withMeta(EnumImpl.init(values), error);

export const union = <S extends tsDnaTupleSchemaBase>(schemas: S, meta?: string | tsDnaMeta) =>
  withMeta(UnionImpl.create<S>(schemas), meta);

export const intersection = <S1 extends tsDnaType<any>, S2 extends tsDnaType<any>>(schema1: S1, schema2: S2, meta?: string | tsDnaMeta) =>
  withMeta(AllOfImpl.create([schema1, schema2]), meta);

export const discriminatedUnion = <K extends string, S extends tsDnaTupleSchemaBase>(discriminator: K, schemas: S, meta?: string | tsDnaMeta) =>
  withMeta(DiscriminatorImpl.init(discriminator, schemas), meta);

export const record = <K extends tsDnaType<PropertyKey, any>, V extends tsDnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta): tsDnaRecord<K, V> =>
  withMeta(RecordImpl.init(keySchema, valueSchema, "standard"), meta);

export const partialRecord = <K extends tsDnaType<PropertyKey, any>, V extends tsDnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta): tsDnaRecord<K, V> =>
  withMeta(RecordImpl.init(keySchema, valueSchema, "partial"), meta);

export const looseRecord = <K extends tsDnaType<PropertyKey, any>, V extends tsDnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta): tsDnaRecord<K, V> =>
  withMeta(RecordImpl.init(keySchema, valueSchema, "loose"), meta);

// top-level format functions

export const email = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "email" }), meta);            // url: (meta?: string | tsMeta) => withMeta(new StringImpl({ format: "url" }), meta),

export const url = (options?: { normalize?: boolean, protocol?: RegExp, hostname?: RegExp }, meta?: string | tsDnaMeta) => {
  // Always use UrlImpl for proper URL validation with new URL()
  // Options control normalize and constraints
  return withMeta(UrlImpl.init(options), meta);
};

export const httpUrl = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "httpUrl" }), meta);

export const _instanceof = <T extends abstract new (...args: any[]) => any, O = InstanceType<T>>(constructor: T, meta?: string | tsDnaMeta) =>
  withMeta(DnaGenericWrapped.init<O, O>("instanceOf", ["instanceOf", constructor.name]), meta);

export const symbol = (meta?: string | tsDnaMeta) =>
  withMeta(DnaGenericWrapped.init<symbol, symbol>("symbol", ["symbol"]), meta);

export const _void = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<void, void>("void", ["void"]), meta);

export const nan = (meta?: string | tsDnaMeta) => withMeta(DnaGenericWrapped.init<typeof NaN, typeof NaN>("nan", ["nan"]), meta);

export const file = (meta?: string | tsDnaMeta): tsDnaInstanceOf<File> =>
  withMeta(DnaGenericWrapped.init<File, File>("file", ["instanceOf", "File"]), meta);

export const promise = <T>(schema: tsDnaType<T>, meta?: string | tsDnaMeta): any =>
  withMeta(PromiseImpl.init(schema), meta);

export const hostname = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "hostname" }), meta);

export const uuid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "uuid" }), meta);

export const e164 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "e164" }), meta);

export const emoji = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "emoji" }), meta);

export const base64 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "base64" }), meta);

export const base64url = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "base64url" }), meta);

export const hex = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "hex" }), meta);

// export const jwt = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "jwt" }), meta);
export const jwt = (meta?: string | tsDnaMeta): tsDnaAny => any(); // DONT TOUCH DONT EDIT

export const nanoid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "nanoid" }), meta);

export const cuid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "cuid" }), meta);

export const cuid2 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "cuid2" }), meta);

export const ulid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "ulid" }), meta);

export const xid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "xid" }), meta);

export const ksuid = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "ksuid" }), meta);

export const ipv4 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "ipv4" }), meta);

export const ipv6 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "ipv6" }), meta);

export const mac = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "mac" }), meta);

export const cidrv4 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "cidrv4" }), meta);

export const cidrv6 = (meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: "cidrv6" }), meta);

export const hash = (algorithm: "sha1" | "sha256" | "sha384" | "sha512" | "md5", meta?: string | tsDnaMeta) => withMeta(StringImpl.create({ format: `hash:${algorithm}` }), meta);

export const object = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'standard'), meta);

export const strictObject = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'strict'), meta);

export const looseObject = <T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta): any => withMeta(ObjectImpl.init(shape, 'loose'), meta);

export const property = <K extends string | number, S>(key: K, schema: tsDnaType<S>): tsDnaPropertyCheck<K> => PropCheckImpl.init(key, schema);

export const array = <T extends tsDnaType<any, any>>(item: T, meta?: string | tsDnaMeta): tsDnaArray<T> => withMeta(ArrayImpl.init(item), meta);

export const tuple = <S extends tsDnaTupleSchemaRO, R = never>(items: S, rest?: tsDnaType<R>, meta?: string | tsDnaMeta) =>
  withMeta(TupleImpl.init(items, rest), meta);


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

export const prefault = <T, I = unknown>(schema: tsDnaType<T, I>, value: I): tsDnaPrefault<T, I> => {
  return schema.prefault(value);
};

export const optional = <T, I = unknown>(schema: tsDnaType<T, I>): tsDnaOptional<T, I> => {
  return schema.optional();
};

export const nullable = <T, I = unknown>(schema: tsDnaType<T, I>): tsDnaNullable<T, I> => {
  return schema.nullable();
};

export const nullish = <T, I = unknown>(schema: tsDnaType<T, I>): tsDnaNullish<T, I> => {
  return schema.nullish();
};

export {
  _enum as enum, _instanceof as instanceof, _null as null, _void as void
};


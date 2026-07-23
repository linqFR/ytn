// ============================================
// Helper wrapper for meta parameter

import { DnaIssueCodes } from "../shared/error-codes.js";
import type { tsDecodeFn, tsEncodeFn, tsTransformFn } from "../shared/handlers-builder.types.js";
import type { tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsDnaExternalsDecl } from "../shared/runtime.types.js";
import { initDna } from "./dna-core.js";

import type {
  tsDnaDescribeCheck,
  tsDnaEnumInput,
  tsDnaEnumValues,
  tsDnaEnumValueType,
  tsDnaMetaCheck,
  tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO,
  DnaFunctionInput,
  DnaFunctionOptions,
  tsDnaDiscriminatedUnionObjects,
} from "../types/api-builder.types.js";
import type { $ToEnum, $Input, $Output, $ArrayItem, $TemplateLiteral } from "../types/helpers.types.js";

import {
  DnaBigInt,
  DnaBoolean, DnaDate,
  DnaPipe, DnaString,
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
  DnaJwt,
  DnaHash,
  DnaEnum,
  DnaLazy,
  DnaInt32,
  DnaInt,
  Iso, DnaLiteral, DnaPromise,
  DnaProperty,
  DnaTemplateLiteral,
  DnaTmplLiteralMutate, DnaTuple, DnaUrl,
  DnaNumber,
  DnaStringBool,
  DnaRecord,
  DnaType,
  DnaTypeWithWrappers,
  DnaPrefault,
  DnaOptional,
  DnaNullable,
  DnaNullish,
  DnaCoerceString,
  DnaCoerceNumber,
  DnaCoerceBoolean,
  DnaCoerceBigInt,
  DnaCoerceDate,
  DnaAny,
  DnaUnknown,
  DnaCustom,
  DnaNever,
  DnaNull,
  DnaUndefined,
  DnaTransform,
  DnaInstanceOf,
  DnaFile,
  DnaSymbol,
  DnaVoid,
  DnaNaN,
  DnaUnion,
  DnaIntersection, DnaDiscriminatedUnion,
  DnaObject,
  DnaArray,
  DnaCodec,
  DnaFunction,
  type DnaJson,
  DnaNonOptional,
  type DnaJsonRaw
} from "./dna-interfaces.js";
import type { tsPrimitiveLiteral, tsTmplLitPart } from "../shared/base.types.js";

// DNA compatibility: error codes (from DNA error-types.ts)

export { DnaIssueCodes as IssueCodes };

export const any = () => initDna(DnaAny);
export const unknown = () => initDna(DnaUnknown);
export const never = (meta?: string | tsDnaMeta) => initDna(DnaNever, undefined, meta);
const _null = (meta?: string | tsDnaMeta) => initDna(DnaNull, undefined, meta);
const _undefined = (meta?: string | tsDnaMeta) => initDna(DnaUndefined, undefined, meta);


export const stringbool = (options?: string | { truthy?: string[]; falsy?: string[]; case?: "sensitive" | "insensitive"; error?: string; message?: string }, meta?: string | tsDnaMeta) => {
  let _meta, _opt;
  if (typeof options === "string") { _meta = options; _opt = {} }
  else { _opt = options, _meta = meta }
  return initDna(DnaStringBool, _opt, _meta);
}

/**
 * Template literal schema - combines string literals and schemas.
 * Uses `readonly [...PP]` to infer the tuple shape without forcing a `const` context
 * onto the parts. A `const` context would propagate into nested `literal(...)` calls
 * and cause them to be inferred as `DnaLiteral<any>` instead of `DnaLiteral<"a">`.
 * Validate-only (Zod-compatible): the matched value is returned UNCHANGED; any
 * inner transformations (`.toUpperCase()`, `.trim()`, ...) are ignored for output.
 * Use `templateLiteralMutate` to actually apply them. Alias: `tl`.
 */
export const templateLiteral = <PP extends readonly tsTmplLitPart[]>(parts: readonly [...PP], meta?: string | tsDnaMeta) =>
  initDna(DnaTemplateLiteral<$TemplateLiteral<PP>>, { parts }, meta);
/** Alias for {@link templateLiteral}. */
export const tl = templateLiteral;

/**
 * Mutating template literal schema: like {@link templateLiteral} but the inner
 * transformations ARE applied, so the parsed output reflects them. Alias: `tlm`.
 * Same `readonly [...PP]` tuple inference is used for the same reason.
 */
export const templateLiteralMutate = <PP extends readonly tsTmplLitPart[]>(parts: readonly [...PP], meta?: string | tsDnaMeta) =>
  initDna(DnaTmplLiteralMutate<$TemplateLiteral<PP>>, { parts }, meta);

/** Alias for {@link templateLiteralMutate}. */
export const tlm = templateLiteralMutate;

export const coerce = {
  string: (meta?: string | tsDnaMeta) => initDna(DnaCoerceString, undefined, meta),
  number: (meta?: string | tsDnaMeta) => initDna(DnaCoerceNumber, undefined, meta),
  boolean: (meta?: string | tsDnaMeta) => initDna(DnaCoerceBoolean, undefined, meta),
  bigint: (meta?: string | tsDnaMeta) => initDna(DnaCoerceBigInt, undefined, meta),
  date: (meta?: string | tsDnaMeta) => initDna(DnaCoerceDate, undefined, meta),
};

export const iso = {
  datetime: (options?: { local?: boolean; offset?: boolean; precision?: number; message?: string; error?: string; }) => Iso.datetime(options),
  date: (meta?: { message?: string; error?: string; }) => Iso.date(meta),
  time: (options?: { precision?: number | "minute", message?: string; error?: string; }) => Iso.time(options),
  duration: (meta?: string | tsDnaMeta) => Iso.duration(meta),
};

// NEVER EDIT THIS BLOCK
export const json = (meta?: string | tsDnaMeta): DnaJson => {
  // FORBIDDEN to cast to hide TS warning : if dna types are well defined, that requires NO CAST
  const jsonSchema = lazy((): DnaJsonRaw => {
    return union([
      string(meta),
      number(),
      boolean(),
      _null(),
      array(jsonSchema),
      record(string(), jsonSchema)
    ]);
  });
  return jsonSchema as DnaJson;
};

export const string = (meta?: string | tsDnaMeta) => initDna(DnaString, undefined, meta);

export const number = (meta?: string | tsDnaMeta) => initDna(DnaNumber, undefined, meta);

export const bigint = (meta?: string | tsDnaMeta) => initDna(DnaBigInt, undefined, meta);

export const int = (meta?: string | tsDnaMeta) => initDna(DnaInt, undefined, meta);

export const int32 = (meta?: string | tsDnaMeta) => initDna(DnaInt32, undefined, meta);

export const boolean = (meta?: string | tsDnaMeta) => initDna(DnaBoolean, undefined, meta);

export const date = (meta?: string | tsDnaMeta) => initDna(DnaDate, undefined, meta);

/**
 * Literal schema for a single primitive value or a union of primitive values.
 * `const T` preserves the literal type of the input (e.g. `"a"` stays `"a"`, not `string`).
 * `TT` flattens an array of literals into a union, so `literal(["a", "b"])` becomes
 * `DnaLiteral<"a" | "b">` and `literal("a")` becomes `DnaLiteral<"a">`.
 */
export const literal = <const T extends tsPrimitiveLiteral | tsPrimitiveLiteral[], TT = T extends tsPrimitiveLiteral[] ? T[number] : T>(value: T, meta?: string | tsDnaMeta) =>
  initDna(DnaLiteral<TT>, { value }, meta);

function _enum<const T extends tsDnaEnumInput>(values: T, error?: string | tsDnaMeta) {
  const enumObj: Record<string, tsDnaEnumValueType> = Array.isArray(values) ? values.reduce((acc, v) => { acc[v] = v; return acc }, {}) : values;
  return initDna(DnaEnum<T extends tsDnaEnumValues ? $ToEnum<T[number]> : T>, { enumObj }, error);
}

export const union = <S extends tsDnaTupleSchemaBase>(schemas: S, meta?: string | tsDnaMeta) =>
  initDna(DnaUnion<S>, { schemas }, meta);

export const intersection = <S1 extends DnaType<any>, S2 extends DnaType<any>>(schema1: S1, schema2: S2, meta?: string | tsDnaMeta) =>
  initDna(DnaIntersection, { schemas: [schema1, schema2] }, meta);

export const discriminatedUnion = <K extends string, S extends tsDnaDiscriminatedUnionObjects<K>>(discriminator: K, schemas: S, meta?: string | tsDnaMeta) =>
  initDna(DnaDiscriminatedUnion<K, S>, { discriminator, schemas }, meta);

export const record = <K extends DnaType<PropertyKey>, V extends DnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K, V>, { keySchema, valueSchema, type: "standard" }, meta);

export const partialRecord = <K extends DnaType<PropertyKey>, V extends DnaType<any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K, V>, { keySchema, valueSchema, type: "partial" }, meta);

export const looseRecord = <K extends DnaType<PropertyKey, any>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K, V>, { keySchema, valueSchema, type: "loose" }, meta);

// top-level format functions

export const email = (meta?: string | tsDnaMeta) => initDna(DnaEmail, undefined, meta);

export const url = (options?: { normalize?: boolean, protocol?: RegExp, hostname?: RegExp }, meta?: string | tsDnaMeta) => {
  // Always use UrlImpl for proper URL validation with new URL()
  // Options control normalize and constraints
  return initDna(DnaUrl, options, meta);
};

export const httpUrl = (meta?: string | tsDnaMeta) => initDna(DnaHttpUrl, undefined, meta);

export const _instanceof = <T extends abstract new (...args: any[]) => any, O = InstanceType<T>>(constructor: T, meta?: string | tsDnaMeta) =>
  initDna(DnaInstanceOf<T, O>, { constructor }, meta);
// withMeta(DnaGenericWrapped.init<O, O>("instanceOf", ["instanceOf", constructor.name]), meta);

export const symbol = (meta?: string | tsDnaMeta) => initDna(DnaSymbol, undefined, meta);

export const _void = (meta?: string | tsDnaMeta) => initDna(DnaVoid, undefined, meta);

export const nan = (meta?: string | tsDnaMeta) => initDna(DnaNaN, undefined, meta);

export const file = (meta?: string | tsDnaMeta) => initDna(DnaFile, undefined, meta);

/** @deprecated  */
export const promise = <T>(schema: DnaType<T>, meta?: string | tsDnaMeta) => initDna(DnaPromise, { inner: schema }, meta);

export const hostname = (meta?: string | tsDnaMeta) => initDna(DnaHostname, undefined, meta);

export const uuid = (meta?: string | tsDnaMeta) => initDna(DnaUUID, undefined, meta);

export const e164 = (meta?: string | tsDnaMeta) => initDna(DnaE164, undefined, meta);

export const emoji = (meta?: string | tsDnaMeta) => initDna(DnaEmoji, undefined, meta);

export const base64 = (meta?: string | tsDnaMeta) => initDna(DnaBase64, undefined, meta);

export const base64url = (meta?: string | tsDnaMeta) => initDna(DnaBase64Url, undefined, meta);

export const hex = (meta?: string | tsDnaMeta) => initDna(DnaHex, undefined, meta);

export const jwt = (options?: { alg?: string }, meta?: string | tsDnaMeta) => initDna(DnaJwt, { alg: options?.alg ?? null }, meta);

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

export function object<T extends Record<string, DnaType<any, any>>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'standard' }, meta);
}

export function strictObject<T extends Record<string, DnaType<any, any>>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'strict' }, meta);
}

export function looseObject<T extends Record<string, DnaType<any, any>>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'loose' }, meta);
}

export const property = <K extends string | number, S>(property: K, schema: DnaType<S>) => initDna(DnaProperty<K>, { property, schema });

export const array = <T extends DnaType<any, any>>(item: T, meta?: string | tsDnaMeta) => initDna(DnaArray<T>, { min: null, max: null, length: null, itemSchema: item }, meta);

export const tuple = <S extends tsDnaTupleSchemaRO, R = never>(items: S, rest?: DnaType<R>, meta?: string | tsDnaMeta) =>
  initDna(DnaTuple, { items, rest }, meta);


export const codec = <In extends DnaType<any, any>, Out extends DnaType<any, any>>(
  inSchema: In,
  outSchema: Out,
  options: { decode: tsDecodeFn<$Output<In>, $Output<Out>>, encode: tsEncodeFn<$Output<Out>, $Output<In>>, externals?: tsDnaExternalsDecl },
  meta?: string | tsDnaMeta
) => {
  return initDna(DnaCodec<In, Out>, {
    decodeTwin: inSchema.transform(options.decode, options.externals).pipe(outSchema),
    encodeTwin: outSchema.transform(options.encode, options.externals).pipe(inSchema),
  }, meta);
};


const function_ = <I extends DnaFunctionInput = never, O = unknown>(opts?: DnaFunctionOptions<I, O>) => {
  const input = opts?.input ?? [];
  const output = opts?.output ?? initDna(DnaUnknown);
  return initDna(DnaFunction<I, O>, { input, output });
};
/** Alias for {@link function_}. */
export { function_ as function };


export const transform = <T, R>(fn: tsTransformFn<T, R>, meta?: string | tsDnaMeta) =>
  initDna(DnaTransform<T,R>, { fnStr: fn.toString().trim(), arity: fn.length }, meta);

export const pipe = <T, U>(src: DnaType<T>, target: DnaType<U, T>, meta?: string | tsDnaMeta) => initDna(DnaPipe<T,U>, { steps: [src, target] }, meta);

export const preprocess = <O>(fn: (value: unknown) => O, target: DnaType<O, O>, meta?: string | tsDnaMeta) => {
  const innerMeta: tsDnaInnerMeta = { preprocess: true };
  if (typeof meta === "string") innerMeta.message = meta;
  else if (meta) Object.assign(innerMeta, meta);
  return initDna(DnaPipe<O, unknown>, { steps: [transform(fn), target] }, innerMeta);
};

export const lazy = <S extends DnaType<any, any>>(getter: () => S) => initDna(DnaLazy<S>, { getter });


export const custom = <T>(fn: (val: any) => boolean, params?: any) => initDna(DnaCustom<T>, { fn }, params) // FIXME : params
// {
//   const impl = any().refine(fn, params);
//   return impl;
// };

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

export const prefault = <S extends DnaTypeWithWrappers<any, any>>(schema: S, value: $Input<S>): DnaPrefault<S> => {
  return schema.prefault(value);
};

export const optional = <S extends DnaTypeWithWrappers<any, any>>(schema: S): DnaOptional<S> => {
  return schema.optional();
};

export const nonoptional = <S extends DnaTypeWithWrappers<any, any>>(schema: S): DnaNonOptional<S> => {
  return schema.nonoptional();
};

export const nullable = <S extends DnaTypeWithWrappers<any, any>>(schema: S): DnaNullable<S> => {
  return schema.nullable();
};

export const nullish = <S extends DnaTypeWithWrappers<any, any>>(schema: S): DnaNullish<S> => {
  return schema.nullish();
};

export {
  _enum as enum, _instanceof as instanceof, _null as null, _void as void, _undefined as undefined
};


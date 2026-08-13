// ============================================
// Helper wrapper for meta parameter

import { DnaIssueCodes } from "@ytrynot/dna/core";
import type { tsDecodeFn, tsEncodeFn, tsTransformFn } from "../shared/handlers-builder.types.js";
import type { tsDnaRefineCtx, tsDnaInnerMeta, tsDnaMeta } from "../shared/meta-context.type.js";
import type { tsDnaExternalsDecl } from "../shared/runtime.types.js";
import { initDna } from "@ytrynot/dna/core";

import type {
  tsDnaDescribeCheck,
  tsDnaEnumInput,
  tsDnaEnumValues,
  tsDnaEnumValueType,
  tsDnaMetaCheck,
  tsDnaValidationCheck,
  tsDnaTupleSchemaBase,
  tsDnaTupleSchemaRO,
  DnaFunctionInput,
  DnaFunctionOptions,
  tsDnaDiscriminatedUnionObjects,
  tsDnaCliUnionObjects,
  ICliUnionConfig,
} from "../types/api-builder.types.js";
import type { $ToEnum, $Input, $Output, $ArrayItem, $TemplateLiteral, $DnaObjectOutput, $DnaObjectInput } from "../types/helpers.types.js";
import type { DnaSomeType } from "@ytrynot/dna/core";

import {
  DnaBigInt,
  DnaBoolean, DnaDate,
  DnaPipe, DnaString,
  DnaEmail,
  DnaHttpUrl,
  DnaHostname,
  DnaUUID,
  DnaGuid,
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
  DnaCheckProperty,
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
  DnaCoerceInt,
  DnaCoerceInt32,
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
  DnaXorUnion,
  DnaIntersection, DnaDiscriminatedUnion, DnaCliUnion,
  DnaObject,
  DnaArray,
  DnaCodec,
  externalsMap,
  DnaFunction,
  type DnaJson,
  DnaNonOptional,
  type DnaJsonRaw,
} from "@ytrynot/dna/core";
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

export const string = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceString, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaString, undefined, params);
};

export const number = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceNumber, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaNumber, undefined, params);
};

export const bigint = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceBigInt, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaBigInt, undefined, params);
};

export const int = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceInt, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaInt, undefined, params);
};

export const int32 = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceInt32, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaInt32, undefined, params);
};

export const boolean = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceBoolean, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaBoolean, undefined, params);
};

export const date = (params?: string | ({ coerce?: true } & tsDnaMeta)) => {
  if (params && typeof params === "object" && params.coerce) {
    const { coerce: _, ...meta } = params;
    return initDna(DnaCoerceDate, undefined, Object.keys(meta).length ? meta : undefined);
  }
  return initDna(DnaDate, undefined, params);
};

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

export const union = <S extends tsDnaTupleSchemaRO>(schemas: S, meta?: string | tsDnaMeta) =>
  initDna(DnaUnion<S>, { schemas }, meta);

export const xor = <T extends DnaType<any, any>, U extends DnaType<any, any>>(schemas: readonly [T, U], meta?: string | tsDnaMeta) =>
  initDna(DnaXorUnion<$Output<T>, $Output<U>>, { schemas: [...schemas] }, meta);

export const intersection = <S1 extends DnaType<any>, S2 extends DnaType<any>>(schema1: S1, schema2: S2, meta?: string | tsDnaMeta) =>
  initDna(DnaIntersection, { schemas: [schema1, schema2] }, meta);

export const discriminatedUnion = <K extends string, S extends tsDnaDiscriminatedUnionObjects<K>>(discriminator: K, schemas: S, meta?: string | tsDnaMeta) =>
  initDna(DnaDiscriminatedUnion<K, S>, { discriminator, schemas }, meta);

export const cliUnion = <S extends tsDnaCliUnionObjects>(
  schemas: S,
  config?: ICliUnionConfig,
  meta?: string | tsDnaMeta
) => {
  const discriminators = config?.discriminators ?? DnaCliUnion.detectDiscriminators(schemas);
  const positionals = config?.positionals ?? DnaCliUnion.detectPositionals(schemas, discriminators);
  return initDna(
    DnaCliUnion<S>,
    { schemas: [...schemas], discriminators, positionals },
    meta
  );
};

export const record = <K extends DnaType<any, any>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K, V>, { keySchema, valueSchema, type: "standard" }, meta);

export const partialRecord = <K extends DnaType<any, any>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
  initDna(DnaRecord<K, V>, { keySchema, valueSchema, type: "partial" }, meta);

export const looseRecord = <K extends DnaType<any, any>, V extends DnaType<any, any>>(keySchema: K, valueSchema: V, meta?: string | tsDnaMeta) =>
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
export const promise = <T, I = T>(schema: DnaSomeType<T, I>, meta?: string | tsDnaMeta) => initDna(DnaPromise<T, I>, { inner: schema }, meta);

export const hostname = (meta?: string | tsDnaMeta) => initDna(DnaHostname, undefined, meta);

export const uuid = (meta?: string | tsDnaMeta) => initDna(DnaUUID, undefined, meta);

export const guid = (meta?: string | tsDnaMeta) => initDna(DnaGuid, undefined, meta);

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

export function object<T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'standard' }, meta);
}

export function strictObject<T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'strict' }, meta);
}

export function looseObject<T extends Record<string, any>>(shape: T, meta?: string | tsDnaMeta) {
  return initDna(DnaObject<T>, { propertySchemas: shape, addPropSchema: undefined, objType: 'loose' }, meta);
}

export const property = <K extends string | number, S>(property: K, schema: DnaType<S>) => initDna(DnaCheckProperty<K>, { property, schema });

export const array = <T extends DnaSomeType>(item: T, meta?: string | tsDnaMeta) => initDna(DnaArray<T>, { min: null, max: null, length: null, itemSchema: item }, meta);

export const tuple = <S extends tsDnaTupleSchemaRO, R extends DnaType<any, any> | never = never>(items: S, rest?: R, meta?: string | tsDnaMeta) =>
  initDna(DnaTuple<S, R>, { items, rest }, meta);


export const codec = <In extends DnaType<any, any>, Out extends DnaType<any, any>>(
  inSchema: In,
  outSchema: Out,
  options: { decode: tsDecodeFn<$Output<In>, $Output<Out>>, encode: tsEncodeFn<$Output<Out>, $Output<In>>, externals?: tsDnaExternalsDecl },
  meta?: string | tsDnaMeta
) => {
  const extMap = externalsMap(options.externals);
  if (typeof options.decode === "function" && /\bdna\b/.test(options.decode.toString())) extMap.dna = "dna";
  if (typeof options.encode === "function" && /\bdna\b/.test(options.encode.toString())) extMap.dna = "dna";
  const externals = Object.keys(extMap).length ? extMap : undefined;
  return initDna(DnaCodec<$Output<In>, $Output<Out>>, {
    decodeTwin: inSchema.transform(options.decode, externals).pipe(outSchema),
    encodeTwin: outSchema.transform(options.encode, externals).pipe(inSchema),
  }, meta);
};


const function_ = <I extends DnaFunctionInput = never, O extends DnaType<any> = DnaType<unknown>>(opts?: DnaFunctionOptions<I, O>) => {
  const input = opts?.input ?? initDna(DnaTuple, { items: [], rest: initDna(DnaUnknown) });
  const output = opts?.output ?? initDna(DnaUnknown);
  return initDna(DnaFunction<I, O>, { input, output });
};
/** Alias for {@link function_}. */
export { function_ as function };


export const transform = <T, R>(fn: tsTransformFn<T, R>, meta?: string | tsDnaMeta) =>
  initDna(DnaTransform<T,R>, { fnStr: fn.toString().trim(), arity: fn.length }, meta);

export const pipe = <S extends DnaType<any, any> = DnaType<any, any>, T extends DnaType<any, any> = DnaType<any, any>>(src: S, target: T, meta?: string | tsDnaMeta) => initDna(DnaPipe<S, T>, { steps: [src, target] }, meta);

export function preprocess<O>(fn: (value: unknown, ctx: tsDnaRefineCtx<unknown>) => unknown, target: DnaType<O, any>, externals?: tsDnaExternalsDecl, meta?: string | tsDnaMeta): DnaType<O, unknown>;
export function preprocess<O>(fn: (value: unknown) => unknown, target: DnaType<O, any>, externals?: tsDnaExternalsDecl, meta?: string | tsDnaMeta): DnaType<O, unknown>;
export function preprocess<O>(fn: tsTransformFn<unknown, unknown>, target: DnaType<O, any>, externals?: tsDnaExternalsDecl, meta?: string | tsDnaMeta): DnaType<O, unknown> {
  const innerMeta: tsDnaInnerMeta = { preprocess: true };
  if (typeof meta === "string") innerMeta.message = meta;
  else if (meta) Object.assign(innerMeta, meta);
  const map = externalsMap(externals);
  const transformMeta: tsDnaInnerMeta | undefined = Object.keys(map).length ? { externals: map } : undefined;
  const transformSchema = initDna(DnaTransform<unknown, unknown>, { fnStr: fn.toString().trim(), arity: fn.length }, transformMeta);
  return initDna(DnaPipe<DnaTransform<unknown, unknown>, DnaType<O, any>>, { steps: [transformSchema, target] }, innerMeta);
}

export const lazy = <S extends DnaType<any, any>>(getter: () => S) => initDna(DnaLazy<$Output<S>, $Input<S>, S>, { getter });


export function custom<T>(fn: (val: any) => val is T, params?: any): DnaCustom<T, any>;
export function custom<T>(fn: (val: any) => boolean, params?: any): DnaCustom<T, any>;
export function custom<T>(fn: (val: any) => any, params?: any): DnaCustom<T, any> {
  return initDna(DnaCustom<T>, { fn }).refine(fn as (value: T) => boolean, params);
}

// Top-level check functions (Zod V4 style)
export const describe = (description: string): tsDnaDescribeCheck => ({
  kind: "describe",
  description,
});


export const meta = (meta: tsDnaMeta): tsDnaMetaCheck => ({
  kind: "meta",
  meta,
});

/** Top-level refine: returns a reusable validation check (Zod v4 `z.refine()` parity).
 *  The function receives the value and returns a boolean (falsy = failure).
 *  The body is wrapped with `ctx.addIssue()` on failure, matching `.refine()`.
 *  Pass the result to `.check()`. */
export const refine = (fn: (arg: unknown) => unknown, options?: string | { error?: string; path?: PropertyKey[] }): tsDnaValidationCheck => {
  const errorMessage = typeof options === "string" ? options : (options?.error ?? "Invalid");
  const errorPath = typeof options === "string" ? [] : (options?.path ?? []);
  const fnStr = fn.toString().trim();
  const callArgs = fn.length === 2 ? "value,ctx" : "value";
  const issue = "{code:'custom',message:" + JSON.stringify(errorMessage) + ",path:" + JSON.stringify(errorPath) + ",input:value}";
  const body = "function(value,ctx){var ret=(" + fnStr + ")(" + callArgs + ");if(!ret)ctx.addIssue(" + issue + ");}";
  return { kind: "validation", check: ["func", body, 2] };
};

/** Top-level check: returns a reusable low-level validation check (Zod v4 `z.check()` parity).
 *  The function receives `(value, ctx)` and pushes issues manually via `ctx.addIssue()`.
 *  This is the low-level API — prefer {@link refine} for simple boolean checks.
 *  Pass the result to `.check()`. */
export const check = (fn: (value: unknown, ctx: { addIssue: (issue: { code: string; message: string; path?: PropertyKey[]; input?: unknown }) => void }) => void): tsDnaValidationCheck => {
  return { kind: "validation", check: ["func", fn.toString().trim(), fn.length] };
};


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

export const prefault = <S extends DnaTypeWithWrappers<any, any>>(schema: S, value: $Input<S>) => {
  return schema.prefault(value);
};

export const optional = <S extends DnaTypeWithWrappers<any, any>>(schema: S) => {
  return schema.optional();
};

export const nonoptional = <S extends DnaTypeWithWrappers<any, any>>(schema: S) => {
  return schema.nonoptional();
};

export const nullable = <S extends DnaTypeWithWrappers<any, any>>(schema: S) => {
  return schema.nullable();
};

export const nullish = <S extends DnaTypeWithWrappers<any, any>>(schema: S) => {
  return schema.nullish();
};

export {
  _enum as enum, _instanceof as instanceof, _null as null, _void as void, _undefined as undefined
};


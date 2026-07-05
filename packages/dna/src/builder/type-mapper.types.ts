import type {
  AllOfImpl,
  ArrayImpl,
  BigIntImpl,
  BooleanImpl,
  CodecImpl,
  CombinatorImpl,
  DateImpl,
  DiscriminatorImpl,
  EnumImpl,
  GetterSchemaImpl,
  Int32Impl,
  IntImpl,
  IntersectionImpl,
  LiteralImpl,
  MutateImpl,
  NumberImpl,
  ObjectImpl,
  PromiseImpl,
  PropCheckImpl,
  RecordImpl,
  SchemaImpl,
  SeqSchemaImpl,
  StringBoolImpl,
  StringImpl,
  TemplateLiteralImpl,
  TemplateLiteralMutateImpl,
  TupleImpl,
  UnionImpl,
  UrlImpl,
  WrapperImpl,
  XorImpl
} from "./core.js"
import type {
  FunctionImpl,
  MapImpl,
  SetImpl
} from "./api-enhanced.js"
import type {
  tsStateArray,
  tsStateBoolean,
  tsStateCodec,
  tsStateCombinator,
  tsStateDate,
  tsStateDiscriminator,
  tsStateEnum,
  tsStateFunction,
  tsStateGetter,
  tsStateLiteral,
  tsStateMap,
  tsStateNumber,
  tsStateObject,
  tsStatePromise,
  tsStatePropCheck,
  tsStateRecord,
  tsStateSeq,
  tsStateSet,
  tsStateString,
  tsStateStringBool,
  tsStateTuple,
  tsStateUrl,
  tsStateWrp
} from "./state.types.js"
import type {
  tsDnaAny,
  tsDnaArray,
  tsDnaBigInt,
  tsDnaBoolean,
  tsDnaCatch,
  tsDnaCodec,
  tsDnaCoerceBigInt,
  tsDnaCoerceBoolean,
  tsDnaCoerceDate,
  tsDnaCoerceInteger,
  tsDnaCoerceInteger32,
  tsDnaCoerceNumber,
  tsDnaCoerceString,
  tsDnaCustom,
  tsDnaDate,
  tsDnaDefault,
  tsDnaDiscriminatedUnion,
  tsDnaEmail,
  tsDnaEnum,
  tsDnaFunction,
  tsDnaHex,
  tsDnaHostname,
  tsDnaInstanceOf,
  tsDnaIntersection,
  tsDnaInteger,
  tsDnaInteger32,
  tsDnaISODate,
  tsDnaISODateTime,
  tsDnaISODuration,
  tsDnaISOTime,
  tsDnaJson,
  tsDnaLazy,
  tsDnaLiteral,
  tsDnaMap,
  tsDnaMutate,
  tsDnaNaN,
  tsDnaNever,
  tsDnaNonOptional,
  tsDnaNull,
  tsDnaNullable,
  tsDnaNullish,
  tsDnaNumber,
  tsDnaObject,
  tsDnaOptional,
  tsDnaPipe,
  tsDnaPrefault,
  tsDnaPromise,
  tsDnaPropertyCheck,
  tsDnaRecord,
  tsDnaSet,
  tsDnaString,
  tsDnaSymbol,
  tsDnaTemplateLiteral,
  tsDnaTemplateLiteralMutate,
  tsDnaTmplLit,
  tsDnaTuple,
  tsDnaUndefined,
  tsDnaUnion,
  tsDnaUnknown,
  tsDnaUrl,
  tsDnaUUID,
  tsDnaVoid,
  tsDnaXorUnion
} from "../types/api-builder.types.js"
import type { tsDnaType, $DnaInfer } from "../shared/base.types.js";

export type $toAPIClass<C extends SchemaImpl<any, any, any>> =
  C extends SchemaImpl<infer T, infer I, infer S> ? (
    S extends tsStateDef ? (
      S extends { type: "string" } ? (
        S extends { coerce: true } ? tsDnaCoerceString
        : S extends { format: "email" } ? tsDnaEmail
        : S extends { format: "uuid" } ? tsDnaUUID
        : S extends { format: "hostname" } ? tsDnaHostname
        : S extends { format: "base64" } ? tsDnaBase64
        : S extends { format: "hex" } ? tsDnaHex
        : S extends { format: "iso-datetime" } ? tsDnaISODateTime
        : S extends { format: "iso-date" } ? tsDnaISODate
        : S extends { format: "iso-time" } ? tsDnaISOTime
        : S extends { format: "iso-duration" } ? tsDnaISODuration
        : tsDnaString
      )
      : S extends { type: "n" } ? (
        S extends { coerce: true } ? tsDnaCoerceNumber
        : tsDnaNumber
      )
      : S extends { type: "b" } ? (
        S extends { coerce: true } ? tsDnaCoerceBoolean
        : tsDnaBoolean
      )
      : S extends { type: "date" } ? (
        S extends { coerce: true } ? tsDnaCoerceDate
        : tsDnaDate
      )
      : S extends { type: "url" } ? tsDnaUrl
      : S extends { type: "literal" } ? tsDnaLiteral<T>
      : S extends { type: "enum" } ? tsDnaEnum<T>
      : S extends { type: "array" } ? tsDnaArray<T>
      : S extends { type: "tuple" } ? tsDnaTuple<T, I>
      : S extends { type: "object" } ? tsDnaObject<T, I>
      : S extends { type: "map" } ? tsDnaMap<T, I>
      : S extends { type: "set" } ? tsDnaSet<T>
      : S extends { type: "record" } ? tsDnaRecord<T, I>
      : S extends { type: "promise" } ? tsDnaPromise<T>
      : S extends { type: "function" } ? tsDnaFunction<T, I>
      : S extends { type: "codec" } ? tsDnaCodec<T, I>
      : S extends { type: "anyOf" } ? tsDnaUnion
      : S extends { type: "allOf" } ? tsDnaIntersection
      : S extends { type: "oneOf" } ? tsDnaXorUnion<$DnaInfer<T>>
      : S extends { type: "discriminator" } ? tsDnaDiscriminatedUnion
      : S extends { type: "lazy" } ? tsDnaLazy
      : S extends { type: "property" } ? tsDnaPropertyCheck<T, I>
      : S extends { type: "seq" } ? tsDnaPipe<T, I>
      : S extends { type: "mutate" } ? tsDnaMutate<T, I>
      : S extends { type: "wrp" } ? (
        S extends { wrapperType: "optional" } ? tsDnaOptional<T, I>
        : S extends { wrapperType: "nullable" } ? tsDnaNullable<T, I>
        : S extends { wrapperType: "nullish" } ? tsDnaNullish<T, I>
        : S extends { wrapperType: "default" } ? tsDnaDefault<T, I>
        : S extends { wrapperType: "prefault" } ? tsDnaPrefault<T, I>
        : S extends { wrapperType: "catch" } ? tsDnaCatch<T, I, S extends { value: infer V } ? V : unknown>
        : tsDnaType<T, I>
      )
      : S extends { type: "any" } ? tsDnaAny
      : S extends { type: "unknown" } ? tsDnaUnknown
      : T extends symbol ? tsDnaSymbol
      : T extends typeof NaN ? tsDnaNaN
      : T extends void ? tsDnaVoid
      : T extends null ? tsDnaNull
      : T extends undefined ? tsDnaUndefined
      : T extends never ? tsDnaNever
      : tsDnaType<T, I, S>
    )
    : tsDnaType<T, I, S>
  )
  : tsDnaType;


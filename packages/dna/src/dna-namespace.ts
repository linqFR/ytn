/**
 * DNA Namespace - Type definitions for declaration merging
 * Allows dna.tsDnaString, dna.infer<typeof schema> to work
 */

import type { $Input, $InputHead, $Output } from "./types/helpers.types.js";

// Re-export everything from api (this creates the dna namespace)
export * from "../src/builder/api-enhanced.js";
export * from "../src/builder/api-primitives.js";

// Re-export all DNA schema classes as types (Zod v4 parity: $ZodTypes)
export type {
  DnaAny,
  DnaArray,
  DnaBase64,
  DnaBase64Url,
  DnaBigInt,
  DnaBoolean,
  DnaCatch,
  DnaCheckProperty,
  DnaCidrv4,
  DnaCidrv6,
  DnaCliUnion,
  DnaCodec,
  DnaMarangetUnion,
  DnaCoerceBigInt,
  DnaCoerceBoolean,
  DnaCoerceDate,
  DnaCoerceInt,
  DnaCoerceInt32,
  DnaCoerceNumber,
  DnaCoerceString,
  DnaCuid,
  DnaCuid2,
  DnaCustom,
  DnaDate,
  DnaDefault,
  DnaDiscriminatedUnion,
  DnaE164,
  DnaEmail,
  DnaEmoji,
  DnaEnum,
  DnaExactOptional,
  DnaFile,
  DnaFunction,
  DnaGuid,
  DnaHash,
  DnaHex,
  DnaHostname,
  DnaHttpUrl,
  DnaInstanceOf,
  DnaInt,
  DnaInt32,
  DnaIntersection,
  DnaIpv4,
  DnaIpv6,
  DnaIsoDate,
  DnaIsoDatetime,
  DnaIsoDuration,
  DnaIsoTime,
  DnaIssue,
  DnaIssueCode,
  DnaJson,
  // DnaJsonValue,
  DnaJwt,
  DnaKsuid,
  DnaLazy,
  DnaLiteral,
  DnaMac,
  DnaNaN,
  DnaNanoId,
  DnaNever,
  DnaNonOptional,
  DnaNull,
  DnaNullable,
  DnaNullish,
  DnaNumber,
  DnaObject,
  DnaOptional,
  DnaPipe,
  DnaPrefault,
  DnaPromise,
  DnaRawIssue,
  DnaRecord,
  DnaSomeType,
  DnaString,
  DnaStringBool,
  DnaSymbol,
  DnaTemplateLiteral,
  DnaTmplLiteralMutate,
  DnaTransform,
  DnaTuple,
  DnaType,
  DnaTypeWithWrappers,
  DnaUlid,
  DnaUndefined,
  DnaUnion,
  DnaUnknown,
  DnaUrl,
  DnaUUID,
  DnaVoid,
  DnaXid,
  DnaXorUnion
} from "@ytrynot/dna/core";

// Utility exports
export * as util from "./builder/util.js";

// Type exports
// export type * from "./types/api-builder.types.js";
// export type * as ts from "./types/api-builder.types.js";
export type { DnaFunctionOptions } from "./types/api-builder.types.js";
export type { tsDna, tsDnaOpcode as tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";
export type { output as infer };



export type output<S> = $Output<S>;

export type input<S> = $Input<S>;
export type inputHead<S> = $InputHead<S>;

// Constructor registry for instanceof validation
export {
  getExternal as getConstructor, registerExternal as registerConstructor
} from "@ytrynot/dna/core";


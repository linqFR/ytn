/**
 * DNA Namespace - Type definitions for declaration merging
 * Allows dna.tsDnaString, dna.infer<typeof schema> to work
 */

import type { DnaType } from "@ytrynot/dna/core";
import type { $Input, $InputHead, $Output } from "./types/helpers.types.js";



// Re-export everything from api (this creates the dna namespace)
export * from "../src/builder/api-primitives.js";
export * from "../src/builder/api-enhanced.js"

// Re-export all DNA schema classes as types (Zod v4 parity: $ZodTypes)
export type {
  DnaType,
  DnaTypeWithWrappers,
  DnaAny,
  DnaUnknown,
  DnaNever,
  DnaNull,
  DnaUndefined,
  DnaSymbol,
  DnaVoid,
  DnaNaN,
  DnaUnion,
  DnaIntersection,
  DnaXorUnion,
  DnaTransform,
  DnaOptional,
  DnaExactOptional,
  DnaNonOptional,
  DnaNullable,
  DnaNullish,
  DnaDefault,
  DnaPrefault,
  DnaCatch,
  DnaLiteral,
  DnaString,
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
  DnaTmplLiteralMutate,
  DnaTemplateLiteral,
  DnaPipe,
  DnaStringBool,
  DnaIsoDatetime,
  DnaIsoDate,
  DnaIsoTime,
  DnaIsoDuration,
  DnaDate,
  DnaUrl,
  DnaBoolean,
  DnaNumber,
  DnaBigInt,
  DnaInt,
  DnaInt32,
  DnaCoerceString,
  DnaCoerceNumber,
  DnaCoerceInt,
  DnaCoerceInt32,
  DnaCoerceBigInt,
  DnaCoerceBoolean,
  DnaCoerceDate,
  DnaEnum,
  DnaArray,
  DnaPromise,
  DnaTuple,
  DnaObject,
  DnaDiscriminatedUnion,
  DnaRecord,
  DnaCodec,
  DnaLazy,
  DnaFunction,
  DnaCustom,
  DnaInstanceOf,
  DnaFile,
  DnaCheckProperty,
  DnaSomeType,
  DnaJson,
  tsJsonValue,
} from "@ytrynot/dna/core";

// Utility exports
export * as util from "./builder/util.js"

// Type exports
// export type * from "./types/api-builder.types.js";
// export type * as ts from "./types/api-builder.types.js";
export type { tsDna, tsDnaOpcode as tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";
export type { DnaFunctionOptions } from "./types/api-builder.types.js";



export type output<S> = $Output<S>;
export type { output as infer };

export type input<S> = $Input<S>;
export type inputHead<S> = $InputHead<S>;

// Constructor registry for instanceof validation
export {
  registerExternal as registerConstructor,
  getExternal as getConstructor,
} from "@ytrynot/dna/core";


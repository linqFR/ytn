/**
 * String format regex patterns
 * These patterns are extracted from Zod's toJSONSchema() output for each format validator.
 * Also includes JSON Schema Draft 2020-12 defined formats.
 */

const ISO_HOUR = "(?:[01]\\d|2[0-3])";
const ISO_MINUTE = "[0-5]\\d";
const ISO_SECOND = "[0-5]\\d";
const ISO_TIME_PART = `${ISO_HOUR}:${ISO_MINUTE}(?::${ISO_SECOND}(?:\\.\\d+)?)?`;
const ISO_DATE_PART = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";

export const STRING_FORMAT_PATTERNS: Record<string,string> = {
  // Zod-specific formats
  email: "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
  url: "^(?:[a-z][a-z0-9+\\-.]*:)(?:\\/?\\/)?[^\\s]*$", // URIs (RFC 3986) - fast mode pattern from ajv-formats
  httpUrl: "^https?:\\/\\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(?::\\d+)?(?:\\/[^\\s]*)?$", // HTTP/HTTPS URLs with domain validation
  hostname: "^(?=.{1,253}\\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\\.?$",
  domain: "^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$", // Used by httpUrl for hostname validation
  uuid: "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
  guid: "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$",

  e164: "^\\+[1-9]\\d{6,14}$",
  emoji: "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",
  base64: "^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$",
  base64url: "^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$",
  hex: "^[0-9a-fA-F]*$",
  // jwt: undefined, // Uses format: 'jwt' in JSON Schema
  nanoid: "^[a-zA-Z0-9_-]{21}$",
  cuid: "^[cC][0-9a-z]{6,}$",
  cuid2: "^[0-9a-z]+$",
  ulid: "^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$",
  xid: "^[0-9a-vA-V]{20}$",
  ksuid: "^[A-Za-z0-9]{27}$",
  ipv4: "^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$",
  ipv6: "^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$",
  mac: "^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$",
  cidrv4: "^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\\/([0-9]|[1-2][0-9]|3[0-2])$",
  cidrv6: "^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$",
  "hash:sha1": "^[0-9a-fA-F]{40}$",
  "hash:sha256": "^[0-9a-fA-F]{64}$",
  "hash:sha384": "^[0-9a-fA-F]{96}$",
  "hash:sha512": "^[0-9a-fA-F]{128}$",
  "hash:md5": "^[0-9a-fA-F]{32}$",

  // JSON Schema Draft 2020-12 formats
  "idn-email": "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$", // Internationalized email addresses (RFC 6531) - simplified pattern
  "idn-hostname": "^(?=.{1,253}\\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\\.?$", // Internationalized hostnames (RFC 5891) - simplified pattern
  uri: "^(?:[a-z][a-z0-9+\\-.]*:)(?:\\/?\\/)?[^\\s]*$", // URIs (RFC 3986) - fast mode pattern from ajv-formats
  iri: "^(?:[a-z][a-z0-9+\\-.]*:)(?:\\/?\\/)?[^\\s]*$", // Internationalized Resource Identifiers (RFC 3987) - same as URI for now
  "uri-reference": "^(?:(?:[a-z][a-z0-9+\\-.]*:)?\\/?\\/)?(?:[^\\\\\\s#][^\\s#]*)?(?:#[^\\\\\\s]*)?$", // URI references (RFC 3986) - fast mode pattern from ajv-formats
  "iri-reference": "^(?:(?:[a-z][a-z0-9+\\-.]*:)?\\/?\\/)?(?:[^\\\\\\s#][^\\s#]*)?(?:#[^\\\\\\s]*)?$", // IRI references (RFC 3987) - same as uri-reference for now
  // "uri-template": undefined, // URI Templates (RFC 6570) - complex pattern, better to use library validation
  "json-pointer": "^(?:\\/(?:[^~\\/]|~0|~1)*)*$", // JSON Pointers (RFC 6901) - pattern from ajv-formats
  "relative-json-pointer": "^(?:0|[1-9][0-9]*)(?:#|(?:\\/(?:[^~\\/]|~0|~1)*)*)$", // Relative JSON Pointers - pattern from ajv-formats
  // regex: undefined, // Regular expressions (ECMA-262) - requires actual RegExp validation
  "date-time": `^${ISO_DATE_PART}T(?:${ISO_TIME_PART}(?:Z))$`, // Date and time (RFC 3339) - used by dna.iso.datetime
  date: `^${ISO_DATE_PART}$`, // Full date (RFC 3339) - used by dna.iso.date
  time: `^${ISO_TIME_PART}$`, // Full time (RFC 3339) - used by dna.iso.time
  duration: "^P(?:(\\d+W)|(?!.*W)(?=\\d|T\\d)(\\d+Y)?(\\d+M)?(\\d+D)?(T(?=\\d)(\\d+H)?(\\d+M)?(\\d+([.,]\\d+)?S)?)?)$", // Duration (ISO 8601) - used by dna.iso.duration
} as const;

export type tsStringFormat = keyof typeof STRING_FORMAT_PATTERNS;

/**
 * Escape special regex characters in a string and return a source valid for
 * a regex literal. Uses `new RegExp(...).source` so the engine itself handles
 * escaping of delimiters like '/'.
 * Note: { } ( ) are NOT escaped as they don't need escaping in regex literals
 */
export function escReg(str: string): string {
  const escaped = str.replace(/[.*+?^$|[\]\\]/g, '\\$&');
  return new RegExp(escaped).source;
}

export function getStringFormatPattern(format: string): string | undefined {
  if (format.startsWith("date-time")) return buildIsoDatetimePattern(format);
  if (format.startsWith("time")) return buildIsoTimePattern(format);
  return STRING_FORMAT_PATTERNS[format as tsStringFormat];
}

function buildIsoDatetimePattern(format: string): string {
  const [base, precisionStr] = format.split("-precision-");
  const hasLocal = base.includes("-local");
  const hasOffset = base.includes("-offset");
  const precision = precisionStr === undefined ? undefined : parseInt(precisionStr, 10);

  const datePart = ISO_DATE_PART;
  const hour = ISO_HOUR;
  const minute = ISO_MINUTE;
  const second = ISO_SECOND;

  let timePart: string;
  if (precision === undefined || Number.isNaN(precision)) {
    timePart = hour + ":" + minute + "(?::" + second + "(?:\\.\\d+)?)?";
  } else if (precision < 0) {
    timePart = hour + ":" + minute;
  } else if (precision === 0) {
    timePart = hour + ":" + minute + ":" + second;
  } else {
    timePart = hour + ":" + minute + ":" + second + "\\.\\d{" + precision + "}";
  }

  let tzPart: string;
  if (hasLocal && hasOffset) tzPart = "(?:(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d))?";
  else if (hasLocal) tzPart = "(Z)?";
  else if (hasOffset) tzPart = "(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)";
  else tzPart = "(?:Z)";

  return "^" + datePart + "T" + timePart + tzPart + "$";
}

function buildIsoTimePattern(format: string): string {
  const [, precisionStr] = format.split("-precision-");
  const precision: number | "minute" | undefined = precisionStr === undefined ? undefined : precisionStr === "minute" ? "minute" : parseInt(precisionStr, 10);

  const hour = ISO_HOUR;
  const minute = ISO_MINUTE;
  const second = ISO_SECOND;

  let timePart: string;
  if (precision === "minute" || (typeof precision === "number" && precision < 0)) {
    timePart = hour + ":" + minute;
  } else if (precision === undefined || Number.isNaN(precision)) {
    timePart = hour + ":" + minute + "(?::" + second + "(?:\\.\\d+)?)?";
  } else if (precision === 0) {
    timePart = hour + ":" + minute + ":" + second;
  } else {
    timePart = hour + ":" + minute + ":" + second + "\\.\\d{" + precision + "}";
  }

  return "^" + timePart + "$";
}


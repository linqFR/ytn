/**
 * String format regex patterns
 * These patterns are extracted from Zod's toJSONSchema() output for each format validator.
 * Also includes JSON Schema Draft 2020-12 defined formats.
 */

export const STRING_FORMAT_PATTERNS: Record<string,string> = {
  // Zod-specific formats
  email: "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
  url: "^(?:[a-z][a-z0-9+\\-.]*:)(?:\\/?\\/)?[^\\s]*$", // URIs (RFC 3986) - fast mode pattern from ajv-formats
  httpUrl: "^https?://([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(?::\\d+)?(?:/[^\\s]*)?$", // HTTP/HTTPS URLs with domain validation
  hostname: "^(?=.{1,253}\\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\\.?$",
  domain: "^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$", // Used by httpUrl for hostname validation
  uuid: "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
  e164: "^\\+[1-9]\\d{6,14}$",
  emoji: "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",
  base64: "^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$",
  base64url: "^[A-Za-z0-9_-]*$",
  hex: "^[0-9a-fA-F]*$",
  jwt: undefined, // Uses format: 'jwt' in JSON Schema
  nanoid: "^[a-zA-Z0-9_-]{21}$",
  cuid: "^[cC][0-9a-z]{6,}$",
  cuid2: "^[0-9a-z]+$",
  ulid: "^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$",
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
  "uri-template": undefined, // URI Templates (RFC 6570) - complex pattern, better to use library validation
  "json-pointer": "^(?:\\/(?:[^~\\/]|~0|~1)*)*$", // JSON Pointers (RFC 6901) - pattern from ajv-formats
  "relative-json-pointer": "^(?:0|[1-9][0-9]*)(?:#|(?:\\/(?:[^~\\/]|~0|~1)*)*)$", // Relative JSON Pointers - pattern from ajv-formats
  regex: undefined, // Regular expressions (ECMA-262) - requires actual RegExp validation
  "date-time": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$", // Date and time (RFC 3339) - used by dna.iso.datetime
  date: "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$", // Full date (RFC 3339) - used by dna.iso.date
  time: "^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?$", // Full time (RFC 3339) - used by dna.iso.time
  duration: "^P(?:(\\d+W)|(?!.*W)(?=\\d|T\\d)(\\d+Y)?(\\d+M)?(\\d+D)?(T(?=\\d)(\\d+H)?(\\d+M)?(\\d+([.,]\\d+)?S)?)?)$", // Duration (ISO 8601) - used by dna.iso.duration
} as const;

export type tsStringFormat = keyof typeof STRING_FORMAT_PATTERNS;

/**
 * Escape special regex characters in a string
 */
export function escReg(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a regex pattern for number ranges
 */
export function numRegex(
  min: number | bigint | null,
  exclMin: boolean,
  max: number | bigint | null,
  exclMax: boolean,
  isFloat: boolean
): string {
  if (min === null && max === null) return isFloat ? '-?\\d+(?:\\.\\d+)?' : '-?\\d+';
  
  let pattern = '';
  
  if (min !== null && max !== null) {
    // Range pattern
    const minVal = Number(min);
    const maxVal = Number(max);
    if (minVal === maxVal) {
      pattern = String(minVal);
    } else {
      pattern = `${exclMin ? minVal + 1 : minVal}-${exclMax ? maxVal - 1 : maxVal}`;
    }
  } else if (min !== null) {
    pattern = `${exclMin ? Number(min) + 1 : min},`;
  } else if (max !== null) {
    pattern = `,${exclMax ? Number(max) - 1 : max}`;
  }
  
  return isFloat ? `-?\\d+(?:\\.\\d+)?` : `-?\\d+`;
}

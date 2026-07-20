/**
 * Utility functions for DNA schema builder 
 */

import { serializeRaw } from "../shared/utils.js";


/**
 * Converts a base64 string to a Uint8Array.
 * 
 * @param base64 - The base64 string to convert
 * @returns A Uint8Array containing the decoded bytes
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a base64 string.
 * 
 * @param bytes - The Uint8Array to convert
 * @returns A base64 string representation
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

/**
 * Converts a base64url string to a Uint8Array.
 * 
 * @param base64url - The base64url string to convert (URL-safe base64)
 * @returns A Uint8Array containing the decoded bytes
 */
export function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return base64ToUint8Array(base64 + padding);
}

/**
 * Converts a Uint8Array to a base64url string.
 * 
 * @param bytes - The Uint8Array to convert
 * @returns A base64url string representation (URL-safe base64)
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * 
 * @param hex - The hexadecimal string to convert (e.g., "48656c6c6f" or "0x48656c6c6f")
 * @returns A Uint8Array containing the byte values
 * 
 * @example
 * ```ts
 * import { util } from "@ytn/dna";
 * const bytes = util.hexToUint8Array("48656c6c6f");
 * // => Uint8Array([72, 101, 108, 108, 111])
 * ```
 */
export function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 * 
 * @param bytes - The Uint8Array to convert
 * @returns A hexadecimal string representation (e.g., "48656c6c6f")
 * 
 * @example
 * ```ts
 * import { util } from "@ytn/dna";
 * const hex = util.uint8ArrayToHex(new Uint8Array([72, 101, 108, 108, 111]));
 * // => "48656c6c6f"
 * ```
 */
export function uint8ArrayToHex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}


/**
 * Internal generic serializer used by both `cacheKey` and `tojsStr`.
 * Use `cacheKey` for cache keys and `tojsStr` (exported from toJs/utils.ts) for JS code generation.
 */
/**
 * Stable, JavaScript-agnostic serialization for cache keys.
 * Distinguishes values that JSON.stringify conflates (undefined, null, NaN,
 * Infinity, -Infinity, bigint) using explicit type tags instead of JS literals.
 */
export function cacheKey(value: any, cache = new WeakMap<object, string>()): string {
	return serializeRaw(value, { mode: "cache", sortKeys: true, cache });
}

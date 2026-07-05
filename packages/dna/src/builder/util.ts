/**
 * Utility functions for DNA schema builder 
 */


/**
 * Converts a value to a JavaScript code string representation.
 * Unlike JSON.stringify, this generates valid JS code literals.
 * Handles bigint and regex recursively in objects/arrays with memoization.
 * 
 * @param value - The value to convert
 * @param preserveSpaces - If true, adds spaces after commas in arrays/objects for better readability
 * @param cache - Internal WeakMap for memoization (prevents infinite loops)
 * @returns A string representation suitable for JS code generation
 */
export function tojsStr(value: any, preserveSpaces = false, cache = new WeakMap<object, string>()): string {
	if (typeof value === 'bigint') {
		return value + 'n'; // BigInt literal: 42n
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}
	if (value === null) {
		return 'null';
	}
	if (value === undefined) {
		return 'undefined';
	}
	if (value instanceof RegExp) {
		return value.toString(); // Regex literal: /pattern/flags
	}
	if (typeof value === 'object' && value !== null) {
		if (cache.has(value)) {
			return cache.get(value)!;
		}
		
		let result: string;
		const separator = preserveSpaces ? ', ' : ',';
		if (Array.isArray(value)) {
			const items: string[] = [];
			for (let i = 0; i < value.length; i++) {
				items.push(tojsStr(value[i], preserveSpaces, cache));
			}
			result = '[' + items.join(separator) + ']';
		} else {
			const props: string[] = [];
			const keys = Object.keys(value);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				props.push(JSON.stringify(k) + ':' + (preserveSpaces ? ' ' : '') + tojsStr(value[k], preserveSpaces, cache));
			}
			result = '{' + props.join(separator) + '}';
		}
		cache.set(value, result);
		return result;
	}
	// Fallback
	return JSON.stringify(value);
}

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
export function hexToUint8Array(hex: string): Uint8Array {
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
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

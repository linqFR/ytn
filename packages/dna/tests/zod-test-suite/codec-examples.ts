import * as z from "zod";
import { dna } from "../../src/index.js";

export const codecExamplesTests = [
  {
    description: "string to number codec",
    zodSchema: z.codec(z.string(), z.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.number(), {
      decode: (str) => Number.parseFloat(str),
      encode: (num) => num.toString(),
    }),
    tests: [
      {
        description: "valid string to number decode",
        data: "42.5",
        valid: true,
      },
      {
        description: "valid zero",
        data: "0",
        valid: true,
      },
      {
        description: "valid negative",
        data: "-123.456",
        valid: true,
      },
    ],
  },
  {
    description: "string to int codec",
    zodSchema: z.codec(z.string(), z.int(), {
      decode: (str) => Number.parseInt(str, 10),
      encode: (num) => num.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.int(), {
      decode: (str) => Number.parseInt(str, 10),
      encode: (num) => num.toString(),
    }),
    tests: [
      {
        description: "valid string to int",
        data: "42",
        valid: true,
      },
      {
        description: "valid zero",
        data: "0",
        valid: true,
      },
      {
        description: "valid negative",
        data: "-123",
        valid: true,
      },
    ],
  },
  {
    description: "string to bigint codec",
    zodSchema: z.codec(z.string(), z.bigint(), {
      decode: (str) => BigInt(str),
      encode: (bigint) => bigint.toString(),
    }),
    dnaSchema: dna.codec(dna.string(), dna.bigint(), {
      decode: (str) => BigInt(str),
      encode: (bigint) => bigint.toString(),
    }),
    tests: [
      {
        description: "valid string to bigint",
        data: "123456789012345678901234567890",
        valid: true,
      },
      {
        description: "valid zero",
        data: "0",
        valid: true,
      },
      {
        description: "valid negative",
        data: "-999",
        valid: true,
      },
    ],
  },
  {
    description: "ISO datetime to date codec",
    zodSchema: z.codec(z.iso.datetime(), z.date(), {
      decode: (isoString) => new Date(isoString),
      encode: (date) => date.toISOString(),
    }),
    dnaSchema: dna.codec(dna.iso.datetime(), dna.date(), {
      decode: (isoString) => new Date(isoString),
      encode: (date) => date.toISOString(),
    }),
    tests: [
      {
        description: "valid ISO datetime",
        data: "2024-01-15T10:30:00.000Z",
        valid: true,
      },
      {
        description: "invalid format",
        data: "not-a-date",
        valid: false,
      },
    ],
  },
  {
    description: "JSON codec",
    zodSchema: z.codec(z.string(), z.object({ name: z.string(), age: z.number() }), {
      decode: (jsonString, ctx) => {
        try {
          return JSON.parse(jsonString);
        } catch (err: any) {
          ctx.issues.push({
            code: "invalid_format",
            format: "json",
            input: jsonString,
            message: err.message,
          });
          return z.NEVER;
        }
      },
      encode: (value) => JSON.stringify(value),
    }),
    dnaSchema: dna.codec(dna.string(), dna.object({ name: dna.string(), age: dna.number() }), {
      decode: (jsonString, ctx) => {
        try {
          return JSON.parse(jsonString);
        } catch (err: any) {
          ctx.issues.push({
            code: "invalid_format",
            format: "json",
            input: jsonString,
            message: err.message,
          });
          return dna.NEVER;
        }
      },
      encode: (value) => JSON.stringify(value),
    }),
    tests: [
      {
        description: "valid JSON string",
        data: '{"name":"Alice","age":30}',
        valid: true,
      },
      {
        description: "invalid JSON",
        data: '{"invalid":,}',
        valid: false,
      },
    ],
  },
  {
    description: "hex to bytes codec",
    zodSchema: z.codec(z.hex(), z.instanceof(Uint8Array), {
      decode: (hexString) => z.util.hexToUint8Array(hexString),
      encode: (bytes) => z.util.uint8ArrayToHex(bytes),
    }),
    dnaSchema: dna.codec(dna.hex(), dna.instanceof(Uint8Array), {
      decode: (hexString) => dna.util.hexToUint8Array(hexString),
      encode: (bytes) => dna.util.uint8ArrayToHex(bytes),
    }),
    tests: [
      {
        description: "valid hex string",
        data: "48656c6c6f",
        valid: true,
      },
      {
        description: "invalid hex",
        data: "gg",
        valid: false,
      },
    ],
  },
  {
    description: "hex to bytes codec - raw functions",
    zodSchema: z.codec(z.hex(), z.instanceof(Uint8Array), {
      decode: z.util.hexToUint8Array,
      encode: z.util.uint8ArrayToHex,
    }),
    dnaSchema: dna.codec(dna.hex(), dna.instanceof(Uint8Array), {
      decode: dna.util.hexToUint8Array,
      encode: dna.util.uint8ArrayToHex,
    }),
    tests: [
      {
        description: "valid hex string",
        data: "48656c6c6f",
        valid: true,
      },
      {
        description: "invalid hex",
        data: "gg",
        valid: false,
      },
    ],
  },
  {
    description: "string to URL codec",
    zodSchema: z.codec(z.url(), z.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    dnaSchema: dna.codec(dna.url(), dna.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    tests: [
      {
        description: "valid URL",
        data: "https://example.com/path?query=value",
        valid: true,
      },
      {
        description: "invalid URL",
        data: "not a url",
        valid: false,
      },
    ],
  },
  {
    description: "numberToBigInt codec",
    zodSchema: z.codec(z.int(), z.bigint(), {
      decode: (num) => BigInt(num),
      encode: (bigint) => Number(bigint),
    }),
    dnaSchema: dna.codec(dna.int(), dna.bigint(), {
      decode: (num) => BigInt(num),
      encode: (bigint) => Number(bigint),
    }),
    tests: [
      {
        description: "valid positive integer",
        data: 42,
        valid: true,
      },
      {
        description: "valid zero",
        data: 0,
        valid: true,
      },
      {
        description: "valid negative integer",
        data: -123,
        valid: true,
      },
      {
        description: "invalid float",
        data: 42.5,
        valid: false,
      },
      {
        description: "invalid string",
        data: "42",
        valid: false,
      },
    ],
  },
  {
    description: "epochSecondsToDate codec",
    zodSchema: z.codec(z.int().min(0), z.date(), {
      decode: (seconds) => new Date(seconds * 1000),
      encode: (date) => Math.floor(date.getTime() / 1000),
    }),
    dnaSchema: dna.codec(dna.int().min(0), dna.date(), {
      decode: (seconds) => new Date(seconds * 1000),
      encode: (date) => Math.floor(date.getTime() / 1000),
    }),
    tests: [
      {
        description: "valid epoch seconds",
        data: 1705314600,
        valid: true,
      },
      {
        description: "valid zero",
        data: 0,
        valid: true,
      },
      {
        description: "invalid negative",
        data: -1,
        valid: false,
      },
      {
        description: "invalid float",
        data: 1.5,
        valid: false,
      },
    ],
  },
  {
    description: "epochMillisToDate codec",
    zodSchema: z.codec(z.int().min(0), z.date(), {
      decode: (millis) => new Date(millis),
      encode: (date) => date.getTime(),
    }),
    dnaSchema: dna.codec(dna.int().min(0), dna.date(), {
      decode: (millis) => new Date(millis),
      encode: (date) => date.getTime(),
    }),
    tests: [
      {
        description: "valid epoch millis",
        data: 1705314600000,
        valid: true,
      },
      {
        description: "valid zero",
        data: 0,
        valid: true,
      },
      {
        description: "invalid negative",
        data: -1,
        valid: false,
      },
    ],
  },
  {
    description: "utf8ToBytes codec",
    zodSchema: z.codec(z.string(), z.instanceof(Uint8Array), {
      decode: (str) => new TextEncoder().encode(str),
      encode: (bytes) => new TextDecoder().decode(bytes),
    }),
    dnaSchema: dna.codec(dna.string(), dna.instanceof(Uint8Array), {
      decode: (str) => new TextEncoder().encode(str),
      encode: (bytes) => new TextDecoder().decode(bytes),
    }),
    tests: [
      {
        description: "valid ASCII string",
        data: "Hello",
        valid: true,
      },
      {
        description: "valid Unicode string",
        data: "Hello, 世界!",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "bytesToUtf8 codec",
    zodSchema: z.codec(z.instanceof(Uint8Array), z.string(), {
      decode: (bytes) => new TextDecoder().decode(bytes),
      encode: (str) => new TextEncoder().encode(str),
    }),
    dnaSchema: dna.codec(dna.instanceof(Uint8Array), dna.string(), {
      decode: (bytes) => new TextDecoder().decode(bytes),
      encode: (str) => new TextEncoder().encode(str),
    }),
    tests: [
      {
        description: "valid bytes",
        data: new Uint8Array([72, 101, 108, 108, 111]),
        valid: true,
      },
      {
        description: "invalid string",
        data: "Hello",
        valid: false,
      },
    ],
  },
  {
    description: "base64 codec",
    zodSchema: z.codec(z.base64(), z.instanceof(Uint8Array), {
      decode: (base64String) => z.util.base64ToUint8Array(base64String),
      encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
    }),
    dnaSchema: dna.codec(dna.base64(), dna.instanceof(Uint8Array), {
      decode: (base64String) => dna.util.base64ToUint8Array(base64String),
      encode: (bytes) => dna.util.uint8ArrayToBase64(bytes),
    }),
    tests: [
      {
        description: "valid base64 string",
        data: "SGVsbG8=",
        valid: true,
      },
      {
        description: "invalid base64 string",
        data: "invalid!@#",
        valid: false,
      },
    ],
  },
  {
    description: "base64urlToBytes codec",
    zodSchema: z.codec(z.base64url(), z.instanceof(Uint8Array), {
      decode: (base64urlString) => z.util.base64urlToUint8Array(base64urlString),
      encode: (bytes) => z.util.uint8ArrayToBase64url(bytes),
    }),
    dnaSchema: dna.codec(dna.base64url(), dna.instanceof(Uint8Array), {
      decode: (base64urlString) => dna.util.base64urlToUint8Array(base64urlString),
      encode: (bytes) => dna.util.uint8ArrayToBase64url(bytes),
    }),
    tests: [
      {
        description: "valid base64url string",
        data: "SGVsbG8",
        valid: true,
      },
      {
        description: "invalid base64url string",
        data: "invalid!@#",
        valid: false,
      },
    ],
  },
  {
    description: "stringToHttpURL codec",
    zodSchema: z.codec(z.httpUrl(), z.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    dnaSchema: dna.codec(dna.httpUrl(), dna.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    tests: [
      {
        description: "valid HTTPS URL",
        data: "https://example.com/path",
        valid: true,
      },
      {
        description: "valid HTTP URL",
        data: "http://example.com/path",
        valid: true,
      },
      {
        description: "invalid FTP URL",
        data: "ftp://example.com",
        valid: false,
      },
      {
        description: "invalid non-URL string",
        data: "not a url",
        valid: false,
      },
    ],
  },
  {
    description: "uriComponent codec",
    zodSchema: z.codec(z.string(), z.string(), {
      decode: (encodedString) => decodeURIComponent(encodedString),
      encode: (decodedString) => encodeURIComponent(decodedString),
    }),
    dnaSchema: dna.codec(dna.string(), dna.string(), {
      decode: (encodedString) => decodeURIComponent(encodedString),
      encode: (decodedString) => encodeURIComponent(decodedString),
    }),
    tests: [
      {
        description: "valid encoded string",
        data: "Hello%20World%21",
        valid: true,
      },
      {
        description: "valid plain string",
        data: "Hello World!",
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "stringToBoolean codec",
    zodSchema: z.stringbool(),
    dnaSchema: dna.stringbool(),
    tests: [
      {
        description: "valid true",
        data: "true",
        valid: true,
      },
      {
        description: "valid yes",
        data: "yes",
        valid: true,
      },
      {
        description: "valid 1",
        data: "1",
        valid: true,
      },
      {
        description: "valid false",
        data: "false",
        valid: true,
      },
      {
        description: "valid no",
        data: "no",
        valid: true,
      },
      {
        description: "valid 0",
        data: "0",
        valid: true,
      },
      {
        description: "invalid other string",
        data: "other",
        valid: false,
      },
    ],
  },
];

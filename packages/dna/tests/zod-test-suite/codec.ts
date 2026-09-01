import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable codec schemas
const isoDateCodecZod = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

const isoDateCodecDna = dna.codec(dna.iso.datetime(), dna.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

const stringNumberCodecZod = z.codec(z.string(), z.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

const stringNumberCodecDna = dna.codec(dna.string(), dna.number(), {
  decode: (str) => Number.parseFloat(str),
  encode: (num) => num.toString(),
});

const stringIntCodecZod = z.codec(z.string(), z.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

const stringIntCodecDna = dna.codec(dna.string(), dna.int(), {
  decode: (str) => Number.parseInt(str, 10),
  encode: (num) => num.toString(),
});

export const codecTests = [
  {
    description: "codec basic functionality - forward decoding (ISO string -> Date)",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "valid ISO string", data: "2024-01-15T10:30:00.000Z", valid: true },
    ],
  },
  {
    description: "codec basic functionality - backward encoding (Date -> ISO string)",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "valid Date", data: new Date("2024-01-15T10:30:00.000Z"), valid: true },
    ],
  },
  {
    description: "codec round trip",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "round trip ISO string", data: "2024-12-25T15:45:30.123Z", valid: true },
    ],
  },
  {
    description: "codec with refinement",
    zodSchema: isoDateCodecZod.refine((val) => val.getFullYear() === 2024, { error: "Year must be 2024" }),
    dnaSchema: isoDateCodecDna.refine((val) => val.getFullYear() === 2024, { error: "Year must be 2024" }),
    tests: [
      { description: "valid 2024 date", data: "2024-01-15T10:30:00.000Z", valid: true },
      { description: "invalid year 2023", data: "2023-01-15T10:30:00.000Z", valid: false },
    ],
  },
  {
    description: "safe codec operations - invalid input",
    zodSchema: isoDateCodecZod,
    dnaSchema: isoDateCodecDna,
    tests: [
      { description: "invalid date format", data: "invalid-date", valid: false },
    ],
  },
  {
    description: "codec with different types (string -> number)",
    zodSchema: stringNumberCodecZod,
    dnaSchema: stringNumberCodecDna,
    tests: [
      { description: "valid string to number", data: "42.5", valid: true },
    ],
  },
  {
    description: "codec type inference (string -> int)",
    zodSchema: stringIntCodecZod,
    dnaSchema: stringIntCodecDna,
    tests: [
      { description: "valid string to int", data: "123", valid: true },
    ],
  },
  {
    description: "mutating refinements (codec with trim output)",
    zodSchema: z.codec(z.string(), z.string().trim(), {
      decode: (val) => val,
      encode: (val) => val,
    }),
    dnaSchema: dna.codec(dna.string(), dna.string().trim(), {
      decode: (val) => val,
      encode: (val) => val,
    }),
    tests: [
      { description: "valid string with surrounding spaces (trimmed by output)", data: " asdf ", valid: true },
    ],
  },
  {
    description: "mutating refinements (codec with check trim and maxLength)",
    zodSchema: z
      .codec(z.string(), z.string(), {
        decode: (val) => val,
        encode: (val) => val,
      })
      .check(z.trim(), z.maxLength(4)),
    dnaSchema: dna
      .codec(dna.string(), dna.string().trim(), {
        decode: (val) => val,
        encode: (val) => val,
      })
      .refine((val) => val.length <= 4),
    tests: [
      { description: "valid string trimmed to 4 chars", data: " asdf ", valid: true },
      { description: "invalid string trimmed too long", data: " asdfasdf ", valid: false },
    ],
  },
  {
    description: "async codec functionality",
    zodSchema: z.codec(z.string(), z.number(), {
      decode: async (str) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return Number.parseFloat(str);
      },
      encode: async (num) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return num.toString();
      },
    }),
    dnaSchema: dna.codec(dna.string(), dna.number(), {
      decode: async (str) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return Number.parseFloat(str);
      },
      encode: async (num) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return num.toString();
      },
    }),
    tests: [
      { description: "valid async decode string to number", data: "42.5", valid: true },
      { description: "valid async decode integer string", data: "123", valid: true },
    ],
  },
  {
    description: "codec input validation - invalid base64",
    zodSchema: z.codec(z.base64(), z.instanceof(Uint8Array), {
      decode: (base64String) => z.util.base64ToUint8Array(base64String),
      encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
    }),
    dnaSchema: dna.codec(dna.base64(), dna.instanceof(Uint8Array), {
      decode: (base64String) => dna.util.base64ToUint8Array(base64String),
      encode: (bytes) => dna.util.uint8ArrayToBase64(bytes),
    }),
    tests: [
      { description: "invalid base64 string", data: "invalid!@#", valid: false },
      { description: "valid base64 string", data: "SGVsbG8=", valid: true },
    ],
  },
  {
    description: "codec input validation - invalid http URL",
    zodSchema: z.codec(z.httpUrl(), z.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    dnaSchema: dna.codec(dna.httpUrl(), dna.instanceof(URL), {
      decode: (urlString) => new URL(urlString),
      encode: (url) => url.href,
    }),
    tests: [
      { description: "invalid ftp URL (not http/https)", data: "ftp://example.com", valid: false },
      { description: "valid https URL", data: "https://example.com/path", valid: true },
      { description: "valid http URL", data: "http://example.com/path", valid: true },
    ],
  },
  {
    description: "codec transform error handling - JSON codec with z.json() output",
    zodSchema: z.codec(z.string(), z.json(), {
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
    dnaSchema: dna.codec(dna.string(), dna.json(), {
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
      { description: "valid JSON string", data: '{"valid":"json"}', valid: true },
      { description: "invalid JSON string", data: '{"invalid":,}', valid: false },
    ],
  },
];

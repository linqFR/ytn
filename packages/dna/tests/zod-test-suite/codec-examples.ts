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
];

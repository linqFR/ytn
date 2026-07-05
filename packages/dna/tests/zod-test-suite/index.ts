import * as z from "zod";
import { dna } from "../../src/index.js";

export const indexTests = [
  {
    description: "boolean parsing",
    zodSchema: z.boolean(),
    dnaSchema: dna.boolean(),
    tests: [
      {
        description: "valid true",
        data: true,
        valid: true,
      },
      {
        description: "valid false",
        data: false,
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid string",
        data: "true",
        valid: false,
      },
    ],
  },
  {
    description: "bigint parsing",
    zodSchema: z.bigint(),
    dnaSchema: dna.bigint(),
    tests: [
      {
        description: "valid bigint",
        data: BigInt(123),
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid string",
        data: "123",
        valid: false,
      },
    ],
  },
  {
    description: "symbol parsing",
    zodSchema: z.symbol(),
    dnaSchema: dna.symbol(),
    tests: [
      {
        description: "valid symbol",
        data: Symbol(),
        valid: true,
      },
      {
        description: "invalid string",
        data: "symbol",
        valid: false,
      },
    ],
  },
  {
    description: "date parsing",
    zodSchema: z.date(),
    dnaSchema: dna.date(),
    tests: [
      {
        description: "valid date",
        data: new Date(),
        valid: true,
      },
      {
        description: "invalid string",
        data: "date",
        valid: false,
      },
    ],
  },
  {
    description: "coerce string",
    zodSchema: z.coerce.string(),
    dnaSchema: dna.coerce.string(),
    tests: [
      {
        description: "valid number to string",
        data: 123,
        valid: true,
      },
      {
        description: "valid boolean to string",
        data: true,
        valid: true,
      },
      {
        description: "valid null to string",
        data: null,
        valid: true,
      },
      {
        description: "valid undefined to string",
        data: undefined,
        valid: true,
      },
    ],
  },
  {
    description: "coerce number",
    zodSchema: z.coerce.number(),
    dnaSchema: dna.coerce.number(),
    tests: [
      {
        description: "valid string to number",
        data: "123",
        valid: true,
      },
      {
        description: "valid float string to number",
        data: "123.45",
        valid: true,
      },
      {
        description: "valid true to number",
        data: true,
        valid: true,
      },
      {
        description: "valid false to number",
        data: false,
        valid: true,
      },
      {
        description: "invalid string",
        data: "abc",
        valid: false,
      },
    ],
  },
  {
    description: "coerce boolean",
    zodSchema: z.coerce.boolean(),
    dnaSchema: dna.coerce.boolean(),
    tests: [
      {
        description: "valid true",
        data: true,
        valid: true,
      },
      {
        description: "valid false",
        data: false,
        valid: true,
      },
      {
        description: "valid string true",
        data: "true",
        valid: true,
      },
      {
        description: "valid string false",
        data: "false",
        valid: true,
      },
      {
        description: "valid number 1",
        data: 1,
        valid: true,
      },
      {
        description: "valid number 0",
        data: 0,
        valid: true,
      },
      {
        description: "valid object",
        data: {},
        valid: true,
      },
      {
        description: "valid array",
        data: [],
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "valid empty string",
        data: "",
        valid: true,
      },
    ],
  },
  {
    description: "coerce bigint",
    zodSchema: z.coerce.bigint(),
    dnaSchema: dna.coerce.bigint(),
    tests: [
      {
        description: "valid string to bigint",
        data: "123",
        valid: true,
      },
      {
        description: "valid number to bigint",
        data: 123,
        valid: true,
      },
      {
        description: "invalid string",
        data: "abc",
        valid: false,
      },
    ],
  },
  {
    description: "coerce date",
    zodSchema: z.coerce.date(),
    dnaSchema: dna.coerce.date(),
    tests: [
      {
        description: "valid ISO string to date",
        data: new Date().toISOString(),
        valid: true,
      },
      {
        description: "valid timestamp to date",
        data: new Date().getTime(),
        valid: true,
      },
      {
        description: "invalid string",
        data: "invalid date",
        valid: false,
      },
    ],
  },
  {
    description: "ISO datetime",
    zodSchema: z.iso.datetime(),
    dnaSchema: dna.iso.datetime(),
    tests: [
      {
        description: "valid ISO datetime",
        data: "2021-01-01T00:00:00Z",
        valid: true,
      },
      {
        description: "valid ISO datetime with milliseconds",
        data: "2021-01-01T00:00:00.123Z",
        valid: true,
      },
      {
        description: "invalid without Z",
        data: "2021-01-01T00:00:00",
        valid: false,
      },
      {
        description: "invalid with offset",
        data: "2021-01-01T00:00:00+07:00",
        valid: false,
      },
      {
        description: "invalid bad data",
        data: "bad data",
        valid: false,
      },
    ],
  },
  {
    description: "ISO datetime with local",
    zodSchema: z.iso.datetime({ local: true }),
    dnaSchema: dna.iso.datetime({ local: true }),
    tests: [
      {
        description: "valid ISO datetime",
        data: "2021-01-01T00:00:00Z",
        valid: true,
      },
      {
        description: "valid local datetime",
        data: "2021-01-01T00:00:00",
        valid: true,
      },
      {
        description: "invalid with offset",
        data: "2021-01-01T00:00:00+07:00",
        valid: false,
      },
    ],
  },
  {
    description: "ISO datetime with offset",
    zodSchema: z.iso.datetime({ offset: true }),
    dnaSchema: dna.iso.datetime({ offset: true }),
    tests: [
      {
        description: "valid ISO datetime",
        data: "2021-01-01T00:00:00Z",
        valid: true,
      },
      {
        description: "valid with offset",
        data: "2021-01-01T00:00:00+07:00",
        valid: true,
      },
      {
        description: "invalid without offset",
        data: "2021-01-01T00:00:00",
        valid: false,
      },
    ],
  },
  {
    description: "ISO datetime with precision",
    zodSchema: z.iso.datetime({ precision: 3 }),
    dnaSchema: dna.iso.datetime({ precision: 3 }),
    tests: [
      {
        description: "valid with milliseconds",
        data: "2021-01-01T00:00:00.123Z",
        valid: true,
      },
      {
        description: "invalid without milliseconds",
        data: "2021-01-01T00:00:00Z",
        valid: false,
      },
    ],
  },
  {
    description: "ISO date",
    zodSchema: z.iso.date(),
    dnaSchema: dna.iso.date(),
    tests: [
      {
        description: "valid ISO date",
        data: "2021-01-01",
        valid: true,
      },
      {
        description: "invalid bad data",
        data: "bad data",
        valid: false,
      },
    ],
  },
  {
    description: "ISO time",
    zodSchema: z.iso.time(),
    dnaSchema: dna.iso.time(),
    tests: [
      {
        description: "valid time",
        data: "00:00:00",
        valid: true,
      },
      {
        description: "valid time with milliseconds",
        data: "00:00:00.123",
        valid: true,
      },
      {
        description: "invalid bad data",
        data: "bad data",
        valid: false,
      },
    ],
  },
  {
    description: "ISO time with precision",
    zodSchema: z.iso.time({ precision: 3 }),
    dnaSchema: dna.iso.time({ precision: 3 }),
    tests: [
      {
        description: "valid with milliseconds",
        data: "00:00:00.123",
        valid: true,
      },
      {
        description: "invalid without milliseconds",
        data: "00:00:00",
        valid: false,
      },
    ],
  },
  {
    description: "ISO duration",
    zodSchema: z.iso.duration(),
    dnaSchema: dna.iso.duration(),
    tests: [
      {
        description: "valid duration",
        data: "P3Y6M4DT12H30M5S",
        valid: true,
      },
      {
        description: "invalid bad data",
        data: "bad data",
        valid: false,
      },
    ],
  },
  {
    description: "undefined parsing",
    zodSchema: z.undefined(),
    dnaSchema: dna.undefined(),
    tests: [
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid string",
        data: "undefined",
        valid: false,
      },
    ],
  },
  {
    description: "null parsing",
    zodSchema: z.null(),
    dnaSchema: dna.null(),
    tests: [
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "invalid string",
        data: "null",
        valid: false,
      },
    ],
  },
  {
    description: "any parsing",
    zodSchema: z.any(),
    dnaSchema: dna.any(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 123,
        valid: true,
      },
      {
        description: "valid boolean",
        data: true,
        valid: true,
      },
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "valid object",
        data: {},
        valid: true,
      },
      {
        description: "valid array",
        data: [],
        valid: true,
      },
    ],
  },
  {
    description: "unknown parsing",
    zodSchema: z.unknown(),
    dnaSchema: dna.unknown(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 123,
        valid: true,
      },
      {
        description: "valid boolean",
        data: true,
        valid: true,
      },
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "valid object",
        data: {},
        valid: true,
      },
      {
        description: "valid array",
        data: [],
        valid: true,
      },
    ],
  },
  {
    description: "never parsing",
    zodSchema: z.never(),
    dnaSchema: dna.never(),
    tests: [
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "void parsing",
    zodSchema: z.void(),
    dnaSchema: dna.void(),
    tests: [
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
      {
        description: "invalid null",
        data: null,
        valid: false,
      },
    ],
  },
  {
    description: "array parsing",
    zodSchema: z.array(z.string()),
    dnaSchema: dna.array(dna.string()),
    tests: [
      {
        description: "valid string array",
        data: ["hello", "world"],
        valid: true,
      },
      {
        description: "invalid mixed array",
        data: [123],
        valid: false,
      },
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "union parsing",
    zodSchema: z.union([z.string(), z.number()]),
    dnaSchema: dna.union([dna.string(), dna.number()]),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 123,
        valid: true,
      },
      {
        description: "invalid boolean",
        data: true,
        valid: false,
      },
    ],
  },
  {
    description: "intersection parsing",
    zodSchema: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })),
    dnaSchema: dna.intersection(dna.object({ a: dna.string() }), dna.object({ b: dna.number() })),
    tests: [
      {
        description: "valid intersection",
        data: { a: "hello", b: 123 },
        valid: true,
      },
      {
        description: "invalid missing b",
        data: { a: "hello" },
        valid: false,
      },
      {
        description: "invalid missing a",
        data: { b: 123 },
        valid: false,
      },
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "tuple parsing",
    zodSchema: z.tuple([z.string(), z.number()]),
    dnaSchema: dna.tuple([dna.string(), dna.number()]),
    tests: [
      {
        description: "valid tuple",
        data: ["hello", 123],
        valid: true,
      },
      {
        description: "invalid wrong types",
        data: ["hello", "world"],
        valid: false,
      },
      {
        description: "invalid swapped types",
        data: [123, 456],
        valid: false,
      },
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "record with string keys",
    zodSchema: z.record(z.string(), z.string()),
    dnaSchema: dna.record(dna.string(), dna.string()),
    tests: [
      {
        description: "valid record",
        data: { a: "hello", b: "world" },
        valid: true,
      },
    ],
  },
  {
    description: "record with union keys",
    zodSchema: z.record(z.union([z.string(), z.number()]), z.string()),
    dnaSchema: dna.record(dna.union([dna.string(), dna.number()]), dna.string()),
    tests: [
      {
        description: "valid mixed keys",
        data: { a: "hello", 1: "world" },
        valid: true,
      },
    ],
  },
  {
    description: "record with enum keys",
    zodSchema: z.record(z.enum(["a", "b", "c"]), z.string()),
    dnaSchema: dna.record(dna.enum(["a", "b", "c"]), dna.string()),
    tests: [
      {
        description: "valid all keys",
        data: { a: "hello", b: "world", c: "world" },
        valid: true,
      },
      {
        description: "invalid missing key",
        data: { a: "hello", b: "world" },
        valid: false,
      },
      {
        description: "invalid extra key",
        data: { a: "hello", b: "world", c: "world", d: "world" },
        valid: false,
      },
    ],
  },
  {
    description: "map parsing",
    zodSchema: z.map(z.string(), z.number()),
    dnaSchema: dna.map(dna.string(), dna.number()),
    tests: [
      {
        description: "valid map",
        data: new Map([["hello", 123]]),
        valid: true,
      },
      {
        description: "invalid value type",
        data: new Map([["hello", "world"]]),
        valid: false,
      },
      {
        description: "invalid key type",
        data: new Map([[123, "world"]]),
        valid: false,
      },
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "set parsing",
    zodSchema: z.set(z.string()),
    dnaSchema: dna.set(dna.string()),
    tests: [
      {
        description: "valid set",
        data: new Set(["hello", "world"]),
        valid: true,
      },
      {
        description: "invalid element type",
        data: new Set([123]),
        valid: false,
      },
      {
        description: "invalid array",
        data: ["hello", "world"],
        valid: false,
      },
      {
        description: "invalid string",
        data: "hello",
        valid: false,
      },
    ],
  },
  {
    description: "enum parsing",
    zodSchema: z.enum(["A", "B", "C"]),
    dnaSchema: dna.enum(["A", "B", "C"]),
    tests: [
      {
        description: "valid A",
        data: "A",
        valid: true,
      },
      {
        description: "valid B",
        data: "B",
        valid: true,
      },
      {
        description: "valid C",
        data: "C",
        valid: true,
      },
      {
        description: "invalid D",
        data: "D",
        valid: false,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "literal parsing",
    zodSchema: z.literal("hello"),
    dnaSchema: dna.literal("hello"),
    tests: [
      {
        description: "valid literal",
        data: "hello",
        valid: true,
      },
      {
        description: "invalid different string",
        data: "world",
        valid: false,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
    ],
  },
  {
    description: "nan parsing",
    zodSchema: z.nan(),
    dnaSchema: dna.nan(),
    tests: [
      {
        description: "valid NaN",
        data: Number.NaN,
        valid: true,
      },
      {
        description: "invalid number",
        data: 123,
        valid: false,
      },
      {
        description: "invalid string",
        data: "NaN",
        valid: false,
      },
    ],
  },
  {
    description: "json parsing",
    zodSchema: z.json(),
    dnaSchema: dna.json(),
    tests: [
      {
        description: "valid string",
        data: "hello",
        valid: true,
      },
      {
        description: "valid number",
        data: 123,
        valid: true,
      },
      {
        description: "valid boolean",
        data: true,
        valid: true,
      },
      {
        description: "valid null",
        data: null,
        valid: true,
      },
      {
        description: "valid object",
        data: {},
        valid: true,
      },
      {
        description: "valid nested object",
        data: { a: "hello" },
        valid: true,
      },
      {
        description: "valid array",
        data: [1, 2, 3],
        valid: true,
      },
      {
        description: "valid nested array",
        data: [{ a: "hello" }],
        valid: true,
      },
      {
        description: "invalid date",
        data: new Date(),
        valid: false,
      },
      {
        description: "invalid symbol",
        data: Symbol(),
        valid: false,
      },
      {
        description: "invalid nested date",
        data: { a: new Date() },
        valid: false,
      },
      {
        description: "invalid undefined",
        data: undefined,
        valid: false,
      },
      {
        description: "invalid nested undefined",
        data: { a: undefined },
        valid: false,
      },
    ],
  },
];

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";
import type { tsDnaParserResult } from "../src/shared/runtime.types.js";
import type { tsParserError } from "../src/shared/error.types.js";
import type { ZodSafeParseResult } from "zod";

test("codec type regression — safeEncode/safeDecode/encode/decode return types", () => {
  // Codec: string (input) → number (output)
  // DnaCodec<I=string, O=number>
  // decode: string → number (produces O)
  // encode: number → string (produces I)
  const dnaCodec = dna.codec(dna.string(), dna.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });
  const zodCodec = z.codec(z.string(), z.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });

  // --- dna.infer (output type) ---
  expectTypeOf<dna.infer<typeof dnaCodec>>().toEqualTypeOf<number>();
  expectTypeOf<z.infer<typeof zodCodec>>().toEqualTypeOf<number>();

  // --- safeParse — produces O (output) ---
  const dnaSafeParse = dnaCodec.safeParse("42");
  expectTypeOf<typeof dnaSafeParse>().toEqualTypeOf<tsDnaParserResult<number>>();
  expectTypeOf<typeof dnaSafeParse>().not.toEqualTypeOf<tsDnaParserResult<string>>();

  // --- safeDecode — produces O (output) ---
  const dnaSafeDecode = dnaCodec.safeDecode("42", {});
  expectTypeOf<typeof dnaSafeDecode>().toEqualTypeOf<tsDnaParserResult<number>>();
  expectTypeOf<typeof dnaSafeDecode>().not.toEqualTypeOf<tsDnaParserResult<string>>();

  // Zod parity: safeDecode also produces O (output)
  const zodSafeDecode = zodCodec.safeDecode("42");
  expectTypeOf<typeof zodSafeDecode>().toEqualTypeOf<ZodSafeParseResult<number>>();
  expectTypeOf<typeof zodSafeDecode>().not.toEqualTypeOf<ZodSafeParseResult<string>>();

  // --- safeEncode — produces I (input), NOT O (output) ---
  // This is the bug that was fixed: safeEncode returned O instead of I
  const dnaSafeEncode = dnaCodec.safeEncode(42);
  expectTypeOf<typeof dnaSafeEncode>().toEqualTypeOf<tsDnaParserResult<string>>();
  expectTypeOf<typeof dnaSafeEncode>().not.toEqualTypeOf<tsDnaParserResult<number>>();

  // Zod parity: safeEncode also produces I (input), NOT O (output)
  const zodSafeEncode = zodCodec.safeEncode(42);
  expectTypeOf<typeof zodSafeEncode>().toEqualTypeOf<ZodSafeParseResult<string>>();
  expectTypeOf<typeof zodSafeEncode>().not.toEqualTypeOf<ZodSafeParseResult<number>>();

  // --- encode (throwing) — produces I (input) ---
  const dnaEncodeResult: string = dnaCodec.encode(42);
  expectTypeOf<typeof dnaEncodeResult>().toEqualTypeOf<string>();
  expectTypeOf<typeof dnaEncodeResult>().not.toEqualTypeOf<number>();

  const zodEncodeResult: string = zodCodec.encode(42);
  expectTypeOf<typeof zodEncodeResult>().toEqualTypeOf<string>();

  // --- decode (throwing) — produces O (output) ---
  const dnaDecodeResult: number = dnaCodec.decode("42", {});
  expectTypeOf<typeof dnaDecodeResult>().toEqualTypeOf<number>();

  const zodDecodeResult: number = zodCodec.decode("42");
  expectTypeOf<typeof zodDecodeResult>().toEqualTypeOf<number>();

  // --- _input and _output on the codec ---
  expectTypeOf<(typeof dnaCodec)["_output"]>().toEqualTypeOf<number>();
  expectTypeOf<(typeof dnaCodec)["_input"]>().toEqualTypeOf<string>();

  // --- Async methods — same I/O semantics as sync variants ---
  const dnaSafeEncodeAsync = dnaCodec.safeEncodeAsync(42);
  expectTypeOf<typeof dnaSafeEncodeAsync>().toEqualTypeOf<Promise<tsDnaParserResult<string>>>();
  expectTypeOf<typeof dnaSafeEncodeAsync>().not.toEqualTypeOf<Promise<tsDnaParserResult<number>>>();

  const dnaSafeDecodeAsync = dnaCodec.safeDecodeAsync("42", {});
  expectTypeOf<typeof dnaSafeDecodeAsync>().toEqualTypeOf<Promise<tsDnaParserResult<number>>>();
  expectTypeOf<typeof dnaSafeDecodeAsync>().not.toEqualTypeOf<Promise<tsDnaParserResult<string>>>();

  const dnaEncodeAsync: Promise<string> = dnaCodec.encodeAsync(42);
  expectTypeOf<typeof dnaEncodeAsync>().toEqualTypeOf<Promise<string>>();
  expectTypeOf<typeof dnaEncodeAsync>().not.toEqualTypeOf<Promise<number>>();

  const dnaDecodeAsync: Promise<number> = dnaCodec.decodeAsync("42", {});
  expectTypeOf<typeof dnaDecodeAsync>().toEqualTypeOf<Promise<number>>();

  // --- Codec with object types (I ≠ O structurally) ---
  const objCodec = dna.codec(
    dna.object({ raw: dna.string() }),
    dna.object({ processed: dna.number() }),
    {
      decode: (v) => ({ processed: v.raw.length }),
      encode: (v) => ({ raw: String(v.processed) }),
    },
  );
  // I = { raw: string }, O = { processed: number }
  const objSafeEncode = objCodec.safeEncode({ processed: 42 });
  expectTypeOf<typeof objSafeEncode>().toEqualTypeOf<tsDnaParserResult<{ raw: string }>>();
  expectTypeOf<typeof objSafeEncode>().not.toEqualTypeOf<tsDnaParserResult<{ processed: number }>>();

  const objSafeDecode = objCodec.safeDecode({ raw: "hello" }, {});
  expectTypeOf<typeof objSafeDecode>().toEqualTypeOf<tsDnaParserResult<{ processed: number }>>();
  expectTypeOf<typeof objSafeDecode>().not.toEqualTypeOf<tsDnaParserResult<{ raw: string }>>();

  // --- Error branch verification ---
  // tsDnaParserResult<T> is a discriminated union; verify the error branch on all safe methods
  if (!dnaSafeEncode.success) {
    expectTypeOf<typeof dnaSafeEncode.errors>().toEqualTypeOf<tsParserError[]>();
  }
  if (!dnaSafeDecode.success) {
    expectTypeOf<typeof dnaSafeDecode.errors>().toEqualTypeOf<tsParserError[]>();
  }
  if (!dnaSafeParse.success) {
    expectTypeOf<typeof dnaSafeParse.errors>().toEqualTypeOf<tsParserError[]>();
  }
  if (!objSafeEncode.success) {
    expectTypeOf<typeof objSafeEncode.errors>().toEqualTypeOf<tsParserError[]>();
  }
  if (!objSafeDecode.success) {
    expectTypeOf<typeof objSafeDecode.errors>().toEqualTypeOf<tsParserError[]>();
  }

  // --- Identity codec (I = O) — verifies the type is still correct when I and O coincide ---
  const identityCodec = dna.codec(dna.string(), dna.string(), {
    decode: (s) => s,
    encode: (s) => s,
  });
  const identitySafeEncode = identityCodec.safeEncode("test");
  expectTypeOf<typeof identitySafeEncode>().toEqualTypeOf<tsDnaParserResult<string>>();
  const identitySafeDecode = identityCodec.safeDecode("test", {});
  expectTypeOf<typeof identitySafeDecode>().toEqualTypeOf<tsDnaParserResult<string>>();
  const identityEncode: string = identityCodec.encode("test");
  expectTypeOf<typeof identityEncode>().toEqualTypeOf<string>();
  const identityDecode: string = identityCodec.decode("test", {});
  expectTypeOf<typeof identityDecode>().toEqualTypeOf<string>();

  // --- Union types — codec with union input/output ---
  const unionCodec = dna.codec(
    dna.union([dna.string(), dna.number()]),
    dna.boolean(),
    {
      decode: (v) => typeof v === "string" ? v.length > 0 : v > 0,
      encode: (b) => b ? "1" : 0,
    },
  );
  // I = string | number, O = boolean
  const unionSafeEncode = unionCodec.safeEncode(true);
  expectTypeOf<typeof unionSafeEncode>().toEqualTypeOf<tsDnaParserResult<string | number>>();
  expectTypeOf<typeof unionSafeEncode>().not.toEqualTypeOf<tsDnaParserResult<boolean>>();

  const unionSafeDecode = unionCodec.safeDecode("hello", {});
  expectTypeOf<typeof unionSafeDecode>().toEqualTypeOf<tsDnaParserResult<boolean>>();
  expectTypeOf<typeof unionSafeDecode>().not.toEqualTypeOf<tsDnaParserResult<string | number>>();
});

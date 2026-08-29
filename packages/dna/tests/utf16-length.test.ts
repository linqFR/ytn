import { expect, test, describe } from "vitest";

import { dna } from "../src/index.js";
import { z } from "zod";

// =============================================================================
// UTF-8 / UTF-16 / UTF-32 string length tests — Zod vs DNA
//
// Zod ≤4.4.x counts UTF-16 code units (String.prototype.length, O(1))
// Zod ≥4.5.x counts Unicode code points (codePointLength, O(n) in the window)
// DNA always counts Unicode code points via fCount() (O(n))
//
// This file tests the behavior on multi-unit characters:
// - BMP (Basic Multilingual Plane): 1 code unit per char — no divergence
// - Combining characters: 1 code unit per combining mark — no divergence
// - Astral plane (surrogate pairs): 2 code units per code point — DIVERGENCE on Zod ≤4.4
// - Flag emojis (regional indicator pairs): 2 code units per code point — DIVERGENCE on Zod ≤4.4
// - ZWJ sequences: variable code units per code point — DIVERGENCE on Zod ≤4.4
// - Lone surrogates: malformed UTF-16 — DIVERGENCE on low surrogates
//
// ZOD_CODE_POINTS is a runtime probe: true when Zod counts code points (≥4.5),
// false when Zod counts code units (≤4.4). DNA always counts code points.
// =============================================================================

// Runtime probe: does Zod count code points (4.5+) or code units (≤4.4)?
// 😀 = U+1F600 = 1 code point = 2 UTF-16 code units.
// z.string().length(1) passes only if Zod counts code points.
const ZOD_CODE_POINTS = z.string().length(1).safeParse("\u{1F600}").success;

// Helper: the Zod "unit count" for a string, depending on the Zod version.
// On Zod ≤4.4 this is the UTF-16 code-unit count (string.length).
// On Zod ≥4.5 this is the code-point count (same as DNA).
const zodCount = (s: string): number => ZOD_CODE_POINTS
  ? [...s].length // code points (Zod 4.5+ and DNA agree)
  : s.length;     // UTF-16 code units (Zod ≤4.4)

// =============================================================================
// BMP — Basic Multilingual Plane (U+0000 to U+FFFF)
// 1 code unit per character — Zod and DNA agree
// =============================================================================

describe("BMP characters (1 code unit = 1 code point, Zod and DNA agree)", () => {
  test("ASCII 'abc' .length(3) — both pass", () => {
    expect(z.string().length(3).safeParse("abc").success).toBe(true);
    expect(dna.string().length(3).validate("abc")).toBe(true);
    expect(dna.string().length(3).safeParse("abc").success).toBe(true);
  });

  test("Latin-1 'ééé' .length(3) — both pass (U+00E9 precomposed)", () => {
    expect(z.string().length(3).safeParse("ééé").success).toBe(true);
    expect(dna.string().length(3).validate("ééé")).toBe(true);
    expect(dna.string().length(3).safeParse("ééé").success).toBe(true);
  });

  test("Greek 'αβγ' .length(3) — both pass", () => {
    expect(z.string().length(3).safeParse("αβγ").success).toBe(true);
    expect(dna.string().length(3).validate("αβγ")).toBe(true);
    expect(dna.string().length(3).safeParse("αβγ").success).toBe(true);
  });

  test("CJK '日本語' .length(3) — both pass", () => {
    expect(z.string().length(3).safeParse("日本語").success).toBe(true);
    expect(dna.string().length(3).validate("日本語")).toBe(true);
    expect(dna.string().length(3).safeParse("日本語").success).toBe(true);
  });

  test("CJK '中文' .min(2) — both pass", () => {
    expect(z.string().min(2).safeParse("中文").success).toBe(true);
    expect(dna.string().min(2).validate("中文")).toBe(true);
    expect(dna.string().min(2).safeParse("中文").success).toBe(true);
  });

  test("CJK '日本語' .max(5) — both pass (3 ≤ 5)", () => {
    expect(z.string().max(5).safeParse("日本語").success).toBe(true);
    expect(dna.string().max(5).validate("日本語")).toBe(true);
    expect(dna.string().max(5).safeParse("日本語").success).toBe(true);
  });

  test("ASCII 'ab' .length(3) — both fail (too short)", () => {
    expect(z.string().length(3).safeParse("ab").success).toBe(false);
    expect(dna.string().length(3).validate("ab")).toBe(false);
    expect(dna.string().length(3).safeParse("ab").success).toBe(false);
  });

  test("ASCII 'abcd' .length(3) — both fail (too long)", () => {
    expect(z.string().length(3).safeParse("abcd").success).toBe(false);
    expect(dna.string().length(3).validate("abcd")).toBe(false);
    expect(dna.string().length(3).safeParse("abcd").success).toBe(false);
  });
});

// =============================================================================
// Combining characters — e + combining accent (U+0301)
// 2 code units, 2 code points (base + combining mark)
// Zod and DNA agree (both count code units = code points = 2)
// =============================================================================

describe("Combining characters (e + U+0301 = 2 code units = 2 code points, agree)", () => {
  // "é" decomposed = "e" (U+0065) + combining acute accent (U+0301)
  const decomposedE = "e\u0301";
  const decomposedEE = "e\u0301e\u0301";

  test("Decomposed é .length(2) — both pass", () => {
    expect(z.string().length(2).safeParse(decomposedE).success).toBe(true);
    expect(dna.string().length(2).validate(decomposedE)).toBe(true);
    expect(dna.string().length(2).safeParse(decomposedE).success).toBe(true);
  });

  test("Decomposed éé .length(4) — both pass", () => {
    expect(z.string().length(4).safeParse(decomposedEE).success).toBe(true);
    expect(dna.string().length(4).validate(decomposedEE)).toBe(true);
    expect(dna.string().length(4).safeParse(decomposedEE).success).toBe(true);
  });

  test("Decomposed é .min(3) — both fail (2 < 3)", () => {
    expect(z.string().min(3).safeParse(decomposedE).success).toBe(false);
    expect(dna.string().min(3).validate(decomposedE)).toBe(false);
    expect(dna.string().min(3).safeParse(decomposedE).success).toBe(false);
  });

  test("Decomposed é .max(1) — both fail (2 > 1)", () => {
    expect(z.string().max(1).safeParse(decomposedE).success).toBe(false);
    expect(dna.string().max(1).validate(decomposedE)).toBe(false);
    expect(dna.string().max(1).safeParse(decomposedE).success).toBe(false);
  });
});

// =============================================================================
// Astral plane — surrogate pairs (U+10000 and above)
// 2 code units per code point — DIVERGENCE on Zod ≤4.4, AGREE on Zod ≥4.5
// Zod ≤4.4 counts 2 (code units), DNA counts 1 (code point)
// Zod ≥4.5 counts 1 (code point), DNA counts 1 (code point) — no divergence
// =============================================================================

describe("Astral plane — surrogate pairs (2 code units = 1 code point)", () => {
  // U+1F600 😀 — 1 code point, 2 code units
  const grin = "😀";
  // U+1F98A 🦊 — 1 code point, 2 code units
  const fox = "🦊";
  // U+1F300 🌀 — 1 code point, 2 code units
  const cyclone = "🌀";

  test("Single emoji 😀 .length(2) — Zod: zodCount=2 passes, DNA: 1≠2 fails", () => {
    expect(z.string().length(2).safeParse(grin).success).toBe(zodCount(grin) === 2);
    expect(dna.string().length(2).validate(grin)).toBe(false);
    expect(dna.string().length(2).safeParse(grin).success).toBe(false);
  });

  test("Single emoji 😀 .length(1) — Zod: zodCount=1 passes, DNA: 1=1 passes", () => {
    expect(z.string().length(1).safeParse(grin).success).toBe(zodCount(grin) === 1);
    expect(dna.string().length(1).validate(grin)).toBe(true);
    expect(dna.string().length(1).safeParse(grin).success).toBe(true);
  });

  test("Two emojis 😀😀 .length(4) — Zod: zodCount=4 passes, DNA: 2≠4 fails", () => {
    expect(z.string().length(4).safeParse(grin + grin).success).toBe(zodCount(grin + grin) === 4);
    expect(dna.string().length(4).validate(grin + grin)).toBe(false);
    expect(dna.string().length(4).safeParse(grin + grin).success).toBe(false);
  });

  test("Two emojis 😀😀 .length(2) — Zod: zodCount=2 passes, DNA: 2=2 passes", () => {
    expect(z.string().length(2).safeParse(grin + grin).success).toBe(zodCount(grin + grin) === 2);
    expect(dna.string().length(2).validate(grin + grin)).toBe(true);
    expect(dna.string().length(2).safeParse(grin + grin).success).toBe(true);
  });

  test("Single emoji 😀 .min(2) — Zod: zodCount≥2 passes, DNA: 1<2 fails", () => {
    expect(z.string().min(2).safeParse(grin).success).toBe(zodCount(grin) >= 2);
    expect(dna.string().min(2).validate(grin)).toBe(false);
    expect(dna.string().min(2).safeParse(grin).success).toBe(false);
  });

  test("Single emoji 😀 .min(1) — both pass (zodCount≥1, 1≥1)", () => {
    expect(z.string().min(1).safeParse(grin).success).toBe(true);
    expect(dna.string().min(1).validate(grin)).toBe(true);
    expect(dna.string().min(1).safeParse(grin).success).toBe(true);
  });

  test("Single emoji 😀 .max(1) — Zod: zodCount≤1 passes, DNA: 1≤1 passes", () => {
    expect(z.string().max(1).safeParse(grin).success).toBe(zodCount(grin) <= 1);
    expect(dna.string().max(1).validate(grin)).toBe(true);
    expect(dna.string().max(1).safeParse(grin).success).toBe(true);
  });

  test("Single emoji 😀 .max(2) — both pass (zodCount≤2, 1≤2)", () => {
    expect(z.string().max(2).safeParse(grin).success).toBe(true);
    expect(dna.string().max(2).validate(grin)).toBe(true);
    expect(dna.string().max(2).safeParse(grin).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .max(5) — Zod: zodCount≤5, DNA: 3≤5 passes", () => {
    const three = grin + fox + cyclone;
    expect(z.string().max(5).safeParse(three).success).toBe(zodCount(three) <= 5);
    expect(dna.string().max(5).validate(three)).toBe(true);
    expect(dna.string().max(5).safeParse(three).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .max(6) — both pass (zodCount≤6, 3≤6)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().max(6).safeParse(three).success).toBe(true);
    expect(dna.string().max(6).validate(three)).toBe(true);
    expect(dna.string().max(6).safeParse(three).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .min(4) — Zod: zodCount≥4, DNA: 3<4 fails", () => {
    const three = grin + fox + cyclone;
    expect(z.string().min(4).safeParse(three).success).toBe(zodCount(three) >= 4);
    expect(dna.string().min(4).validate(three)).toBe(false);
    expect(dna.string().min(4).safeParse(three).success).toBe(false);
  });

  test("Three emojis 😀🦊🌀 .min(3) — both pass (zodCount≥3, 3≥3)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().min(3).safeParse(three).success).toBe(true);
    expect(dna.string().min(3).validate(three)).toBe(true);
    expect(dna.string().min(3).safeParse(three).success).toBe(true);
  });
});

// =============================================================================
// Flag emojis — regional indicator pairs (U+1F1E6 to U+1F1FF)
// Each flag = 2 code points = 4 code units — DIVERGENCE on Zod ≤4.4
// 🇫🇷 = U+1F1EB U+1F1F7 = 2 code points = 4 code units
// Zod ≤4.4 counts 4 (code units), DNA counts 2 (code points)
// Zod ≥4.5 counts 2 (code points), DNA counts 2 (code points) — no divergence
// =============================================================================

describe("Flag emojis (4 code units = 2 code points)", () => {
  const flagFR = "🇫🇷";
  const flagUS = "🇺🇸";
  const flagJP = "🇯🇵";

  test("Flag 🇫🇷 .length(4) — Zod: zodCount=4 passes, DNA: 2≠4 fails", () => {
    expect(z.string().length(4).safeParse(flagFR).success).toBe(zodCount(flagFR) === 4);
    expect(dna.string().length(4).validate(flagFR)).toBe(false);
    expect(dna.string().length(4).safeParse(flagFR).success).toBe(false);
  });

  test("Flag 🇫🇷 .length(2) — Zod: zodCount=2 passes, DNA: 2=2 passes", () => {
    expect(z.string().length(2).safeParse(flagFR).success).toBe(zodCount(flagFR) === 2);
    expect(dna.string().length(2).validate(flagFR)).toBe(true);
    expect(dna.string().length(2).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .max(5) — both pass (zodCount≤5, 2≤5)", () => {
    expect(z.string().max(5).safeParse(flagFR).success).toBe(true);
    expect(dna.string().max(5).validate(flagFR)).toBe(true);
    expect(dna.string().max(5).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .max(3) — Zod: zodCount≤3, DNA: 2≤3 passes", () => {
    expect(z.string().max(3).safeParse(flagFR).success).toBe(zodCount(flagFR) <= 3);
    expect(dna.string().max(3).validate(flagFR)).toBe(true);
    expect(dna.string().max(3).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .min(3) — Zod: zodCount≥3, DNA: 2<3 fails", () => {
    expect(z.string().min(3).safeParse(flagFR).success).toBe(zodCount(flagFR) >= 3);
    expect(dna.string().min(3).validate(flagFR)).toBe(false);
    expect(dna.string().min(3).safeParse(flagFR).success).toBe(false);
  });

  test("Two flags 🇫🇷🇺🇸 .length(8) — Zod: zodCount=8 passes, DNA: 4≠8 fails", () => {
    expect(z.string().length(8).safeParse(flagFR + flagUS).success).toBe(zodCount(flagFR + flagUS) === 8);
    expect(dna.string().length(8).validate(flagFR + flagUS)).toBe(false);
    expect(dna.string().length(8).safeParse(flagFR + flagUS).success).toBe(false);
  });

  test("Two flags 🇫🇷🇺🇸 .length(4) — Zod: zodCount=4 passes, DNA: 4=4 passes", () => {
    expect(z.string().length(4).safeParse(flagFR + flagUS).success).toBe(zodCount(flagFR + flagUS) === 4);
    expect(dna.string().length(4).validate(flagFR + flagUS)).toBe(true);
    expect(dna.string().length(4).safeParse(flagFR + flagUS).success).toBe(true);
  });

  test("Three flags 🇫🇷🇺🇸🇯🇵 .max(10) — Zod: zodCount≤10, DNA: 6≤10 passes", () => {
    const three = flagFR + flagUS + flagJP;
    expect(z.string().max(10).safeParse(three).success).toBe(zodCount(three) <= 10);
    expect(dna.string().max(10).validate(three)).toBe(true);
    expect(dna.string().max(10).safeParse(three).success).toBe(true);
  });

  test("Three flags 🇫🇷🇺🇸🇯🇵 .min(8) — Zod: zodCount≥8, DNA: 6<8 fails", () => {
    const three = flagFR + flagUS + flagJP;
    expect(z.string().min(8).safeParse(three).success).toBe(zodCount(three) >= 8);
    expect(dna.string().min(8).validate(three)).toBe(false);
    expect(dna.string().min(8).safeParse(three).success).toBe(false);
  });
});

// =============================================================================
// Mixed ASCII + astral — real-world scenarios
// =============================================================================

describe("Mixed ASCII + astral characters", () => {
  test("'a😀b' .length(4) — Zod: zodCount=4 passes, DNA: 3≠4 fails", () => {
    expect(z.string().length(4).safeParse("a😀b").success).toBe(zodCount("a😀b") === 4);
    expect(dna.string().length(4).validate("a😀b")).toBe(false);
    expect(dna.string().length(4).safeParse("a😀b").success).toBe(false);
  });

  test("'a😀b' .length(3) — Zod: zodCount=3 passes, DNA: 3=3 passes", () => {
    expect(z.string().length(3).safeParse("a😀b").success).toBe(zodCount("a😀b") === 3);
    expect(dna.string().length(3).validate("a😀b")).toBe(true);
    expect(dna.string().length(3).safeParse("a😀b").success).toBe(true);
  });

  // "Hello 🌍!" = 8 code points, 9 code units
  // "Hello " = 6 chars, "🌍" = 1 code point (2 code units), "!" = 1 char
  test("'Hello 🌍!' .max(7) — both fail (zodCount>7, 8>7)", () => {
    expect(z.string().max(7).safeParse("Hello 🌍!").success).toBe(zodCount("Hello 🌍!") <= 7);
    expect(dna.string().max(7).validate("Hello 🌍!")).toBe(false);
    expect(dna.string().max(7).safeParse("Hello 🌍!").success).toBe(false);
  });

  test("'Hello 🌍!' .max(8) — Zod: zodCount≤8, DNA: 8≤8 passes", () => {
    expect(z.string().max(8).safeParse("Hello 🌍!").success).toBe(zodCount("Hello 🌍!") <= 8);
    expect(dna.string().max(8).validate("Hello 🌍!")).toBe(true);
    expect(dna.string().max(8).safeParse("Hello 🌍!").success).toBe(true);
  });

  test("'Hello 🌍!' .min(8) — both pass (zodCount≥8, 8≥8)", () => {
    expect(z.string().min(8).safeParse("Hello 🌍!").success).toBe(true);
    expect(dna.string().min(8).validate("Hello 🌍!")).toBe(true);
    expect(dna.string().min(8).safeParse("Hello 🌍!").success).toBe(true);
  });

  test("'Hello 🌍!' .min(9) — Zod: zodCount≥9, DNA: 8<9 fails", () => {
    expect(z.string().min(9).safeParse("Hello 🌍!").success).toBe(zodCount("Hello 🌍!") >= 9);
    expect(dna.string().min(9).validate("Hello 🌍!")).toBe(false);
    expect(dna.string().min(9).safeParse("Hello 🌍!").success).toBe(false);
  });
});

// =============================================================================
// ZWJ sequences — Zero Width Joiner (U+200D)
// 👩‍🚀 = woman + ZWJ + rocket = 3 code points = 5 code units — DIVERGENCE on Zod ≤4.4
// Zod ≤4.4 counts 5 (code units), DNA counts 3 (code points)
// Zod ≥4.5 counts 3 (code points), DNA counts 3 (code points) — no divergence
// =============================================================================

describe("ZWJ sequences (3 code points = 5 code units)", () => {
  const womanRocket = "👩‍🚀"; // U+1F469 U+200D U+1F680

  test("ZWJ 👩‍🚀 .length(5) — Zod: zodCount=5 passes, DNA: 3≠5 fails", () => {
    expect(z.string().length(5).safeParse(womanRocket).success).toBe(zodCount(womanRocket) === 5);
    expect(dna.string().length(5).validate(womanRocket)).toBe(false);
    expect(dna.string().length(5).safeParse(womanRocket).success).toBe(false);
  });

  test("ZWJ 👩‍🚀 .length(3) — Zod: zodCount=3 passes, DNA: 3=3 passes", () => {
    expect(z.string().length(3).safeParse(womanRocket).success).toBe(zodCount(womanRocket) === 3);
    expect(dna.string().length(3).validate(womanRocket)).toBe(true);
    expect(dna.string().length(3).safeParse(womanRocket).success).toBe(true);
  });

  test("ZWJ 👩‍🚀 .max(4) — Zod: zodCount≤4, DNA: 3≤4 passes", () => {
    expect(z.string().max(4).safeParse(womanRocket).success).toBe(zodCount(womanRocket) <= 4);
    expect(dna.string().max(4).validate(womanRocket)).toBe(true);
    expect(dna.string().max(4).safeParse(womanRocket).success).toBe(true);
  });

  test("ZWJ 👩‍🚀 .min(4) — Zod: zodCount≥4, DNA: 3<4 fails", () => {
    expect(z.string().min(4).safeParse(womanRocket).success).toBe(zodCount(womanRocket) >= 4);
    expect(dna.string().min(4).validate(womanRocket)).toBe(false);
    expect(dna.string().min(4).safeParse(womanRocket).success).toBe(false);
  });
});

// =============================================================================
// Lone surrogates — malformed UTF-16 (unpaired surrogate)
// JavaScript strings can contain them, but they're invalid Unicode
// fCount skips low surrogates (U+DC00–U+DFFF), counts high surrogates (U+D800–U+DBFF)
// =============================================================================

describe("Lone surrogates (malformed UTF-16, DIVERGE on low)", () => {
  // Lone high surrogate U+D83C (first half of a surrogate pair, no low surrogate)
  const loneHigh = "\uD83C";
  // Lone low surrogate U+DF00 (second half, no high surrogate)
  const loneLow = "\uDF00";

  test("Lone high surrogate \\uD83C .length(1) — both pass (Zod: 1=1, DNA fCount: 1=1)", () => {
    expect(z.string().length(1).safeParse(loneHigh).success).toBe(true);
    expect(dna.string().length(1).validate(loneHigh)).toBe(true);
    expect(dna.string().length(1).safeParse(loneHigh).success).toBe(true);
  });

  test("Lone low surrogate \\uDF00 .length(1) — Zod passes (1=1), DNA fails (fCount skips low → 0≠1)", () => {
    expect(z.string().length(1).safeParse(loneLow).success).toBe(true);
    expect(dna.string().length(1).validate(loneLow)).toBe(false);
    expect(dna.string().length(1).safeParse(loneLow).success).toBe(false);
  });

  test("Lone high surrogate \\uD83C .min(1) — both pass", () => {
    expect(z.string().min(1).safeParse(loneHigh).success).toBe(true);
    expect(dna.string().min(1).validate(loneHigh)).toBe(true);
    expect(dna.string().min(1).safeParse(loneHigh).success).toBe(true);
  });

  test("Lone low surrogate \\uDF00 .min(1) — Zod passes (1≥1), DNA fails (fCount=0 < 1)", () => {
    expect(z.string().min(1).safeParse(loneLow).success).toBe(true);
    expect(dna.string().min(1).validate(loneLow)).toBe(false);
    expect(dna.string().min(1).safeParse(loneLow).success).toBe(false);
  });
});

// =============================================================================
// UTF-32 conceptual — characters that are single code points in UTF-32
// but 2 code units in UTF-16 (astral plane, grouped here for clarity)
// =============================================================================

describe("UTF-32 single code points (1 UTF-32 unit = 2 UTF-16 units)", () => {
  // Mathematical symbols U+1D5XX
  const mathD = "𝔻"; // U+1D537 — 1 code point, 2 code units
  const mathE = "𝔼"; // U+1D538
  const mathF = "𝔽"; // U+1D539

  test("Math 𝔻 .length(2) — Zod: zodCount=2 passes, DNA: 1≠2 fails", () => {
    expect(z.string().length(2).safeParse(mathD).success).toBe(zodCount(mathD) === 2);
    expect(dna.string().length(2).validate(mathD)).toBe(false);
    expect(dna.string().length(2).safeParse(mathD).success).toBe(false);
  });

  test("Math 𝔻 .length(1) — Zod: zodCount=1 passes, DNA: 1=1 passes", () => {
    expect(z.string().length(1).safeParse(mathD).success).toBe(zodCount(mathD) === 1);
    expect(dna.string().length(1).validate(mathD)).toBe(true);
    expect(dna.string().length(1).safeParse(mathD).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .length(6) — Zod: zodCount=6 passes, DNA: 3≠6 fails", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().length(6).safeParse(three).success).toBe(zodCount(three) === 6);
    expect(dna.string().length(6).validate(three)).toBe(false);
    expect(dna.string().length(6).safeParse(three).success).toBe(false);
  });

  test("Math 𝔻𝔼𝔽 .length(3) — Zod: zodCount=3 passes, DNA: 3=3 passes", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().length(3).safeParse(three).success).toBe(zodCount(three) === 3);
    expect(dna.string().length(3).validate(three)).toBe(true);
    expect(dna.string().length(3).safeParse(three).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .max(4) — Zod: zodCount≤4, DNA: 3≤4 passes", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().max(4).safeParse(three).success).toBe(zodCount(three) <= 4);
    expect(dna.string().max(4).validate(three)).toBe(true);
    expect(dna.string().max(4).safeParse(three).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .min(4) — Zod: zodCount≥4, DNA: 3<4 fails", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().min(4).safeParse(three).success).toBe(zodCount(three) >= 4);
    expect(dna.string().min(4).validate(three)).toBe(false);
    expect(dna.string().min(4).safeParse(three).success).toBe(false);
  });
});

// =============================================================================
// Summary — documents the counting behavior with actual schema calls
// On Zod ≤4.4: Zod counts UTF-16 code units, DNA counts Unicode code points (DIVERGE)
// On Zod ≥4.5: both count Unicode code points (AGREE)
// =============================================================================

describe("Counting behavior documentation", () => {
  test("DNA always counts Unicode code points; Zod depends on version", () => {
    const emoji = "😀";
    const flag = "🇫🇷";
    const zwj = "👩‍🚀";

    // Zod — behavior depends on version (probe at top of file)
    expect(z.string().length(2).safeParse(emoji).success).toBe(zodCount(emoji) === 2);
    expect(z.string().length(1).safeParse(emoji).success).toBe(zodCount(emoji) === 1);
    expect(z.string().length(4).safeParse(flag).success).toBe(zodCount(flag) === 4);
    expect(z.string().length(5).safeParse(zwj).success).toBe(zodCount(zwj) === 5);

    // DNA always uses fCount (code points) — verified via actual schema calls
    expect(dna.string().length(2).safeParse(emoji).success).toBe(false); // 1 point ≠ 2
    expect(dna.string().length(1).safeParse(emoji).success).toBe(true);  // 1 point = 1 ✅
    expect(dna.string().length(4).safeParse(flag).success).toBe(false);  // 2 points ≠ 4
    expect(dna.string().length(5).safeParse(zwj).success).toBe(false);   // 3 points ≠ 5
  });
});

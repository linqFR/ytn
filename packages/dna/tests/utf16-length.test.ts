import { expect, test, describe } from "vitest";

import { dna } from "../src/index.js";
import { z } from "zod";

// =============================================================================
// UTF-8 / UTF-16 / UTF-32 string length tests — Zod vs DNA
//
// Zod v4 uses String.prototype.length (UTF-16 code units count, O(1))
// DNA uses fCount() (Unicode code points count, O(n))
//
// This file tests the divergence on multi-unit characters:
// - BMP (Basic Multilingual Plane): 1 code unit per char — no divergence
// - Combining characters: 1 code unit per combining mark — no divergence
// - Astral plane (surrogate pairs): 2 code units per code point — DIVERGENCE
// - Flag emojis (regional indicator pairs): 2 code units per code point — DIVERGENCE
// - ZWJ sequences: variable code units per code point — DIVERGENCE
// - Lone surrogates: malformed UTF-16 — DIVERGENCE on low surrogates
// =============================================================================

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
// 2 code units per code point — DIVERGENCE
// Zod counts 2, DNA counts 1
// =============================================================================

describe("Astral plane — surrogate pairs (2 code units = 1 code point, DIVERGE)", () => {
  // U+1F600 😀 — 1 code point, 2 code units
  const grin = "😀";
  // U+1F98A 🦊 — 1 code point, 2 code units
  const fox = "🦊";
  // U+1F300 🌀 — 1 code point, 2 code units
  const cyclone = "🌀";

  test("Single emoji 😀 .length(2) — Zod passes (2=2), DNA fails (1≠2)", () => {
    expect(z.string().length(2).safeParse(grin).success).toBe(true);
    expect(dna.string().length(2).validate(grin)).toBe(false);
    expect(dna.string().length(2).safeParse(grin).success).toBe(false);
  });

  test("Single emoji 😀 .length(1) — Zod fails (2≠1), DNA passes (1=1)", () => {
    expect(z.string().length(1).safeParse(grin).success).toBe(false);
    expect(dna.string().length(1).validate(grin)).toBe(true);
    expect(dna.string().length(1).safeParse(grin).success).toBe(true);
  });

  test("Two emojis 😀😀 .length(4) — Zod passes (4=4), DNA fails (2≠4)", () => {
    expect(z.string().length(4).safeParse(grin + grin).success).toBe(true);
    expect(dna.string().length(4).validate(grin + grin)).toBe(false);
    expect(dna.string().length(4).safeParse(grin + grin).success).toBe(false);
  });

  test("Two emojis 😀😀 .length(2) — Zod fails (4≠2), DNA passes (2=2)", () => {
    expect(z.string().length(2).safeParse(grin + grin).success).toBe(false);
    expect(dna.string().length(2).validate(grin + grin)).toBe(true);
    expect(dna.string().length(2).safeParse(grin + grin).success).toBe(true);
  });

  test("Single emoji 😀 .min(2) — Zod passes (2≥2), DNA fails (1<2)", () => {
    expect(z.string().min(2).safeParse(grin).success).toBe(true);
    expect(dna.string().min(2).validate(grin)).toBe(false);
    expect(dna.string().min(2).safeParse(grin).success).toBe(false);
  });

  test("Single emoji 😀 .min(1) — both pass (2≥1, 1≥1)", () => {
    expect(z.string().min(1).safeParse(grin).success).toBe(true);
    expect(dna.string().min(1).validate(grin)).toBe(true);
    expect(dna.string().min(1).safeParse(grin).success).toBe(true);
  });

  test("Single emoji 😀 .max(1) — Zod fails (2>1), DNA passes (1≤1)", () => {
    expect(z.string().max(1).safeParse(grin).success).toBe(false);
    expect(dna.string().max(1).validate(grin)).toBe(true);
    expect(dna.string().max(1).safeParse(grin).success).toBe(true);
  });

  test("Single emoji 😀 .max(2) — both pass (2≤2, 1≤2)", () => {
    expect(z.string().max(2).safeParse(grin).success).toBe(true);
    expect(dna.string().max(2).validate(grin)).toBe(true);
    expect(dna.string().max(2).safeParse(grin).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .max(5) — Zod fails (6>5), DNA passes (3≤5)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().max(5).safeParse(three).success).toBe(false);
    expect(dna.string().max(5).validate(three)).toBe(true);
    expect(dna.string().max(5).safeParse(three).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .max(6) — both pass (6≤6, 3≤6)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().max(6).safeParse(three).success).toBe(true);
    expect(dna.string().max(6).validate(three)).toBe(true);
    expect(dna.string().max(6).safeParse(three).success).toBe(true);
  });

  test("Three emojis 😀🦊🌀 .min(4) — Zod passes (6≥4), DNA fails (3<4)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().min(4).safeParse(three).success).toBe(true);
    expect(dna.string().min(4).validate(three)).toBe(false);
    expect(dna.string().min(4).safeParse(three).success).toBe(false);
  });

  test("Three emojis 😀🦊🌀 .min(3) — both pass (6≥3, 3≥3)", () => {
    const three = grin + fox + cyclone;
    expect(z.string().min(3).safeParse(three).success).toBe(true);
    expect(dna.string().min(3).validate(three)).toBe(true);
    expect(dna.string().min(3).safeParse(three).success).toBe(true);
  });
});

// =============================================================================
// Flag emojis — regional indicator pairs (U+1F1E6 to U+1F1FF)
// Each flag = 2 code points = 4 code units — DIVERGENCE
// 🇫🇷 = U+1F1EB U+1F1F7 = 2 code points = 4 code units
// Zod counts 4, DNA counts 2
// =============================================================================

describe("Flag emojis (4 code units = 2 code points, DIVERGE)", () => {
  const flagFR = "🇫🇷";
  const flagUS = "🇺🇸";
  const flagJP = "🇯🇵";

  test("Flag 🇫🇷 .length(4) — Zod passes (4=4), DNA fails (2≠4)", () => {
    expect(z.string().length(4).safeParse(flagFR).success).toBe(true);
    expect(dna.string().length(4).validate(flagFR)).toBe(false);
    expect(dna.string().length(4).safeParse(flagFR).success).toBe(false);
  });

  test("Flag 🇫🇷 .length(2) — Zod fails (4≠2), DNA passes (2=2)", () => {
    expect(z.string().length(2).safeParse(flagFR).success).toBe(false);
    expect(dna.string().length(2).validate(flagFR)).toBe(true);
    expect(dna.string().length(2).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .max(5) — both pass (4≤5, 2≤5)", () => {
    expect(z.string().max(5).safeParse(flagFR).success).toBe(true);
    expect(dna.string().max(5).validate(flagFR)).toBe(true);
    expect(dna.string().max(5).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .max(3) — Zod fails (4>3), DNA passes (2≤3)", () => {
    expect(z.string().max(3).safeParse(flagFR).success).toBe(false);
    expect(dna.string().max(3).validate(flagFR)).toBe(true);
    expect(dna.string().max(3).safeParse(flagFR).success).toBe(true);
  });

  test("Flag 🇫🇷 .min(3) — Zod passes (4≥3), DNA fails (2<3)", () => {
    expect(z.string().min(3).safeParse(flagFR).success).toBe(true);
    expect(dna.string().min(3).validate(flagFR)).toBe(false);
    expect(dna.string().min(3).safeParse(flagFR).success).toBe(false);
  });

  test("Two flags 🇫🇷🇺🇸 .length(8) — Zod passes (8=8), DNA fails (4≠8)", () => {
    expect(z.string().length(8).safeParse(flagFR + flagUS).success).toBe(true);
    expect(dna.string().length(8).validate(flagFR + flagUS)).toBe(false);
    expect(dna.string().length(8).safeParse(flagFR + flagUS).success).toBe(false);
  });

  test("Two flags 🇫🇷🇺🇸 .length(4) — Zod fails (8≠4), DNA passes (4=4)", () => {
    expect(z.string().length(4).safeParse(flagFR + flagUS).success).toBe(false);
    expect(dna.string().length(4).validate(flagFR + flagUS)).toBe(true);
    expect(dna.string().length(4).safeParse(flagFR + flagUS).success).toBe(true);
  });

  test("Three flags 🇫🇷🇺🇸🇯🇵 .max(10) — Zod fails (12>10), DNA passes (6≤10)", () => {
    const three = flagFR + flagUS + flagJP;
    expect(z.string().max(10).safeParse(three).success).toBe(false);
    expect(dna.string().max(10).validate(three)).toBe(true);
    expect(dna.string().max(10).safeParse(three).success).toBe(true);
  });

  test("Three flags 🇫🇷🇺🇸🇯🇵 .min(8) — Zod passes (12≥8), DNA fails (6<8)", () => {
    const three = flagFR + flagUS + flagJP;
    expect(z.string().min(8).safeParse(three).success).toBe(true);
    expect(dna.string().min(8).validate(three)).toBe(false);
    expect(dna.string().min(8).safeParse(three).success).toBe(false);
  });
});

// =============================================================================
// Mixed ASCII + astral — real-world scenarios
// =============================================================================

describe("Mixed ASCII + astral characters (DIVERGE)", () => {
  test("'a😀b' .length(4) — Zod passes (4=4), DNA fails (3≠4)", () => {
    expect(z.string().length(4).safeParse("a😀b").success).toBe(true);
    expect(dna.string().length(4).validate("a😀b")).toBe(false);
    expect(dna.string().length(4).safeParse("a😀b").success).toBe(false);
  });

  test("'a😀b' .length(3) — Zod fails (4≠3), DNA passes (3=3)", () => {
    expect(z.string().length(3).safeParse("a😀b").success).toBe(false);
    expect(dna.string().length(3).validate("a😀b")).toBe(true);
    expect(dna.string().length(3).safeParse("a😀b").success).toBe(true);
  });

  // "Hello 🌍!" = 8 code points, 9 code units
  // "Hello " = 6 chars, "🌍" = 1 code point (2 code units), "!" = 1 char
  test("'Hello 🌍!' .max(7) — both fail (9>7, 8>7)", () => {
    expect(z.string().max(7).safeParse("Hello 🌍!").success).toBe(false);
    expect(dna.string().max(7).validate("Hello 🌍!")).toBe(false);
    expect(dna.string().max(7).safeParse("Hello 🌍!").success).toBe(false);
  });

  test("'Hello 🌍!' .max(8) — Zod fails (9>8), DNA passes (8≤8)", () => {
    expect(z.string().max(8).safeParse("Hello 🌍!").success).toBe(false);
    expect(dna.string().max(8).validate("Hello 🌍!")).toBe(true);
    expect(dna.string().max(8).safeParse("Hello 🌍!").success).toBe(true);
  });

  test("'Hello 🌍!' .min(8) — both pass (9≥8, 8≥8)", () => {
    expect(z.string().min(8).safeParse("Hello 🌍!").success).toBe(true);
    expect(dna.string().min(8).validate("Hello 🌍!")).toBe(true);
    expect(dna.string().min(8).safeParse("Hello 🌍!").success).toBe(true);
  });

  test("'Hello 🌍!' .min(9) — Zod passes (9≥9), DNA fails (8<9)", () => {
    expect(z.string().min(9).safeParse("Hello 🌍!").success).toBe(true);
    expect(dna.string().min(9).validate("Hello 🌍!")).toBe(false);
    expect(dna.string().min(9).safeParse("Hello 🌍!").success).toBe(false);
  });
});

// =============================================================================
// ZWJ sequences — Zero Width Joiner (U+200D)
// 👩‍🚀 = woman + ZWJ + rocket = 3 code points = 5 code units — DIVERGENCE
// Zod counts 5, DNA counts 3
// =============================================================================

describe("ZWJ sequences (3 code points = 5 code units, DIVERGE)", () => {
  const womanRocket = "👩‍🚀"; // U+1F469 U+200D U+1F680

  test("ZWJ 👩‍🚀 .length(5) — Zod passes (5=5), DNA fails (3≠5)", () => {
    expect(z.string().length(5).safeParse(womanRocket).success).toBe(true);
    expect(dna.string().length(5).validate(womanRocket)).toBe(false);
    expect(dna.string().length(5).safeParse(womanRocket).success).toBe(false);
  });

  test("ZWJ 👩‍🚀 .length(3) — Zod fails (5≠3), DNA passes (3=3)", () => {
    expect(z.string().length(3).safeParse(womanRocket).success).toBe(false);
    expect(dna.string().length(3).validate(womanRocket)).toBe(true);
    expect(dna.string().length(3).safeParse(womanRocket).success).toBe(true);
  });

  test("ZWJ 👩‍🚀 .max(4) — Zod fails (5>4), DNA passes (3≤4)", () => {
    expect(z.string().max(4).safeParse(womanRocket).success).toBe(false);
    expect(dna.string().max(4).validate(womanRocket)).toBe(true);
    expect(dna.string().max(4).safeParse(womanRocket).success).toBe(true);
  });

  test("ZWJ 👩‍🚀 .min(4) — Zod passes (5≥4), DNA fails (3<4)", () => {
    expect(z.string().min(4).safeParse(womanRocket).success).toBe(true);
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

describe("UTF-32 single code points (1 UTF-32 unit = 2 UTF-16 units, DIVERGE)", () => {
  // Mathematical symbols U+1D5XX
  const mathD = "𝔻"; // U+1D537 — 1 code point, 2 code units
  const mathE = "𝔼"; // U+1D538
  const mathF = "𝔽"; // U+1D539

  test("Math 𝔻 .length(2) — Zod passes (2=2), DNA fails (1≠2)", () => {
    expect(z.string().length(2).safeParse(mathD).success).toBe(true);
    expect(dna.string().length(2).validate(mathD)).toBe(false);
    expect(dna.string().length(2).safeParse(mathD).success).toBe(false);
  });

  test("Math 𝔻 .length(1) — Zod fails (2≠1), DNA passes (1=1)", () => {
    expect(z.string().length(1).safeParse(mathD).success).toBe(false);
    expect(dna.string().length(1).validate(mathD)).toBe(true);
    expect(dna.string().length(1).safeParse(mathD).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .length(6) — Zod passes (6=6), DNA fails (3≠6)", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().length(6).safeParse(three).success).toBe(true);
    expect(dna.string().length(6).validate(three)).toBe(false);
    expect(dna.string().length(6).safeParse(three).success).toBe(false);
  });

  test("Math 𝔻𝔼𝔽 .length(3) — Zod fails (6≠3), DNA passes (3=3)", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().length(3).safeParse(three).success).toBe(false);
    expect(dna.string().length(3).validate(three)).toBe(true);
    expect(dna.string().length(3).safeParse(three).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .max(4) — Zod fails (6>4), DNA passes (3≤4)", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().max(4).safeParse(three).success).toBe(false);
    expect(dna.string().max(4).validate(three)).toBe(true);
    expect(dna.string().max(4).safeParse(three).success).toBe(true);
  });

  test("Math 𝔻𝔼𝔽 .min(4) — Zod passes (6≥4), DNA fails (3<4)", () => {
    const three = mathD + mathE + mathF;
    expect(z.string().min(4).safeParse(three).success).toBe(true);
    expect(dna.string().min(4).validate(three)).toBe(false);
    expect(dna.string().min(4).safeParse(three).success).toBe(false);
  });
});

// =============================================================================
// Summary — documents the known divergences with actual schema calls
// =============================================================================

describe("Divergence documentation", () => {
  test("Zod counts UTF-16 code units, DNA counts Unicode code points", () => {
    const emoji = "😀";
    const flag = "🇫🇷";
    const zwj = "👩‍🚀";

    // Zod uses .length (UTF-16 code units) — verified via actual schema calls
    expect(z.string().length(2).safeParse(emoji).success).toBe(true);   // 2 units = 2 ✅
    expect(z.string().length(1).safeParse(emoji).success).toBe(false);  // 2 units ≠ 1
    expect(z.string().length(4).safeParse(flag).success).toBe(true);    // 4 units = 4 ✅
    expect(z.string().length(5).safeParse(zwj).success).toBe(true);     // 5 units = 5 ✅

    // DNA uses fCount (code points) — verified via actual schema calls
    expect(dna.string().length(2).safeParse(emoji).success).toBe(false); // 1 point ≠ 2
    expect(dna.string().length(1).safeParse(emoji).success).toBe(true);  // 1 point = 1 ✅
    expect(dna.string().length(4).safeParse(flag).success).toBe(false);  // 2 points ≠ 4
    expect(dna.string().length(5).safeParse(zwj).success).toBe(false);   // 3 points ≠ 5
  });
});

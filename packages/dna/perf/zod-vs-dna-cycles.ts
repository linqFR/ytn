/**
 * Benchmark: Zod vs DNA — first cycle (cold) vs subsequent cycles (warm)
 *
 * Measures operations per second for validation and parsing,
 * from the first cycle (before V8 JIT optimization) to subsequent cycles (after optimization).
 *
 * Methodology:
 * - Cold (first cycle): recompiles the function on each run (not measured),
 *   then measures the first batch of calls. Captures the baseline-JIT state.
 *   For DNA: validatorBuilder/parserBuilder(dnaSeq) creates an unoptimized new Function.
 *   For Zod: schema recreation, first safeParse before internal caches are set up.
 * - Warm (subsequent cycles): compiles once, massive warmup (10 000 calls),
 *   then measures. Captures the TurboFan-optimized state.
 * - 20 runs, median + CV% reported
 * - GC forced between runs (--expose-gc; degrades gracefully)
 * - DCE sink prevents V8 from eliminating calls
 * - Cold: order alternated per-run (DNA/Zod) to balance V8 tier-up bias
 *
 * Run: node --import tsx --expose-gc packages/dna/perf/zod-vs-dna-cycles.ts
 */

import { dna } from "../src/index.js";
import { validatorBuilder, parserBuilder } from "../src/toJs/dna-to-js.js";
import type { tsDnaSeq } from "../src/types/core.types.js";
import { z } from "zod";

// --- Configuration ---

const ITERATIONS = 1000;
const RUNS = 20;
const WARMUP = 10_000;
const GC_AVAILABLE = typeof globalThis.gc === "function";

/** Force GC between runs if --expose-gc was passed; no-op otherwise. */
function forceGc(): void {
  if (GC_AVAILABLE) globalThis.gc?.();
}

// --- Types ---

type Stats = { mean: number; median: number; p95: number; stdDev: number; cvPct: number };
type CompileFn = () => (data: unknown) => unknown;

type CaseDef = {
  name: string;
  makeDna: () => { toDna: () => tsDnaSeq };
  makeZod: () => { safeParse: (data: unknown) => unknown };
  data: unknown;
};

// --- DCE sink ---

let _sink = 0;

// --- Helpers ---

const computeStats = (samples: number[]): Stats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const cvPct = (stdDev / mean) * 100;
  return { mean, median, p95, stdDev, cvPct };
};

/**
 * Measures the first cycle (cold): recompiles the function on each run (not measured),
 * then measures the first batch of ITERATIONS calls. Captures the baseline-JIT state
 * before TurboFan optimizes the function. Order is alternated per-run to balance
 * V8 tier-up bias.
 */
const measureCold = (compile: CompileFn, data: unknown): Stats => {
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    forceGc();
    const fn = compile(); // recompile — not measured
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) _sink = (_sink + +!!fn(data)) | 0;
    const elapsed = performance.now() - start;
    samples.push(ITERATIONS / (elapsed / 1000));
  }
  return computeStats(samples);
};

/**
 * Measures subsequent cycles (warm): compiles once, massive warmup to
 * trigger TurboFan optimization, then measures RUNS batches.
 */
const measureWarm = (compile: CompileFn, data: unknown): Stats => {
  const fn = compile(); // compile once
  for (let i = 0; i < WARMUP; i++) _sink = (_sink + +!!fn(data)) | 0; // warmup — triggers TurboFan
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    forceGc();
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) _sink = (_sink + +!!fn(data)) | 0;
    const elapsed = performance.now() - start;
    samples.push(ITERATIONS / (elapsed / 1000));
  }
  return computeStats(samples);
};

const fmt = (n: number): string => Math.round(n).toLocaleString("en-US").padStart(12);
const fmtRatio = (n: number): string => `x${n.toFixed(2)}`.padStart(7);
const fmtRatioWide = (n: number): string => `x${n.toFixed(2)}`.padStart(9);
const fmtCv = (n: number): string => `${n.toFixed(1)}%`.padStart(6);

// --- Test cases ---

const cases: CaseDef[] = [
  {
    name: "1. Simple string",
    makeDna: () => dna.string(),
    makeZod: () => z.string(),
    data: "hello world",
  },
  {
    name: "2. Simple object (3 props)",
    makeDna: () => dna.object({
      name: dna.string(),
      age: dna.number(),
      active: dna.boolean(),
    }),
    makeZod: () => z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    }),
    data: { name: "John", age: 30, active: true },
  },
  {
    name: "3. Object with constraints (min/max/email/array)",
    makeDna: () => dna.object({
      name: dna.string().min(2).max(100),
      age: dna.number().min(0).max(150),
      email: dna.string().email(),
      tags: dna.array(dna.string()).min(1).max(10),
      active: dna.boolean(),
    }),
    makeZod: () => z.object({
      name: z.string().min(2).max(100),
      age: z.number().min(0).max(150),
      email: z.email(),
      tags: z.array(z.string()).min(1).max(10),
      active: z.boolean(),
    }),
    data: { name: "John Doe", age: 30, email: "john@example.com", tags: ["user", "premium"], active: true },
  },
  {
    name: "4. Array of objects (5 items)",
    makeDna: () => dna.array(
      dna.object({
        name: dna.string().min(2),
        age: dna.number().min(0),
        active: dna.boolean(),
      })
    ).min(1).max(100),
    makeZod: () => z.array(
      z.object({
        name: z.string().min(2),
        age: z.number().min(0),
        active: z.boolean(),
      })
    ).min(1).max(100),
    data: [
      { name: "John", age: 30, active: true },
      { name: "Jane", age: 25, active: false },
      { name: "Bob", age: 40, active: true },
      { name: "Alice", age: 35, active: true },
      { name: "Charlie", age: 28, active: false },
    ],
  },
  {
    name: "5. Deeply nested object (3 levels)",
    makeDna: () => dna.object({
      level1: dna.object({
        level2: dna.object({
          level3: dna.object({
            value: dna.string().min(1),
            count: dna.number().min(0),
          }),
        }),
      }),
    }),
    makeZod: () => z.object({
      level1: z.object({
        level2: z.object({
          level3: z.object({
            value: z.string().min(1),
            count: z.number().min(0),
          }),
        }),
      }),
    }),
    data: { level1: { level2: { level3: { value: "deep", count: 42 } } } },
  },
  {
    name: "6. Transform (trim + lowercase + Number)",
    makeDna: () => dna.string()
      .transform(s => s.trim())
      .transform(s => s.toLowerCase())
      .transform(s => Number(s)),
    makeZod: () => z.string()
      .transform(s => s.trim())
      .transform(s => s.toLowerCase())
      .transform(s => Number(s)),
    data: "  42  ",
  },
  {
    name: "7. Complex with transforms (nested object + array + constraints)",
    makeDna: () => dna.object({
      name: dna.string().min(2).max(100).transform(s => s.trim()),
      age: dna.string().transform(s => Number(s)),
      email: dna.string().email(),
      tags: dna.array(dna.string().min(1)).min(1).max(10),
      active: dna.boolean(),
      nested: dna.object({
        city: dna.string().min(1),
        zip: dna.string().transform(s => s.trim()),
      }),
    }),
    makeZod: () => z.object({
      name: z.string().min(2).max(100).transform(s => s.trim()),
      age: z.string().transform(s => Number(s)),
      email: z.email(),
      tags: z.array(z.string().min(1)).min(1).max(10),
      active: z.boolean(),
      nested: z.object({
        city: z.string().min(1),
        zip: z.string().transform(s => s.trim()),
      }),
    }),
    data: {
      name: "  John Doe  ",
      age: "30",
      email: "john@example.com",
      tags: ["user", "premium"],
      active: true,
      nested: { city: "Paris", zip: "  75001  " },
    },
  },
];

// --- Verification: ensure functions return valid results ---

for (const caseDef of cases) {
  const dnaSeq = caseDef.makeDna().toDna();
  const dnaV = validatorBuilder(dnaSeq);
  const dnaP = parserBuilder(dnaSeq);
  const zodS = caseDef.makeZod();

  const dv = dnaV(caseDef.data);
  const dp = dnaP(caseDef.data) as { success: boolean };
  const zp = zodS.safeParse(caseDef.data) as { success: boolean };

  if (dv !== true) {
    throw new Error(`${caseDef.name}: DNA validator returned ${String(dv)} for valid data`);
  }
  if (!dp.success) {
    throw new Error(`${caseDef.name}: DNA parser returned success=false for valid data`);
  }
  if (!zp.success) {
    throw new Error(`${caseDef.name}: Zod safeParse returned success=false for valid data`);
  }
}

// --- Execution ---

console.log("\n");
console.log("=".repeat(110));
console.log("BENCHMARK: Zod vs DNA — First cycle (cold) vs subsequent cycles (warm)");
console.log("=".repeat(110));
console.log(`Configuration: ${ITERATIONS} calls/batch x ${RUNS} runs | warmup: ${WARMUP.toLocaleString("en-US")} calls`);
console.log(`GC between runs: ${GC_AVAILABLE ? "YES (--expose-gc)" : "NO (pass --expose-gc for deterministic GC)"}`);
console.log(`Cold = recompile on each run (not measured), measure 1st batch (baseline-JIT, before TurboFan)`);
console.log(`Warm = compile 1x + warmup, measure after TurboFan optimization`);
console.log(`Unit: ops/sec (operations per second) — median used as primary metric | CV% = coefficient of variation`);
console.log(`Node: ${process.version} | V8: ${process.versions.v8}`);
console.log("=".repeat(110));

type CaseResult = {
  name: string;
  dnaVCold: number; dnaVWarm: number;
  dnaPCold: number; dnaPWarm: number;
  zodCold: number; zodWarm: number;
};

const results: CaseResult[] = [];

for (const caseDef of cases) {
  // Precompute the DNA sequence once (not measured)
  const dnaSeq = caseDef.makeDna().toDna();

  // Compile functions
  const dnaValidateCompile: CompileFn = () => validatorBuilder(dnaSeq);
  const dnaParseCompile: CompileFn = () => parserBuilder(dnaSeq);
  const zodCompile: CompileFn = () => {
    const schema = caseDef.makeZod();
    return (data: unknown) => schema.safeParse(data);
  };

  // Measurements
  console.log(`\n--- ${caseDef.name} ---`);

  const dnaVCold = measureCold(dnaValidateCompile, caseDef.data);
  const dnaVWarm = measureWarm(dnaValidateCompile, caseDef.data);

  const dnaPCold = measureCold(dnaParseCompile, caseDef.data);
  const dnaPWarm = measureWarm(dnaParseCompile, caseDef.data);

  const zodCold = measureCold(zodCompile, caseDef.data);
  const zodWarm = measureWarm(zodCompile, caseDef.data);

  // Per-case table
  console.log("| Engine  | Cold ops/s   | Cold CV% | Warm ops/s   | Warm CV% | Warm/Cold |");
  console.log("|---------|--------------|----------|--------------|----------|-----------|");
  console.log(`| DNA V   | ${fmt(dnaVCold.median)} | ${fmtCv(dnaVCold.cvPct)} | ${fmt(dnaVWarm.median)} | ${fmtCv(dnaVWarm.cvPct)} | ${fmtRatioWide(dnaVWarm.median / dnaVCold.median)} |`);
  console.log(`| DNA P   | ${fmt(dnaPCold.median)} | ${fmtCv(dnaPCold.cvPct)} | ${fmt(dnaPWarm.median)} | ${fmtCv(dnaPWarm.cvPct)} | ${fmtRatioWide(dnaPWarm.median / dnaPCold.median)} |`);
  console.log(`| Zod     | ${fmt(zodCold.median)} | ${fmtCv(zodCold.cvPct)} | ${fmt(zodWarm.median)} | ${fmtCv(zodWarm.cvPct)} | ${fmtRatioWide(zodWarm.median / zodCold.median)} |`);
  console.log("");
  console.log(`  DNA V vs Zod — cold: ${fmtRatio(dnaVCold.median / zodCold.median)} | warm: ${fmtRatio(dnaVWarm.median / zodWarm.median)}`);
  console.log(`  DNA P vs Zod — cold: ${fmtRatio(dnaPCold.median / zodCold.median)} | warm: ${fmtRatio(dnaPWarm.median / zodWarm.median)}`);

  results.push({
    name: caseDef.name,
    dnaVCold: dnaVCold.median, dnaVWarm: dnaVWarm.median,
    dnaPCold: dnaPCold.median, dnaPWarm: dnaPWarm.median,
    zodCold: zodCold.median, zodWarm: zodWarm.median,
  });
}

// --- Summary tables ---

const shortName = (n: string) => n.replace(/^\d+\.\s*/, "").slice(0, 38).padEnd(38);
const padR = (s: string, w: number) => s.padEnd(w);

console.log("\n" + "=".repeat(110));
console.log("SUMMARY 1/3 — Cold ops/sec (first cycle, before TurboFan)");
console.log("=".repeat(110));
console.log(`| ${padR("Case", 38)} | ${padR("DNA V", 12)} | ${padR("DNA P", 12)} | ${padR("Zod", 12)} | ${padR("V/Z", 7)} | ${padR("P/Z", 7)} |`);
console.log(`|${"-".repeat(40)}|${"-".repeat(14)}|${"-".repeat(14)}|${"-".repeat(14)}|${"-".repeat(9)}|${"-".repeat(9)}|`);
for (const r of results) {
  console.log(`| ${shortName(r.name)} | ${fmt(r.dnaVCold)} | ${fmt(r.dnaPCold)} | ${fmt(r.zodCold)} | ${fmtRatio(r.dnaVCold / r.zodCold)} | ${fmtRatio(r.dnaPCold / r.zodCold)} |`);
}

console.log("\n" + "=".repeat(110));
console.log("SUMMARY 2/3 — Warm ops/sec (subsequent cycles, after TurboFan)");
console.log("=".repeat(110));
console.log(`| ${padR("Case", 38)} | ${padR("DNA V", 12)} | ${padR("DNA P", 12)} | ${padR("Zod", 12)} | ${padR("V/Z", 7)} | ${padR("P/Z", 7)} |`);
console.log(`|${"-".repeat(40)}|${"-".repeat(14)}|${"-".repeat(14)}|${"-".repeat(14)}|${"-".repeat(9)}|${"-".repeat(9)}|`);
for (const r of results) {
  console.log(`| ${shortName(r.name)} | ${fmt(r.dnaVWarm)} | ${fmt(r.dnaPWarm)} | ${fmt(r.zodWarm)} | ${fmtRatio(r.dnaVWarm / r.zodWarm)} | ${fmtRatio(r.dnaPWarm / r.zodWarm)} |`);
}

console.log("\n" + "=".repeat(110));
console.log("SUMMARY 3/3 — Warm/Cold speedup ratio (JIT optimization gain)");
console.log("=".repeat(110));
console.log(`| ${padR("Case", 38)} | ${padR("DNA V", 7)} | ${padR("DNA P", 7)} | ${padR("Zod", 7)} |`);
console.log(`|${"-".repeat(40)}|${"-".repeat(9)}|${"-".repeat(9)}|${"-".repeat(9)}|`);
for (const r of results) {
  console.log(`| ${shortName(r.name)} | ${fmtRatio(r.dnaVWarm / r.dnaVCold)} | ${fmtRatio(r.dnaPWarm / r.dnaPCold)} | ${fmtRatio(r.zodWarm / r.zodCold)} |`);
}
console.log("=".repeat(110));
console.log("DNA V = DNA validator (boolean, fail-fast) | DNA P = DNA parser (result + reconstruction/transforms) | Zod = safeParse");
console.log("V/Z = DNA vs Zod speedup ratio | Warm/Cold = speedup after V8 JIT optimization (TurboFan)");
console.log("=".repeat(110));
console.log(`DCE sink: ${_sink} (non-zero confirms calls were not eliminated)`);

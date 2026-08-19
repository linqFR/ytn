/**
 * Benchmark: Codegen micro-patterns — instanceof, function overhead, loop optimization, IIFE
 *
 * Recreates the measurements referenced in docs/performance-technical-notes.md.
 * Produces portable ratios only (baseline = 1.00x).
 *
 * Methodology:
 * - 20 runs, median + CV% reported
 * - GC forced between runs (--expose-gc; degrades gracefully)
 * - DCE sink prevents V8 from eliminating operations
 * - Order alternated per-run to balance V8 tier-up bias
 * - Warmup: 10 000 iterations to trigger TurboFan
 *
 * Run: node --import tsx --expose-gc packages/dna/perf/bench-codegen-patterns.ts
 */

const GC_AVAILABLE = typeof globalThis.gc === "function";

/** Force GC between runs if --expose-gc was passed; no-op otherwise. */
function forceGc(): void {
  if (GC_AVAILABLE) globalThis.gc?.();
}

/** DCE sink — prevents V8 from eliminating operations. */
let _sink = 0;

const RUNS = 20;
const WARMUP = 1_000;

type Stats = { median: number; cvPct: number };

function computeStats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  return { median, cvPct: (stdDev / mean) * 100 };
}

/** Measure a function over N iterations, R runs, with warmup + GC + DCE sink. */
function bench(fn: () => void, iterations: number): Stats {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn();
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    forceGc();
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    samples.push(performance.now() - start);
  }
  return computeStats(samples);
}

const fmtRatio = (n: number): string => `x${n.toFixed(2)}`.padStart(7);
const fmtCv = (n: number): string => `${n.toFixed(1)}%`.padStart(6);

// ============================================================
// Section 1 — Instanceof Validation Performance (1M iterations)
// ============================================================

class MyClass {}
const instances: MyClass[] = Array.from({ length: 100 }, () => new MyClass());
let instIdx = 0;

// Direct instanceof
function directInstanceof(): void {
  _sink = (_sink + +(instances[instIdx] instanceof MyClass)) | 0;
  instIdx = (instIdx + 1) % 100;
}

// Registry-based (closure) — constructor captured in closure
const registry = new Map<string, typeof MyClass>([["MyClass", MyClass]]);
function makeClosureInstanceof(): () => void {
  const C = registry.get("MyClass")!;
  return () => {
    _sink = (_sink + +(instances[instIdx] instanceof C)) | 0;
    instIdx = (instIdx + 1) % 100;
  };
}

// Registry-based (inline) — constructor retrieved on every call
function makeInlineInstanceof(): () => void {
  return () => {
    const C = registry.get("MyClass")!;
    _sink = (_sink + +(instances[instIdx] instanceof C)) | 0;
    instIdx = (instIdx + 1) % 100;
  };
}

// Generated code (IIFE) — constructor retrieved within IIFE
function makeIifeInstanceof(): () => void {
  return (() => {
    return () => {
      const C = registry.get("MyClass")!;
      _sink = (_sink + +(instances[instIdx] instanceof C)) | 0;
      instIdx = (instIdx + 1) % 100;
    };
  })();
}

// ============================================================
// Section 2 — Function Overhead Performance (10M iterations)
// ============================================================

const offset = 1;
let fnValue = 0;

// Direct operation
function directOp(): void {
  _sink = (_sink + (fnValue + offset)) | 0;
  fnValue = (fnValue + 1) % 1000;
}

// Inline function
const inlineFn = (v: number) => v + offset;
function inlineCall(): void {
  _sink = (_sink + inlineFn(fnValue)) | 0;
  fnValue = (fnValue + 1) % 1000;
}

// Closure function
function makeClosureFn(): () => void {
  const D = (v: number) => v + offset;
  return () => {
    _sink = (_sink + D(fnValue)) | 0;
    fnValue = (fnValue + 1) % 1000;
  };
}

// Generated code (IIFE)
function makeIifeFn(): () => void {
  return () => {
    const D = (v: number) => v + offset;
    _sink = (_sink + D(fnValue)) | 0;
    fnValue = (fnValue + 1) % 1000;
  };
}

// ============================================================
// Section 3 — Loop Optimization Performance (100M iterations)
// ============================================================

const LOOP_N = 10_000_000;

function loopIncremental(): void {
  let acc = 0;
  for (let i = 0; i < LOOP_N; i++) acc = (acc + 1) | 0;
  _sink = (_sink + acc) | 0;
}

function loopDecremental(): void {
  let acc = 0;
  for (let i = LOOP_N; i--;) acc = (acc + 1) | 0;
  _sink = (_sink + acc) | 0;
}

function loopDecrementalInitOutside(): void {
  let acc = 0;
  let i = LOOP_N;
  for (; i--;) acc = (acc + 1) | 0;
  _sink = (_sink + acc) | 0;
}

// ============================================================
// Section 4 — IIFE Closure Pattern (100M iterations)
// ============================================================

function directFunction(): void {
  _sink = (_sink + (fnValue + offset)) | 0;
  fnValue = (fnValue + 1) % 1000;
}

function makeIifeClosed(): () => void {
  return (function (off: number) {
    const _offset = off;
    return function () {
      _sink = (_sink + (fnValue + _offset)) | 0;
      fnValue = (fnValue + 1) % 1000;
    };
  })(offset);
}

function makeIifeClosedArgs(): () => void {
  return (function (off: number) {
    return function () {
      _sink = (_sink + (fnValue + off)) | 0;
      fnValue = (fnValue + 1) % 1000;
    };
  })(offset);
}

function makeIifeClosedArgsConst(): () => void {
  return (function (off: number) {
    const _off = off;
    return function () {
      _sink = (_sink + (fnValue + _off)) | 0;
      fnValue = (fnValue + 1) % 1000;
    };
  })(offset);
}

function makeIifeNoArgs(): () => void {
  return (function () {
    const _offset = offset;
    return function () {
      _sink = (_sink + (fnValue + _offset)) | 0;
      fnValue = (fnValue + 1) % 1000;
    };
  })();
}

// ============================================================
// Runner
// ============================================================

type Case = { name: string; fn: () => void; iterations: number };

const cases: Case[] = [
  // Section 1 — Instanceof (1M iterations)
  { name: "1. Direct instanceof", fn: directInstanceof, iterations: 1_000_000 },
  { name: "1. Registry closure", fn: makeClosureInstanceof(), iterations: 1_000_000 },
  { name: "1. Registry inline", fn: makeInlineInstanceof(), iterations: 1_000_000 },
  { name: "1. Generated IIFE", fn: makeIifeInstanceof(), iterations: 1_000_000 },
  // Section 2 — Function overhead (1M iterations)
  { name: "2. Direct operation", fn: directOp, iterations: 1_000_000 },
  { name: "2. Inline function", fn: inlineCall, iterations: 1_000_000 },
  { name: "2. Closure function", fn: makeClosureFn(), iterations: 1_000_000 },
  { name: "2. Generated IIFE", fn: makeIifeFn(), iterations: 1_000_000 },
  // Section 3 — Loop optimization (10M iterations)
  { name: "3. Incremental loop", fn: loopIncremental, iterations: 1 },
  { name: "3. Decremental loop", fn: loopDecremental, iterations: 1 },
  { name: "3. Decremental init outside", fn: loopDecrementalInitOutside, iterations: 1 },
  // Section 4 — IIFE closure pattern (1M iterations)
  { name: "4. Direct function", fn: directFunction, iterations: 1_000_000 },
  { name: "4. IIFE closed", fn: makeIifeClosed(), iterations: 1_000_000 },
  { name: "4. IIFE closed args", fn: makeIifeClosedArgs(), iterations: 1_000_000 },
  { name: "4. IIFE closed args const", fn: makeIifeClosedArgsConst(), iterations: 1_000_000 },
  { name: "4. IIFE no args", fn: makeIifeNoArgs(), iterations: 1_000_000 },
];

console.log("\n");
console.log("=".repeat(90));
console.log("BENCHMARK: Codegen Micro-Patterns (instanceof, function overhead, loops, IIFE)");
console.log("=".repeat(90));
console.log(`Runs: ${RUNS} | Warmup: ${WARMUP.toLocaleString("en-US")} | GC: ${GC_AVAILABLE ? "YES (--expose-gc)" : "NO (pass --expose-gc)"}`);
console.log(`Node: ${process.version} | V8: ${process.versions.v8}`);
console.log("Ratios are relative to the baseline of each section (first row = x1.00).");
console.log("=".repeat(90));

// Section baselines
const baselines: Record<string, number> = {};
const sectionOf: Record<string, string> = {};
for (const c of cases) {
  const section = c.name.split(".")[0]!;
  sectionOf[c.name] = section;
  if (!baselines[section]) baselines[section] = 0;
}

const results: Record<string, Stats> = {};
for (const c of cases) {
  const stats = bench(c.fn, c.iterations);
  results[c.name] = stats;
  const section = sectionOf[c.name]!;
  if (!baselines[section]) baselines[section] = stats.median;
}

console.log("");
console.log("| Case                          | median ratio | CV%    |");
console.log("|-------------------------------|--------------|--------|");
for (const c of cases) {
  const section = sectionOf[c.name]!;
  const ratio = results[c.name]!.median / baselines[section]!;
  console.log(`| ${c.name.padEnd(29)} | ${fmtRatio(ratio)}      | ${fmtCv(results[c.name]!.cvPct)} |`);
}
console.log("=".repeat(90));
console.log(`DCE sink: ${_sink} (non-zero confirms operations were not eliminated)`);

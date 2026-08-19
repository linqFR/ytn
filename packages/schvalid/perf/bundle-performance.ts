/**
 * Benchmark: Full bundle vs Minified bundle — validation performance
 *
 * Compares the runtime performance of the full @ytrynot/dna/toJs bundle
 * against the minified @ytrynot/dna/toJs/min bundle.
 *
 * Methodology:
 * - 30 runs, median + CV% reported
 * - GC forced between runs (--expose-gc; degrades gracefully)
 * - DCE sink prevents V8 from eliminating calls
 * - Order alternated per-run (Full/Min) to balance V8 tier-up bias
 * - Warmup: 10 000 calls to trigger TurboFan
 *
 * Run: node --import tsx --expose-gc packages/schvalid/perf/bundle-performance.ts
 */

import { jschemaToDna } from "../src/index.js";
import { validator as validatorFull } from "@ytrynot/dna/toJs";
import { validator as validatorMin } from "@ytrynot/dna/toJs/min";

const GC_AVAILABLE = typeof globalThis.gc === "function";

/** Force GC between runs if --expose-gc was passed; no-op otherwise. */
function forceGc(): void {
  if (GC_AVAILABLE) globalThis.gc?.();
}

/** DCE sink — prevents V8 from eliminating function calls. */
let _sink = 0;

const schema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 2 },
    age: { type: "number", minimum: 0 },
    active: { type: "boolean" },
  },
  required: ["name", "age", "active"],
};

const dnaSeq = jschemaToDna(schema);

const validateFull = validatorFull(dnaSeq);
const validateMin = validatorMin(dnaSeq);

if (typeof validateFull !== "function") {
  throw new Error("Full bundle did not compile to a function");
}
if (typeof validateMin !== "function") {
  throw new Error("Minified bundle did not compile to a function");
}

if (validateFull({ name: "John", age: 30, active: true }) !== true) {
  throw new Error("Full bundle validation failed on valid data");
}
if (validateFull({ name: "J", age: 30, active: true }) !== false) {
  throw new Error("Full bundle validation should have failed on invalid data");
}
if (validateMin({ name: "John", age: 30, active: true }) !== true) {
  throw new Error("Minified bundle validation failed on valid data");
}
if (validateMin({ name: "J", age: 30, active: true }) !== false) {
  throw new Error("Minified bundle validation should have failed on invalid data");
}

const iterations = 10000;
const runs = 30;
const testData = { name: "John", age: 30, active: true };

// Warm up — triggers TurboFan
for (let i = 0; i < 10_000; i++) {
  _sink = (_sink + +!!validateFull(testData)) | 0;
  _sink = (_sink + +!!validateMin(testData)) | 0;
}

const fullSamples: number[] = [];
const minSamples: number[] = [];

// Interleaved runs with alternated order per-run
for (let r = 0; r < runs; r++) {
  forceGc();
  if (r % 2 === 0) {
    // Even runs: Full first
    const startFull = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!validateFull(testData)) | 0;
    fullSamples.push((performance.now() - startFull) / iterations);

    forceGc();
    const startMin = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!validateMin(testData)) | 0;
    minSamples.push((performance.now() - startMin) / iterations);
  } else {
    // Odd runs: Min first
    forceGc();
    const startMin = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!validateMin(testData)) | 0;
    minSamples.push((performance.now() - startMin) / iterations);

    forceGc();
    const startFull = performance.now();
    for (let i = 0; i < iterations; i++) _sink = (_sink + +!!validateFull(testData)) | 0;
    fullSamples.push((performance.now() - startFull) / iterations);
  }
}

const stats = (samples: number[]) => {
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

const fullStats = stats(fullSamples);
const minStats = stats(minSamples);

const toMs = (s: number) => (s * 1000).toFixed(3);
const toThroughput = (s: number) => (1 / s).toFixed(0);
const fmtCv = (n: number) => `${n.toFixed(1)}%`.padStart(6);

const diff = (minStats.median - fullStats.median) / fullStats.median;
const ratio = fullStats.median / minStats.median;

console.log("\n");
console.log("WARNING: Benchmark results may vary between runs due to parallel execution scheduling.");
console.log("=".repeat(80));
console.log("BUNDLE VALIDATION BENCHMARK with compiled function");
console.log("=".repeat(80));
console.log(`GC between runs: ${GC_AVAILABLE ? "YES (--expose-gc)" : "NO (pass --expose-gc)"}`);
console.log(`Schema:     JSON Schema -> DNA (object with string/number/boolean)`);
console.log(`Data:       ${JSON.stringify(testData)}`);
console.log(`Workload:   ${runs.toLocaleString()} runs x ${iterations.toLocaleString()} validations = ${(runs * iterations).toLocaleString()} total validations`);
console.log(`Method:     Alternated order per-run (Full/Min) | GC forced between runs | DCE sink`);
console.log("=".repeat(80));
console.log("| Bundle      | ms/validation | median (ms) | p95 (ms) | stddev (ms) | CV%   | validations/sec |");
console.log("|-------------|---------------|-------------|----------|-------------|-------|-----------------|");
console.log(`| Full bundle | ${toMs(fullStats.mean).padEnd(13)} | ${toMs(fullStats.median).padEnd(11)} | ${toMs(fullStats.p95).padEnd(8)} | ${toMs(fullStats.stdDev).padEnd(11)} | ${fmtCv(fullStats.cvPct)} | ${toThroughput(fullStats.median).padEnd(15)} |`);
console.log(`| Min bundle  | ${toMs(minStats.mean).padEnd(13)} | ${toMs(minStats.median).padEnd(11)} | ${toMs(minStats.p95).padEnd(8)} | ${toMs(minStats.stdDev).padEnd(11)} | ${fmtCv(minStats.cvPct)} | ${toThroughput(minStats.median).padEnd(15)} |`);
console.log("=".repeat(80));
console.log(`Min bundle is ${Math.abs(diff * 100).toFixed(2)}% ${diff < 0 ? "faster" : "slower"} than Full bundle (median)`);
console.log(`Speedup ratio (Full/Min): ${ratio.toFixed(2)}x`);
console.log("=".repeat(80));
console.log(`DCE sink: ${_sink} (non-zero confirms calls were not eliminated)`);

if (fullStats.median >= 0.01) {
  throw new Error(`Full bundle median ${fullStats.median} ms is too slow`);
}
if (minStats.median >= 0.01) {
  throw new Error(`Min bundle median ${minStats.median} ms is too slow`);
}

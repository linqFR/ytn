/**
 * Benchmark: if-chain (current codegen) vs Maranget decision tree (proposed)
 *
 * This is the benchmark that actually matters for the codegen decision.
 * It generates two complete routing functions from the SAME clause matrix:
 *   A. if-chain: sequential branch testing (current dna-js-json.ts cli() output)
 *   B. maranget-tree: nested switch/if decision tree (design doc proposal)
 *
 * Tests with N = 3, 10, 25, 50 branches to show O(N) vs O(log N) scaling.
 *
 * Methodology:
 *   - 10 runs per measurement, median reported, CV% (coefficient of variation)
 *   - GC forced between runs (requires --expose-gc; degrades gracefully)
 *   - Polymorphic inputs shuffled per-run (different seed) to defeat branch prediction
 *   - if-chain / maranget order alternated per-run to balance V8 tier-up bias
 *   - Results sunk into a global accumulator to prevent dead-code elimination
 *
 * Run: npx.cmd tsx --tsconfig packages/dna/tsconfig.json packages/dna/perf/bench-ifchain-vs-maranget.ts
 *   (add --expose-gc via NODE_OPTIONS for deterministic GC between runs)
 *
 * For GC-controlled runs:
 *   node --import tsx --expose-gc packages/dna/perf/bench-ifchain-vs-maranget.ts
 */

import { performance } from "node:perf_hooks";

// ---------------------------------------------------------------------------
// Key space — simulates a real CLI with multiple discriminator keys
// ---------------------------------------------------------------------------

interface IKey { name: string; values: string[]; optional: boolean }

const KEYS: IKey[] = [
  { name: "cmd",      values: ["build", "deploy", "test", "lint", "clean", "run", "stop", "init"], optional: false },
  { name: "mode",     values: ["dev", "prod", "test", "staging"], optional: false },
  { name: "fmt",      values: ["json", "yaml", "text"], optional: false },
  { name: "verbose",  values: ["on", "off"], optional: true },
];

// ---------------------------------------------------------------------------
// Clause matrix generation
// ---------------------------------------------------------------------------

interface IBranch {
  id: number;
  values: Record<string, string | undefined>; // key name → value (or undefined if optional+absent)
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBranches(N: number, seed = 42): IBranch[] {
  const rng = mulberry32(seed);
  const branches: IBranch[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (branches.length < N && attempts < N * 50) {
    attempts++;
    const values: Record<string, string | undefined> = {};
    const parts: string[] = [];
    for (const key of KEYS) {
      if (key.optional && rng() < 0.4) {
        values[key.name] = undefined;
        parts.push(`${key.name}=__absent__`);
      } else {
        const v = key.values[Math.floor(rng() * key.values.length)]!;
        values[key.name] = v;
        parts.push(`${key.name}=${v}`);
      }
    }
    const sig = parts.join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    branches.push({ id: branches.length, values });
  }
  return branches;
}

function branchToInput(b: IBranch): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const key of KEYS) {
    const v = b.values[key.name];
    if (v !== undefined) input[key.name] = v;
  }
  input["payload"] = "data";
  return input;
}

// ---------------------------------------------------------------------------
// A. if-chain codegen (current dna-js-json.ts cli() pattern)
// ---------------------------------------------------------------------------

function buildIfChain(branches: IBranch[]): (input: Record<string, unknown>) => number {
  const parts: string[] = [];
  parts.push("let _matched=false;let _branchIdx=-1;");

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]!;
    const conditions: string[] = [];
    for (const key of KEYS) {
      const v = b.values[key.name];
      const keyStr = JSON.stringify(key.name);
      if (v === undefined) {
        conditions.push(`input[${keyStr}]===undefined`);
      } else {
        conditions.push(`input[${keyStr}]===${JSON.stringify(v)}`);
      }
    }
    const cond = conditions.join("&&");
    parts.push(`if(${cond}){_matched=true;_branchIdx=${i};}`);
  }
  parts.push("return _branchIdx;");

  const body = parts.join("\n");
  return new Function("input", body) as (input: Record<string, unknown>) => number;
}

// ---------------------------------------------------------------------------
// B. Maranget decision tree codegen (proposed)
// ---------------------------------------------------------------------------

interface ICell { value: string } // "__absent__" for undefined

function branchToCells(b: IBranch): ICell[] {
  return KEYS.map(k => ({ value: b.values[k.name] ?? "__absent__" }));
}

/** q-heuristic: choose column with fewest distinct values that still splits */
function chooseColumn(matrix: ICell[][], remaining: Set<number>): number {
  let bestCol = -1;
  let minDistinct = Infinity;
  for (const col of remaining) {
    const vals = new Set<string>();
    for (const row of matrix) vals.add(row[col]!.value);
    if (vals.size < 2) continue; // doesn't split
    if (vals.size < minDistinct) { minDistinct = vals.size; bestCol = col; }
  }
  return bestCol;
}

function buildMarangetTree(branches: IBranch[]): (input: Record<string, unknown>) => number {
  const matrix: ICell[][] = branches.map(branchToCells);
  const indices = branches.map((_, i) => i);
  const allCols = new Set(KEYS.map((_, i) => i));

  function emit(matrix: ICell[][], targetIdx: number[], remaining: Set<number>, depth: number): string {
    const indent = "  ".repeat(depth + 1);

    if (targetIdx.length === 0) return `${indent}return -1;`;
    if (targetIdx.length === 1) return `${indent}return ${targetIdx[0]};`;

    // Check if any column can split
    let canSplit = false;
    for (const col of remaining) {
      const vals = new Set<string>();
      for (const row of matrix) vals.add(row[col]!.value);
      if (vals.size > 1) { canSplit = true; break; }
    }
    if (!canSplit) return `${indent}return ${targetIdx[0]};`;

    const col = chooseColumn(matrix, remaining);
    if (col === -1) return `${indent}return ${targetIdx[0]};`;

    const key = KEYS[col]!;
    const keyStr = JSON.stringify(key.name);
    const isOptional = key.optional;

    // Group rows by value
    const groups = new Map<string, { matrix: ICell[][]; idx: number[] }>();
    for (let i = 0; i < matrix.length; i++) {
      const v = matrix[i]![col]!.value;
      if (!groups.has(v)) groups.set(v, { matrix: [], idx: [] });
      groups.get(v)!.matrix.push(matrix[i]!);
      groups.get(v)!.idx.push(targetIdx[i]!);
    }

    const newRemaining = new Set(remaining);
    newRemaining.delete(col);

    const lines: string[] = [];

    if (isOptional) {
      // if-first pattern for optional keys (rule 2)
      const sorted = [...groups.entries()].sort(([a], [b]) => {
        if (a === "__absent__") return -1;
        if (b === "__absent__") return 1;
        return a.localeCompare(b);
      });

      let first = true;
      for (const [value, group] of sorted) {
        const cmp = value === "__absent__" ? "undefined" : JSON.stringify(value);
        const kw = first ? "if" : "else if";
        if (group.idx.length === 1 && newRemaining.size === 0) {
          lines.push(`${indent}${kw} (input[${keyStr}]===${cmp}) return ${group.idx[0]};`);
        } else {
          lines.push(`${indent}${kw} (input[${keyStr}]===${cmp}) {`);
          lines.push(emit(group.matrix, group.idx, newRemaining, depth + 1));
          lines.push(`${indent}}`);
        }
        first = false;
      }
      lines.push(`${indent}return -1;`);
    } else {
      // switch for required keys (rule 1)
      lines.push(`${indent}switch (input[${keyStr}]) {`);
      for (const [value, group] of groups) {
        const caseLabel = JSON.stringify(value);
        if (group.idx.length === 1 && newRemaining.size === 0) {
          lines.push(`${indent}  case ${caseLabel}: return ${group.idx[0]};`);
        } else {
          lines.push(`${indent}  case ${caseLabel}: {`);
          lines.push(emit(group.matrix, group.idx, newRemaining, depth + 1));
          lines.push(`${indent}  }`);
        }
      }
      lines.push(`${indent}  default: return -1;`);
      lines.push(`${indent}}`);
    }

    return lines.join("\n");
  }

  const body = emit(matrix, indices, allCols, 0);
  return new Function("input", body) as (input: Record<string, unknown>) => number;
}

// ---------------------------------------------------------------------------
// Harness — proper micro-benchmark methodology
// ---------------------------------------------------------------------------

/** Force GC between runs if --expose-gc was passed; no-op otherwise. */
function forceGc(): void {
  if (GC_AVAILABLE) globalThis.gc?.();
}

/** Fisher-Yates shuffle in-place using the provided RNG. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * DCE sink — accumulate results so V8 cannot eliminate the function calls.
 * Without this, V8 may detect that the return value is unused and skip the call.
 */
let _sink = 0;

function benchPoly(
  fn: (input: Record<string, unknown>) => number,
  inputs: Record<string, unknown>[],
  iters: number,
): number {
  const n = inputs.length;
  const start = performance.now();
  for (let i = 0; i < iters; i++) _sink = (_sink + fn(inputs[i % n]!)) | 0;
  const end = performance.now();
  return ((end - start) * 1e6) / iters;
}

function benchMono(
  fn: (input: Record<string, unknown>) => number,
  input: Record<string, unknown>,
  iters: number,
): number {
  const start = performance.now();
  for (let i = 0; i < iters; i++) _sink = (_sink + fn(input)) | 0;
  const end = performance.now();
  return ((end - start) * 1e6) / iters;
}

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m! - 1]! + s[m]!) / 2;
}

function cv(vals: number[]): number {
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  return (sd / mean) * 100;
}

const WARMUP = 100_000;
const ITERS = 1_000_000;
const RUNS = 15;
const Ns = [3, 10, 25, 50];
const GC_AVAILABLE = typeof globalThis.gc === "function";

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`=== if-chain (current codegen) vs Maranget tree (proposed) ===`);
console.log(`Node ${process.version} | warmup=${WARMUP} | iters=${ITERS} | runs=${RUNS}`);
console.log(`GC between runs: ${GC_AVAILABLE ? "YES (--expose-gc)" : "NO (pass --expose-gc for deterministic GC)"}`);
console.log(`Polymorphic | ${KEYS.length} keys (${KEYS.filter(k => k.optional).length} optional)`);
console.log(`Shuffle: per-run (different seed) | Order: alternated per-run\n`);

interface IResult { N: number; approach: string; case: string; medianNs: number; cvPct: number }
const allResults: IResult[] = [];

for (const N of Ns) {
  console.log(`\n--- N=${N} branches ---`);
  const branches = generateBranches(N);
  if (branches.length < N) { console.log(`  only generated ${branches.length} unique branches, skipping`); continue; }

  const ifChainFn = buildIfChain(branches);
  const marangetFn = buildMarangetTree(branches);

  // Verify correctness
  let verified = true;
  for (let i = 0; i < branches.length; i++) {
    const input = branchToInput(branches[i]!);
    const r1 = ifChainFn(input);
    const r2 = marangetFn(input);
    if (r1 !== i || r2 !== i) {
      console.log(`  MISMATCH branch ${i}: ifchain=${r1}, maranget=${r2}`);
      verified = false;
      break;
    }
  }
  // Invalid input
  const invalidInput: Record<string, unknown> = { cmd: "nonexistent", mode: "dev", fmt: "json", payload: "x" };
  if (ifChainFn(invalidInput) !== -1 || marangetFn(invalidInput) !== -1) {
    console.log(`  MISMATCH invalid: ifchain=${ifChainFn(invalidInput)}, maranget=${marangetFn(invalidInput)}`);
    verified = false;
  }
  if (!verified) { console.log("  verification FAILED, skipping benchmark"); continue; }
  console.log(`  verification passed (${branches.length} branches + invalid)`);

  // Build polymorphic inputs — varied hidden classes
  const validInputs: Record<string, unknown>[] = branches.map(branchToInput);
  // Add some with extra keys for hidden class diversity
  for (let i = 0; i < validInputs.length; i += 3) {
    validInputs[i] = { ...validInputs[i], extra: "x" };
  }
  // Invalid inputs
  const invalidInputs: Record<string, unknown>[] = [
    { cmd: "nonexistent", mode: "dev", fmt: "json", payload: "x" },
    { cmd: "build", mode: "nonexistent", fmt: "json", payload: "x" },
    { cmd: "build", mode: "dev", fmt: "nonexistent", payload: "x" },
  ];
  const allInputs = [...validInputs, ...invalidInputs];

  // Test cases: first, mid, last, invalid
  const firstInput = branchToInput(branches[0]!);
  const midInput = branchToInput(branches[Math.floor(branches.length / 2)]!);
  const lastInput = branchToInput(branches[branches.length - 1]!);

  type ICase = { name: string; input: Record<string, unknown> | Record<string, unknown>[] };
  const cases: ICase[] = [
    { name: "first", input: firstInput },
    { name: "mid", input: midInput },
    { name: "last", input: lastInput },
    { name: "invalid", input: invalidInputs[0]! },
    { name: "mixed(poly)", input: allInputs }, // special: array of inputs for polymorphic
  ];

  for (const { name: caseName, input } of cases) {
    const fns: [string, (input: Record<string, unknown>) => number][] = [
      ["if-chain", ifChainFn],
      ["maranget", marangetFn],
    ];

    // Collect runs for each approach
    const runData: Map<string, number[]> = new Map([["if-chain", []], ["maranget", []]]);

    for (let run = 0; run < RUNS; run++) {
      forceGc();

      // Alternate order: even runs = if-chain first, odd runs = maranget first
      const ordered = run % 2 === 0 ? fns : [fns[1]!, fns[0]!] as typeof fns;

      if (Array.isArray(input)) {
        // Polymorphic: shuffle inputs per-run with a different seed to defeat branch prediction
        const shuffled = shuffle([...input], mulberry32(run * 7919 + N * 31));
        for (const [approach, fn] of ordered) {
          for (let i = 0; i < WARMUP; i++) _sink = (_sink + fn(shuffled[i % shuffled.length]!)) | 0;
          runData.get(approach)!.push(benchPoly(fn, shuffled, ITERS));
        }
      } else {
        // Monomorphic single input (for comparison)
        for (const [approach, fn] of ordered) {
          for (let i = 0; i < WARMUP; i++) _sink = (_sink + fn(input)) | 0;
          runData.get(approach)!.push(benchMono(fn, input, ITERS));
        }
      }
    }

    for (const [approach, runs] of runData) {
      allResults.push({ N, approach, case: caseName, medianNs: median(runs), cvPct: cv(runs) });
    }
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`\n\n=== RESULTS (median ns/op, ${RUNS} runs) ===\n`);

for (const N of Ns) {
  const rs = allResults.filter(r => r.N === N);
  if (rs.length === 0) continue;
  console.log(`--- N=${N} branches ---`);
  console.log(`  approach    | case          |  median ns/op |   CV % | speedup`);
  console.log(`  ${"-".repeat(14)}|${"-".repeat(15)}|${"-".repeat(15)}|${"-".repeat(7)}|${"-".repeat(8)}`);

  const cases = [...new Set(rs.map(r => r.case))];
  for (const cs of cases) {
    const ifchain = rs.find(r => r.approach === "if-chain" && r.case === cs);
    const maranget = rs.find(r => r.approach === "maranget" && r.case === cs);
    if (ifchain && maranget) {
      const speedup = ifchain.medianNs / maranget.medianNs;
      console.log(`  if-chain     | ${cs.padEnd(15)}| ${ifchain.medianNs.toFixed(2).padStart(13)} | ${ifchain.cvPct.toFixed(1).padStart(5)} | ${speedup.toFixed(2)}x`);
      console.log(`  maranget     | ${cs.padEnd(15)}| ${maranget.medianNs.toFixed(2).padStart(13)} | ${maranget.cvPct.toFixed(1).padStart(5)} |   ---`);
    }
  }
  console.log();
}

// Summary: scaling
console.log(`=== SCALING SUMMARY (mixed/polymorphic case) ===\n`);
console.log(`  N branches | if-chain ns/op | maranget ns/op | speedup | if-chain O(N) | maranget O(log N)`);
console.log(`  ${"-".repeat(11)}|${"-".repeat(16)}|${"-".repeat(16)}|${"-".repeat(8)}|${"-".repeat(14)}|${"-".repeat(17)}`);
for (const N of Ns) {
  const ifchain = allResults.find(r => r.N === N && r.approach === "if-chain" && r.case === "mixed(poly)");
  const maranget = allResults.find(r => r.N === N && r.approach === "maranget" && r.case === "mixed(poly)");
  if (ifchain && maranget) {
    const speedup = ifchain.medianNs / maranget.medianNs;
    console.log(`  ${String(N).padStart(11)}| ${ifchain.medianNs.toFixed(2).padStart(14)} | ${maranget.medianNs.toFixed(2).padStart(14)} | ${speedup.toFixed(2)}x | ~${(ifchain.medianNs / Ns[0]! * 3).toFixed(0)} ns      | ~${(maranget.medianNs / Math.log2(N) * 3).toFixed(0)} ns`);
  }
}

console.log("\n=== BENCHMARK COMPLETE ===");
console.log(`DCE sink: ${_sink} (non-zero confirms calls were not eliminated)`);

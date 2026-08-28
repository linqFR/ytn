// ============================================================
// Oracle differential testing — Maranget marangetUnion (DEC-0039/DEC-0041)
// ============================================================
// Compares the compiled DNA decision tree against an independent
// reference compiler (same spec: Maranget rules 1/2/4 + Option B
// constructor-priority + q-heuristic) over randomized clause
// matrices and inputs.
//
// Reference semantics (Option B — deliberate deviation from
// Maranget strict): within each column, constructor rows win over
// wildcard rows; when a constructor case succeeds, wildcard rows
// (P2') are carried into that subtree; the base case picks rows[0].
// In "source-order" mode, rows are sorted by branchIdx instead.
//
// The reference compiler is written as a clean recursive TS tree
// (not JS step emission) so codegen bugs surface as divergences.
//
// Terminology (DEC-0041, F1 fix ACT-0028):
// - **trailing-wildcard row**: wildcards appear ONLY at the end (after all
//   values). The ADN encodes these as sparse arrays (absent = beyond length).
// - **non-trailing-wildcard row**: a wildcard appears BEFORE a declared value
//   (e.g. branch { help: "help" } without cmd, where cmd is a discriminator
//   for other branches). The ADN uses the explicit WILDCARD_CELL marker
//   ("\x00") to keep the matrix position-aligned (F1 fix).
//
// Two test runs:
// 1. Trailing-wildcard only (200 seeds × 60 inputs = 12,000 comparisons) —
//    the original oracle, exercises the sparse-encoding path.
// 2. Arbitrary-wildcard (200 seeds × 60 inputs = 12,000 comparisons) —
//    wildcards at ANY position, exercises the WILDCARD_CELL marker path
//    (F1 fix, ACT-0030). Both modes (source-order, constructor-priority).
import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import { toJS } from "../src/toJs/dna-to-js.js";

// --- Reference compiler (same q-heuristic as DNA) ---

type Cell = string[] | "*";
interface Row { cells: Cell[]; branchIdx: number }

// Output type of each branch after the __idx transform — the oracle reads
// `res.data.__idx` to identify which branch won the routing.
type BranchOut = Record<string, unknown> & { __idx: number };
type Node =
  | { kind: "leaf"; branchIdx?: number; fail?: boolean }
  | { kind: "switch"; col: number; cases: { value: string; subtree: Node }[]; default: Node }
  | { kind: "skip"; subtree: Node };

function classifyColumn(rows: Row[], col: number): "variable" | "constructor" | "mixture" {
  const allWild = rows.every(r => r.cells[col] === "*");
  if (allWild) return "variable";
  const allCtor = rows.every(r => r.cells[col] !== "*");
  if (allCtor) return "constructor";
  return "mixture";
}

function distinctValues(rows: Row[], col: number): Set<string> {
  const vals = new Set<string>();
  for (const r of rows) {
    const c = r.cells[col];
    if (c === "*") continue;
    for (const v of c) vals.add(v);
  }
  return vals;
}

function chooseColumn(rows: Row[], cols: number[]): number {
  let bestCol = -1;
  let minDistinct = Infinity;
  let bestNonSplit = -1;
  for (const col of cols) {
    const vals = distinctValues(rows, col);
    if (vals.size >= 2) {
      if (vals.size < minDistinct) { minDistinct = vals.size; bestCol = col; }
    } else if (vals.size === 1) {
      if (bestNonSplit === -1) bestNonSplit = col;
    }
    // vals.size === 0 → full-wildcard → skipped (variable rule)
  }
  return bestCol !== -1 ? bestCol : bestNonSplit;
}

type Mode = "constructor-priority" | "source-order";
// Merge constructor rows + carried wildcard rows in the routing order.
const orderRows = (a: Row[], b: Row[], mode: Mode): Row[] =>
  mode === "source-order"
    ? [...a, ...b].sort((x, y) => x.branchIdx - y.branchIdx)
    : [...a, ...b];

function compile(rows: Row[], cols: number[], mode: Mode = "constructor-priority"): Node {
  if (rows.length === 0) return { kind: "leaf", fail: true };
  if (cols.length === 0) return { kind: "leaf", branchIdx: rows[0].branchIdx };
  const col = chooseColumn(rows, cols);
  if (col === -1) return { kind: "leaf", branchIdx: rows[0].branchIdx };
  const remaining = cols.filter(c => c !== col);
  const rule = classifyColumn(rows, col);
  if (rule === "variable") return { kind: "skip", subtree: compile(rows, remaining) };

  const p1 = rows.filter(r => r.cells[col] !== "*");
  const p2 = rows.filter(r => r.cells[col] === "*");

  if (rule === "constructor") {
    const groups = new Map<string, Row[]>();
    for (const r of p1) {
      const c = r.cells[col] as string[];
      for (const v of c) {
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v)!.push(r);
      }
    }
    const cases = [...groups.entries()].map(([v, g]) => ({
      value: v,
      subtree: compile(g, remaining, mode),
    }));
    return { kind: "switch", col, cases, default: { kind: "leaf", fail: true } };
  }

  // mixture: carry P2' into each constructor case (§4)
  const groups = new Map<string, Row[]>();
  for (const r of p1) {
    const c = r.cells[col] as string[];
    for (const v of c) {
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v)!.push(r);
    }
  }
  const cases = [...groups.entries()].map(([v, g]) => ({
    value: v,
    subtree: compile(orderRows(g, p2, mode), remaining, mode),
  }));
  return { kind: "switch", col, cases, default: compile(p2, remaining, mode) };
}

function matchTree(node: Node, input: Record<string, string>): number | "fail" {
  if (node.kind === "leaf") return node.fail ? "fail" : node.branchIdx!;
  if (node.kind === "skip") return matchTree(node.subtree, input);
  // switch
  const colKey = `k${node.col}`;
  const val = input[colKey];
  for (const c of node.cases) {
    if (c.value === val) return matchTree(c.subtree, input);
  }
  return matchTree(node.default, input);
}

// --- Build DNA schemas from abstract rows ---

function buildSchemas(rows: Row[], nCols: number, keyOrder?: number[]) {
  const order = keyOrder ?? Array.from({ length: nCols }, (_, i) => i);
  return rows.map((row) => {
    const shape: Record<string, unknown> = {};
    for (const c of order) {
      const cell = row.cells[c];
      if (cell === "*") continue; // absent key → wildcard in DNA
      if (cell.length === 1) shape[`k${c}`] = dna.literal(cell[0]);
      else shape[`k${c}`] = dna.enum(cell as [string, ...string[]]);
    }
    // Mark the branch index via transform so we can identify the winner.
    // The index must be a literal (not a closure) — DNA serializes transform
    // functions via fnStr, so only self-contained bodies survive codegen.
    const obj = dna.object(shape);
    const idx = row.branchIdx;
    const fn = new Function("d", `return {...d, __idx: ${idx}}`) as (d: Record<string, unknown>) => BranchOut;
    return obj.transform(fn);
  });
}

// --- Deterministic PRNG (seeded) ---

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = ["build", "deploy", "help", "git", "commit", "push", "status", "run", "exec", "list"];

// --- Fuzz loop ---

function runCase(seed: number): { divergences: string[]; sentinelLeak: boolean } {
  const rand = mulberry32(seed);
  const mode: Mode = seed % 2 === 0 ? "source-order" : "constructor-priority";
  const nBranches = 2 + Math.floor(rand() * 4); // 2..5
  const nCols = 1 + Math.floor(rand() * 3);     // 1..3
  const maxValues = 1 + Math.floor(rand() * 2); // 1..2 (enum multi-values)

  // Build rows as PREFIXES: a branch declares columns 0..p-1 (values), the
  // remaining columns p..nCols-1 are wildcards ("*").
  const rows: Row[] = [];
  for (let b = 0; b < nBranches; b++) {
    const p = Math.floor(rand() * (nCols + 1)); // 0..nCols declared columns
    const cells: Cell[] = [];
    for (let c = 0; c < nCols; c++) {
      if (c >= p) {
        cells.push("*");
      } else {
        const n = 1 + Math.floor(rand() * maxValues);
        const vals = new Set<string>();
        while (vals.size < n) vals.add(POOL[Math.floor(rand() * POOL.length)]);
        cells.push([...vals]);
      }
    }
    rows.push({ cells, branchIdx: b });
  }

  // DNA schemas + union (both routing modes are exercised)
  const schemas = buildSchemas(rows, nCols);
  const union = dna.marangetUnion(schemas, { mode });

  // IMPORTANT: DNA auto-detects discriminators as the UNION of keys across
  // branches, in branch-declaration order (e.g. ['k2','k1','k0']). The
  // reference matrix MUST use that exact column order, otherwise the two
  // compilers route on different keys and every comparison diverges.
  const discOrder = union.discriminators as string[];
  const keyToCol = new Map<string, number>();
  for (let c = 0; c < nCols; c++) keyToCol.set(`k${c}`, c);
  const oracleRows: Row[] = rows.map(r => ({
    cells: discOrder.map(k => r.cells[keyToCol.get(k)!]),
    branchIdx: r.branchIdx,
  }));

  // Reference tree (columns indexed by discOrder position)
  const cols = Array.from({ length: discOrder.length }, (_, i) => i);
  const tree = compile(oracleRows, cols, mode);

  // Match uses the real key name per column position
  const match = (node: Node, input: Record<string, string>) => {
    if (node.kind === "leaf") return node.fail ? "fail" : node.branchIdx!;
    if (node.kind === "skip") return match(node.subtree, input);
    const val = input[discOrder[node.col]];
    for (const c of node.cases) {
      if (c.value === val) return match(c.subtree, input);
    }
    return match(node.default, input);
  };

  // Generate inputs: all keys present with random pool values
  const valuePool = [...POOL, "zzz-unknown", "nonexistent"];
  const divergences: string[] = [];
  for (let it = 0; it < 60; it++) {
    const input: Record<string, string> = {};
    for (let c = 0; c < nCols; c++) {
      if (rand() < 0.8) input[`k${c}`] = valuePool[Math.floor(rand() * valuePool.length)];
    }
    const expected = match(tree, input);
    const res = union.safeParse(input);
    if (expected === "fail") {
      if (res.success) {
        divergences.push(`expected FAIL, got success idx=${res.data.__idx} input=${JSON.stringify(input)}`);
      }
    } else if (!res.success) {
      divergences.push(`expected branch ${expected}, got FAIL input=${JSON.stringify(input)}`);
    } else if (res.data.__idx !== expected) {
      divergences.push(`expected branch ${expected}, got ${res.data.__idx} input=${JSON.stringify(input)}`);
    }
  }

  // INVARIANT: the generated code must NEVER contain the wildcard sentinel.
  // Two sentinels to check:
  // - `Symbol(wildcard)` — the internal `WILDCARD` unique symbol (algo-only,
  //   never emitted). Kept as a safety net in case the algo changes.
  // - `"\x00"` (NUL) — the ADN `WILDCARD_CELL` marker. If the codegen leaks
  //   it as a `case "\x00":` value, routing is broken (F1 regression).
  const gen = toJS(false, true)(union.toDna());
  const code = gen.code.join("");
  const sentinelLeak = code.includes("Symbol(wildcard)") || code.includes("\x00");
  return { divergences, sentinelLeak };
}

// --- Non-trailing-wildcard fuzz loop (F1 fix coverage, ACT-0030) ---
// Same as runCase but generates rows with wildcards at ARBITRARY positions
// (not just trailing). This exercises the WILDCARD_CELL marker path in the
// builder (_emitSelf) and the codegen (WILDCARD_CELL → WILDCARD).

function runCaseArbitrary(seed: number): { divergences: string[]; sentinelLeak: boolean } {
  const rand = mulberry32(seed + 100000); // offset to avoid overlap with runCase
  const mode: Mode = seed % 2 === 0 ? "source-order" : "constructor-priority";
  const nBranches = 2 + Math.floor(rand() * 4); // 2..5
  const nCols = 1 + Math.floor(rand() * 3);     // 1..3
  const maxValues = 1 + Math.floor(rand() * 2); // 1..2 (enum multi-values)

  // Build rows with wildcards at ARBITRARY positions (non-trailing).
  // Each cell is independently wildcard (~30%) or value (~70%).
  // This produces matrices like ["*", "help"] (wildcard before value)
  // which require the WILDCARD_CELL marker to stay position-aligned.
  const rows: Row[] = [];
  for (let b = 0; b < nBranches; b++) {
    const cells: Cell[] = [];
    for (let c = 0; c < nCols; c++) {
      if (rand() < 0.3) {
        cells.push("*");
      } else {
        const n = 1 + Math.floor(rand() * maxValues);
        const vals = new Set<string>();
        while (vals.size < n) vals.add(POOL[Math.floor(rand() * POOL.length)]);
        cells.push([...vals]);
      }
    }
    rows.push({ cells, branchIdx: b });
  }

  // DNA schemas + union (both routing modes are exercised).
  // Key insertion order is SHUFFLED per-seed: detectDiscriminators iterates
  // candidate keys in insertion order (Set preserves it), so a shuffled order
  // produces a discOrder that is NOT [k0, k1, ...] — the remapping
  // (discOrder.map(k => r.cells[keyToCol.get(k)])) is non-identity, which
  // exercises the column-reordering logic in the oracle and the codegen.
  const keyOrder = Array.from({ length: nCols }, (_, i) => i);
  for (let i = keyOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keyOrder[i], keyOrder[j]] = [keyOrder[j], keyOrder[i]];
  }
  const schemas = buildSchemas(rows, nCols, keyOrder);
  const union = dna.marangetUnion(schemas, { mode });

  // DNA auto-detects discriminators as the UNION of keys across branches.
  // A column that is wildcard in ALL branches is NOT a discriminator
  // (no branch has a finite value for it) — it is excluded from discOrder.
  const discOrder = union.discriminators as string[];
  const keyToCol = new Map<string, number>();
  for (let c = 0; c < nCols; c++) keyToCol.set(`k${c}`, c);
  const oracleRows: Row[] = rows.map(r => ({
    cells: discOrder.map(k => r.cells[keyToCol.get(k)!]),
    branchIdx: r.branchIdx,
  }));

  // Reference tree (columns indexed by discOrder position)
  const cols = Array.from({ length: discOrder.length }, (_, i) => i);
  const tree = compile(oracleRows, cols, mode);

  // Match uses the real key name per column position
  const match = (node: Node, input: Record<string, string>): number | "fail" => {
    if (node.kind === "leaf") return node.fail ? "fail" : node.branchIdx!;
    if (node.kind === "skip") return match(node.subtree, input);
    const val = input[discOrder[node.col]];
    for (const c of node.cases) {
      if (c.value === val) return match(c.subtree, input);
    }
    return match(node.default, input);
  };

  // Generate inputs: all keys present with random pool values
  const valuePool = [...POOL, "zzz-unknown", "nonexistent"];
  const divergences: string[] = [];
  for (let it = 0; it < 60; it++) {
    const input: Record<string, string> = {};
    for (let c = 0; c < nCols; c++) {
      if (rand() < 0.8) input[`k${c}`] = valuePool[Math.floor(rand() * valuePool.length)];
    }
    const expected = match(tree, input);
    const res = union.safeParse(input);
    if (expected === "fail") {
      if (res.success) {
        divergences.push(`expected FAIL, got success idx=${res.data.__idx} input=${JSON.stringify(input)}`);
      }
    } else if (!res.success) {
      divergences.push(`expected branch ${expected}, got FAIL input=${JSON.stringify(input)}`);
    } else if (res.data.__idx !== expected) {
      divergences.push(`expected branch ${expected}, got ${res.data.__idx} input=${JSON.stringify(input)}`);
    }
  }

  // INVARIANT: the generated code must NEVER contain the wildcard sentinel.
  // See runCase for the full rationale (Symbol(wildcard) + "\x00" NUL marker).
  const gen = toJS(false, true)(union.toDna());
  const code = gen.code.join("");
  const sentinelLeak = code.includes("Symbol(wildcard)") || code.includes("\x00");
  return { divergences, sentinelLeak };
}

describe("marangetUnion — differential oracle vs reference compiler", () => {
  it("matches the reference compiler over 200 seeded matrices × 60 inputs (12,000 comparisons), both modes", () => {
    let total = 0;
    const allDivergences: string[] = [];
    const leaks: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const r = runCase(seed);
      total += 60;
      allDivergences.push(...r.divergences.map(d => `seed=${seed}: ${d}`));
      if (r.sentinelLeak) leaks.push(seed);
    }
    expect(total).toBe(12000);
    expect(allDivergences).toEqual([]);
    expect(leaks).toEqual([]);
  });

  it("matches the reference compiler with NON-TRAILING wildcards (F1 fix path, WILDCARD_CELL marker) — 200 seeded matrices × 60 inputs (12,000 comparisons), both modes", () => {
    let total = 0;
    const allDivergences: string[] = [];
    const leaks: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const r = runCaseArbitrary(seed);
      total += 60;
      allDivergences.push(...r.divergences.map(d => `seed=${seed}: ${d}`));
      if (r.sentinelLeak) leaks.push(seed);
    }
    expect(total).toBe(12000);
    expect(allDivergences).toEqual([]);
    expect(leaks).toEqual([]);
  });
});

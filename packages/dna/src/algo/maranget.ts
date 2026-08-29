/**
 * Maranget — complete, parameterizable decision-tree compilation.
 *
 * This module implements Luc Maranget's *"Compiling Pattern Matching to Good
 * Decision Trees"* (ML'05) and the classical scheme of Le Fessant & Maranget
 * *"Optimizing Pattern Matching"* (ICFP 2001, §3.3): given a **clause matrix**
 * (rows of patterns over columns), compute a **decision tree**. It is PURE and
 * DNA-agnostic: no JS emission (the codegen is the emitter), no DNA bytecode
 * knowledge (extracting the matrix from DNA is an adapter concern that lives in
 * the codegen), only patterns, rows, columns, options, and a tree.
 *
 * The engine is **complete** — all four rules of the classical scheme:
 * - variable rule (§3.3 r1): a full-wildcard column is skipped,
 * - constructor rule (§3.3 r2): a column of constructors becomes a `switch`,
 * - orpat rule (§3.3 r3): a single row whose cell is an or-pattern is split
 *   into its alternatives without duplicating the row remainder,
 * - mixture rule (§3.3 r4): constructor rows drive the cases, wildcard rows
 *   become the fallback,
 * plus constructor **arity** (patterns `c(q1,…,qa)` specialize into their
 * argument patterns), the **improved scheme** (P2'-carrying, ML'05 §4) and the
 * classical `catch`/`exit` semantics (fail-substitution), the paper's
 * **heuristics** (f, q, b, a, L, p/necessity), the **exhaustiveness**
 * optimization (`switch*`, ML'05 §4.2), and two **routing modes**.
 *
 * ## Options (`IMarangetOptions`)
 *
 * | Option | Values (default) | Meaning |
 * |--------|------------------|---------|
 * | `mode` | `"source-order"` \| `"constructor-priority"` | Row priority when a wildcard overlaps a constructor. `source-order` = Maranget strict (first row that matches wins); `constructor-priority` = constructors beat wildcards (deliberate deviation, fallback semantics). |
 * | `heuristics` | `["b","L"]` | Ordered list of column scorers, combined lexicographically (first heuristic dominates, ties go to the next). |
 * | `carryWildcards` | `true` \| `false` | Improved scheme: wildcard rows (P2') are carried into every constructor case so a nested failure still reaches the catch-all. `false` = naive scheme (classic multi-column catch-all bug). |
 * | `useOrpatRule` | `true` \| `false` | Emit the dedicated orpat rule for single-row or-patterns (remainder compiled once, shared). `false` = or-patterns are always expanded. |
 * | `mixtureSplit` | `"all"` \| `"prefix"` | `"all"` = constructors vs wildcards split (improved scheme). `"prefix"` = classical scheme: P1 is the largest homogeneous prefix, P2 is the fallback compiled with the column intact and `fail` nodes substituted by C(P2) (the `catch` translation). |
 * | `exhaustive` | per-column signatures \| `null` | Declared complete constructor sets: when the case set covers the signature the default is unreachable (`switch*`, `exhaustive: true` on the node). |
 * | `optionalColumns` | `boolean[]` | DNA extension: columns that also route on `undefined` (absent key). Emitted as `if (key === undefined)` first (the `undef` node). |
 * | `tieBreak` | `"first"` \| `"last"` | Tie-break between equal heuristic scores (leftmost / rightmost column). |
 *
 * ## Heuristics (Scott & Ramsey 2000, recalled in ML'05 §8.1)
 *
 * All scores are maximized; a column with only wildcard cells is never chosen.
 * - `f` (first row): 1 when the first row's cell is a (generalized) constructor,
 * - `q`: number of leading non-wildcard rows in the column,
 * - `b` (branching factor): splitting-first, fewest distinct constructors —
 *   this is exactly the legacy `chooseColumn` semantics,
 * - `a` (arity): negative sum of the arities of the distinct constructors,
 * - `L`: leftmost column (pure tie-break),
 * - `p` (needed prefix / necessity): largest prefix of rows that are all
 *   *needed* on the column (a wildcard cell is needed when removing the column
 *   makes the row useless).
 *
 * Column choice never changes the winner in `source-order` mode (the paper's
 * scheme is non-deterministic on purpose); it only changes the tree shape.
 *
 * ## Layout contract
 *
 * `compileMatrix` never shrinks a row's pattern array: active columns are
 * tracked by a column-index list and constructor arguments are **appended** as
 * new trailing columns (wild rows are padded). Consequently the tree's `col`
 * is always an index into the current layout — for arity-0 matrices (the DNA
 * flat model) this is the original column order and the codegen maps
 * `discriminators[col]` directly.
 *
 * `compile(rows, mode?, isOptionalKey?)` is the backward-compatible entry point
 * used by the DNA codegen (constructor-priority default, b heuristic,
 * improved scheme, all-vs-all split) — it produces exactly the historical tree.
 */

import type { tsPrimitiveLiteral } from "../shared/base.types.js";

/**
 * A finite constructor value in a pattern (the CLI/DNA translation of a
 * Maranget constructor `c(q1,…,qa)` is a finite literal/enum value).
 * Reuses the shared primitive set — includes `bigint` (`dna.literal(10n)`
 * routes on `=== 10n`; `tojsStr` emits valid `10n` literals).
 */
export type tsMarangetValue = tsPrimitiveLiteral;

/**
 * Wildcard pattern sentinel — matches ANY value on that column. In the paper
 * this is `_`. A `unique symbol` is used so it can never collide with a
 * finite constructor value.
 */
export const WILDCARD: unique symbol = Symbol("wildcard");
export type tsWildcard = typeof WILDCARD;

/**
 * ADN wildcard cell marker (the serialized counterpart of `WILDCARD`).
 *
 * The clause matrix cells in the ADN (`discriminKeys`) are primitive values;
 * a wildcard cell (absent key / non-finite schema) is written as this marker
 * at its POSITION so the matrix stays aligned — a sparse "beyond length"
 * encoding cannot express a wildcard BEFORE a value, which would silently
 * misroute the following value onto the wildcard column.
 *
 * `"\x00"` (NUL) is JSON-safe (`"\u0000"` roundtrips) and collision-free in
 * practice: NUL cannot be a CLI input (Node rejects null bytes in
 * child_process args — the `\x00ID` convention). A schema
 * `dna.literal("\x00")` is a reserved/pathological definition.
 */
export const WILDCARD_CELL = "\x00" as const;
export type tsWildcardCell = typeof WILDCARD_CELL;

/**
 * Generic pattern: a constructor pattern `c(q1,…,qa)`, an or-pattern
 * `(q1|…|qo)`, or the wildcard `_`. Arity-0 constructors are the DNA flat
 * values; a multi-value cell (`dna.enum([...])`) is an or-pattern.
 */
export type tsPat =
  | { kind: "ctor"; ctor: tsMarangetValue; args: tsPat[] }
  | { kind: "or"; alts: tsPat[] }
  | tsWildcard;

/** Compatibility alias (the DNA flat model is a subset of `tsPat`). */
export type tsMarangetPattern = tsPat;

/** A row in the clause matrix: one pattern per column, plus a row id. */
export interface IMarangetRow {
  patterns: tsPat[];
  /** Row id (the codegen maps it to the branch DNA index). */
  id: number;
}

/**
 * A compiled decision-tree node:
 * - `leaf` — row `id` matches (success),
 * - `fail` — no row matches,
 * - `switch` — test column `col`; `optional` columns emit an `if (undefined)`
 *   first (`undef`); `cases` are the constructor values (each subtree carries
 *   the wildcard rows P2' per the improved scheme, or substitutes the
 *   classical catch handler); `default` is the wildcard/fallback subtree (or
 *   `fail`); `exhaustive` marks a `switch*` (all values covered, default
 *   unreachable).
 */
export type tsTreeNode =
  | { kind: "leaf"; id: number }
  | { kind: "fail" }
  | {
      kind: "switch";
      col: number;
      optional: boolean;
      undef: tsTreeNode | null;
      cases: { value: tsMarangetValue; subtree: tsTreeNode }[];
      default: tsTreeNode;
      exhaustive?: boolean;
    };

/**
 * Routing mode when a wildcard (catch-all) row overlaps a constructor row:
 * - `SOURCE_ORDER` (Maranget strict): the first row in matrix order that
 *   matches wins,
 * - `CONSTRUCTOR_PRIORITY` (default for the DNA compat entry point):
 *   constructor rows beat wildcard rows on the same column (P1_match ∪ P2'
 *   orders constructors first). The catch-all is a fallback. This is a
 *   **deliberate deviation** from Maranget strict source order (Gap E).
 * - `CLI_MODE` ("cli"): the CLI contract marker — routes like
 *   `CONSTRUCTOR_PRIORITY`, and the required discriminator columns are sorted
 *   by positional priority (positionals first — the order is self-describing
 *   in `discAdn`). Optional columns have NO order semantics (they stay last,
 *   in declaration order). Routing is invariant under this sort (the b
 *   heuristic is order-independent except stable ties).
 */
export const CONSTRUCTOR_PRIORITY = "constructor-priority" as const;
export const SOURCE_ORDER = "source-order" as const;
export const CLI_MODE = "cli" as const;
export type tsMarangetMode =
  | typeof CONSTRUCTOR_PRIORITY
  | typeof SOURCE_ORDER
  | typeof CLI_MODE;

/** Column-scoring heuristics (ML'05 §8.1, Scott & Ramsey 2000). */
export type tsMarangetHeuristic = "f" | "q" | "b" | "a" | "L" | "p";

/** Compilation options — see the module JSDoc for the full table. */
export interface IMarangetOptions {
  /** Row priority semantics (default `SOURCE_ORDER`, Maranget strict). */
  mode?: tsMarangetMode;
  /** Ordered heuristic combination (default `["b", "L"]`). */
  heuristics?: tsMarangetHeuristic[];
  /** Improved scheme P2'-carrying (default `true`). */
  carryWildcards?: boolean;
  /** Dedicated orpat rule for single-row or-patterns (default `true`). */
  useOrpatRule?: boolean;
  /** Mixture split: all-vs-all (improved) or largest homogeneous prefix (classical, default `"all"`). */
  mixtureSplit?: "all" | "prefix";
  /** Per-column complete constructor signatures → `switch*` (default `null`). */
  exhaustive?: readonly (readonly tsMarangetValue[])[] | null;
  /** Columns that also route on `undefined` (DNA extension, default none). */
  optionalColumns?: readonly boolean[];
  /** Tie-break between equal heuristic scores (default `"first"`). */
  tieBreak?: "first" | "last";
}

// ---------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------

const isCtor = (p: tsPat): p is { kind: "ctor"; ctor: tsMarangetValue; args: tsPat[] } =>
  p !== WILDCARD && p.kind === "ctor";

/**
 * A cell whose or-pattern contains a wildcard alternative matches every value
 * (ML'05 normalization: any pattern is a generalized constructor or a
 * wildcard) — it behaves as a wildcard cell.
 */
const isWildCell = (p: tsPat): boolean =>
  p === WILDCARD || (p.kind === "or" && p.alts.some(a => a === WILDCARD));

/** Flattens a pattern into its constructor alternatives (or-pattern expansion). */
function orAlts(p: tsPat): tsPat[] {
  if (p === WILDCARD) return [];
  if (p.kind === "ctor") return [p];
  const out: tsPat[] = [];
  for (const a of p.alts) out.push(...orAlts(a));
  return out;
}

/** Distinct constructor identities present in a column (ctor cells + or alternatives). */
function headSet(rows: IMarangetRow[], col: number): Set<tsMarangetValue> {
  const s = new Set<tsMarangetValue>();
  for (const r of rows) {
    const p = r.patterns[col];
    if (isWildCell(p)) continue;
    for (const a of orAlts(p)) if (isCtor(a)) s.add(a.ctor);
  }
  return s;
}

/** True when the cell matches constructor `c` (an or-cell matches via any alternative). */
function cellMatchesCtor(p: tsPat, c: tsMarangetValue): boolean {
  if (isWildCell(p)) return true;
  return orAlts(p).some(a => isCtor(a) && a.ctor === c);
}

/** Constructor arity as declared in a cell (first constructor occurrence). */
function ctorArity(p: tsPat): number {
  for (const a of orAlts(p)) if (isCtor(a)) return a.args.length;
  return 0;
}

const range = (from: number, to: number): number[] =>
  to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);

// ---------------------------------------------------------------------------
// Heuristics (all scores are maximized)
// ---------------------------------------------------------------------------

type Scorer = (rows: IMarangetRow[], col: number) => number;

/** `b` — splitting-first, fewest distinct constructors (legacy `chooseColumn`). */
const scoreB: Scorer = (rows, col) => {
  const h = headSet(rows, col).size;
  if (h >= 2) return 1000 - h;
  return h === 1 ? 0 : -Infinity;
};

/** `f` — first-row heuristic: 1 when the first row's cell is a constructor. */
const scoreF: Scorer = (rows, col) =>
  rows[0] !== undefined && !isWildCell(rows[0].patterns[col]) ? 1 : 0;

/** `q` — number of leading non-wildcard rows in the column. */
const scoreQ: Scorer = (rows, col) => {
  let n = 0;
  for (const r of rows) {
    if (isWildCell(r.patterns[col])) break;
    n++;
  }
  return n;
};

/** `a` — negative sum of the arities of the distinct constructors. */
const scoreA: Scorer = (rows, col) => {
  let sum = 0;
  const seen = new Set<tsMarangetValue>();
  for (const r of rows) {
    const p = r.patterns[col];
    if (isWildCell(p)) continue;
    for (const a of orAlts(p)) {
      if (isCtor(a) && !seen.has(a.ctor)) {
        seen.add(a.ctor);
        sum += a.args.length;
      }
    }
  }
  return -sum;
};

/** `L` — leftmost column. */
const scoreL: Scorer = (_rows, col) => -col;

// --- `p` (needed prefix / necessity) — port of the ML'05 §8.1 heuristic ---

/** Pattern generality (Milner et al., SML'90 — or-patterns compared via alternatives). */
function isPatternMoreGeneral(p1: tsPat, p2: tsPat): boolean {
  if (p1 === WILDCARD) return true;
  if (p2 === WILDCARD) return false;
  if (p1.kind === "or" || p2.kind === "or") {
    if (p1.kind === "or" && p2.kind === "or") {
      return p2.alts.every(q2 => p1.alts.some(q1 => isPatternMoreGeneral(q1, q2)));
    }
    return false;
  }
  return (
    p1.ctor === p2.ctor &&
    p1.args.length === p2.args.length &&
    p1.args.every((a, i) => isPatternMoreGeneral(a, p2.args[i]))
  );
}

function isPatternRedundant(idx: number, pats: tsPat[]): boolean {
  const p = pats[idx];
  for (let i = 0; i < idx; i++) {
    if (isPatternMoreGeneral(pats[i], p)) return true;
  }
  return false;
}

function isRowUseless(rows: IMarangetRow[], rowIdx: number, skipCol: number): boolean {
  const nCols = rows[0].patterns.length;
  for (let c = 0; c < nCols; c++) {
    if (c === skipCol) continue;
    const colPats = rows.map(r => r.patterns[c]);
    if (!isPatternRedundant(rowIdx, colPats)) return false;
  }
  return true;
}

/** A cell is needed when it is a constructor, or when dropping the column makes the row useless. */
const isNeeded = (row: number, col: number, rows: IMarangetRow[]): boolean =>
  !isWildCell(rows[row].patterns[col]) || isRowUseless(rows, row, col);

/** `p` — largest prefix of rows that are all needed on the column. */
const scoreP: Scorer = (rows, col) => {
  const m = rows.length;
  const allNeeded = (upToRow: number): boolean => {
    for (let r = 0; r <= upToRow; r++) {
      if (!isNeeded(r, col, rows)) return false;
    }
    return true;
  };
  for (let r = m - 1; r >= 0; r--) {
    if (allNeeded(r)) return r;
  }
  return 0;
};

const SCORERS: Record<tsMarangetHeuristic, Scorer> = {
  f: scoreF,
  q: scoreQ,
  b: scoreB,
  a: scoreA,
  L: scoreL,
  p: scoreP,
};

// ---------------------------------------------------------------------------
// Column selection
// ---------------------------------------------------------------------------

function chooseColumnByHeuristics(
  rows: IMarangetRow[],
  cols: number[],
  heuristics: tsMarangetHeuristic[],
  tieBreak: "first" | "last"
): number {
  // A full-wildcard column is never chosen (variable rule).
  const candidates = cols.filter(c => rows.some(r => !isWildCell(r.patterns[c])));
  if (candidates.length === 0) return -1;
  let best = candidates[0];
  let bestScores: number[] | null = null;
  for (const c of candidates) {
    const scores = heuristics.map(h => SCORERS[h](rows, c));
    if (bestScores === null) {
      bestScores = scores;
      continue;
    }
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] !== bestScores[i]) {
        if (tieBreak === "last" ? scores[i] >= bestScores[i] : scores[i] > bestScores[i]) {
          best = c;
          bestScores = scores;
        }
        break;
      }
    }
  }
  return best;
}

/**
 * Compatibility column selection: `b` heuristic (splitting-first, fewest
 * distinct values) with leftmost tie-break — exactly the historical
 * `chooseColumn` behavior used by the DNA codegen.
 */
export function chooseColumn(rows: IMarangetRow[], cols: number[]): number {
  return chooseColumnByHeuristics(rows, cols, ["b", "L"], "first");
}

// ---------------------------------------------------------------------------
// Matrix operations
// ---------------------------------------------------------------------------

/**
 * Orders surviving rows per the routing mode:
 * - `constructor-priority`: constructors first, then wildcards (P1_match ∪ P2').
 * - `source-order`: by row id (Maranget strict first-match-wins).
 * - `cli`: routes like `constructor-priority` (the CLI fallback semantics).
 */
function orderRows(a: IMarangetRow[], b: IMarangetRow[], mode: tsMarangetMode): IMarangetRow[] {
  return mode === SOURCE_ORDER
    ? [...a, ...b].sort((x, y) => x.id - y.id)
    : [...a, ...b];
}

/**
 * Specializes rows for constructor `c` on column `col` (paper S(c,P)): rows
 * whose cell matches `c` keep their layout, and the constructor **arguments**
 * are appended as new trailing columns (arity support — wild rows are padded
 * with wildcards so every row shares the same layout). The `col` cell itself
 * stays in place; it is never read again because the caller drops `col` from
 * the active column list. Returns the specialized rows and the new column list.
 */
function specialize(
  rows: IMarangetRow[],
  col: number,
  c: tsMarangetValue,
  arity: number,
  layoutLen: number,
  cols: number[]
): { rows: IMarangetRow[]; cols: number[] } {
  const newCols = [...cols.filter(x => x !== col), ...range(layoutLen, layoutLen + arity - 1)];
  const out: IMarangetRow[] = [];
  const pad = (base: tsPat[]): tsPat[] => {
    const res = [...base];
    for (let i = res.length; i < layoutLen + arity; i++) res.push(WILDCARD);
    return res;
  };
  for (const r of rows) {
    const p = r.patterns[col];
    if (isWildCell(p)) {
      out.push({ patterns: pad(r.patterns), id: r.id });
      continue;
    }
    let pushed = false;
    for (const a of orAlts(p)) {
      if (isCtor(a) && a.ctor === c) {
        out.push({ patterns: pad([...r.patterns, ...a.args]), id: r.id });
        pushed = true;
      }
    }
    if (!pushed) out.push({ patterns: pad(r.patterns), id: r.id });
  }
  return { rows: out, cols: newCols };
}

/**
 * Classical `catch` translation: every `fail` node inside the compiled P1 is
 * replaced by the compiled handler C(P2) (paper §3.3 r4 — static exceptions
 * compile to jumps to the associated handlers).
 */
function replaceFails(node: tsTreeNode, replacement: tsTreeNode): tsTreeNode {
  if (node.kind === "fail") return replacement;
  if (node.kind === "leaf") return node;
  return {
    kind: "switch",
    col: node.col,
    optional: node.optional,
    undef: node.undef !== null ? replaceFails(node.undef, replacement) : null,
    cases: node.cases.map(g => ({ value: g.value, subtree: replaceFails(g.subtree, replacement) })),
    default: replaceFails(node.default, replacement),
    ...(node.exhaustive !== undefined ? { exhaustive: node.exhaustive } : {}),
  };
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

/**
 * Compiles a clause matrix into a decision tree (complete, parameterizable
 * Maranget). See the module JSDoc for the options table.
 *
 * @param rows - The clause matrix rows (source order).
 * @param opts - Compilation options (heuristics, modes, schemes, ...).
 * @returns The compiled decision tree.
 */
export function compileMatrix(rows: IMarangetRow[], opts: IMarangetOptions = {}): tsTreeNode {
  const mode = opts.mode ?? SOURCE_ORDER;
  const heuristics = opts.heuristics ?? ["b", "L"];
  const carry = opts.carryWildcards ?? true;
  const useOrpat = opts.useOrpatRule ?? true;
  const splitMode = opts.mixtureSplit ?? "all";
  const exhaustive = opts.exhaustive ?? null;
  const optional = opts.optionalColumns ?? [];
  const tieBreak = opts.tieBreak ?? "first";

  const compileCols = (rs: IMarangetRow[], cols: number[]): tsTreeNode => {
    // Rule 0 — no rows: no match.
    if (rs.length === 0) return { kind: "fail" };

    // Base case — no column can split (all wildcard / empty): the first
    // surviving row wins (rows already ordered per the mode).
    const col = chooseColumnByHeuristics(rs, cols, heuristics, tieBreak);
    if (col === -1) return { kind: "leaf", id: rs[0].id };

    const remaining = cols.filter(c => c !== col);
    const opt = optional[col] === true;

    // --- Orpat rule (paper §3.3 r3): single row whose cell is an or-pattern ---
    // The row remainder is compiled ONCE and shared by every arity-0
    // alternative ("it does not duplicate any pattern nor action").
    if (useOrpat && rs.length === 1) {
      const p = rs[0].patterns[col];
      if (p !== WILDCARD && p.kind === "or" && !p.alts.some(a => a === WILDCARD)) {
        const row = rs[0];
        const layout = row.patterns.length;
        // Deduplicated constructor alternatives (historical value-grouping
        // dedupes: a cell ["a","a"] yields one case "a", not two).
        const ctorAlts = orAlts(p).filter(isCtor);
        const uniqueAlts: { kind: "ctor"; ctor: tsMarangetValue; args: tsPat[] }[] = [];
        {
          const seen = new Set<tsMarangetValue>();
          for (const a of ctorAlts) {
            if (!seen.has(a.ctor)) {
              seen.add(a.ctor);
              uniqueAlts.push(a);
            }
          }
        }
        // The remainder keeps the FULL layout (the layout contract never
        // shrinks rows — the chosen column is excluded via the active column
        // list); arity args are appended as new trailing columns.
        const shared: IMarangetRow = { patterns: row.patterns, id: row.id };
        const sharedSubtree = compileCols([shared], remaining);
        const cases: { value: tsMarangetValue; subtree: tsTreeNode }[] = [];
        for (const a of uniqueAlts) {
          // `undefined` is always routed via the undef node, never as a case
          // (matches the historical layout; the codegen emits the undef branch
          // only when the column is optional).
          if (a.ctor === undefined) continue;
          const sub =
            a.args.length > 0
              ? compileCols(
                  [{ patterns: [...row.patterns, ...a.args], id: row.id }],
                  [...remaining, ...range(layout, layout + a.args.length - 1)]
                )
              : sharedSubtree;
          cases.push({ value: a.ctor, subtree: sub });
        }
        const undef = uniqueAlts.some(a => a.ctor === undefined) ? sharedSubtree : null;
        return { kind: "switch", col, optional: opt, undef, cases, default: { kind: "fail" } };
      }
    }

    const wildRows = rs.filter(r => isWildCell(r.patterns[col]));
    const nonWild = rs.filter(r => !isWildCell(r.patterns[col]));

    // --- Mixture split ---
    // "all" (improved): constructors vs wildcards — the default carries only
    // the wildcard rows, P2' is carried into every case.
    // "prefix" (classical §3.3 r4): P1 is the largest leading run of
    // non-wildcard cells; P2 (column INTACT) is the catch handler — every
    // fail inside C(P1) falls back to C(P2).
    let caseRows = nonWild;
    let fallbackRows: IMarangetRow[] | null = null;
    let prefixMode = false;
    if (splitMode === "prefix") {
      let k = 0;
      while (k < rs.length && !isWildCell(rs[k].patterns[col])) k++;
      if (k < rs.length) {
        caseRows = rs.slice(0, k);
        fallbackRows = rs.slice(k);
        prefixMode = true;
      }
    }

    // Active heads, ordered by first occurrence (deterministic case order).
    // `undefined` is always excluded from the cases (it routes via the undef
    // node, which the codegen emits only for optional columns).
    const heads = headSet(caseRows, col);
    const orderedHeads: tsMarangetValue[] = [];
    {
      const seen = new Set<tsMarangetValue>();
      for (const r of caseRows) {
        for (const a of orAlts(r.patterns[col])) {
          if (isCtor(a) && a.ctor !== undefined && !seen.has(a.ctor)) {
            seen.add(a.ctor);
            orderedHeads.push(a.ctor);
          }
        }
      }
    }

    // Default / catch handler subtree.
    let defaultNode: tsTreeNode;
    if (prefixMode && fallbackRows !== null) {
      defaultNode = compileCols(fallbackRows, cols);
    } else {
      defaultNode = wildRows.length > 0 ? compileCols(wildRows, remaining) : { kind: "fail" };
    }

    // Exhaustiveness (paper §4.2, switch*): when the declared signature of the
    // column is fully covered by the cases, the default is unreachable.
    const signature = exhaustive !== null ? exhaustive[col] : null;
    const complete =
      signature !== null &&
      signature.length > 0 &&
      orderedHeads.length === signature.length &&
      orderedHeads.every(v => signature.includes(v));
    if (complete) defaultNode = { kind: "fail" };

    // Constructor cases (rule 2 / mixture): one subtree per head value.
    const cases: { value: tsMarangetValue; subtree: tsTreeNode }[] = [];
    const layoutLen = rs[0].patterns.length;
    for (const c of orderedHeads) {
      const matched = caseRows.filter(r => cellMatchesCtor(r.patterns[col], c));
      const arity = Math.max(...matched.map(r => ctorArity(r.patterns[col])), 0);
      const spec = specialize(matched, col, c, arity, layoutLen, cols);
      // P2'-carrying (improved scheme): wildcard rows are carried into every
      // case; in prefix mode P1 has no wildcards, the carry is empty and the
      // classical catch substitution below plays the fallback role instead.
      const carried = splitMode === "all" && carry ? wildRows : [];
      const ordered = orderRows(spec.rows, carried, mode);
      let subtree = compileCols(ordered, spec.cols);
      if (prefixMode && fallbackRows !== null) subtree = replaceFails(subtree, defaultNode);
      cases.push({ value: c, subtree });
    }

    // Undefined routing (DNA extension): explicit `undefined` cells AND
    // wildcard rows match absence. The node is built whenever such rows exist
    // (the codegen emits it only for optional columns — historical layout).
    const undefRows = caseRows.filter(r => cellMatchesCtor(r.patterns[col], undefined));
    const undefNode: tsTreeNode | null =
      undefRows.length > 0 || wildRows.length > 0
        ? compileCols(orderRows(undefRows, wildRows, mode), remaining)
        : null;

    return {
      kind: "switch",
      col,
      optional: opt,
      undef: undefNode,
      cases,
      default: defaultNode,
      ...(complete ? { exhaustive: true } : {}),
    };
  };

  const nCols = rows.length > 0 ? rows[0].patterns.length : 0;
  return compileCols(rows, Array.from({ length: nCols }, (_, i) => i));
}

/**
 * Backward-compatible entry point (DNA codegen): `compile(rows, mode?,
 * isOptionalKey?)` with the historical defaults — constructor-priority,
 * `b` heuristic (leftmost tie-break), improved scheme (P2'-carrying),
 * all-vs-all mixture split. Produces exactly the pre-parameterization tree.
 *
 * @param rows - The clause matrix rows (source order).
 * @param mode - Routing mode (constructor-priority default).
 * @param isOptionalKey - Per-column optionality (undefined routing).
 * @returns The compiled decision tree.
 */
export function compile(
  rows: IMarangetRow[],
  mode: tsMarangetMode = CONSTRUCTOR_PRIORITY,
  isOptionalKey: boolean[] = []
): tsTreeNode {
  return compileMatrix(rows, {
    mode,
    heuristics: ["b", "L"],
    carryWildcards: true,
    useOrpatRule: true,
    mixtureSplit: "all",
    optionalColumns: isOptionalKey,
    tieBreak: "first",
  });
}

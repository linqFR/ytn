# Maranget — technical reference

This document is the **technical reference** for the Maranget decision-tree
compilation engine in `@ytrynot/dna`. It covers the algorithm, the clause
matrix format, the compilation rules, the heuristics, the routing modes, the
wildcard handling, and the separation of concerns (SoC).

For the **user-facing explanation** (what the feature does, why it's useful,
how to use it), see [maranget.md](maranget.md). For the **builder API and
usage examples**, see [cli-union.md](cli-union.md).

> **Code snippets**: the TypeScript snippets in this document are illustrative
> excerpts from the source. Type annotations are omitted for clarity. The
> authoritative signatures are in the source files
> ([`algo/maranget.ts`](../src/algo/maranget.ts),
> [`builder/dna-interfaces.ts`](../src/builder/dna-interfaces.ts),
> [`toJs/dna-js-json.ts`](../src/toJs/dna-js-json.ts)).

## Table of contents

- [Architecture (SoC)](#architecture-soc)
- [The clause matrix](#the-clause-matrix)
- [ADN format](#adn-format)
- [Wildcard encoding](#wildcard-encoding)
- [Compilation rules](#compilation-rules)
- [Column selection heuristics](#column-selection-heuristics)
- [Mixture rule and P2'-carrying](#mixture-rule-and-p2-carrying)
- [Orpat rule](#orpat-rule)
- [Routing modes](#routing-modes)
- [Optional columns](#optional-columns)
- [Exhaustiveness (switch*)](#exhaustiveness-switch)
- [Classical catch translation](#classical-catch-translation)
- [Layout contract](#layout-contract)
- [Entry points](#entry-points)
- [F1 — non-trailing wildcard alignment](#f1--non-trailing-wildcard-alignment)
- [Validation evidence](#validation-evidence)
- [References](#references)

---

## Architecture (SoC)

The Maranget engine is split across five layers, each with a single
responsibility:

| Layer | File | Responsibility |
|-------|------|----------------|
| **Builder** | `builder/dna-interfaces.ts` (`_emitSelf`) | Transforms branch schemas → ADN args (`discAdn`, `discriminKeys`, `branchDef`, `mode`). No compilation. |
| **Algorithm** | `algo/maranget.ts` (`compileMatrix` / `compile`) | Pure clause matrix → decision tree. No JS emission, no DNA knowledge. |
| **Codegen** | `toJs/dna-js-json.ts` (`maranget` handler) | Converts ADN cells → `IMarangetRow[]`, calls `compile()`, emits the tree as JS. |
| **Introspection** | `builder/maranget-keys.ts` (via `@ytrynot/dna/introspect`) | Discriminator detection, positional inference, finite-value extraction. CLI-facing, needs no Maranget output. |
| **Roundtrip** | `fromDna/index.ts` | Reconstructs `DnaMarangetUnion` or `DnaCliUnion` from the ADN. |

The DNA bytecode is the **spec** (source data only). The algorithm is **pure**
(no JS, no DNA). The codegen is the **emitter** (tree → JS). The builder never
compiles — it only transforms schemas into the source arguments for the
compiler.

---

## The clause matrix

The input to the compiler is a **clause matrix**: a grid where:

- **rows** = branches (one per route)
- **columns** = discriminator keys (the routing keys)
- **cells** = the finite value set accepted by that branch for that key, or
  **wildcard** (`*`, matches any value)

A **wildcard cell** arises when a branch does not declare the key, or declares
it with a non-finite schema (`dna.string()`, `dna.unknown()`).

Example (with a catch-all branch):

```
             cmd         mode
            ┌──────────┬──────────┐
  branch 0  │ "build"  │ "dev"    │
  branch 1  │ "build"  │ "prod"   │
  branch 2  │ "deploy" │ *        │   ← wildcard on `mode`
  branch 3  │ *        │ *        │   ← catch-all (wildcard on all keys)
            └──────────┴──────────┘
```

The internal representation is `IMarangetRow[]`:

```typescript
interface IMarangetRow {
  patterns: tsPat[];  // one pattern per column
  id: number;         // branch index (the codegen maps it to the branch DNA)
}
```

Where `tsPat` is:

```typescript
type tsPat =
  | { kind: "ctor"; ctor: tsMarangetValue; args: tsPat[] }  // constructor c(q1,…,qa)
  | { kind: "or"; alts: tsPat[] }                           // or-pattern (q1|…|qo)
  | typeof WILDCARD;                                        // wildcard _
```

The DNA flat model uses arity-0 constructors (`args: []`) — a `dna.literal("build")`
is `{ kind: "ctor", ctor: "build", args: [] }`. A `dna.enum(["build", "b"])` is
an or-pattern `{ kind: "or", alts: [{kind:"ctor",ctor:"build",args:[]}, {kind:"ctor",ctor:"b",args:[]}] }`.

---

## ADN format

The DNA carries the clause matrix as an opcode argument (DEC-0041 Option A —
the matrix is Maranget's INPUT, the tree is its OUTPUT):

```js
["maranget",
 ["cmd", "mode", ["verbose"]],             // discAdn: required (strings) + optional (final sub-array)
 [                                           // discriminKeys: clause matrix (per branch array)
   ["build", "dev", true],                  //   singleton → direct value
   ["build", ["dev", "prod"], [true, undefined]], // multi → sub-array; undefined present = real value
   ["deploy"],                              //   absent columns (beyond length) → wildcard
   []                                       //   catch-all
 ],
 [prevalidationId, branch0Id, branch1Id, branch2Id, branch3Id],  // branchDef (targets)
 "constructor-priority"]                   // mode
```

| Field | Index | Description |
|-------|-------|-------------|
| `discAdn` | `[1]` | Routing key names (column order). Required as strings; optional columns grouped in a **final sub-array** (the optionality marker). |
| `discriminKeys` | `[2]` | The clause matrix — one array per branch, position = column. Singleton → direct value; multi-value → sub-array; `undefined` present → real value; beyond array length → wildcard (trailing); `"\x00"` → wildcard (non-trailing, see [F1](#f1--non-trailing-wildcard-alignment)). |
| `branchDef` | `[3]` | `[prevalidationId, branch0Id, ...]` — pre-validation object (type + required keys check) then branch sub-schemas. |
| `mode` | `[4]` | `"constructor-priority"` (default) \| `"source-order"` \| `"cli"` — routing semantics. |

The builder builds `discAdn` + `discriminKeys` from the live branch shapes. The
codegen converts ADN cells → `IMarangetRow[]` (absent and `"\x00"` → `WILDCARD`),
calls `compile(rows, mode, isOptionalKey)`, and emits the resulting tree as JS.
`fromDna` reads `node[1]`/`node[2]`/`node[3]`/`node[4]` and unfolds `discAdn`
(deterministic — verified by roundtrip tests).

---

## Wildcard encoding

Two kinds of wildcard cells exist in the ADN matrix:

| Kind | Encoding | When |
|------|----------|------|
| **Trailing wildcard** | Position beyond the array length (sparse) | A branch omits a column that is after all its declared values. |
| **Non-trailing wildcard** | `WILDCARD_CELL` marker `"\x00"` at its position | A branch omits a column that is BEFORE a declared value (e.g. `{help:"help"}` without `cmd`). |

The codegen converts both to the internal `WILDCARD` symbol during cell
conversion. Without the `"\x00"` marker, a non-trailing absence would shift
later values into the wrong column (misrouting) — see
[F1 fix](#f1--non-trailing-wildcard-alignment).

`WILDCARD` is a `unique symbol` — it can never collide with a finite constructor
value. `WILDCARD_CELL` is `"\x00"` (NUL) — JSON-safe (`"\u0000"` roundtrips) and
collision-free in practice (NUL cannot be a CLI input).

---

## Compilation rules

The compiler (`compileMatrix`) recursively chooses a column and applies one of
four rules from the classical scheme (Le Fessant & Maranget, ICFP 2001, §3.3):

| Rule | Column content | Action |
|------|----------------|--------|
| **Variable** (r1) | all cells are wildcards | skip the column — it carries no routing information |
| **Constructor** (r2) | all cells are finite values | emit `switch` with one case per value, `default: fail` |
| **Orpat** (r3) | single row whose cell is an or-pattern | split into alternatives, compile the remainder once, share the subtree |
| **Mixture** (r4) | mix of finite values and wildcards | constructors become `switch` cases; wildcards become the `default` subtree (and are carried into every case — see [P2'-carrying](#mixture-rule-and-p2-carrying)) |

Pseudocode:

```
compileCols(rows, cols):
  1. rows empty → emit fail
  2. col = chooseColumnByHeuristics(rows, cols, heuristics, tieBreak)
  3. col == -1 (no column splits) → emit leaf (first surviving row wins)
  4. orpat rule (single row, or-pattern cell) → split, share remainder
  5. split rows into nonWild / wildRows on col
  6. group nonWild by value (orderedHeads — first occurrence order)
  7. for each head value:
       specialize matched rows (append constructor args as new columns)
       carry wildRows (P2') into the subtree if improved scheme
       order rows by mode (constructor-priority or source-order)
       recurse compileCols(ordered, newCols)
  8. default = compileCols(wildRows, remaining) or fail
  9. optional column → emit undef node (if (key === undefined) subtree)
 10. return switch node { col, cases, default, undef, optional }
```

---

## Column selection heuristics

The compiler chooses the column to test at each node using a configurable
heuristic combination (Scott & Ramsey 2000, recalled in ML'05 §8.1):

| Heuristic | Score | Meaning |
|-----------|-------|---------|
| `f` | 1 if first row's cell is a constructor | First-row preference |
| `q` | count of leading non-wildcard rows | Leading constructors |
| `b` | fewest distinct constructors (splitting-first) | Smallest branching factor — the legacy `chooseColumn` behavior |
| `a` | negative sum of constructor arities | Prefer arity-0 (flat) constructors |
| `L` | leftmost column | Pure tie-break |
| `p` | largest prefix of needed rows | Necessity (a wildcard is needed when removing the column makes the row useless) |

Heuristics are combined **lexicographically**: the first heuristic dominates,
ties go to the next. The default combination is `["b", "L"]` (fewest distinct
values, leftmost tie-break) — exactly the historical `chooseColumn` behavior.

A full-wildcard column is never chosen (variable rule). Column choice never
changes the winner in `source-order` mode (the paper's scheme is
non-deterministic on purpose); it only changes the tree shape (depth).

---

## Mixture rule and P2'-carrying

The mixture rule (r4) handles **catch-all branches** — rows that are wildcard
on the current column. The matrix splits:

- **P1** = constructor rows → drive the `switch` cases
- **P2** = wildcard rows → become the fallback (`default`)

The **naive** scheme puts P2 only in the `default` of the current switch. This
breaks multi-column catch-alls: an input that matches a constructor on the
first column but fails on the second falls into the inner `default` and fails
— even though the catch-all should match.

Maranget's **improved scheme** (ML'05 §4) fixes it by **carrying P2'** (the
wildcard rows, with the current column consumed) **into every constructor
case**:

```
switch (cmd) {
  case "git":
    switch (sub) {
      case "commit": → branch 0
      case "push":   → branch 1
      default:       → branch 3    ← P2' carried in ✓
    }
  default: → branch 3              ← P2 in the outer default ✓
}
```

With P2'-carrying, `{ cmd: "git", sub: "unknown" }` reaches the catch-all.

In the implementation:

```typescript
const carried = splitMode === "all" && carry ? wildRows : [];
const ordered = orderRows(spec.rows, carried, mode);
```

`carryWildcards: true` (default) enables the improved scheme. `mixtureSplit:
"all"` (default) splits constructors vs wildcards. The alternative
`mixtureSplit: "prefix"` uses the classical scheme: P1 is the largest
homogeneous prefix, P2 is the catch handler compiled with the column intact,
and `replaceFails` substitutes fail nodes inside C(P1) with C(P2).

---

## Orpat rule

The orpat rule (r3) handles a **single row** whose cell is an or-pattern
(`dna.enum(["build", "b"])`). The row remainder is compiled **once** and shared
by every alternative — "it does not duplicate any pattern nor action" (paper).

```typescript
if (useOrpat && rs.length === 1) {
  const p = rs[0].patterns[col];
  if (p !== WILDCARD && p.kind === "or" && !p.alts.some(a => a === WILDCARD)) {
    const sharedSubtree = compileCols([shared], remaining);
    for (const a of uniqueAlts) {
      cases.push({ value: a.ctor, subtree: sharedSubtree });
    }
  }
}
```

Constructor alternatives are deduplicated (a cell `["a","a"]` yields one case
`"a"`, not two). `undefined` is always routed via the `undef` node, never as a
case.

---

## Routing modes

When multiple rows can match the same input, the **mode** decides which one
wins:

| Mode | Behavior | Default |
|------|----------|---------|
| `CONSTRUCTOR_PRIORITY` | Constructor rows beat wildcard rows on the same column. The catch-all is a fallback. | Yes (DNA compat entry point) |
| `SOURCE_ORDER` | First row in matrix order that matches wins (Maranget strict). | No |
| `CLI_MODE` | Routes like `CONSTRUCTOR_PRIORITY` + sorts required columns by positional priority. | No (used by `cliUnion`) |

The mode is applied via `orderRows`:

```typescript
function orderRows(a, b, mode) {
  return mode === SOURCE_ORDER
    ? [...a, ...b].sort((x, y) => x.id - y.id)  // source order
    : [...a, ...b];                              // constructors first
}
```

The matrix is **identical** in all modes — what changes is the order of rows
the compiler processes (that order decides the winner at the base case). The
mode is serialized in the DNA (5th element) so `fromDna` roundtrips preserve
the routing semantics.

---

## Optional columns

A column is **optional** when the builder marks it in `discAdn` (a declaring
branch carries `undefined` in its cell, e.g. `dna.literal(true).optional()`).
The compiler emits an `undef` node:

```typescript
const undefRows = caseRows.filter(r => cellMatchesCtor(r.patterns[col], undefined));
const undefNode = undefRows.length > 0 || wildRows.length > 0
  ? compileCols(orderRows(undefRows, wildRows, mode), remaining)
  : null;
```

The codegen emits `if (key === undefined) { subtree }` before the switch —
`undefined` is treated like a constructor value. Wildcard cells do **not** make
a key optional: an absent key on a non-optional column falls to the switch
`default` (the wildcard/catch-all subtree).

---

## Exhaustiveness (switch*)

When the declared constructor signature of a column is fully covered by the
cases, the `default` is unreachable — the node is marked `exhaustive: true`
(ML'05 §4.2, `switch*`):

```typescript
const complete =
  signature !== null &&
  signature.length > 0 &&
  orderedHeads.length === signature.length &&
  orderedHeads.every(v => signature.includes(v));
if (complete) defaultNode = { kind: "fail" };
```

The codegen can elide the `default` branch for exhaustive nodes (no fail path
needed).

---

## Classical catch translation

In `mixtureSplit: "prefix"` mode, the classical `catch` translation replaces
every `fail` node inside the compiled P1 with the compiled handler C(P2)
(paper §3.3 r4 — static exceptions compile to jumps to the associated handlers):

```typescript
function replaceFails(node, replacement) {
  if (node.kind === "fail") return replacement;
  if (node.kind === "leaf") return node;
  return { kind: "switch", ... cases: node.cases.map(g => ({
    value: g.value, subtree: replaceFails(g.subtree, replacement)
  })), default: replaceFails(node.default, replacement) };
}
```

This is the alternative to P2'-carrying — used when `mixtureSplit: "prefix"`.
The default (`"all"`) uses P2'-carrying instead.

---

## Layout contract

`compileMatrix` never shrinks a row's pattern array: active columns are tracked
by a column-index list and constructor arguments are **appended** as new
trailing columns (wild rows are padded with `WILDCARD`). Consequently the
tree's `col` is always an index into the current layout — for arity-0 matrices
(the DNA flat model) this is the original column order and the codegen maps
`discriminators[col]` directly.

```typescript
function specialize(rows, col, c, arity, layoutLen, cols) {
  const newCols = [...cols.filter(x => x !== col), ...range(layoutLen, layoutLen + arity - 1)];
  // ... pad each row to layoutLen + arity with WILDCARD ...
}
```

---

## Entry points

| Function | File | Purpose |
|----------|------|---------|
| `compileMatrix(rows, opts?)` | `algo/maranget.ts` | Full parameterizable entry point. Defaults: `source-order`, `["b","L"]`, P2'-carrying, orpat, `"all"` split. |
| `compile(rows, mode?, isOptionalKey?)` | `algo/maranget.ts` | Backward-compatible entry point (DNA codegen). Defaults: `constructor-priority`, `["b","L"]`, P2'-carrying, orpat, `"all"` split. Produces exactly the historical tree. |
| `chooseColumn(rows, cols)` | `algo/maranget.ts` | Compatibility column selection: `b` heuristic + leftmost tie-break. |

The codegen calls `compile(rows, mode, isOptionalKey)` — the backward-compatible
entry point with the historical defaults.

---

## F1 — non-trailing wildcard alignment

### The problem

A branch can route on a **different key** than the other branches — e.g.
`{cmd:"build"}`, `{cmd:"deploy"}`, `{help:"help"}`. The `help` branch has a
wildcard on `cmd` (column 0) **and** a value on `help` (column 1). This is a
**non-trailing wildcard**: a wildcard BEFORE a declared value.

Without an explicit marker, the ADN encodes absence by "beyond the array
length". The `help` branch would serialize as `["help"]` — position 0 = `"help"`,
which the codegen reads as `cmd = "help"`. **Misrouting**: `{cmd:"help"}` matches
the `help` branch instead of failing.

### The fix

The builder (`_emitSelf`) inserts the `WILDCARD_CELL` marker `"\x00"` for
**non-trailing** absences:

```js
["maranget",
 ["cmd", "help"],
 [
   ["build"],           // branch 0: cmd="build", help=wildcard (trailing, sparse)
   ["deploy"],          // branch 1: cmd="deploy", help=wildcard (trailing, sparse)
   ["\x00", "help"]     // branch 2: cmd=wildcard (NON-trailing, marker), help="help"
 ],
 [prevalidationId, branch0Id, branch1Id, branch2Id],
 "constructor-priority"]
```

The codegen converts `"\x00"` → `WILDCARD` (same as beyond-length positions).
Trailing absences stay sparse (no marker needed — nothing follows).

### Terminology

- **trailing-wildcard row**: wildcards appear ONLY at the end (after all values).
  Encoded as sparse arrays (absent = beyond length).
- **non-trailing-wildcard row**: a wildcard appears BEFORE a declared value.
  Encoded with the `WILDCARD_CELL` marker `"\x00"` at its position.

---

## Validation evidence

| Test | Coverage | Result |
|------|----------|--------|
| Oracle differential (trailing) | 200 seeds × 60 inputs = 12 000 comparisons, both modes | 0 divergence, 0 sentinel leak |
| Oracle differential (non-trailing) | 200 seeds × 60 inputs = 12 000 comparisons, shuffled column order, both modes | 0 divergence, 0 sentinel leak |
| Structural compatibility | 10 000 random matrices, `compile` vs `compileMatrix` | 10 000/10 000 structurally identical trees |
| F1 unit tests | 3-column non-trailing, F1 case, source-order catch-all, cli mode non-trailing | All pass |
| DNA full suite | 3009 tests, 26 files | All pass |
| Sentinel leak check | `code.includes("Symbol(wildcard)")` + `code.includes("\x00")` | 0 leak |

The oracle's sentinel leak check verifies that neither the internal `WILDCARD`
symbol nor the `WILDCARD_CELL` marker `"\x00"` appears in the generated
JavaScript — both are compile-time concepts that must never leak into the
emitted code.

---

## References

- Maranget, *"Compiling Pattern Matching to Good Decision Trees"*, ML'05 —
  <https://pauillac.inria.fr/~maranget/papers/opat/pat003.html>
- Le Fessant & Maranget, *"Optimizing Pattern Matching"*, ICFP 2001 — §3.3
  (the classical scheme: variable, constructor, orpat, mixture rules).
- Scott & Ramsey 2000 — heuristics (f, q, b, a, L, p), recalled in ML'05 §8.1.
- Prototype: [`packages/cli/sandbox/maranget-prototype.ts`](../../cli/sandbox/maranget-prototype.ts)
- Oracle differential test:
  [`packages/dna/tests/maranget-oracle-differential.test.ts`](../tests/maranget-oracle-differential.test.ts)
- DEC-0039 (mixture rule, Accepted with amendements),
  DEC-0040 (orpat rule, Accepted — algo deployed, canonical API `dna.enum([...])`),
  DEC-0041 (rename + mode + SoC),
  DEC-0042 (cli mode, derived positionals),
  DEC-0043 (SoC statics → utils/introspect):
  [`mailbox/mailbox-decisions.md`](../../../mailbox/mailbox-decisions.md)
- ACT-0028 (F1 fix), ACT-0030 (oracle non-trailing extension):
  [`mailbox/mailbox-actions.md`](../../../mailbox/mailbox-actions.md)
- User-facing explanation: [maranget.md](maranget.md)
- Builder API and usage: [cli-union.md](cli-union.md)

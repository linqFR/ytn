# 22 — The test suite and bench, in plain words

> What `npm test` and `npm run bench` actually play, what each number means, and which guarantee each check protects. Companion docs: [the memory-model spec](spec-memory-model_EN.md), [the external benchmark](results-longmemeval-bench_EN.md).

## Table of Contents

- [How to run](#how-to-run)
- [The bench script — 4 scenarios](#the-bench-script--4-scenarios)
- [Recall quality (A-series)](#recall-quality-a-series)
- [Temporal dynamics (B-series)](#temporal-dynamics-b-series)
- [Field health and determinism (C/D)](#field-health-and-determinism-cd)
- [Stress and recovery](#stress-and-recovery)
- [Sources, planes, vector parity](#sources-planes-vector-parity)
- [Agent simulation (H-series)](#agent-simulation-h-series)
- [Windowed frequency (AC checks)](#windowed-frequency-ac-checks)
- [Functional retrieval (F-series)](#functional-retrieval-f-series)
- [How this maps to standard RAG metrics](#how-this-maps-to-standard-rag-metrics)

---

## How to run

```bash
npm test  -w @ytrynot/osem-rag   # 55 vitest checks — behavioral suite
npm run bench -w @ytrynot/osem-rag  # 4 measured scenarios on the real corpus
npm run lme   -w @ytrynot/osem-rag  # LongMemEval-S, external benchmark (the LongMemEval doc)
```

The suite uses a frozen snapshot of real documentation (`tests/fixtures/`, the `dna` package docs → ~2,500 atoms), plus small synthetic corpora built per test. Everything is deterministic: same corpus, same queries, same result.

## The bench script — 4 scenarios

`npm run bench` prints each scenario with `play` (what is done), `reads` (the metric), `goal` (the criterion):

| Scenario | What it plays | What it reads | Criterion |
|---|---|---|---|
| **A4 · honest silence** | 10 queries on topics never stored (graphql, kubernetes…) | how many return empty | **10/10** — no fabricated seeds |
| **C1 · Gini** | 200 queries over 10 recurring topics; each traversal reinforces the edges used | Gini of link weights — 0 = equal, 1 = one edge owns everything | **< 0.6** — above that, reinforcement is a monopoly |
| **C2 · hubness** | 50 queries; count each leaf's appearances in the injected payload | % of payload slots captured by the top-1% leaves | **< 20%** — popular facts must not drown the precise ones |
| **D1 · latency** | identical queries at 1k / 5k / 10k atoms, sqlite-vec OFF then ON | p50/p95 + growth ratio | **bounded growth** — the beam bounds the wave work |

Honest note on D1: at this scale the measured trend is roughly **linear** (the per-candidate cosine scan dominates), not sub-linear — which is exactly why the native `sqlite-vec` index exists and shows its value at 50k+ atoms.

## Recall quality (A-series)

`tests/a-recall.test.ts` — does the field find better than raw full-text?

| Test | Scenario | Measure | Criterion |
|---|---|---|---|
| **A1** | 20 annotated queries on the real doc corpus, field vs FTS5 alone | MRR + P@5 | field ≥ baseline (propagation must earn its keep) |
| **A3** | typo `serializaton`, French `sérialisation`, FR→EN paraphrase | does the target surface | crosses the lexical wall via the gated vector surface |
| **A4** | 10 concepts absent from the corpus | silence count | 10/10 — never fabricate |
| **A10** | query a fact living in a leaf | leaf in payload + ancestors as breadcrumbs | the leaf answers, the ancestors locate |

## Temporal dynamics (B-series)

`tests/b-temporal.test.ts` — the "memory" claims, played over time.

| Test | Scenario | Measure | Criterion |
|---|---|---|---|
| **B1** | same topic queried repeatedly | target energy across recalls | rises then plateaus (bounded reinforcement) |
| **B3** | a topic is raised, then 5 unrelated queries follow | residual energy | falls below threshold — working memory forgets fast |
| **B5** | a `pinned` atom, then 50 silent commits | its wave presence | still reachable — flags are a right of surfacing |
| **B6** | a `superseded` fact is artificially energized | surfacing + edge weight | never surfaces, weight frozen — zombie facts stay dead |
| **B8** | atom consulted once vs 5 spaced times | bucket spread | only *spaced* consultations earn durability |
| **B9** | same consultation count, burst vs spaced | long-window spread | the burst packs into few buckets, the spaced one disperses — hype dies, fundamentals persist |
| **B15** | 30 rapid-fire queries on a fact, then cooling | post-cooling presence | the buzz dies once the window slides past; a pinned decision still holds |

## Field health and determinism (C/D)

`tests/c-health.test.ts` — the bench's C1/C2 scenarios as assertions, plus:

| Test | Scenario | Measure | Criterion |
|---|---|---|---|
| **D1** | synthetic corpus 1k→10k | latency growth | bounded across sizes |
| **D2** | two independent engines, same corpus, 100 identical queries | byte-identical output | determinism is total — same state, same answer |

## Stress and recovery

`tests/d-stress.test.ts` — what breaks in real operation.

| Test | Scenario | Measure | Criterion |
|---|---|---|---|
| **B12** | 30% of the corpus replaced/deleted | edges to removed atoms | erode and prune (traced); orphans cool down |
| **B13** | kill mid-session, reopen | what survives | working memory lost (accepted); cadastre + bookmarks intact |
| **B14** | 2 agents on one cadastre in parallel | isolation + shared lattice | working memories stay partitioned, the shared graph stays coherent |

## Sources, planes, vector parity

`tests/e-mixed-sources.test.ts`, `g-planes.test.ts`, `vec-parity.test.ts`:

| Test | Scenario | Criterion |
|---|---|---|
| **E** | one field fed with markdown + txt + a web page + SQL rows | facts from every source surface; provenance (source + lines) is exact |
| **planes** | share mirrors, `actAs` ownership, private planes, explicit scope lists | shared facts cross planes; private notes never leak; non-owners are rejected |
| **vec parity** | same corpus + queries, `sqlite-vec` ON vs OFF | identical semantics — the native index changes speed, never behavior |
| **audit regressions** | propagation right after deposits, vec0 backfill, zombie KNN | no dead field, no resurrected superseded atom under KNN |

## Agent simulation (H-series)

`tests/h-agent-sim.test.ts` — LongMemEval-style classes replayed as agent usage (needle recall, updates, retraction, distractors…).

| Test | Scenario | Result |
|---|---|---|
| **H1** | 40 needle facts buried in the corpus, queried after load | 40/40 restituted into the injected context |
| **H2** | a fact updated ("my editor is vim" → later "emacs") | new value returned, old one buried — 10/10 |
| **H3** | a memory explicitly retracted | never resurfaces, anywhere |
| **H4** | twin facts differing by one discriminating term | right twin wins — 10/10 |
| **H5** | fact shared by agent A into a scope | restituted to agent B — 8/8 |
| **H6** | private notes | invisible to other agents — zero leakage |
| **H7** | 10 never-stored topics | silence 10/10 |
| **H8** | a memory consulted with spacing vs an untouched twin | the consulted one wins — 3/3 |
| **H9** | the full battery under latency measurement | recall + injection stays bounded (p50/p95 reported as trace) |
| **H10** | multi-paragraph episodes | found and injected within the excerpt budget |

## Windowed frequency (AC checks)

`tests/i-frequency.test.ts` — the internals of the per-scope frequency model: `seq` orders commits, `bookmarks` record surfacings, `freq_buckets` is the rebuildable ring cache, `f20/f50/f100` are read windows.

| Test | Scenario | Criterion |
|---|---|---|
| **AC9** | corrupt a ring slot, rebuild from bookmarks | drift = 0 — the cache is exactly derived from truth |
| **AC11** | inspect query atoms | one per recall, slim, never surfaced, never indexed |
| **AC12** | look for self-boost | a query never sees its own commit — past bookmarks only |
| **AC13** | let the hot window slide past | silence dilutes frequency — it never strengthens it |
| **AC15** | flood the cadastre with 300 unbookmarked atoms | `N` (distinct bookmarked atoms) unchanged — deposits are inert |
| **AC16** | 100 silent recalls from a foreign scope | the shared scope's `seq`, ring and shares untouched |

## Functional retrieval (F-series)

`tests/j-functional.test.ts` — end-to-end effectiveness, the "does it actually find things" checks.

| Test | Scenario | Criterion |
|---|---|---|
| **F1** | 30 tagged facts + 20 distractors sharing the vocabulary | top-1 ≥ 80%, top-5 ≥ 90% |
| **F2** | two atoms matching equally; one frequently consulted | the frequented twin outranks the cold one |
| **F3** | same query by two agents | bookmarks land on the acting scope only |
| **F4** | unknown topic | silence — no fabricated top-k |
| **F5** | fact shared onto `scope:proj` by agent alpha | restituted to beta, bookmarked on the scope |
| **F6** | frequently-consulted leaf | present in `formatContext().leafIds` — frequency reaches the payload |
| **F7** | real markdown fixtures ingested via `registerDoc` | queries answered from the doc that holds the truth |

## How this maps to standard RAG metrics

| Standard metric | Where it lives here |
|---|---|
| MRR (mean reciprocal rank) | A1 |
| Precision@k / hit rate | A1, F1, H1 |
| Recall@k into the injected context | H1 (context recall), the LongMemEval doc (external) |
| Abstention accuracy | A4, H7, F4 |
| Adversarial distractors | H4, F1 |
| Knowledge update recency | H2 (+ the LongMemEval doc misses) |
| Multi-hop / cross-session | H5, A10, the LongMemEval doc coverage@k |
| Latency p50/p95 | D1, H9 |
| Determinism | D2 |
| Echo-chamber / diversity health | C1 (Gini), C2 (hubness) |

Not covered by design: generation metrics (faithfulness, answer correctness) — the engine returns atoms, not answers; that layer belongs to the consuming LLM. See [the LongMemEval doc](results-longmemeval-bench_EN.md) for the external retrieval evaluation on a public benchmark.

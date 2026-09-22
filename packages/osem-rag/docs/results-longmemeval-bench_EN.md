# 21 — LongMemEval-S: external retrieval benchmark

> Annex to the [README](../README.md#benchmarks-summary): how `@ytrynot/osem-rag` was measured against a public long-term-memory benchmark, what the numbers mean, and where the engine actually fails.

## Table of Contents

- [What LongMemEval measures](#what-longmemeval-measures)
- [Setup — dataset and how to run](#setup--dataset-and-how-to-run)
- [Results](#results)
- [hit@k vs evidence coverage — read the right number](#hitk-vs-evidence-coverage--read-the-right-number)
- [Failure analysis](#failure-analysis)
- [Caveats — this is not a leaderboard score](#caveats--this-is-not-a-leaderboard-score)
- [What the failures suggest](#what-the-failures-suggest)

---

## What LongMemEval measures

[LongMemEval](https://github.com/xiaowu0162/LongMemEval) is a 500-question benchmark for long-term memory assistants. Each instance provides a chat haystack (~48 sessions, ~10 turns each, ~115k tokens) plus the ids of the sessions that contain the evidence (`answer_session_ids`).

The benchmark pipeline has three stages:

| Stage | Owner | What it answers |
|---|---|---|
| Indexing | the memory system | how is history stored |
| **Retrieval** | the memory system | are the evidence sessions found |
| Reading | an LLM | is the final answer correct |

`osem-rag` is a retrieval engine — it returns atoms, not generated answers — so this doc evaluates the **retrieval stage only**. Question types covered: single-session extraction (user, assistant, preference), multi-session reasoning, temporal reasoning, and knowledge updates. Abstention questions have no ground-truth session and are part of the 500 but contribute no evidence target.

## Setup — dataset and how to run

The harness is [`scripts/longmemeval.ts`](../scripts/longmemeval.ts). The dataset is **not committed** (~277 MB): the harness auto-downloads `longmemeval_s_cleaned.json` from the Hugging Face `xiaowu0162/longmemeval-cleaned` repository into the package's `sandbox/` directory and deletes it after the run (`LME_KEEP=1` keeps it, `LME_DATASET=<path>` uses a local copy).

```bash
# from the repo root
npm run lme -w @ytrynot/osem-rag

# options (environment variables)
LME_LIMIT=50    npm run lme -w @ytrynot/osem-rag   # subset
LME_HASH=1      npm run lme -w @ytrynot/osem-rag   # hash embedder control
LME_MODE=vec    npm run lme -w @ytrynot/osem-rag   # fused wave (vec direct)
LME_MODE=lexical npm run lme -w @ytrynot/osem-rag  # lexical-only wave
LME_BUDGET=4000 npm run lme -w @ytrynot/osem-rag   # override the injection budget
LME_DATASET=path/to/longmemeval_s_cleaned.json npm run lme -w @ytrynot/osem-rag
LME_KEEP=1      npm run lme -w @ytrynot/osem-rag   # keep the auto-downloaded dataset
LME_MISS=path/to/misses.json npm run lme -w @ytrynot/osem-rag  # dump per-miss ranks
```

Protocol per instance: a **fresh in-memory field** is created (each question owns its haystack), every session is registered as one paragraph-granularity atom (`registerMemo`, `src` set to the session id), then the question goes through `recall()` — the full cascade, lexical plus vector surface when a model2vec directory is present. `rank` is the position of the first surfaced atom whose id is an `answer_session_id`; `-1` means the evidence never reached the wave threshold. The harness then calls `formatContext()` and measures **injected coverage**: the fraction of evidence sessions that land in the payload a reader would actually receive (budget-capped, mapped via `src`).

## Results

Verified output of the full run (500 instances, model2vec `potion-base-8M`, `recall()` default cascade — N1 then always N2, vector embeds the raw prompt):

```text
=== LongMemEval-S retrieval (500 instances) ===
hit@1 : 0.836
hit@5 : 0.932   (baselines: bm25≈.58 contriever≈.71 stella≈.80)
MRR   : 0.877
evidence coverage@5 : 0.881  (all sessions, not just first)
evidence coverage@10: 0.928
injected coverage   : 0.881  (evidence in the injected payload — real usage)
avg surfaced: 21.8  empty recalls: 0

per question_type:
  single-session-user          hit@5=0.929 cov@5=0.929 inj=0.929  (n=70)
  multi-session                hit@5=0.955 cov@5=0.851 inj=0.851  (n=133)
  single-session-preference    hit@5=0.667 cov@5=0.667 inj=0.667  (n=30)
  temporal-reasoning           hit@5=0.917 cov@5=0.840 inj=0.840  (n=133)
  knowledge-update             hit@5=0.974 cov@5=0.955 inj=0.955  (n=78)
  single-session-assistant     hit@5=1.000 cov@5=1.000 inj=1.000  (n=56)
```

### Retrieval modes compared (same dataset, same code)

| Metric | `mode:"lexical"` (shallow) | `mode:"lexical_vec"` (default) | `mode:"vec"` (fused) |
|---|---:|---:|---:|
| hit@5 | **0.946** | 0.932 | 0.942 |
| evidence cov@5 | 0.874 | **0.881** | 0.869 |
| evidence cov@10 | 0.923 | **0.928** | 0.923 |
| multi-session cov@5 | 0.775 | **0.851** | 0.800 |
| misses | 27 | 34 | **29** |
| avg wave size | 12.9 | 21.9 | 15.4 |
| cost | 1× | ~3× | ~1.5× |

Three profiles, all measured: shallow is the most precise at top-5 and the cheapest; the cascade has the widest coverage (adjacent-term expansion inflates the wave — measured echo effect); the fused wave is the balance — near-lexical precision with the semantic reach, at half the cascade's cost. The F-150 knowledge-update case illustrates it: `[-1,-1]` before the vector query was decoupled from adjacent terms, `[5,6]` in fused mode.

### Injected coverage vs the injection budget

`hit@5` ranks atoms by wave energy — it is *not* what the reader sees. `injected coverage` measures which evidence sessions actually land in the `formatContext` payload. With the default `budgetTok: 800` the payload holds ~5 items, so `inj ≈ cov@5`; the budget, not the wave, was the delivery bottleneck (a diversity cap on the shared `_root` bucket used to hard-limit flat corpora to 3 injected facts — fixed).

| `budgetTok` | payload tokens | injected coverage (cascade) |
|---:|---:|---:|
| 800 (default) | ~560 → ~5 items | 0.881 |
| 2000 | ~1400 → ~13 items | 0.940 |
| 4000 | ~2800 → ~26 items | 0.966 |

At 4000 the full median wave (~22 atoms) is delivered — injected coverage exceeds cov@10 (evidence ranked 9-10 in the wave reaches the reader). The elbow sits around 2000–3000 tokens.

## hit@k vs evidence coverage — read the right number

`hit@5` counts a question as solved when **at least one** evidence session surfaces in the top-5. That is a fair metric for single-evidence questions — which is why `single-session-*` types show `cov@5 == hit@5` — but it is **generous for multi-evidence questions**: finding one of four required sessions counts as a hit while the reader would still answer wrong.

`coverage@k` is the honest metric for aggregation: the fraction of *all* evidence sessions found in the top-k. The gap is visible in the data:

| Question type | hit@5 (any evidence) | cov@5 (all evidence) |
|---|---:|---:|
| multi-session | 0.947 | **0.775** |
| temporal-reasoning | 0.932 | **0.844** |
| knowledge-update | 0.974 | **0.955** |

For multi-session questions the engine finds *something* 95% of the time but *everything needed* only 78% of the time at depth 5 (92% at depth 10 overall).

## Failure analysis

34 instances missed hit@5 on the cascade run (the shallow control had 27, the fused run 29 — borderline cases fluctuate between modes). Looking at each miss individually, they fall into three families:

**Synthesized answers (~16).** The expected answer does not exist verbatim in *any* session of the corpus: it must be derived by combining several pieces of evidence ("how many projects", "the user would prefer…", "you did not mention this"). This is not a pure retrieval failure — every evidence session must first be fetched, then a reading stage combines them. Retrieval stays necessary (a missing proof means a wrong answer), but it is not sufficient.

**Literal answer, deep rank (~5).** Here the evidence session does contain the answer and the wave *did* surface it — just below the top-5 (ranks 5 to 20). This is a ranking-depth limitation: the session has enough lexical overlap to cross the threshold, not enough to dominate. A wider k or a reranking stage recovers them.

**Literal answer, never surfaced.** `rank = -1`: the session never crossed the wave threshold at all — no lexical seed touched it and the vector surface did not rescue it. These are the only true retrieval misses in the strict sense — a handful per run, ~1–2% of the 500 questions.

Representative never-surfaced misses, with cause:

| Question | Expected | Evidence ranks | Cause |
|---|---|---|---|
| "What is the name of my hamster?" | a name | `[-1]` | the evidence likely does not exist verbatim in the cleaned dataset |
| "How many projects have I led?" | 2 | `[-1,-1,-1,-1]` | each project is mentioned in passing inside unrelated sessions — individually low salience |
| "Years older than at graduation?" | 7 | `[-1,-1]` | two-hop: one session has age at graduation, another has the current age |
| "Total number of siblings?" | 4 | `[-1,-1]` | siblings scattered one per session ("a brother", …) |
| "Kitchen appliance bought 10 days ago?" | a smoker | `[-1]` | "kitchen appliance" ↔ "smoker" mismatch plus a temporal anchor |
| "How often do I see Dr. Johnson?" | a frequency | `[5,-1]` | one of two evidence sessions found; the other never surfaced |

Per-evidence ranks on multi-evidence misses show the pattern is **not** "just below the cut": evidence is either absent from the wave or scattered deep. Widening the injection budget recovers the deep-but-surfaced ones; the `-1` ones are the hard core.

**Fixed since the first run** — the "vehicle model" knowledge-update miss (`[-1,-1]` → `[9,10]` cascade, `[5,6]` fused): the vector query used to embed `prompt + adjacent terms`, and the adjacent terms came from the dominant cluster of the *history* (travel vocabulary), dragging the embedding off-topic — evidence dropped from vector rank #1 to #10, outside `topKVec`. The vector surface now embeds the raw prompt; adjacent terms only feed the lexical re-query.

## Caveats — this is not a leaderboard score

- **Protocol difference**: the paper's baselines index at turn or session granularity over their own pipelines and evaluate flat top-k lists. This harness registers one atom per session and measures rank inside the surfaced wave (~22 atoms in cascade mode). Same spirit, different rigging — treat the comparison to BM25/Contriever/Stella as a strong signal, not an official score.
- **One-shot questions**: every instance uses a fresh field, so the usage frequency layer (bookmarks, f-windows, scope sediment) is barely exercised — each question is the first and only query on its scope. This benchmark measures the *cold* retrieval surfaces, not the memory dynamics.
- **Small embedder**: `potion-base-8M` is an 8M-parameter model; misses caused by vocabulary mismatch may be recoverable with a stronger encoder.
- **Determinism**: identical input produces identical output, but miss counts shift between retrieval modes (27 shallow / 34 cascade / 29 fused).

## What the failures suggest

- **Delivery, not retrieval, was the first bottleneck**: the wave already carried most evidence — the default `budgetTok` and a diversity-cap bug on flat corpora (the `_root` bucket) were what kept it from the reader. Both fixed; the injected-coverage metric is what surfaced them.
- **Wave diversity, not depth**: aggregation evidence is individually weak and dispersed; the wave concentrates on the strongest lexical cluster. A coverage mechanism — discounting atoms too similar to already-surfaced ones — is the kind of change that would target this class.
- **Temporal anchoring**: questions like "10 days ago" need session-date arithmetic the engine does not perform; evidence exists but is not promoted by recency relative to the question date.
- **Preference questions** remain the weakest class (hit@5 0.667 on the cascade, 0.700 fused): implicit user preferences are the hardest targets for term-based seeding — and the semantic surface's extra breadth does not rescue them.

None of these are bugs in the implemented model; they are characterized boundaries of single-shot wave retrieval.

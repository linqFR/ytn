# OSEM memory model — specification

> The contract `@ytrynot/osem-rag` implements: what the engine guarantees, stated at the level of observable behavior. Companion docs: [HOW-IT-WORKS](HOW-IT-WORKS.md) (mechanics), [API](API.md) (calls), [test suite map](result-test-suite_EN.md) (verification), [LongMemEval results](results-longmemeval-bench_EN.md) (external eval).

## Table of Contents

- [Atoms and granularity](#atoms-and-granularity)
- [Memory planes](#memory-planes)
- [Two memory layers](#two-memory-layers)
- [Queries, commits and silence](#queries-commits-and-silence)
- [Frequency over sliding windows](#frequency-over-sliding-windows)
- [Surfacing vs payload](#surfacing-vs-payload)
- [Pins, flags and supersession](#pins-flags-and-supersession)
- [Sharing across planes](#sharing-across-planes)
- [Honest silence](#honest-silence)
- [Invariants](#invariants)
- [Non-goals](#non-goals)

---

## Atoms and granularity

Knowledge is stored as **atoms** — the unit of memory. An atom has a body, a kind, optional provenance (`src` + line), and a **granularity** on a fixed chain:

```text
doc → section → paragraph → sentence          (markdown / text)
table → row → field                           (structured rows)
```

The **leaf** is the smallest self-contained unit — the atom that still makes sense quoted alone. Deposition never truncates: granularity is chosen per source, and a leaf that is too long for its budget is *split*, never cut. Parents (`doc`, `section`) are context, not answers — they locate the leaf as breadcrumbs but never steal a payload slot.

## Memory planes

Every piece of attention happens on a **scope** — a memory plane identified by a string:

| Scope | Plane | Owner |
|---|---|---|
| `agent:<id>` | the agent's personal plane | the agent itself |
| `public` | the shared collective plane | the system |
| `scope:<name>` | a named shared plane (project, team, repo) | first agent to claim it |
| `skill:<name>` | knowledge plane of a skill | the skill owner |

Planes are **independent**: each carries its own working memory, its own attention history, its own frequency statistics. An agent consulting `scope:proj` writes nothing on `agent:beta` — scopes never share sediment.

`actAs` lets a scope's **owner** act directly on it (its clock, its memory). A non-owner claim is rejected before anything is touched.

## Two memory layers

| Layer | Keyed by | Lifetime | Role |
|---|---|---|---|
| **Working memory** (STP) | `(agent, atom)` | session-scale, decays fast | priming: a recently raised topic stays warm within the session |
| **Attention memory** (LTP) | `(scope, atom)` | sliding windows of commits | frequency: knowledge consulted with spacing gains durable presence |

The two layers never share a key and never write each other. STP answers "what was just active"; LTP answers "what this scope keeps coming back to".

## Queries, commits and silence

A recall is a **delegated request** to one or more scopes, not a table read. For each participating scope:

1. a wave is computed over the scope's state — lexical, referent, title and semantic surfaces compete (`recallLexical` stays lexical-only);
2. atoms above the energy threshold form the **commit**: the scope's attention position advances and each surfaced atom is **bookmarked** — an append-only record carrying provenance (which surface found it, which path propagated it);
3. a recall that surfaces nothing is **silence**: the acting scope's position still advances (attention was spent) but no atom is credited.

Consequences that follow from this construction:

- **Deposits are inert.** Registering knowledge does not count as attention — flooding the corpus with never-consulted atoms dilutes nothing.
- **Foreign silence cannot flush a scope.** A recall addressed to other scopes never advances your scope's position; only commits written *on* a scope move it.
- **No self-boost.** A query only benefits from *past* commits — it never sees its own.

## Frequency over sliding windows

A scope's long-term attention is derived from its recent bookmarks over three nested windows (hot / medium / long, configurable). What matters:

- **Recency dilutes.** As the window slides, old credits leave it — a memory not consulted for a while loses its frequency boost. Silence is dilution, never reinforcement.
- **Durability requires dispersion.** Credits must be spread across distinct commits to qualify as durable — a burst of 30 rapid consultations packs into a narrow window and dies with it; spaced consultations disperse and compound. This is how hype fades while fundamentals persist, without a coded rule.
- **Shares are normalized per scope** over its own bookmarked vocabulary: each scope compares atoms against what *it* actually consults, so a small focused scope and a huge public one rank fairly.

## Surfacing vs payload

Two distinct sets, deliberately separate:

- **Surfaced** atoms crossed the energy threshold — this is *memory state* and earns frequency credit;
- **Payload** is the subset rendered into context under the token budget — this is *presentation*.

A rendering cap never erases memory credit: an atom that surfaced but did not fit the payload still counts as consulted.

## Pins, flags and supersession

- `pinned` / high-flag atoms keep a **surfacing right** independent of frequency — a founding decision cannot be forgotten merely because nobody cites it this month;
- `superseded` atoms **never** surface and their links freeze — a retracted fact stays dead;
- references and pins resolve through the supersession chain to the *live* version of a truth — pinning is a reference to an identity, not a frozen snapshot.

Authority is scoped: pinning on `scope:proj` does not pin for `agent:x`.

## Sharing across planes

`share` on a recall **mirrors** the commit onto shared planes: the surfaced atoms are bookmarked there too, tagged as shared (with the acting plane's provenance), but the mirror performs no graph learning. This is how a fact deposited by one agent becomes restitutable by another through a common scope — while private planes remain invisible to everyone else.

## Honest silence

When no surface reaches confidence, the engine returns **nothing** — no fabricated top-k, no filler context. Silence is a first-class answer and a tested contract (A4/H7/F4: 10/10 on absent topics).

## Invariants

- **I1 — scope independence**: no recall writes outside the scopes it commits to; foreign silence leaves a scope untouched.
- **I2 — silence dilutes, never strengthens**: sliding windows only erase frequency; nothing gains credit without surfacing.
- **I3 — deposits inert**: `N` (the normalization vocabulary) counts bookmarked atoms only.
- **I4 — no self-boost**: a commit is invisible to its own query.
- **I5 — pins immune**: flagged atoms keep their surfacing floor regardless of frequency.
- **I6 — determinism**: same corpus state + same prompt → same wave; no wall-clock in the physics.
- **I7 — truth is append-only**: bookmarks and the cadastre are never rewritten; derived caches are exactly rebuildable from them.
- **I8 — attribution limit**: the engine knows *who asked* (provenance on query atoms) and *what surfaced* — never *who saw*; that is an application-level concern.

## Non-goals

The engine returns **atoms**, not answers. Aggregation ("how many…"), temporal arithmetic ("10 days ago"), and answer correctness belong to the reading layer above — retrieval supplies the evidence sessions; combining them is the consumer's job (see the [failure analysis](results-longmemeval-bench_EN.md#failure-analysis) for where this boundary bites).

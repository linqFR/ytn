# @ytrynot/osem-rag

[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ytrynot/osem-rag.svg)](https://www.npmjs.com/package/@ytrynot/osem-rag) [![Bundle size](https://packagephobia.com/badge?p=@ytrynot/osem-rag)](https://packagephobia.com/result?p=@ytrynot/osem-rag) [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Oscillo Ergo Memini** — *"It oscillates, therefore it remembers."*

A deterministic **memory engine for AI agents**, built on a single local SQLite file. You feed it documents and structured rows; it makes them **searchable, ranked by real usage over time, and honestly silent** when the answer is not in the corpus — no hallucinated filler context, no external vector database, no Python.

```
npm install @ytrynot/osem-rag better-sqlite3
# optional: semantic model (~29 MB) — repo workspace only; from an installed
# package, run scripts/install-model2vec.ts directly or set OSEM_MODEL_DIR
npm run setup -w @ytrynot/osem-rag
```

---

## Table of Contents

- [What it is](#what-it-is)
- [How a query works — the wave](#how-a-query-works--the-wave)
- [Glossary — the acronyms and the vocabulary](#glossary-the-acronyms-and-the-vocabulary)
- [Quick start](#quick-start)
  - [1. Ingest a folder of markdown](#1-ingest-a-folder-of-markdown)
  - [2. Ask questions](#2-ask-questions)
  - [3. Inject the context into your prompt](#3-inject-the-context-into-your-prompt)
  - [4. Let time do its job](#4-let-time-do-its-job)
- [Scripts — demo, bench, lme, setup](#scripts--demo-bench-lme-setup)
- [How to integrate](#how-to-integrate)
  - [With Vercel AI SDK](#with-vercel-ai-sdk)
  - [With LangChain.js](#with-langchainjs)
  - [With a custom HTTP API (e.g. Vercel function)](#with-a-custom-http-api-eg-vercel-function)
- [Configuring for other languages](#configuring-for-other-languages)
- [Configuration](#configuration)
- [Operations](#operations)
- [Benchmarks (summary)](#benchmarks-summary)
- [API reference](docs/API.md)
- [Memory model spec](docs/spec-memory-model_EN.md)
- [License](#license)

---

## What it is

You give it knowledge (markdown files, database rows, decisions). Your agent asks questions. It returns **the exact fact plus where it comes from**, or **nothing at all** when the corpus does not contain the answer.

Three things make it different from a chunk-and-embed RAG:

1. **It remembers usage over time.** Knowledge that is consulted regularly (with spacing) becomes more durable; one-shot buzz dilutes and disappears. No timers, no cron — each memory plane counts its own commits.
2. **It answers with the precise fact, not a truncated chunk.** Retrieval returns the fine-grained *leaf* (a sentence, a paragraph, a SQL row) plus a breadcrumb (`doc > section`) showing where it lives.
3. **It prefers silence to lies.** If nothing in the corpus matches — lexically, structurally or semantically — it returns zero results instead of the "least distant" neighbours.

Everything runs in one SQLite file, in-process, fully deterministic: the same state + the same question always produce the same answer.

### How a query works — the wave

Retrieval is not a top-k document list; it is an activation wave through the atom graph:

1. **Seeds** — atoms matching the question directly receive energy, via four surfaces: referents, FTS5 keywords, titles, and the vector (semantic) surface.
2. **Propagation** — energy spreads along the links between atoms, like ripples in water (hence "wave"). Atoms connected to matches get carried up.
3. **Threshold θ** — only atoms whose final energy crosses `theta` *surface*. The wave = the activated atoms, ordered by energy.

`recall` picks the strategy via `mode`: `"lexical"` runs one lexical-only wave (the cheap probe — what `recallLexical()` aliases); `"lexical_vec"` (default) runs N1 then a second wave with adjacent terms plus the vector surface and keeps the stronger; `"vec"` fuses lexical and vector seeds into a single wave — it reaches facts that share no vocabulary with the question.

### Glossary (the acronyms and the vocabulary)

| Term | Meaning |
|---|---|
| **RAG** | Retrieval-Augmented Generation — fetching documents to feed an LLM. |
| **FTS5** | SQLite's built-in full-text search engine (used for exact lexical matching). |
| **BM25** | The ranking function FTS5 uses — rare terms score higher (built-in IDF). |
| **model2vec** | A family of tiny static embedding models (here `potion-base-8M`, 29 MB, pure JS loader — no Python, no ONNX). |
| **vec0 / sqlite-vec** | A SQLite extension adding native vector search. Optional; used above ~50k atoms. |
| **KNN** | k-nearest-neighbours — the vector similarity search. |
| **STP / LTP** | Short-Term / Long-Term memory, borrowed from neuroscience. STP = the agent's *working memory*: volatile energy that cools within a few prompts. LTP = *windowed frequency*: how often an atom surfaced over the scope's recent commits — measured, not simulated. |
| **Bookmark** | One append-only row written per surfaced atom per commit on a scope (`w = the atom's wave energy ÷ atoms surfaced that commit`). The durable truth of "this scope surfaced this atom" — everything else is rebuilt from it. |
| **Ring / `freq_buckets`** | A 10-slot bucket ring per (scope, atom) caching bookmark mass per ~10-commit bucket — O(1) writes, rebuilt exactly from `bookmarks` by `maintain()`. |
| **Spread** | Number of distinct buckets an atom occupies. A burst packs into few buckets; consultations spaced across commits fill the ring — that is what separates durable knowledge from hype. |
| **Leaf / atom** | The smallest self-contained unit of knowledge (a sentence, paragraph or SQL row) that still makes sense when quoted alone. |
| **Cadastre** | The permanent, append-only record of everything ever deposited (atoms, links, logs). The "landscape" (what surfaces) is computed from it and can always be rebuilt. |
| **Wave / surfacing** | When a query activates the field, energy spreads from the matched atoms to their neighbours ("waves"); atoms whose energy crosses the threshold `theta` *surface* (become visible to the agent). |
| **Cascade (N1/N2)** | The two-wave query strategy: N1 = lexical match only; N2 = the same wave re-run with adjacent terms plus the vector surface. `recall` always runs both and keeps the stronger wave; `recallLexical` stops at N1. If nothing credible matches, the engine stays silent. |
| **`derives_from`** | The provenance chain linking a leaf to its section and document. |

---

## Quick start

```bash
npm install @ytrynot/osem-rag better-sqlite3
npm run setup -w @ytrynot/osem-rag   # optional: download the semantic model
```

The whole engine is eight methods, in three groups:

| Group | Method | What it does, in plain words |
|---|---|---|
| Write | `registerMemo(input)` | store one fact (a leaf, or a structural parent) |
| Write | `registerDoc(dir, opts?)` | ingest a whole folder of markdown files |
| Query | `recall(opts)` | **recommended query** — lexical wave first, then always a second wave with related terms + semantic search |
| Query | `recallLexical(opts)` | lexical-only variant — alias of `recall({ mode: "lexical" })`, for tight loops |
| Query | `formatContext(opts)` | build the ready-to-paste context block from the agent's working memory |
| Care | `maintain()` | maintenance: erode and prune learned edges, rebuild the frequency ring (every pruning is traced, drift is reported) |
| Care | `stats()` · `hotAtoms(n)` | field health · hottest atoms by recent-windowed share (diagnostics) |

The query flow is always the same two calls: `recall`/`recallLexical` fills the agent's working memory *and* returns what surfaced; `formatContext` renders that working memory into a prompt-ready block.

### 1. Ingest a folder of markdown

```typescript
import Database from "better-sqlite3";
import { createOsem } from "@ytrynot/osem-rag";

const db = new Database("memory.db");   // your connection — the engine never opens or closes it
const osem = createOsem({ db });         // hash embedder, tuned defaults
const { files, atoms } = osem.registerDoc("./docs");
// → { files: 26, atoms: 4358 }
```

Each document becomes a hierarchy: `doc → section → paragraph → sentence`. The **leaf** (paragraph, or sentence for critical rules) is what gets cited; its ancestors are kept as breadcrumbs, not as competing chunks.

### 2. Ask questions

```typescript
const { surfaced, trace } = osem.recall({
  agentId: "my-agent",   // each agent gets its own working memory
  prompt: "serialization atoms",
});
// surfaced = the atoms that lit up, strongest first, with provenance tags
// e.g. via="wave" srcs="f,g"  → reached by full-text AND title surfaces
```

`recall` picks a wave strategy via `mode`: `"lexical_vec"` (default) runs the lexical wave (N1) then a second wave (N2) with adjacent terms plus the vector surface — the stronger wave is kept; `"vec"` runs one fused lexical+vector wave instead (cheaper, no adjacent-term expansion); `"lexical"` is the lexical-only probe. If nothing credible matches, it returns **zero results** — the field stays silent rather than inventing context.

> **Query style: keywords, not sentences.** Each term of the prompt is priced by its corpus frequency (IDF): a word that appears everywhere contributes ≈ 0 energy, a rare term contributes fully. There is no stop list — but in a technical corpus, question scaffolding (`how`, `does`, `comment`) is *rare* and therefore *expensive*: `"how does the injection budget work"` lets `how` seed real atoms. Agents should pass the distilled keywords — `"injection budget"` — and let their own LLM handle the question→keyword step. Matching several informative terms still dominates a single-word hit.

### 3. Inject the context into your prompt

```typescript
const ctx = osem.formatContext({ agentId: "my-agent" });
// ctx.text  → ready-to-paste context block:
//   ⚓ pinned decisions (never forgotten)
//   📄 the precise leaves (the facts)
//   🗺  breadcrumbs (doc > section, where the leaves live)
//   ≈  hot zones (parents worth digging into)
systemPrompt += `\n\nRelevant knowledge:\n${ctx.text}`;
```

### 4. Let time do its job

```typescript
// No clock to pass — each scope counts its own commits. Dilution, spread
// and fatigue are computed from that sequence — no background jobs, no cron.
const surfaced = osem.recallLexical({ agentId: "my-agent", prompt: userMessage });
osem.maintain();          // maintenance: erode/prune edges, rebuild the ring (traced)
```

> `recallLexical` runs a single lexical pass; `recall` always adds the second wave — related terms then the semantic channel. Prefer `recall` for user-facing queries; the single pass suits tight loops where you control the strategy yourself.

Facts that are consulted regularly *with spacing* spread across commit buckets and earn the durable tier. One-day buzz dies when the long window slides past — no cron, no TTL tables.

---

## Scripts — demo, bench, lme, setup

All four live in `scripts/` and run through npm from the repo root. They import the **built package** (`@ytrynot/osem-rag` → `dist/`), exactly what a consumer gets — so build first, then run:

```bash
# 0. Build (the scripts exercise dist/, not src/)
npm run build -w @ytrynot/osem-rag

# 1. Download the semantic model (optional — the hash embedder works without it)
npm run setup -w @ytrynot/osem-rag

# 2. Run the demo: ingest the dna corpus, run the cascade, show the injection
npm run demo -w @ytrynot/osem-rag

# 3. Run the bench campaign (silence, health, latency, OFF/ON)
npm run bench -w @ytrynot/osem-rag

# 4. Run the LongMemEval-S retrieval benchmark (dataset auto-downloaded,
#    deleted after the run)
npm run lme -w @ytrynot/osem-rag

# 5. Run the 55-test vitest suite
npm test -w @ytrynot/osem-rag
```

**Demo** — run it on YOUR documentation. Sources are repeatable and mixable; anything that is not a flag is a prompt:

```bash
npm run demo -w @ytrynot/osem-rag
#   → scripted demo on the package's own docs (README + docs/, ~500 atoms)

npm run demo -w @ytrynot/osem-rag -- --dir ./docs
#   ingest every markdown file under ./docs

npm run demo -w @ytrynot/osem-rag -- --doc ./README.md --doc ./GUIDE.md
# one or more single files

npm run demo -w @ytrynot/osem-rag -- --url https://example.com/guide
# fetch a web page and ingest its readable text (repeatable too)

npm run demo -w @ytrynot/osem-rag -- --dir ./docs "your prompt" "another prompt"
# mix sources and prompts: prompts run through the cascade, then the
# injected context is printed
```

| Flag | Meaning |
|---|---|
| `--doc <file>` | ingest one markdown file |
| `--dir <folder>` | ingest every markdown file under a folder |
| `--url <url>` | fetch a web page, strip the HTML, ingest the readable text |
| anything else | a prompt, run through the cascade |

With no source, the demo ingests **the package's own documentation** — its README plus everything under `docs/`. Point it at your own folder, files or pages with the flags above.

**Bench** — same script, plus latency scaling with and without the native vector index:

```bash
npm run bench -w @ytrynot/osem-rag                       # JS scan (default)
OSEM_SQLITE_VEC=1 npm run bench -w @ytrynot/osem-rag   # native vec0 KNN
```

**LME** — the external benchmark harness ([results](docs/results-longmemeval-bench_EN.md)). It auto-downloads the LongMemEval-S dataset (~277 MB, not committed — Hugging Face `xiaowu0162/longmemeval-cleaned`) into `sandbox/` when absent, and deletes it after the run (`LME_KEEP=1` to keep it, `LME_DATASET=<path>` to use a local copy):

```bash
npm run lme -w @ytrynot/osem-rag          # 500 instances, model2vec if present
LME_LIMIT=50 npm run lme -w @ytrynot/osem-rag   # subset
LME_HASH=1   npm run lme -w @ytrynot/osem-rag   # hash-embedder control
LME_MODE=vec npm run lme -w @ytrynot/osem-rag   # fused wave (lexical|lexical_vec|vec)
LME_BUDGET=4000 npm run lme -w @ytrynot/osem-rag # override the injection budget
```

**Configuring the scripts** (both read the same two settings):

| Setting | Default | Meaning |
|---|---|---|
| `OSEM_MODEL_DIR` (env) or 1st argument | `~/.osem/models/potion-base-8M` | where the model2vec files live (outside the repo) |
| `OSEM_SQLITE_VEC=1` (env) | off | load the native sqlite-vec KNN index for the bench |
| default corpus (no source given) | the package's own `README.md` | pass `--dir` / `--doc` / `--url` to ingest your own documentation |

The model is downloaded **outside the repository** (`~/.osem/models/` by default) — nothing binary ever lands in git. If the model files are absent, the demo and bench automatically fall back to the zero-dependency hash embedder and say so in their banner.

---

## How to integrate

### With Vercel AI SDK

The field is storage + retrieval only — it never calls an LLM. Use it as the retriever in front of `generateText`:

```typescript
import { generateText } from "ai";
import { createOsem } from "@ytrynot/osem-rag";

const osem = createOsem({ db });
const ctx = osem.formatContext({ agentId: "user-42" });
const answer = await generateText({
  model,
  system: "Answer only from the provided context. If absent, say you don't know.",
  prompt: `${userQuestion}\n\nContext:\n${ctx.text}`,
});
```

### With LangChain.js

Implement the `Embeddings` interface over osem's own recall — or the reverse: plug any LangChain embeddings as the osem semantic channel.

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";
import type { IEmbedder } from "@ytrynot/osem-rag";

// LangChain embeddings → osem embedder (one adapter, ~10 lines).
class LangChainEmbedder {
  readonly dim: number;
  readonly vocab = 0;
  constructor(private readonly inner: { embedDocuments(t: string[]): Promise<number[][]> }) {}
  embed(text: string): Float32Array { /* call inner, L2-normalize, return */ }
}

const osem = createOsem({ db, embedder: { embedder: new MyAdapter(new OpenAIEmbeddings()) } });
```

The same applies to any provider (Cohere, Jina, local ONNX…): implement `embed(text) → Float32Array` (L2-normalized) and you are done — the field physics are identical whatever the backend.

### With a custom HTTP API (e.g. Vercel function)

```typescript
// app/api/recall/route.ts — the engine runs inside your serverless function.
import Database from "better-sqlite3";
import { createOsem } from "@ytrynot/osem-rag";

const db = new Database(process.env.OSEM_DB_PATH ?? "memory.db");
const osem = createOsem({ db });

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const agentId = req.headers.get("x-agent") ?? "anon";
  osem.recallLexical({ agentId, prompt });
  return Response.json(osem.formatContext({ agentId }));
}
```

> **Serverless caveat**: SQLite is single-writer. One writer per file, or enable WAL mode on your connection before handing it to `createOsem`.

## Configuring for other languages

The engine is language-agnostic; only the *seeding* layer is language-bound. Three independent levers, all swappable without touching the physics:

| Layer | FR/EN default | For other languages |
|---|---|---|
| Full-text (FTS5) | default unicode tokenizer | `tokenize='unicode61'` (accents) or `'trigram'` (CJK, no spaces) |
| Hash channel | works as-is (character n-grams) | already language-agnostic |
| Semantic model | `potion-base-8M` (English-distilled; FR/ES/DE work via cognates) | any multilingual model2vec variant — same loader, different safetensors file |
| CJK scripts | not segmented by the pre-tokenizer | split CJK character ranges before WordPiece lookup |

```typescript
// Example: point at a multilingual model directory (same loader, other files).
const osem = createOsem({
  db,
  embedder: { kind: "model2vec", modelDir: "./models/potion-multilingual" },
  config: { embedDim: 256 },   // must match the model's dimension
});
```

What fails today for CJK (validated, not assumed): a Chinese prompt surfaces **zero** atoms — honest silence, no fabricated context. The lexical regex is ASCII-only (`termsOf` extracts nothing from `记忆场引擎`) and the FTS5 default tokenizer stores each CJK run as one opaque token, so even an exact bigram fails to match. The failure is confined to seeding; waves, fatigue and floors are untouched (measured during the v4 campaign — the archived measurement doc is not shipped with the package). Activation path when needed: CJK-bigram extraction in `termsOf` (IDF prices each bigram, no dictionary required), `tokenize='trigram'` on the FTS tables, and a multilingual safetensors file.

---

## Configuration

Every constant is a documented field of `IOsemConfig`, with the audited value as default. The ones you will actually touch:

| Field | Default | Meaning |
|---|---|---|
| `theta` | 0.5 | surfacing threshold on wave energy |
| `freqWindowHot` / `freqWindowMedium` / `freqWindowLong` | 20 / 50 / 100 | the commit windows (hot / warm / durable reads) |
| `freqBucketSize` | 10 | commits per ring bucket — the ring depth is `freqWindowLong / freqBucketSize` |
| `freqMinBuckets` | 3 | minimum spread for the durable tier |
| `cosSilenceSemantic` / `cosSilenceHash` | 0.40 / 0.55 | per-channel silence guard |
| `budgetTok` / `payloadShare` | 800 / 0.7 | injection budget and payload share |
| `maxLeavesPerAncestor` | 3 | injection diversity cap per ancestor |
| `useSqliteVec` | false | native KNN index (worth it above ~50k atoms) |

## Operations

```typescript
osem.stats();                      // atoms, links, embeddings, query atoms, active scopes
osem.hotAtoms(8);                  // hottest atoms by recent-windowed share (diagnostics)
osem.maintain();                   // traced erosion + pruning + ring rebuild (drift reported)
```

- **Backups**: it is one SQLite file — copy it. `pinned` atoms, `bookmarks` and the cadastre are append-only; the landscape is regenerable from the tables.
- **Concurrency**: SQLite is single-writer. One writer process per file; multiple readers are fine.
- **Crash recovery**: working memory (per-scope energy) is volatile by design; the cadastre and the append-only bookmarks survive a crash — and the frequency ring is rebuilt from them on the next `maintain()`.
- **Privacy**: every recall persists its prompt verbatim as a `kind='query'` atom (the provenance anchor of bookmarks — excluded from every surface, never FTS-indexed or embedded). Don't put secrets in prompts.

## Benchmarks (summary)

We ran five adversarial behaviors against the engine — drawn from a 55-test suite (see [`docs/result-test-suite_EN.md`](docs/result-test-suite_EN.md)) plus a 500-question external benchmark. What they mean in practice:

- **It says "I don't know" instead of guessing.** We asked about 10 topics that are completely absent from the knowledge base (kubernetes, graphql, rustlang…). All 10 returned *nothing* — no approximate chunks, no invented context. A classic vector search would have returned its "least bad" chunks anyway, and the LLM would have improvised an answer from that noise.

- **Typos and other languages still find the answer.** Asking `serializaton` (misspelled), `sérialisation` (French spelling) or "convertir les types automatiquement" (French, the docs are in English) all found the right document — thanks to the semantic embedding layer, not keyword matching.

- **Repeatedly asking about a fad does not make it permanent.** We queried a fake one-day bug 30 times in a row: it became temporarily prominent, then died on its own once the commit window slid past. Knowledge that is revisited *regularly over time* spreads across buckets and stays durable. This behaviour is not hard-coded anywhere — it emerges from how committed surfacings are counted.

- **Same input, same output, always.** Two freshly initialized systems, 100 identical queries each: byte-identical results. No randomness anywhere.

- **Response time grows roughly linearly, not explosively.** From 1,000 to 10,000 atoms, end-to-end query time grows ~proportionally with the corpus (seed collection scans the corpus; only wave *propagation* is beam-bounded). The optional native vector index only becomes useful around 50,000+ atoms.

We also ran a **LongMemEval-style agent-usage simulation** (`tests/h-agent-sim.test.ts`): ~350 deposited memories, 3 agents, 102 queries across the published memory-benchmark categories. Results:

| What we tested | What happened |
|---|---|
| Finding a specific fact among hundreds | all 40 came back into the injected context |
| A fact that was later updated | the new value is returned, the old one is gone (10/10) |
| A memory you deleted or retracted | it never resurfaces — anywhere |
| Two memories differing by a single word | the right one wins, 10/10 |
| A fact shared by one agent | another agent can retrieve it (8/8) |
| An agent's private notes | invisible to other agents — zero leakage |
| Asking about something never stored | silence, 10/10 — nothing invented |
| A memory consulted regularly over time | it outranks an identical but untouched one |
| A longer memory (2-3 paragraphs, ~130 words) | found and injected, excerpt bounded to its budget share |
| Time for a full recall + context build | bounded — grows roughly linearly with the corpus |

For scale: the comfort zone is agent-scale memory (hundreds to tens of thousands of memories), not million-row archives.

---

The current memory-model contract: [`docs/spec-memory-model_EN.md`](docs/spec-memory-model_EN.md).

What each test and bench scenario plays, in plain words: [`docs/result-test-suite_EN.md`](docs/result-test-suite_EN.md).

External benchmark — LongMemEval-S retrieval evaluation (500 questions, failure analysis included): [`docs/results-longmemeval-bench_EN.md`](docs/results-longmemeval-bench_EN.md).

---

## License

MIT — see [LICENSE](./LICENSE).

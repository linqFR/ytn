/**
 * Bench — OSEM-RAG package campaign (port of the v12 sandbox bench).
 * Four self-describing scenarios; ratios and trends are portable,
 * raw numbers are platform-dependent trace only.
 *
 * Runs against the BUILT package (dist/ via the workspace self-import) —
 * build first: `npm run build -w @ytrynot/osem-rag`.
 *
 *   node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/bench.ts
 *   OSEM_SQLITE_VEC=1 node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/bench.ts
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOsem, type IOsemRag } from "@ytrynot/osem-rag";

const USE_VEC = process.env.OSEM_SQLITE_VEC === "1";
const MODEL_DIR = process.env.OSEM_MODEL_DIR
  ?? join(homedir(), ".osem", "models", "potion-base-8M");
const hasModel = existsSync(`${MODEL_DIR}/model.safetensors`);

/** Field over the frozen dna-docs snapshot (the campaign corpus). */
function makeOsemReal(): { osem: IOsemRag; db: Database.Database } {
  const db = new Database(":memory:");
  const osem = createOsem({
    db,
    embedder: hasModel
      ? { kind: "model2vec", modelDir: MODEL_DIR }
      : { kind: "hash" },
  });
  osem.registerDoc(join(import.meta.dirname, "..", "tests",
    "fixtures", "dna-snapshot"));
  osem.maintain();
  return { osem, db };
}

function buildSynth(n: number): { osem: IOsemRag; db: Database.Database } {
  const db = new Database(":memory:");
  const osem = createOsem({
    db,
    embedder: hasModel
      ? { kind: "model2vec", modelDir: MODEL_DIR }
      : { kind: "hash" },
    config: { useSqliteVec: USE_VEC },
  });
  osem.registerMemo({ id: "doc:load.md", kind: "synthese", granularity: "doc",
                 body: "Load corpus", title: "load", fts: false });
  const words = Array.from({ length: 300 }, (_, i) => `tok${i}`);
  for (let i = 0; i < n; i++)
    osem.registerMemo({ id: `syn:${i}`, kind: "observation", granularity: "paragraph",
      body: `${words[(i * 7) % 300]} ${words[(i * 13 + 3) % 300]} ` +
            `${words[(i * 29 + 5) % 300]} contenu atome ${i}`,
      derivesFrom: "doc:load.md" });
  osem.maintain();
  return { osem, db };
}

function giniOf(values: number[]): number {
  const v = values.slice().sort((a, b) => a - b);
  const n = v.length, sum = v.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  let g = 0;
  for (let i = 0; i < n; i++) g += (2 * (i + 1) - n - 1) * v[i];
  return g / (n * sum);
}

const rule = (s: string) => `── ${s} ${"─".repeat(Math.max(0, 68 - s.length))}`;

console.log("═══ OSEM-RAG BENCH ═══");
const { osem, db } = makeOsemReal();
console.log(`corpus: ${JSON.stringify(osem.stats())}\n`);

// ── A4 · honest silence ──────────────────────────────────────────────────
// 10 questions about topics that were NEVER stored. A memory engine must
// return nothing rather than fabricate context.
console.log(rule("A4 · honest silence — unknown topics must return nothing"));
console.log("play : 10 queries on absent concepts (graphql, kubernetes, …)");
console.log("reads: how many queries come back empty");
console.log("goal : 10/10 silent — no fabricated seeds\n");
let silences = 0;
for (const q of ["graphql", "kubernetes", "docker", "terraform", "webassembly",
  "postgresql", "redis", "nginx", "rustlang", "elm"]) {
  const { surfaced } = osem.recall({ agentId: "A4", prompt: q });
  if (surfaced.length === 0) silences++;
}
console.log(`→ ${silences}/10 silent  (criterion: 10/10)\n`);

// ── C1 · weight inequality ───────────────────────────────────────────────
// 200 queries over 10 recurring topics. Every traversal strengthens the
// edges used — does traffic collapse into a winner-take-all field?
console.log(rule("C1 · link-weight inequality (Gini) — echo-chamber detector"));
console.log("play : 200 queries across 10 recurring topics; each traversal");
console.log("       reinforces the edges it used (hebbian gain)");
console.log("reads: Gini coefficient of link weights (0 = perfectly equal,");
console.log("       1 = all the weight on a single edge)");
console.log("goal : < 0.6 — above that, reinforcement becomes a monopoly\n");
const topics = ["maranget", "serialization", "coercion", "opcode", "schema",
  "performance", "worker", "bytecode", "dispatch", "coercion"];
for (let i = 0; i < 200; i++)
  osem.recallLexical({ agentId: "C1",
                prompt: `${topics[i % topics.length]} ${topics[(i * 7) % topics.length]}` });
const weights = (db.prepare(`SELECT weight FROM atom_links`).all() as
  { weight: number }[]).map(w => w.weight);
const gini = giniOf(weights);
console.log(`→ Gini = ${gini.toFixed(3)}  (criterion: < 0.6)\n`);

// ── C2 · injected hubness ────────────────────────────────────────────────
// 50 more queries; count how often each leaf lands in the injected payload.
// Do a few popular atoms monopolize the context window?
console.log(rule("C2 · injected hubness — do a few atoms hog the context?"));
console.log("play : 50 more queries; count each leaf's appearances in the");
console.log("       injected payload (post-pool selection, ancestor cap on)");
console.log("reads: % of payload slots captured by the top-1% leaves");
console.log("goal : < 20% — popular facts must not drown the precise ones\n");
const injected = new Map<string, number>();
for (let i = 0; i < 50; i++) {
  osem.recallLexical({ agentId: "C2",
                prompt: `${topics[i % topics.length]} ${topics[(i * 3) % topics.length]}` });
  const ctx = osem.formatContext({ agentId: "C2" });
  for (const id of ctx.leafIds)
    injected.set(id, (injected.get(id) ?? 0) + 1);
}
const counts = [...injected.values()].sort((a, b) => b - a);
const top1pct = Math.max(1, Math.ceil(counts.length / 100));
const hub = counts.slice(0, top1pct).reduce((a, b) => a + b, 0);
const total = counts.reduce((a, b) => a + b, 0);
console.log(`→ ${(hub / Math.max(1, total) * 100).toFixed(1)}% of payload slots  (criterion: < 20%)\n`);

// ── D1 · latency vs corpus size ──────────────────────────────────────────
// Same queries at growing corpus sizes (synthetic), with and without the
// native vector index. Beam-bounded propagation should keep latency flat-ish.
console.log(rule("D1 · recall latency vs corpus size — does it scale?"));
console.log("play : 20 identical queries at 1k / 5k / 10k synthetic atoms,");
console.log("       measured without then with the sqlite-vec KNN index");
console.log("reads: p50 / p95 latency and the growth ratio per step");
console.log("goal : sub-linear growth — the beam bounds the work, not the corpus\n");
for (const useVec of [false, true]) {
  console.log(`   ── sqlite-vec ${useVec ? "ON" : "OFF"} ──`);
  let prevP95 = 0, prevN = 0;
  const trends: string[] = [];
  for (const n of [1000, 5000, 10000]) {
    const { osem: s, db: d } = buildSynth(n);
    const lat: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      s.recallLexical({ agentId: "D1",
                 prompt: `tok${(i * 11) % 300} tok${(i * 3 + 1) % 300}` });
      lat.push(performance.now() - t0);
    }
    lat.sort((a, b) => a - b);
    // Percentiles by rank: p = ceil(p·n)-1 on the sorted sample.
    const q = (p: number) => lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)]!;
    console.log(`   ${String(n).padStart(6)} atoms: p50=${q(0.5).toFixed(1)}ms  p95=${q(0.95).toFixed(1)}ms`);
    if (prevP95) trends.push(`x${(q(0.95) / prevP95).toFixed(2)} vs ${prevN}`);
    prevP95 = q(0.95); prevN = n;
    d.close();
  }
  console.log(`   trend: ${trends.join(", ")} (expected: sub-linear — beam bounded)\n`);
}

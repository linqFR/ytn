/**
 * Bench — OSEM-RAG package campaign (port of sandbox/bench-ariane.ts).
 * Reports portable ratios and trends; raw numbers are sandbox trace only.
 *
 *   node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/bench.ts
 *   OSEM_SQLITE_VEC=1 node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/bench.ts
 */
import Database from "better-sqlite3";
import { createOsem, type IOsemRag } from "../src/index.ts";
import { makeOsemReal, MODEL_DIR, hasModel } from "../tests/helpers.ts";

const USE_VEC = process.env.OSEM_SQLITE_VEC === "1";

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
  osem.maintain(0);
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

console.log("═══ OSEM-RAG BENCH ═══");
const { osem, db } = makeOsemReal();
console.log(`═══ ${JSON.stringify(osem.stats())} ═══\n`);

// A4 — honest silence on the real corpus.
let silences = 0;
for (const q of ["graphql", "kubernetes", "docker", "terraform", "webassembly",
  "postgresql", "redis", "nginx", "rustlang", "elm"]) {
  const { surfaced } = osem.recall({ agentId: "A4", tick: 0, prompt: q });
  if (surfaced.length === 0) silences++;
}
console.log(`A4 honest silence: ${silences}/10 (criterion: 10/10)\n`);

// C1/C2 — field health after 200 prompts.
const topics = ["maranget", "serialization", "coercion", "opcode", "schema",
  "performance", "worker", "bytecode", "dispatch", "coercion"];
for (let i = 0; i < 200; i++)
  osem.recallShallow({ agentId: "C1", tick: 0,
                prompt: `${topics[i % topics.length]} ${topics[(i * 7) % topics.length]}` });
const weights = (db.prepare(`SELECT weight FROM atom_links`).all() as
  { weight: number }[]).map(w => w.weight);
const sorted = weights.slice().sort((a, b) => a - b);
const n = sorted.length, sum = sorted.reduce((a, b) => a + b, 0);
let g = 0;
for (let i = 0; i < n; i++) g += (2 * (i + 1) - n - 1) * sorted[i];
const gini = sum ? g / (n * sum) : 0;
console.log(`C1 Gini of link weights: ${gini.toFixed(3)} (criterion: < 0.6)`);

const injected = new Map<string, number>();
for (let i = 0; i < 50; i++) {
  osem.recallShallow({ agentId: "C2", tick: 0,
                prompt: `${topics[i % topics.length]} ${topics[(i * 3) % topics.length]}` });
  const ctx = osem.formatContext({ agentId: "C2" });
  for (const id of ctx.leafIds)
    injected.set(id, (injected.get(id) ?? 0) + 1);
}
const counts = [...injected.values()].sort((a, b) => b - a);
const top1pct = Math.max(1, Math.ceil(counts.length / 100));
const hub = counts.slice(0, top1pct).reduce((a, b) => a + b, 0);
const total = counts.reduce((a, b) => a + b, 0);
console.log(`C2 injected hubness (post-pools, ancestor cap): ` +
  `${(hub / Math.max(1, total) * 100).toFixed(1)}% of payload slots (criterion: < 20%)\n`);

// D1 — latency vs corpus size (synthetic), vec OFF then ON.
for (const useVec of [false, true]) {
  console.log(`── D1 latency (sqlite-vec ${useVec ? "ON" : "OFF"}) ──`);
  let prevP95 = 0, prevN = 0;
  const trends: string[] = [];
  for (const n of [1000, 5000, 10000]) {
    const { osem: s, db: d } = buildSynth(n);
    const lat: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      s.recallShallow({ agentId: "D1", tick: 0,
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

/**
 * LongMemEval-S retrieval benchmark — offline, one fresh in-memory field per
 * question instance.
 *
 * Protocol: each of the 500 instances owns its own haystack (~48 sessions).
 * Sessions are ingested as paragraph-granularity atoms, then the question is
 * recalled. A hit@k means at least one `answer_session_id` surfaced in the
 * wave's top-k; coverage@k measures the fraction of ALL evidence sessions
 * found (the metric that matters for aggregation questions).
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/longmemeval.ts
 *   LME_LIMIT=50    → run a subset
 *   LME_DATASET=<path> → dataset location (default: sandbox/longmemeval_s.json)
 *   LME_HASH=1      → force the hash embedder (no semantic surface)
 *   LME_MODE=lexical | lexical_vec | vec  → wave strategy (default lexical_vec)
 *   LME_BUDGET=<n>  → override formatContext budgetTok for the injected-
 *                     coverage metric (default: engine config, 800)
 *   LME_MISS=<path> → dump per-miss evidence ranks as JSON
 *   LME_KEEP=1      → keep the auto-downloaded dataset after the run
 *
 * Dataset: longmemeval_s_cleaned.json (~277 MB), Hugging Face
 * `xiaowu0162/LongMemEval`. Auto-downloaded into sandbox/ when absent and
 * deleted after the run (unless LME_KEEP=1 or LME_DATASET points elsewhere).
 *
 * Paper baselines (retrieval recall@5, session granularity): flat BM25 ≈ .58,
 * Contriever ≈ .71, Stella ≈ .80. Our protocol is close but not identical
 * (wave surfacing, not top-k list) — treat as a signal, not a leaderboard run.
 */
import Database from "better-sqlite3";
import { createWriteStream, existsSync, readFileSync, unlinkSync,
         writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOsem, type IOsemRag } from "@ytrynot/osem-rag";

/** One LongMemEval instance: question + haystack + evidence session ids. */
interface tsLmeInstance {
  question_id: string;
  question_type: string;
  question: string;
  answer: string;
  haystack_session_ids: string[];
  haystack_sessions: { role: string; content: string }[][];
  answer_session_ids: string[];
}

const MODEL_DIR = process.env.OSEM_MODEL_DIR
  ?? join(homedir(), ".osem", "models", "potion-base-8M");
const hasModel = existsSync(`${MODEL_DIR}/model.safetensors`);
const LIMIT = parseInt(process.env.LME_LIMIT ?? "500", 10);
const DATASET = process.env.LME_DATASET ?? "sandbox/longmemeval_s.json";
const MISS_OUT = process.env.LME_MISS ?? "sandbox/lme-misses.json";
const USE_MODEL = hasModel && process.env.LME_HASH !== "1";
console.log(USE_MODEL ? `[model2vec ON: ${MODEL_DIR}]` : "[hash embedder]");

const DATASET_URL = "https://huggingface.co/datasets/xiaowu0162/" +
  "longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json";
const datasetPath = join(import.meta.dirname, "..", DATASET);
const autoDownloaded = !existsSync(datasetPath)
  && !process.env.LME_DATASET;
if (autoDownloaded) {
  console.log(`dataset absent — downloading ${DATASET_URL}`);
  const res = await fetch(DATASET_URL);
  if (!res.ok || !res.body)
    throw new Error(`dataset download failed: HTTP ${res.status}`);
  await res.body.pipeTo(Writable.toWeb(createWriteStream(datasetPath)));
  console.log("dataset downloaded");
}
const data = JSON.parse(readFileSync(datasetPath, "utf8")) as tsLmeInstance[];

const sessionText = (turns: { role: string; content: string }[]): string =>
  turns.map((t) => `${t.role}: ${t.content}`).join("\n");

let hit1 = 0, hit5 = 0, mrr = 0, n = 0, surfacedTotal = 0, empty = 0;
let cov5 = 0, cov10 = 0; // mean fraction of evidence sessions in top-k
let injCov = 0;          // mean fraction of evidence sessions in injected payload
const byType: Record<string,
  { n: number; hit5: number; cov5: number; inj: number }> = {};
const misses: {
  qid: string; type: string; q: string; ranks: number[]; nsurf: number;
}[] = [];
const t0 = Date.now();

for (const inst of data.slice(0, LIMIT)) {
  const db = new Database(":memory:");
  const osem: IOsemRag = createOsem(USE_MODEL
    ? { db, embedder: { kind: "model2vec", modelDir: MODEL_DIR } }
    : { db });
  inst.haystack_sessions.forEach((turns, i) =>
    osem.registerMemo({
      id: `s:${inst.haystack_session_ids[i]}`, kind: "observation",
      granularity: "paragraph", body: sessionText(turns),
      src: `s:${inst.haystack_session_ids[i]}`,
    }));
  osem.maintain();

  // recall() exercises the full cascade (lexical + adjacent + vector);
  // recallLexical() is the lexical probe used for the hash-embedder control.
  // LME_MODE mirrors the recall `mode` option verbatim:
  // "lexical" only, "lexical_vec" (default) cascade, "vec" fused wave.
  const mode = process.env.LME_MODE === "lexical" ? "lexical"
    : process.env.LME_MODE === "vec" ? "vec" : "lexical_vec";
  const surfaced = USE_MODEL
    ? osem.recall({ agentId: "lme", prompt: inst.question, mode }).surfaced
    : osem.recall({ agentId: "lme", prompt: inst.question,
        mode: "lexical" }).surfaced;

  // The metric that matches real usage: which evidence sessions land in the
  // injected payload (budget-capped), not just somewhere in the wave.
  const budgetTok = parseInt(process.env.LME_BUDGET ?? "0", 10) || undefined;
  const injected = new Set(
    osem.formatContext({ agentId: "lme", budgetTok }).items
      .map(i => i.source));
  const instInj = inst.answer_session_ids.filter(
    aid => injected.has(`s:${aid}`)).length / inst.answer_session_ids.length;

  const ranks = inst.answer_session_ids.map((aid) =>
    surfaced.findIndex((r) => r.id === `s:${aid}`));
  const first = Math.min(...ranks.filter((r) => r >= 0), Infinity);
  const c5 = ranks.filter((r) => r >= 0 && r < 5).length / ranks.length;
  const c10 = ranks.filter((r) => r >= 0 && r < 10).length / ranks.length;

  n++;
  surfacedTotal += surfaced.length;
  if (surfaced.length === 0) empty++;
  if (first === 0) hit1++;
  if (first < 5) hit5++;
  if (first < Infinity) mrr += 1 / (first + 1);
  cov5 += c5;
  cov10 += c10;
  injCov += instInj;
  const t = inst.question_type;
  (byType[t] ??= { n: 0, hit5: 0, cov5: 0, inj: 0 }).n++;
  byType[t].hit5 += first < 5 ? 1 : 0;
  byType[t].cov5 += c5;
  byType[t].inj += instInj;
  if (first >= 5)
    misses.push({ qid: inst.question_id, type: t, q: inst.question,
      ranks, nsurf: surfaced.length });
  db.close();
  if (n % 50 === 0)
    console.log(`...${n}/${LIMIT} hit@5=${(hit5 / n).toFixed(3)} ` +
                `elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log(`\n=== LongMemEval-S retrieval (${n} instances) ===`);
console.log(`hit@1 : ${(hit1 / n).toFixed(3)}`);
console.log(`hit@5 : ${(hit5 / n).toFixed(3)}   (baselines: bm25≈.58 contriever≈.71 stella≈.80)`);
console.log(`MRR   : ${(mrr / n).toFixed(3)}`);
console.log(`evidence coverage@5 : ${(cov5 / n).toFixed(3)}  (all sessions, not just first)`);
console.log(`evidence coverage@10: ${(cov10 / n).toFixed(3)}`);
console.log(`injected coverage   : ${(injCov / n).toFixed(3)}  (evidence in the injected payload — real usage)`);
console.log(`avg surfaced: ${(surfacedTotal / n).toFixed(1)}  empty recalls: ${empty}`);
console.log("\nper question_type:");
for (const [t, s] of Object.entries(byType))
  console.log(`  ${t.padEnd(28)} hit@5=${(s.hit5 / s.n).toFixed(3)} ` +
              `cov@5=${(s.cov5 / s.n).toFixed(3)} ` +
              `inj=${(s.inj / s.n).toFixed(3)}  (n=${s.n})`);
console.log(`\nmisses: ${misses.length} instances`);
for (const m of misses)
  console.log(`  ${m.type.padEnd(28)} ranks=${JSON.stringify(m.ranks)} ${m.q}`);
if (process.env.LME_MISS) {
  writeFileSync(join(import.meta.dirname, "..", MISS_OUT),
                JSON.stringify(misses, null, 1));
  console.log(`details dumped → ${MISS_OUT}`);
}
console.log(`total: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (autoDownloaded && process.env.LME_KEEP !== "1") {
  unlinkSync(datasetPath);
  console.log("dataset deleted (LME_KEEP=1 to keep it)");
}

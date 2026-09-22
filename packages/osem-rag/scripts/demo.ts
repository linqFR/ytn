/**
 * Demo / CLI — try the memory field on YOUR documentation.
 *
 *   npm run demo -w @ytrynot/osem-rag
 *   npm run demo -w @ytrynot/osem-rag -- --dir ./docs
 *   npm run demo -w @ytrynot/osem-rag -- --doc ./README.md --url https://example.com/guide
 *   npm run demo -w @ytrynot/osem-rag -- --dir ./docs "injection budget" "synaptic fatigue"
 *
 * Sources (repeatable):
 *   --doc <file>    one markdown file
 *   --dir <folder>  every markdown file under a folder
 *   --url <url>     fetch a web page and ingest its readable text
 * Anything else is a prompt. Prompts are keyword sets — each term is priced by
 * its corpus frequency (IDF), so pass distilled keywords ("injection budget"),
 * not full questions: in a technical corpus, scaffolding words like "how" are
 * rare and therefore expensive. With no source, the demo ingests the
 * package's own documentation (README + docs/) and runs scripted queries.
 */
import Database from "better-sqlite3";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { ancestorsOf, createOsem, leafChunks,
  splitMarkdownSections } from "@ytrynot/osem-rag";

const modelDir = process.env.OSEM_MODEL_DIR
  ?? join(homedir(), ".osem", "models", "potion-base-8M");
const hasModel = existsSync(`${modelDir}/model.safetensors`);

const db = new Database(":memory:");
const osem = createOsem({
  db,
  embedder: hasModel ? { kind: "model2vec", modelDir } : { kind: "hash" },
});

/** Parse argv: repeatable --doc/--dir/--url flags; the rest are prompts. */
const argv = process.argv.slice(2);
const sources: string[] = [];
const prompts: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if ((a === "--doc" || a === "--dir" || a === "--url") && argv[i + 1]) {
    sources.push(argv[i + 1]!);
    i++;
  } else prompts.push(a);
}
if (!sources.length) {
  // Default corpus: the package documents itself — README + docs/.
  sources.push(join(import.meta.dirname, "..", "README.md"));
  sources.push(join(import.meta.dirname, "..", "docs"));
}

/** Strip an HTML page down to readable text (zero dependency). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, "\n\n## $2\n")
    .replace(/<(p|li|tr|div)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/** Ingest one source: a URL, a directory, or a single markdown file. */
async function ingest(src: string): Promise<{ files: number; atoms: number }> {
  if (/^https?:\/\//.test(src)) {
    console.log(`   fetching ${src} …`);
    const res = await fetch(src, { redirect: "follow" });
    if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status} for ${src}`);
    const html = await res.text();
    const host = new URL(src).hostname;
    const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? host).trim();
    const text = htmlToText(html);
    osem.registerMemo({ id: `doc:${host}`, kind: "synthese", granularity: "doc",
                   body: `Document ${src}`, title: host, fts: false });
    osem.registerMemo({ id: `web:${host}#0`, kind: "observation", granularity: "section",
                   title: title.slice(0, 120), body: `[${host}] ${text}`,
                   derivesFrom: `doc:${host}` });
    return { files: 1, atoms: 2 };
  }
  if (statSync(src).isDirectory()) return osem.registerDoc(src);
  const rel = basename(src);
  const md = readFileSync(src, "utf8");
  const stem = rel.slice(0, rel.length - extname(rel).length);
  osem.registerMemo({ id: `doc:${rel}`, kind: "synthese", granularity: "doc",
                 body: `Document ${rel}`, title: rel, fts: false });
  const sections = splitMarkdownSections(md);
  let leaves = 0;
  for (const [i, sec] of sections.entries()) {
    const secId = `${stem}#${i}`;
    osem.registerMemo({ id: secId, kind: "observation", granularity: "section",
                   title: (sec.text.match(/^#{1,3}\s+(.+)/m)?.[1] ?? "").slice(0, 120),
                   body: `[${rel}] ${sec.text}`, derivesFrom: `doc:${rel}`,
                   fts: false, src, srcLine: sec.line });
    for (const leaf of leafChunks(secId, rel, sec.text, sec.line)) {
      osem.registerMemo({ id: leaf.id, kind: "observation", granularity: leaf.granularity,
                     body: leaf.body, flag: leaf.flag, derivesFrom: secId,
                     src, srcLine: leaf.srcLine });
      leaves++;
    }
  }
  return { files: 1, atoms: 1 + sections.length + leaves };
}

const stats = { files: 0, atoms: 0 };
for (const src of sources) {
  const r = await ingest(src);
  stats.files += r.files;
  stats.atoms += r.atoms;
}
osem.maintain();
console.log(`\n═══ OSEM-RAG demo ═══`);
console.log(`Corpus: ${stats.files} document(s) → ${stats.atoms} atoms`);
console.log(`Embedder: ${hasModel ? "model2vec (semantic) + hash (typos)" : "hash only"}\n`);

/** Human-readable provenance: which surfaces found the atom. */
const FOUND_BY: Record<string, string> = {
  r: "exact reference", f: "full-text", g: "title", s: "semantic",
};
const foundBy = (srcs?: string) =>
  (srcs?.split(",") ?? []).map(t => FOUND_BY[t] ?? t).join(" + ") || "propagation";
const excerpt = (body: string) =>
  body.replace(/^\[[^\]]*\]\s*/, "").replace(/[|\n]+/g, " ").replace(/\s+/g, " ")
    .trim().slice(0, 90);

/** Structured result: type, breadcrumb, provenance, excerpt, energy. */
function toResult(x: { id: string; e: number; via: string; srcs?: string }) {
  const row = db.prepare(
    `SELECT body, granularity, title, src, src_line FROM atoms WHERE id = ?`).get(x.id) as
    { body: string; granularity: string; title: string | null;
      src: string | null; src_line: number | null } | undefined;
  const chain = ancestorsOf(db, x.id).map(a => a.title);
  const kind = row?.granularity === "doc" ? "document"
    : row?.granularity === "section" ? "section" : "leaf";
  // A document has no parent chain — its own title is the breadcrumb.
  const breadcrumb = chain.length ? chain.join(" > ") : row?.title ?? x.id;
  const lines: [number, number] | null = row?.src_line != null
    ? [row.src_line, row.src_line + (row.body.split("\n").length - 1)]
    : null;
  return {
    type: kind,
    breadcrumb,
    source: row?.src ?? null,
    lines,
    excerpt: row ? excerpt(row.body) : "",
    energy: +x.e.toFixed(3),
    foundBy: foundBy(x.srcs),
  };
}

/** Print the top results as JSON (breadcrumbs + energy + provenance). */
let legendShown = false;
function show(surfaced: { id: string; e: number; via: string; srcs?: string }[], n = 4) {
  if (!legendShown) {
    console.log("  (energy = match strength; anything ≥ 0.50 surfaces)");
    legendShown = true;
  }
  console.log(JSON.stringify(surfaced.slice(0, n).map(toResult)));
}

const run = (p: string) => {
  const t0 = performance.now();
  const { surfaced, trace } = osem.recall({ agentId: "CLI", prompt: p });
  console.log(`\n── Query: "${p}"  [${(performance.now() - t0).toFixed(0)} ms] ──`);
  if (!surfaced.length) {
    console.log("  → the field stays SILENT: nothing in the corpus matches " +
      "(no fabricated context).");
    return;
  }
  for (const t of trace) console.log(`  · ${t}`);
  console.log(`  Top results:`);
  show(surfaced, 4);
};

if (prompts.length) {
  for (const p of prompts) run(p);
} else {
  // Scripted queries showcase the contract: keywords, a typo, and French.
  for (const p of ["injection budget", "serializaton",
    "fatigue synaptique"]) run(p);
}

const injected = osem.formatContext({ agentId: "CLI" });
console.log(`\n── Injected context (${injected.usedTok} tokens, ` +
  `${injected.leaves} leaves) — JSON provenance ──`);
console.log(JSON.stringify(injected.items));

/**
 * Ingestion — registerMemo atoms into the cadastre.
 * Markdown: doc → sections → paragraphs → sentences (adaptive, never truncated).
 * Rows: canonically serialized with column names (a field value alone is not
 * self-describing). Provenance is retained via `derives_from` + `src`/`src_line`
 * (the source file and the 1-based line range of each atom).
 */
import type Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { IEmbedder, IMemoInput, IOsemConfig, tsGranularity } from "../types.ts";
import type { tsStatsState } from "./field.ts";

export interface tsIngestDeps {
  db: Database.Database;
  cfg: IOsemConfig;
  embedder: IEmbedder;
  hashEmbedder: IEmbedder;
  vecExtReady: boolean;
  /** Marked when the graph mutates — the next wave lazily refreshes
   *  _fan/_mass/_din so registerMemo→recallShallow (no maintain) never propagates on stale stats. */
  statsState?: tsStatsState;
}

// Default referent patterns — cfg.referentPattern / cfg.referentFilePattern override.

export type tsFlag = "pinned" | "high" | "medium" | "low";

/** Heuristic critic: flags critical/constraint-heavy text (drives floors). */
export function flagOf(body: string): "high" | "medium" | "low" {
  if (/\b(jamais|never|interdit|forbidden|mandatory|critical|critique)\b/i.test(body)) return "high";
  if (/\b(deprecated|déprécié|doit|must|always|toujours)\b/i.test(body)) return "medium";
  return "low";
}

/** Register one memo (leaf or structural parent) into the cadastre. */
export function registerMemo(deps: tsIngestDeps, d: IMemoInput): void {
  const { db, cfg, embedder, hashEmbedder, vecExtReady } = deps;
  const floor = d.flag === "pinned" ? 1 : 0;
  const w = d.flag === "pinned" ? 3 : 2;
  db.transaction(() => {
    // Upsert: re-ingesting an updated document must not crash on the PK.
    // Sediment lives in atom_sediment per scope and is PRESERVED on update —
    // this statement never touches it.
    db.prepare(`INSERT INTO atoms(id,kind,body,flag,granularity,title,recorded_at,src,src_line)
                VALUES (?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                  body = excluded.body, title = excluded.title,
                  flag = excluded.flag, granularity = excluded.granularity,
                  src = excluded.src, src_line = excluded.src_line`)
      .run(d.id, d.kind, d.body, d.flag ?? "low", d.granularity ?? "section",
           d.title ?? null, new Date().toISOString(), d.src ?? null, d.srcLine ?? null);
    if (d.fts !== false) {
      // FTS5 has no upsert: delete the stale index rows first.
      db.prepare(`DELETE FROM atoms_fts WHERE atom_id = ?`).run(d.id);
      db.prepare(`INSERT INTO atoms_fts(atom_id, body) VALUES (?,?)`).run(d.id, d.body);
      // Leaves carry TWO spectra: semantic (model2vec) + hash (typos).
      // Embeddings have no upsert either: replace the spectra.
      db.prepare(`DELETE FROM atom_embeddings WHERE atom_id = ?`).run(d.id);
      db.prepare(`INSERT INTO atom_embeddings(atom_id, vec, vec_hash) VALUES (?,?,?)`)
        .run(d.id, Buffer.from(embedder.embed(d.body).buffer),
             Buffer.from(hashEmbedder.embed(d.body).buffer));
      if (vecExtReady) {
        // vec0 does not support OR REPLACE → delete + insert.
        db.prepare(`DELETE FROM atoms_vec WHERE atom_id = ?`).run(d.id);
        db.prepare(`DELETE FROM atoms_vec_hash WHERE atom_id = ?`).run(d.id);
        db.prepare(`INSERT INTO atoms_vec(atom_id, vec) VALUES (?,?)`)
          .run(d.id, Buffer.from(embedder.embed(d.body).buffer));
        db.prepare(`INSERT INTO atoms_vec_hash(atom_id, vec) VALUES (?,?)`)
          .run(d.id, Buffer.from(hashEmbedder.embed(d.body).buffer));
      }
    }
    if (d.title) {
      // FTS5 has no upsert: replace the stale title row.
      db.prepare(`DELETE FROM titles_fts WHERE atom_id = ?`).run(d.id);
      db.prepare(`INSERT INTO titles_fts(atom_id, title) VALUES (?,?)`).run(d.id, d.title);
    }
    const refAtom = db.prepare(
      `INSERT OR IGNORE INTO atoms(id,kind,body,flag,recorded_at) VALUES (?,'ref',?,'low',?)`);
    const link = db.prepare(
      `INSERT OR IGNORE INTO atom_links(from_id,to_id,rel,weight,floor) VALUES (?,?,?,?,?)`);
    // `supports` channels track the CURRENT flag of the deposited atom: a
    // re-registerMemo with a downgraded flag must downgrade the channel too
    // (an engraved floor=1 must not survive its own retraction).
    const linkSupports = db.prepare(
      `INSERT INTO atom_links(from_id,to_id,rel,weight,floor) VALUES (?,?,'supports',?,?)
       ON CONFLICT(from_id,to_id,rel) DO UPDATE SET weight = excluded.weight,
         floor = excluded.floor`);
    const refRegex = new RegExp(cfg.referentPattern, "g");
    const fileRegex = new RegExp(cfg.referentFilePattern, "g");
    for (const ref of d.body.match(refRegex) ?? []) {
      refAtom.run(ref, `referent ${ref}`, new Date().toISOString());
      linkSupports.run(ref, d.id, w, floor);
    }
    for (const f of d.body.match(fileRegex) ?? []) {
      refAtom.run(`file:${f}`, `referent file:${f}`, new Date().toISOString());
      linkSupports.run(`file:${f}`, d.id, w, floor);
    }
    if (d.derivesFrom) {
      link.run(d.id, d.derivesFrom, "derives_from", 1, 0);
      link.run(d.derivesFrom, d.id, "contains", cfg.weightContains, 0);
    }
  })();
  // The graph changed: propagation stats are stale until the next refresh.
  if (deps.statsState) deps.statsState.dirty = true;
}

/** Adaptive leaf chunking: paragraph by default, sentence when critical/long.
 *  `secLine` = 1-based line of the section start in the source; each leaf
 *  reports the 1-based line where it starts in the source file. */
export function* leafChunks(secId: string, rel: string, section: string, secLine = 1):
  Generator<{ id: string; granularity: tsGranularity; body: string;
              flag: ReturnType<typeof flagOf>; srcLine: number }> {
  const paras = section.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 10);
  let pi = 0;
  let searchFrom = 0;
  for (const para of paras) {
    const flag = flagOf(para);
    // Running offset: two identical paragraphs must not resolve to the
    // same srcLine (indexOf alone would always find the first copy).
    const at = section.indexOf(para, searchFrom);
    const pos = at < 0 ? searchFrom : at;
    const lineOffset = section.slice(0, pos).split("\n").length - 1;
    searchFrom = pos + para.length;
    const sents = flag !== "low" || para.length > 900
      ? para.split(/(?<=[.!?:])\s+/).map(s => s.trim()).filter(s => s.length > 10)
      : [];
    if (sents.length > 1) {
      let sentLine = secLine + lineOffset;
      for (let sj = 0; sj < sents.length; sj++) {
        yield { id: `${secId}.${pi}.${sj}`, granularity: "sentence",
                body: `[${rel}] ${sents[sj]}`, flag: flagOf(sents[sj]!), srcLine: sentLine };
        sentLine += sents[sj]!.split("\n").length;
      }
    } else {
      yield { id: `${secId}.${pi}`, granularity: "paragraph",
              body: `[${rel}] ${para}`, flag, srcLine: secLine + lineOffset };
    }
    pi++;
  }
}

/**
 * Split markdown into sections at headings — but ONLY outside fenced code
 * blocks (` ``` ` / `~~~`), so `#` comments inside code never become sections.
 * Returns each section with its 1-based starting line in the source.
 */
export function splitMarkdownSections(md: string):
  { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let cur: string[] = [];
  let lineStart = 1;
  let lineNo = 0;
  let fence: string | null = null;
  for (const line of md.split("\n")) {
    lineNo++;
    const fenceMark = line.trimStart().match(/^(```|~~~)/);
    if (fenceMark) {
      if (!fence) fence = fenceMark[1];
      else if (line.trimStart().startsWith(fence)) fence = null;
    }
    if (!fence && /^#{1,3} /.test(line) && cur.length) {
      out.push({ text: cur.join("\n"), line: lineStart });
      cur = [];
      lineStart = lineNo;
    }
    cur.push(line);
  }
  out.push({ text: cur.join("\n"), line: lineStart });
  return out.filter(s => s.text.trim());
}

/** Register a doc tree: doc → sections → paragraphs/sentences. */
export function registerDoc(deps: tsIngestDeps, rootDir: string,
                               opts: { idPrefix?: string; ext?: string } = {}):
  { files: number; atoms: number } {
  const ext = opts.ext ?? ".md";
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory() && !["node_modules", "dist", ".git", "_archives"].includes(e.name))
        walk(p);
      else if (e.name.endsWith(ext)) files.push(p);
    }
  };
  walk(rootDir);
  let n = 0;
  for (const f of files) {
    const rel = relative(rootDir, f).replaceAll("\\", "/");
    registerMemo(deps, { id: `doc:${rel}`, kind: "synthese", granularity: "doc",
                    body: `Document ${rel}`, title: rel, fts: false, src: f });
    const sections = splitMarkdownSections(readFileSync(f, "utf8"));
    for (let si = 0; si < sections.length; si++) {
      const secId = `${opts.idPrefix ?? "md"}:${rel}#${si}`;
      const secText = sections[si]!.text;
      const title = (secText.match(/^#{1,3}\s+(.+)/m)?.[1]
                     ?? secText.split("\n")[0]).trim().slice(0, 120);
      registerMemo(deps, { id: secId, kind: "observation", granularity: "section", title,
                      body: `[${rel}] ${secText}`, flag: flagOf(secText),
                      derivesFrom: `doc:${rel}`, fts: false,
                      src: f, srcLine: sections[si]!.line });
      for (const leaf of leafChunks(secId, rel, secText, sections[si]!.line)) {
        registerMemo(deps, { id: leaf.id, kind: "observation",
                        granularity: leaf.granularity, body: leaf.body,
                        flag: leaf.flag, derivesFrom: secId,
                        src: f, srcLine: leaf.srcLine });
        n++;
      }
    }
  }
  return { files: files.length, atoms: n };
}

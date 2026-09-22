/**
 * Injection — two pools: the leaf informs, the ancestor localizes.
 * Payload pool = fine-grained leaves (facts). Context pool = breadcrumbs.
 * Parents never steal payload slots from leaves.
 */
import type Database from "better-sqlite3";
import type { IFormatContextOpts, IOsemConfig, OContextBlock, OContextItem, tsScopeId } from "../types.ts";

export interface tsInjectDeps {
  db: Database.Database;
  cfg: IOsemConfig;
}

const estTok = (s: string) => Math.ceil(s.length / 4);

/** Ancestor chain of a leaf via `derives_from` (leaf → … → doc), root first. */
export function ancestorsOf(db: Database.Database, id: string):
  { id: string; title: string }[] {
  const chain: { id: string; title: string }[] = [];
  let cur = id;
  for (let i = 0; i < 5; i++) {
    const p = db.prepare(
      `SELECT l.to_id AS id, IFNULL(a.title, a.id) AS title
       FROM atom_links l JOIN atoms a ON a.id = l.to_id
       WHERE l.from_id = ? AND l.rel = 'derives_from'`,
    ).get(cur) as { id: string; title: string } | undefined; // CAST: get() returns unknown
    if (!p) break;
    chain.push(p); cur = p.id;
  }
  return chain.reverse();
}

export function makeInject(deps: tsInjectDeps) {
  const { db, cfg } = deps;

  /** Inject context from the selected memory planes into a token budget. */
  function formatContext(opts: IFormatContextOpts): OContextBlock {
    const sid: tsScopeId | null = opts.agentId ? `agent:${opts.agentId}` : null;
    const budgetTok = opts.budgetTok ?? cfg.budgetTok;
    // Aggregate the selected planes. An explicit `scopes` list is
    // authoritative — it returns exactly those planes. Default: personal
    // + public; "all" = read-only union of every plane.
    const planes: string[] = opts.scopes === "all"
      ? (db.prepare(`SELECT DISTINCT scope_id FROM agent_energy`).all() as
          { scope_id: string }[]).map(r => r.scope_id)
      : opts.scopes ?? [...(sid ? [sid] : []), "public" as tsScopeId];
    db.exec(`DROP TABLE IF EXISTS _energy;
             CREATE TEMP TABLE _energy(atom_id TEXT PRIMARY KEY, e REAL)`);
    const ins = db.prepare(
      `INSERT INTO _energy(atom_id, e) VALUES (?,?)
       ON CONFLICT(atom_id) DO UPDATE SET e = e + excluded.e`);
    db.transaction(() => {
      const sel = db.prepare(`SELECT atom_id, energy FROM agent_energy WHERE scope_id = ?`);
      for (const p of planes)
        for (const r of sel.all(p) as { atom_id: string; energy: number }[]) // CAST: all() returns unknown[]
          ins.run(r.atom_id, r.energy);
    })();

    const lines: string[] = [];
    let used = 0;          // total budget (anchors + payload + context)
    let payloadUsed = 0;   // payload-pool spend only — anchors sit ABOVE it
    const push = (s: string, pool: "anchor" | "payload" | "context" = "context") => {
      lines.push(s);
      const tok = estTok(s);
      used += tok;
      if (pool === "payload") payloadUsed += tok;
    };

    // Critical anchors: pinned facts — outside the payload budget.
    // kind='query' atoms are provenance entities, never payload — the
    // kind filter is a hard exclusion on every surface below.
    for (const b of db.prepare(
      `SELECT id, body FROM atoms
       WHERE flag = 'pinned' AND status = 'active' AND kind != 'query'`,
    ).all() as { id: string; body: string }[]) // CAST: all() returns unknown[]
      push(`⚓ [pinned] ${b.id}: ${b.body.slice(0, 200)}`, "anchor");

    // Payload pool: fine-grained leaves only, with full provenance.
    const leaves = db.prepare(
      `SELECT s.atom_id AS id, s.e AS e, a.body, a.granularity,
              a.src, a.src_line, a.title
       FROM _energy s JOIN atoms a ON a.id = s.atom_id
       WHERE a.status = 'active' AND a.kind != 'query'
         AND a.granularity IN ('sentence','paragraph','row')
       ORDER BY s.e DESC`,
    ).all() as { id: string; e: number; body: string; granularity: string;
                 src: string | null; src_line: number | null }[]; // CAST: all() returns unknown[]

    const crumbs = new Map<string, { id: string; title: string }[]>();
    const perAnc = new Map<string, number>();
    const payloadBudget = budgetTok * cfg.payloadShare;
    const taken: typeof leaves = [];
    const items: OContextItem[] = [];
    for (const l of leaves) {
      if (payloadUsed + estTok(l.body.slice(0, 400)) > payloadBudget) break;
      const anc = ancestorsOf(db, l.id);
      const sec = anc[anc.length - 1];
      // Diversity cap: one ancestor cannot propel more than N leaves.
      // A root atom is its own ancestor — flat corpora must not collapse
      // into a single "_root" bucket capped at N items total.
      const secKey = sec?.id ?? l.id;
      if ((perAnc.get(secKey) ?? 0) >= cfg.maxLeavesPerAncestor) continue;
      perAnc.set(secKey, (perAnc.get(secKey) ?? 0) + 1);
      taken.push(l);
      if (sec && !crumbs.has(sec.id)) crumbs.set(sec.id, anc);
      // Each fact carries its own provenance: source, section, line range.
      const srcRow = db.prepare(`SELECT src, src_line FROM atoms WHERE id = ?`)
        .get(l.id) as { src: string | null; src_line: number | null } | undefined;
      const where = anc.map(a => a.title).join(" > ");
      const clean = l.body.replace(/^\[[^\]]*\]\s*/, "");
      const lines: [number, number] | null = srcRow?.src_line != null
        ? [srcRow.src_line, srcRow.src_line + clean.split("\n").length - 1]
        : null;
      items.push({ source: srcRow?.src ?? where, section: where, lines,
                   excerpt: clean.slice(0, 400), energy: l.e });
      push(`📄 [fact] ${where}${lines ? ` (lines ${lines[0]}-${lines[1]})` : ""}\n` +
           `   ${clean.slice(0, 400)}`, "payload");
    }
    for (const [, anc] of crumbs)
      push(`🗺  [where] ${anc.map(a => a.title).join(" > ")}`);

    // Hot zones: parents above θ with nothing precise — dig here?
    const takenIds = new Set(taken.map(t => t.id));
    const ancestorIds = new Set([...crumbs.values()].flatMap(c => c.map(a => a.id)));
    for (const z of db.prepare(
      `SELECT s.atom_id AS id, IFNULL(a.title, a.id) AS title, a.granularity
       FROM _energy s JOIN atoms a ON a.id = s.atom_id
       WHERE s.e >= ? AND a.status = 'active' AND a.kind != 'query'
         AND a.granularity IN ('section','doc')`,
    ).all(cfg.theta) as { id: string; title: string; granularity: string }[]) { // CAST: all() returns unknown[]
      if (ancestorIds.has(z.id) || takenIds.has(z.id)) continue;
      push(`≈ [related section, nothing precise matched — dig deeper?] ${z.title}`);
      if (used > budgetTok) break;
    }
    return { text: lines.join("\n"), usedTok: used, leaves: taken.length,
             leafIds: taken.map(t => t.id), items };
  }

  return { formatContext };
}

/**
 * Windowed-frequency acceptance tests — query atoms, bookmarks, the
 * freq_buckets ring, silence dilution, per-scope normalization, and
 * foreign-silence isolation.
 */
import { describe, expect, it } from "vitest";
import { burn, makeOsem, seqOf } from "./helpers.ts";

const TOPIC = "maranget decision tree";

describe("AC9 — the ring is exactly rebuildable from bookmarks", () => {
  it("rebuilds a clean ring (drift 0) and repairs corrupted slots", () => {
    const { osem, db } = makeOsem();
    for (let i = 0; i < 6; i++) osem.recallLexical({ agentId: "ac9", prompt: TOPIC });
    const snap = () => db.prepare(
      `SELECT scope_id, atom_id, slot, bucket_id, n
       FROM freq_buckets ORDER BY scope_id, atom_id, slot`,
    ).all() as { scope_id: string; atom_id: string; slot: number;
                 bucket_id: number; n: number }[]; // CAST: all() returns unknown[]
    const before = snap();
    expect(before.length).toBeGreaterThan(0);
    // A maintenance pass rebuilds the ring: zero drift on a healthy cache.
    const clean = osem.maintain();
    expect(clean.ringDrift).toBe(0);
    // Corrupt a slot, rebuild, verify detection + restoration.
    db.prepare(`UPDATE freq_buckets SET n = n + 99
                WHERE rowid = (SELECT rowid FROM freq_buckets LIMIT 1)`).run();
    const dirty = osem.maintain();
    expect(dirty.ringDrift).toBeGreaterThan(0);
    const after = snap();
    // Same slots, same n within fp tolerance (incremental sums vs SUM(w)
    // can differ in the last bits — the truth is identical).
    expect(after.map(r => `${r.scope_id}|${r.atom_id}|${r.slot}|${r.bucket_id}`))
      .toEqual(before.map(r => `${r.scope_id}|${r.atom_id}|${r.slot}|${r.bucket_id}`));
    for (let i = 0; i < before.length; i++)
      expect(Math.abs(after[i].n - before[i].n)).toBeLessThan(1e-9);
  });
});

describe("AC11 — query atoms are slim provenance entities", () => {
  it("registers one atom per recall, no FTS, no embedding, never surfaced", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "ac11", prompt: TOPIC });
    osem.recall({ agentId: "ac11", prompt: "qzxw jvkm bplq zxcv" }); // silent
    const q = db.prepare(
      `SELECT id, kind, body, src FROM atoms WHERE kind = 'query' ORDER BY id`,
    ).all() as { id: string; kind: string; body: string; src: string }[]; // CAST: all() returns unknown[]
    expect(q).toHaveLength(2);
    expect(q[0].id).toMatch(/^qry:agent:ac11:\d+$/);
    expect(q[0].body).toBe(TOPIC);          // prompt stored verbatim
    expect(q[1].src).toBe("agent:ac11");    // silent recall: scopes auditable
    // Slim: no FTS row, no embeddings, no working-memory energy.
    for (const t of ["atoms_fts", "atom_embeddings", "agent_energy"])
      expect((db.prepare(
        `SELECT COUNT(*) n FROM ${t} WHERE ${t === "agent_energy" ? "atom_id" : "atom_id"} LIKE 'qry:%'`)
        .get() as { n: number }).n, t).toBe(0);
    // Never surfaced, never injected.
    const surf = osem.recallLexical({ agentId: "ac11", prompt: TOPIC });
    expect(surf.every(x => !x.id.startsWith("qry:"))).toBe(true);
    const ctx = osem.formatContext({ agentId: "ac11" });
    expect(ctx.leafIds.every(id => !id.startsWith("qry:"))).toBe(true);
    expect(ctx.text).not.toContain(TOPIC); // prompts are not context
  });
});

describe("AC12 — a query never sees its own bookmark commit", () => {
  it("counts past commits only — a future-seq bookmark does not boost", () => {
    const mk = () => {
      const h = makeOsem();
      h.osem.registerMemo({ id: "ATOM-X", kind: "observation", granularity: "paragraph",
                       body: "tokX unique probe content" });
      return h;
    };
    const a = mk(); // clean baseline
    const e1 = a.osem.recallLexical({ agentId: "w", prompt: "tokX" })[0]?.e ?? 0;
    const b = mk(); // a past commit (seq ≤ curSeq) boosts
    b.db.prepare(`INSERT INTO atoms(id,kind,body,recorded_at) VALUES ('qry:past:0','query','x','t')`).run();
    b.db.prepare(`INSERT INTO scope_clock(scope_id,seq) VALUES ('agent:w',5)`).run();
    b.db.prepare(`INSERT INTO bookmarks(query_id,scope_id,atom_id,seq,w) VALUES ('qry:past:0','agent:w','ATOM-X',5,0.5)`).run();
    const eB = b.osem.recallLexical({ agentId: "w", prompt: "tokX" })[0]?.e ?? 0;
    const c = mk(); // a bookmark on the NEXT commit's seq must not count
    c.db.prepare(`INSERT INTO atoms(id,kind,body,recorded_at) VALUES ('qry:past:99','query','x','t')`).run();
    c.db.prepare(`INSERT INTO scope_clock(scope_id,seq) VALUES ('agent:w',5)`).run();
    c.db.prepare(`INSERT INTO bookmarks(query_id,scope_id,atom_id,seq,w) VALUES ('qry:past:99','agent:w','ATOM-X',6,0.5)`).run();
    const eC = c.osem.recallLexical({ agentId: "w", prompt: "tokX" })[0]?.e ?? 0;
    expect(eB).toBeGreaterThan(e1);       // a past commit boosts
    // The out-of-window bookmark adds NO E_K — only the w0/N registration
    // prior applies (N=1 once the scope has any bookmark).
    expect(eC).toBeCloseTo(e1 + c.osem.config.ltpRate * c.osem.config.registrationWeight, 6);
    expect(eC).toBeLessThan(eB);          // the wave reads pre-commit seq only
  });
});

describe("AC13 — silence dilutes by sliding windows, never strengthens", () => {
  it("sliding past the hot window erases the frequency boost", () => {
    const { osem, db } = makeOsem();
    osem.registerMemo({ id: "ATOM-DIL", kind: "observation", granularity: "paragraph",
                   body: "tokDIL distinctive dilution probe content" });
    for (let i = 0; i < 3; i++) osem.recallLexical({ agentId: "ac13", prompt: "tokDIL" });
    const hot = osem.recallLexical({ agentId: "ac13", prompt: "tokDIL" });
    const eHot = hot.find(x => x.id === "ATOM-DIL")!.e;
    burn(osem, "ac13", 25); // 25 silent commits — slide K1=20 past the surfacings
    const bm = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='agent:ac13' AND atom_id='ATOM-DIL'`,
    ).get() as { n: number }).n; // CAST: get() returns unknown
    expect(bm).toBe(4); // silence wrote nothing — append-only truth kept
    const cold = osem.recallLexical({ agentId: "ac13", prompt: "tokDIL" });
    const eCold = cold.find(x => x.id === "ATOM-DIL")!.e;
    expect(eCold).toBeLessThan(eHot); // the boost evaporated, the atom still re-seeds
  });
});

describe("AC15 — corpus bound: deposits are inert, N counts bookmarked atoms", () => {
  it("flooding the cadastre with unbookmarked atoms dilutes nothing", () => {
    const { osem, db } = makeOsem();
    for (let i = 0; i < 4; i++) osem.recallLexical({ agentId: "ac15", prompt: TOPIC });
    const n0 = (db.prepare(
      `SELECT COUNT(DISTINCT atom_id) n FROM bookmarks WHERE scope_id='agent:ac15'`,
    ).get() as { n: number }).n; // CAST: get() returns unknown
    const shares0 = osem.hotAtoms(8, "agent:ac15");
    // Deposit 200 atoms — none bookmarked → N unchanged, shares unchanged.
    for (let i = 0; i < 200; i++)
      osem.registerMemo({ id: `flood:${i}`, kind: "observation", granularity: "paragraph",
                     body: `flood atom ${i} zzq kwv xj` });
    const n1 = (db.prepare(
      `SELECT COUNT(DISTINCT atom_id) n FROM bookmarks WHERE scope_id='agent:ac15'`,
    ).get() as { n: number }).n; // CAST: get() returns unknown
    expect(n1).toBe(n0); // deposits are inert — N grows only on first bookmark
    expect(osem.hotAtoms(8, "agent:ac15")).toEqual(shares0);
  });
});

describe("AC16 — foreign silence cannot flush a shared scope", () => {
  it("100 silent foreign recalls leave seq, ring and shares untouched", () => {
    const { osem, db } = makeOsem();
    osem.recallLexical({ agentId: "alpha", prompt: TOPIC, actAs: "scope:gov" });
    const seq0 = seqOf(db, "scope:gov");
    const ring0 = db.prepare(
      `SELECT * FROM freq_buckets WHERE scope_id='scope:gov' ORDER BY atom_id, slot`).all();
    const bm0 = (db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='scope:gov'`).get() as { n: number }).n;
    expect(ring0.length).toBeGreaterThan(0);
    // Beta is not the owner — its recalls act on its own plane only.
    burn(osem, "beta", 100);
    expect(seqOf(db, "scope:gov")).toBe(seq0);
    expect(db.prepare(
      `SELECT * FROM freq_buckets WHERE scope_id='scope:gov' ORDER BY atom_id, slot`).all()
    ).toEqual(ring0);
    expect((db.prepare(
      `SELECT COUNT(*) n FROM bookmarks WHERE scope_id='scope:gov'`).get() as { n: number }).n)
      .toBe(bm0);
    // beta's own plane did advance — silence is real on the acting scope.
    expect(seqOf(db, "agent:beta")).toBe(100);
  });
});

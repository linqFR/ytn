/**
 * A-series — recall efficiency: MRR/P@5 vs FTS5 baseline, lexical wall,
 * honest silence, leaf + breadcrumb provenance.
 * (Protocol épreuves 1 & 2 — silence and provenance.)
 */
import { describe, expect, it } from "vitest";
import { makeOsem, makeOsemReal } from "./helpers.ts";

const A1_QUERIES = [
  { q: "maranget", target: "maranget matching" },
  { q: "maranget decision trees", target: "maranget dispatch" },
  { q: "serialization toJS", target: "serialization toJS" },
  { q: "opcode dispatch", target: "opcode dispatch uses" },
  { q: "coercion", target: "coercion rules" },
  { q: "worker postmessage", target: "worker postmessage" },
  { q: "performance matrix", target: "maranget matrix" },
  { q: "schema bytecode", target: "schema bytecode" },
  { q: "convertir les types", target: "convertir les types" },
  { q: "zero copy buffers", target: "worker postmessage" },
] as const;

const A3_SET = [
  { q: "convertir les types automatiquement", target: "type-inventory" },
  { q: "serializaton", target: "serialization.md" },
  { q: "sérialisation", target: "serialization.md" },
] as const;

const A4_ABSENT = ["graphql", "kubernetes", "docker", "terraform", "webassembly",
  "postgresql", "redis", "nginx", "rustlang", "elm"] as const;

describe("A1 — MRR/P@5: field vs raw FTS5 baseline", () => {
  it("surfaces targets at least as well as the lexical baseline", () => {
    const { osem, db } = makeOsem();
    let mrrB = 0, mrrC = 0;
    for (const { q, target } of A1_QUERIES) {
      const champ = osem.recallLexical({ agentId: "A1", prompt: q });
      const base = db.prepare(
        `SELECT atom_id FROM atoms_fts WHERE atoms_fts MATCH ? ORDER BY rank LIMIT 8`,
      ).all(q.split(/\s+/).map(t => `"${t}"`).join(" OR ")) as { atom_id: string }[];
      const rb = base.findIndex(r => r.atom_id.includes(target)) + 1;
      const rc = champ.findIndex(x => x.id.includes(target)) + 1;
      mrrB += rb > 0 ? 1 / rb : 0;
      mrrC += rc ? 1 / rc : 0;
    }
    expect(mrrC).toBeGreaterThanOrEqual(mrrB);
  });
});

describe("A3 — lexical wall (typos / french paraphrase)", () => {
  it("crosses the lexical wall through the gated vector surface", () => {
    // The dual embedder needs a realistic corpus: on a 9-leaf fixture the hash
    // cosine of a typo falls under the silence threshold (measured 0.37 < 0.55)
    // — the v12 campaign ran this test on the real dna corpus.
    const { osem } = makeOsemReal();
    for (const { q, target } of A3_SET) {
      const { surfaced } = osem.recall({ agentId: "A3", prompt: q });
      expect(surfaced.some(x => x.id.includes(target))).toBe(true);
    }
  });
});

describe("A4 — honest silence (10 absent concepts)", () => {
  it("returns zero atoms for every out-of-domain query", () => {
    const { osem } = makeOsem();
    let silences = 0;
    for (const q of A4_ABSENT) {
      const { surfaced } = osem.recall({ agentId: "A4", prompt: q });
      if (surfaced.length === 0) silences++;
    }
    expect(silences).toBe(A4_ABSENT.length);
  });
});

describe("A10 — filiation (leaf + breadcrumb)", () => {
  it("injects the precise leaf with its doc > section breadcrumb", () => {
    const { osem } = makeOsem();
    osem.recallLexical({ agentId: "A10", prompt: "coercion rules" });
    const ctx = osem.formatContext({ agentId: "A10" });
    expect(ctx.leafIds.length).toBeGreaterThan(0);
    expect(ctx.text).toMatch(/🗺/);
    expect(ctx.text).toContain(">");
  });
});

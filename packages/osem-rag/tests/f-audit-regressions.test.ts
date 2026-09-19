/**
 * Audit regressions — the three bugs the second audit caught empirically:
 *  B1. vec0 KNN branch seeded superseded atoms (the JS scan filtered them).
 *  B2. vec0 tables created on a populated base stayed EMPTY (no backfill)
 *      → the semantic surface died silently on reopen with useSqliteVec.
 *  B3. registerMemo→recallShallow without maintain() ran propagation on empty _fan/_mass/_din
 *      → upward propagation (derives_from/supports) was silently dead.
 */
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createOsem } from "../src/index.ts";
import { makeOsem, MODEL_DIR, hasModel } from "./helpers.ts";

const vecAvailable = (() => {
  try {
    const d = new Database(":memory:");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("sqlite-vec") as { load(db: unknown): void }).load(d);
    d.close();
    return true;
  } catch {
    return false;
  }
})();

describe("B3 — propagation stats: registerMemo→recallShallow without maintain() must not run a dead field", () => {
  it("upward propagation works right after deposits (lazy stats refresh)", () => {
    const { osem } = makeOsem(); // deliberately NO tick()
    const { surfaced } = osem.recall({
      agentId: "B3", prompt: "maranget decision tree",
    });
    // The section parent must be reached by derives_from propagation —
    // impossible while _fan was empty (it excluded non-contains edges).
    expect(surfaced.some(x => x.id === "synth:doc#0")).toBe(true);
  });
});

describe.skipIf(!vecAvailable)("vec0 regressions (sqlite-vec loaded)", () => {
  it("B2 — reopening a populated base with useSqliteVec backfills the KNN index", () => {
    const db = new Database(":memory:");
    const off = createOsem({ db }); // useSqliteVec: false
    off.registerMemo({ id: "leaf:1", kind: "observation", granularity: "paragraph",
                  body: "serialization converts atoms into portable bytecode" });
    // Same db, reopened WITH the extension — the index must be backfilled.
    createOsem({ db, config: { useSqliteVec: true } });
    const n = (db.prepare(`SELECT COUNT(*) n FROM atoms_vec`).get() as { n: number }).n;
    const emb = (db.prepare(`SELECT COUNT(*) n FROM atom_embeddings`).get() as { n: number }).n;
    expect(emb).toBeGreaterThan(0);
    expect(n).toBe(emb);
  });

  it("B1 — a superseded atom never seeds nor radiates under the KNN branch", () => {
    const build = (useVec: boolean) => {
      const db = new Database(":memory:");
      const osem = createOsem({
        db,
        embedder: hasModel ? { kind: "model2vec", modelDir: MODEL_DIR } : { kind: "hash" },
        config: { useSqliteVec: useVec },
      });
      osem.registerMemo({ id: "doc:z", kind: "synthese", granularity: "doc",
                     body: "Document z", title: "z", fts: false });
      osem.registerMemo({ id: "sec:z", kind: "observation", granularity: "section",
                     title: "Zombie section", body: "[z] zombie section",
                     derivesFrom: "doc:z", fts: false });
      osem.registerMemo({ id: "z:0", kind: "observation", granularity: "paragraph",
                     body: "[z] zombie serialization bytecode fact",
                     derivesFrom: "sec:z" });
      // Retract the leaf AFTER registerMemo: it must be inert on every surface.
      db.prepare(`UPDATE atoms SET status = 'superseded' WHERE id = 'z:0'`).run();
      return { osem, db };
    };
    const run = (useVec: boolean) => {
      const { osem } = build(useVec);
      const { surfaced } = osem.recall({
        agentId: "B1", prompt: "zombie serialization bytecode",
      });
      return surfaced.map(x => `${x.id}:${x.e.toFixed(4)}`);
    };
    const on = run(true), off = run(false);
    expect(on).toEqual(off);                       // parity with the JS scan
    expect(on.some(s => s.startsWith("z:0:"))).toBe(false); // never surfaces
  });
});

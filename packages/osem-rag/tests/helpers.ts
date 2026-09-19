/**
 * Test helpers — deterministic synthetic corpus (no external dependency).
 * Every test builds its own in-memory database with the same fixture.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOsem, type IOsemConfig, type IOsemRag } from "../src/index.ts";

/** Topics with distinct token families so targets are unambiguous. */
export const CORPUS = {
  doc: "synth.md",
  sections: [
    {
      title: "Maranget decision trees",
      leaves: [
        "maranget matching compiles a decision tree into a jump matrix",
        "maranget dispatch avoids the naive opcode chain of comparisons",
        "the maranget matrix is rebuilt whenever a route is added",
      ],
    },
    {
      title: "Serialization internals",
      leaves: [
        "serialization toJS converts atoms into portable bytecode",
        "worker postmessage transfers Float32Array buffers by zero copy",
        "convertir les types automatiquement is the french phrase for auto type conversion",
      ],
    },
    {
      title: "Opcode dispatch",
      leaves: [
        "opcode dispatch uses a jump table indexed by the opcode byte",
        "coercion rules convert operands before the opcode executes",
        "schema bytecode is validated before the dispatch loop runs",
      ],
    },
  ],
} as const;

export interface IOsemHarness {
  osem: IOsemRag;
  db: Database.Database;
}

/** Build an isolated in-memory field with the synthetic corpus. */
export function makeOsem(config: Partial<IOsemConfig> = {}): IOsemHarness {
  const db = new Database(":memory:");
  const osem = createOsem({ db, config });
  osem.registerMemo({ id: `doc:${CORPUS.doc}`, kind: "synthese", granularity: "doc",
                 body: `Document ${CORPUS.doc}`, title: CORPUS.doc, fts: false });
  for (let si = 0; si < CORPUS.sections.length; si++) {
    const sec = CORPUS.sections[si];
    const secId = `synth:doc#${si}`;
    osem.registerMemo({ id: secId, kind: "observation", granularity: "section",
                   title: sec.title, body: `[${CORPUS.doc}] ${sec.title}`,
                   derivesFrom: `doc:${CORPUS.doc}`, fts: false });
    CORPUS.sections[si].leaves.forEach((leaf, li) => {
      osem.registerMemo({ id: `${secId}.${li}`, kind: "observation",
                     granularity: "paragraph",
                     body: `[${CORPUS.doc}] ${leaf}`, derivesFrom: secId });
    });
  }
  return { osem, db };
}

/** Model directory (outside the repo): OSEM_MODEL_DIR or ~/.osem/models/. */
export const MODEL_DIR = process.env.OSEM_MODEL_DIR
  ?? join(homedir(), ".osem", "models", "potion-base-8M");
export const hasModel = existsSync(`${MODEL_DIR}/model.safetensors`);

/** Build a field over a FROZEN snapshot of the dna corpus (the v12 campaign
 *  conditions, without coupling to a live directory other agents may edit). */
export function makeOsemReal(): IOsemHarness {
  const db = new Database(":memory:");
  const osem = createOsem({
    db,
    embedder: hasModel
      ? { kind: "model2vec", modelDir: MODEL_DIR }
      : { kind: "hash" },
  });
  osem.registerDoc(join(import.meta.dirname, "fixtures", "dna-snapshot"));
  osem.maintain();
  return { osem, db };
}

/** Advance a scope's hit counter by `n` consultations that match nothing
 *  (honest silence — each acting recall is +1 hit, commits no sediment). */
export function burn(osem: IOsemRag, agentId: string, n: number): void {
  for (let i = 0; i < n; i++)
    osem.recallShallow({ agentId, prompt: "qzxw jvkm bplq zxcv" });
}

/** Current hit count of a scope (its own consultation clock). */
export function hitOf(db: Database.Database, scopeId: string): number {
  // CAST: get() returns unknown — single {hit} row or undefined
  return ((db.prepare(`SELECT hit FROM scope_clock WHERE scope_id = ?`)
    .get(scopeId) as { hit: number } | undefined)?.hit) ?? 0;
}

/** Deterministic pseudo-random words for load tests (no runtime randomness). */
export function synthBody(i: number, words: string[]): string {
  return `${words[(i * 7) % words.length]} ${words[(i * 13 + 3) % words.length]} ` +
         `${words[(i * 29 + 5) % words.length]} contenu atome ${i}`;
}

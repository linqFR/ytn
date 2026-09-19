/**
 * Vec ON/OFF parity — the index swap is semantically transparent (V4-18):
 * same corpus, same queries, identical surfaced atoms with and without the
 * native vec0 KNN index. Skipped when the sqlite-vec extension is unavailable.
 */
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createOsem } from "../src/index.ts";
import { MODEL_DIR, hasModel } from "./helpers.ts";

const vecAvailable = (() => {
  try {
    // Probe: can the vec0 extension load in this environment?
    const d = new Database(":memory:");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("sqlite-vec") as { load(db: unknown): void }).load(d);
    d.close();
    return true;
  } catch {
    return false;
  }
})();

function build(useVec: boolean) {
  const db = new Database(":memory:");
  const osem = createOsem({
    db,
    embedder: hasModel ? { kind: "model2vec", modelDir: MODEL_DIR } : { kind: "hash" },
    config: { useSqliteVec: useVec },
  });
  osem.registerMemo({ id: "doc:vec.md", kind: "synthese", granularity: "doc",
                 body: "Document vec", title: "vec", fts: false });
  osem.registerMemo({ id: "synth:vec#0", kind: "observation", granularity: "section",
                 title: "Serialization", body: "[vec.md] serialization section",
                 derivesFrom: "doc:vec.md", fts: false });
  osem.registerMemo({ id: "synth:vec#0.0", kind: "observation", granularity: "paragraph",
                 body: "[vec.md] serialization toJS converts atoms into portable bytecode",
                 derivesFrom: "synth:vec#0" });
  osem.registerMemo({ id: "synth:vec#0.1", kind: "observation", granularity: "paragraph",
                 body: "[vec.md] opcode dispatch uses a jump table indexed by the opcode byte",
                 derivesFrom: "synth:vec#0" });
  osem.maintain();
  return { osem, db };
}

describe("vec ON/OFF — semantic transparency (V4-18)", () => {
  it.skipIf(!vecAvailable)(
    "surfaces the same atoms with and without the native KNN index", () => {
      const run = (useVec: boolean): string[] => {
        const { osem } = build(useVec);
        const out: string[] = [];
        for (const q of ["serializaton", "sérialisation", "opcode dispatch"]) {
          const { surfaced } = osem.recall({ agentId: "VEC", prompt: q });
          out.push(surfaced.map(x => `${x.id}:${x.e.toFixed(4)}`).join("|"));
        }
        return out;
      };
      expect(run(true)).toEqual(run(false));
    });
});

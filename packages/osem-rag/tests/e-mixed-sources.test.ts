/**
 * E-series — mixed sources: markdown files, plain-text files, web pages and
 * SQL rows deposited by a connector, all in ONE field, queried together.
 * Provenance (source + lines) must stay exact across every source type.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOsem } from "../src/index.ts";
import { leafChunks, splitMarkdownSections } from "../src/engine/ingest.ts";

let dir = "";
let server: Server | undefined;
let port = 0;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "osem-mixed-"));
  // One markdown file (the engine's native path).
  writeFileSync(join(dir, "guide.md"),
    "# Guide\n\n## Alpha section\n\nmdtok alpha paragraph about migration rules\n");
  // One plain-text file (no headings — a connector would registerMemo it directly).
  writeFileSync(join(dir, "notes.txt"), "txttok beta plain-text note about backups\n");
  // A local HTTP page (no external network needed).
  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><head><title>Mixed Page</title></head><body>" +
      "<h1>Web heading</h1><p>webtok paragraph about deployment</p></body></html>");
  });
  await new Promise<void>(r => server!.listen(0, "127.0.0.1", r));
  port = (server!.address() as { port: number }).port;
});

afterAll(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

function buildCorpus() {
  const db = new Database(":memory:");
  const osem = createOsem({ db });
  // 1. markdown directory (the engine's native path)
  osem.registerDoc(dir);
  // 2. plain-text file (a connector would registerMemo it exactly like this)
  const txt = join(dir, "notes.txt");
  osem.registerMemo({ id: "doc:notes.txt", kind: "synthese", granularity: "doc",
                 body: "Document notes.txt", title: "notes.txt", fts: false });
  osem.registerMemo({ id: "txt:notes#0", kind: "observation", granularity: "paragraph",
                 body: "[notes.txt] txttok beta plain-text note about backups",
                 derivesFrom: "doc:notes.txt", src: txt, srcLine: 1 });
  // 3. SQL row (connector path: canonically serialized, pinned decision)
  osem.registerMemo({ id: "table:decisions", kind: "synthese", granularity: "doc",
                 body: "Table decisions (external source)", title: "decisions", fts: false });
  osem.registerMemo({ id: "row:decisions#DEC-0006", kind: "observation", flag: "pinned",
                 granularity: "row",
                 body: "table: decisions | id: DEC-0006 | never migrate without backup",
                 derivesFrom: "table:decisions", src: "db:gov", srcLine: 6 });
  osem.maintain();
  return { osem, db };
}

describe("E — mixed sources (md + txt + url + sql rows, one field)", () => {
  it("surfaces facts from every source type in a single field", () => {
    const { osem } = buildCorpus();
    osem.recallLexical({ agentId: "E1", prompt: "mdtok alpha" });
    osem.recallLexical({ agentId: "E1", prompt: "txttok backups" });
    const ctx = osem.formatContext({ agentId: "E1" });
    expect(ctx.items.some(i => i.excerpt.includes("mdtok"))).toBe(true);
    expect(ctx.items.some(i => i.excerpt.includes("txttok"))).toBe(true);
  });

  it("keeps exact provenance (source + lines) for each source kind", () => {
    const { osem } = buildCorpus();
    osem.recallLexical({ agentId: "E2", prompt: "mdtok alpha" });
    osem.recallLexical({ agentId: "E2", prompt: "txttok backups" });
    osem.recallLexical({ agentId: "E2", prompt: "DEC-0006 migrate" });
    const ctx = osem.formatContext({ agentId: "E2" });
    const md = ctx.items.find(i => i.excerpt.includes("mdtok"));
    const txtItem = ctx.items.find(i => i.excerpt.includes("txttok"));
    const row = ctx.items.find(i => i.source === "db:gov");
    expect(md?.source.endsWith("guide.md")).toBe(true);
    expect(md?.lines).not.toBeNull();
    expect(md?.lines![0]).toBeGreaterThan(0);
    expect(txtItem?.source.endsWith("notes.txt")).toBe(true);
    expect(row?.lines).toEqual([6, 6]);
  });

  it("ingests a local web page alongside the file corpus", async () => {
    const { osem } = buildCorpus();
    const url = `http://127.0.0.1:${port}/page`;
    const html = await (await fetch(url)).text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    osem.registerMemo({ id: "doc:web", kind: "synthese", granularity: "doc",
                   body: `Document ${url}`, title: "web", fts: false });
    osem.registerMemo({ id: "web:page#0", kind: "observation", granularity: "section",
                   title: "Mixed Page", body: `[${url}] ${text}`,
                   derivesFrom: "doc:web", src: url });
    osem.maintain();
    const { surfaced } = osem.recall(
      { agentId: "E4", prompt: "webtok deployment" });
    expect(surfaced.some(x => x.id.startsWith("web:"))).toBe(true);
  });
});

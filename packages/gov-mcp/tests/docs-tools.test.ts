/**
 * Tests for list_docs and get_doc MCP tools.
 *
 * Verifies:
 * - list_docs returns all .md files in the package docs/ directory
 * - get_doc returns the content of a specific file
 * - path traversal is rejected (no ".." or "/" in filename)
 * - missing file returns an error
 */

import { describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const ctx: IToolCtx = (() => {
  const db = GovDb.memory();
  initDatabase(db);
  return { db, queries: compileQueries(db) };
})();

describe("list_docs", () => {
  it("returns all .md files in the docs/ directory", () => {
    const result = read.listDocs(ctx, {});
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { docs: Array<{ filename: string }>, count: number };
    expect(structured.docs.length).toBeGreaterThan(0);
    expect(structured.count).toBe(structured.docs.length);
    // All entries should be .md files
    for (const doc of structured.docs) {
      expect(doc.filename.endsWith(".md")).toBe(true);
    }
    // Should include known docs
    const filenames = structured.docs.map((d) => d.filename);
    expect(filenames).toContain("tools.md");
    expect(filenames).toContain("architecture.md");
  });

  it("includes filename, size, and title for each doc", () => {
    const result = read.listDocs(ctx, {});
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { docs: Array<{ filename: string, size: number, title: string | null }> };
    for (const doc of structured.docs) {
      expect(typeof doc.filename).toBe("string");
      expect(typeof doc.size).toBe("number");
      expect(doc.size).toBeGreaterThan(0);
    }
    // tools.md should have a title
    const tools = structured.docs.find((d) => d.filename === "tools.md");
    expect(tools).toBeDefined();
    expect(tools!.title).not.toBeNull();
  });
});

describe("get_doc", () => {
  it("returns the content of a valid .md file", () => {
    const result = read.getDoc(ctx, { filename: "tools.md" });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { filename: string, content: string, size: number };
    expect(structured.filename).toBe("tools.md");
    expect(typeof structured.content).toBe("string");
    expect(structured.content.length).toBeGreaterThan(0);
    expect(structured.size).toBeGreaterThan(0);
  });

  it("rejects path traversal with .. in filename", () => {
    // The DNA schema regex rejects ".." or "/" before the handler runs,
    // but we test the handler directly with a safeParse bypass scenario.
    // The schema itself should reject it.
    const result = read.getDoc(ctx, { filename: "../package.json" });
    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain("Validation failed");
  });

  it("rejects path traversal with / in filename", () => {
    const result = read.getDoc(ctx, { filename: "subdir/file.md" });
    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain("Validation failed");
  });

  it("rejects non-.md extensions", () => {
    const result = read.getDoc(ctx, { filename: "package.json" });
    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain("Validation failed");
  });

  it("returns an error for a missing .md file", () => {
    const result = read.getDoc(ctx, { filename: "nonexistent.md" });
    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain("not found");
  });
});

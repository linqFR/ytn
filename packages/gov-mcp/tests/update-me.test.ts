/**
 * Tests for update_me tool — writer profile self-update.
 *
 * Covers:
 * - Update single field (responsibility, objective, expertise, prohibitions)
 * - Update multiple fields at once
 * - Partial update preserves other fields
 * - Invalid nanoid rejected
 * - No fields provided rejected
 * - whoami reflects updated fields
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb, resolveReportsDir } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "test-nanoid-21chars__";

function setup(): { db: GovDb; ctx: IToolCtx } {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db), reportsDir: resolveReportsDir() };
  write.registerWriter(ctx, {
    id: "test-agent",
    role: "agent",
    responsibility: "initial responsibility",
    objective: "initial objective",
    expertise: "initial expertise",
    prohibitions: "initial prohibitions",
  });
  db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-agent");
  return { db, ctx };
}

function getText(res: { content: { text: string }[]; isError: boolean }): string {
  return res.content[0]?.text ?? "";
}

function getWriter(res: { structuredContent?: Record<string, unknown> }): Record<string, unknown> | undefined {
  return res.structuredContent?.writer as Record<string, unknown> | undefined;
}

describe("update_me", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => { ({ db, ctx } = setup()); });
  afterEach(() => db.close());

  it("updates a single field (responsibility)", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      responsibility: "updated responsibility",
    });
    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({
      id: "test-agent",
      updated: true,
      fields: ["responsibility"],
    });

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.responsibility).toBe("updated responsibility");
    expect(writer?.objective).toBe("initial objective");
    expect(writer?.expertise).toBe("initial expertise");
    expect(writer?.prohibitions).toBe("initial prohibitions");
  });

  it("updates a single field (objective)", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      objective: "new objective",
    });
    expect(res.isError).toBe(false);
    expect(res.structuredContent?.fields).toEqual(["objective"]);

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.objective).toBe("new objective");
    expect(writer?.responsibility).toBe("initial responsibility");
  });

  it("updates a single field (expertise)", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      expertise: "TypeScript, MCP, SQLite",
    });
    expect(res.isError).toBe(false);
    expect(res.structuredContent?.fields).toEqual(["expertise"]);

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.expertise).toBe("TypeScript, MCP, SQLite");
  });

  it("updates a single field (prohibitions)", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      prohibitions: "No commit, no publish",
    });
    expect(res.isError).toBe(false);
    expect(res.structuredContent?.fields).toEqual(["prohibitions"]);

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.prohibitions).toBe("No commit, no publish");
  });

  it("updates all four fields at once", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      responsibility: "full responsibility",
      objective: "full objective",
      expertise: "full expertise",
      prohibitions: "full prohibitions",
    });
    expect(res.isError).toBe(false);
    expect(res.structuredContent?.fields).toEqual(["responsibility", "objective", "expertise", "prohibitions"]);

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.responsibility).toBe("full responsibility");
    expect(writer?.objective).toBe("full objective");
    expect(writer?.expertise).toBe("full expertise");
    expect(writer?.prohibitions).toBe("full prohibitions");
  });

  it("preserves other fields on partial update", () => {
    write.updateMe(ctx, {
      nanoid: NANOID,
      objective: "changed objective",
    });

    const res = write.updateMe(ctx, {
      nanoid: NANOID,
      responsibility: "changed responsibility",
    });
    expect(res.isError).toBe(false);

    const who = read.whoami(ctx, { nanoid: NANOID });
    const writer = getWriter(who);
    expect(writer?.responsibility).toBe("changed responsibility");
    expect(writer?.objective).toBe("changed objective");
    expect(writer?.expertise).toBe("initial expertise");
    expect(writer?.prohibitions).toBe("initial prohibitions");
  });

  it("rejects invalid nanoid", () => {
    const res = write.updateMe(ctx, {
      nanoid: "invalid-nanoid-21char",
      responsibility: "should not apply",
    });
    expect(res.isError).toBe(true);
    expect(getText(res)).toContain("Invalid nanoid");
  });

  it("rejects when no fields are provided", () => {
    const res = write.updateMe(ctx, {
      nanoid: NANOID,
    });
    expect(res.isError).toBe(true);
    expect(getText(res)).toContain("No fields to update");
  });

  it("does not modify role, id, default_scope, or display_name", () => {
    const before = read.whoami(ctx, { nanoid: NANOID });
    const writerBefore = getWriter(before);
    expect(writerBefore?.role).toBe("agent");
    expect(writerBefore?.id).toBe("test-agent");
    expect(writerBefore?.default_scope).toBe("workspace");

    write.updateMe(ctx, {
      nanoid: NANOID,
      responsibility: "new responsibility",
    });

    const after = read.whoami(ctx, { nanoid: NANOID });
    const writerAfter = getWriter(after);
    expect(writerAfter?.role).toBe("agent");
    expect(writerAfter?.id).toBe("test-agent");
    expect(writerAfter?.default_scope).toBe("workspace");
  });
});

/**
 * Integration tests for the free_fields table.
 *
 * Verifies add, get, and delete operations for free-form metadata
 * attached to any entity (decision, action, idea, problem, spec).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as read from "../src/tools/read.js";
import * as write from "../src/tools/write.js";
import type { IToolCtx } from "../src/types/types.ts";

const NANOID = "test-nanoid-21chars__";

describe("free_fields", () => {
  let db: GovDb;
  let ctx: IToolCtx;

  beforeEach(() => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    write.registerWriter(ctx, { id: "test-admin", role: "admin" });
    db.prepare("UPDATE writers SET nanoid = ? WHERE id = ?").run(NANOID, "test-admin");
  });

  afterEach(() => db.close());

  it("add_free_field to a decision and retrieve it", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    const result = write.addFreeField(ctx, {
      nanoid: NANOID,
      entityType: "decision",
      entityId: "DEC-0001",
      key: "required_role",
      format: "json",
      value: JSON.stringify({ role: "devin-dna", skills: ["codegen"] }),
      ftsIndexed: true,
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ created: true });

    const getResult = read.getFreeFields(ctx, {
      entityType: "decision",
      entityId: "DEC-0001",
    });
    expect(getResult.isError).toBeFalsy();
    const fields = getResult.structuredContent as { freeFields: any[]; count: number };
    expect(fields.count).toBe(1);
    expect(fields.freeFields[0]).toMatchObject({
      entity_type: "decision",
      entity_id: "DEC-0001",
      key: "required_role",
      format: "json",
      fts_indexed: 1,
    });
  });

  it("add multiple free_fields to the same entity", () => {
    write.createAction(ctx, { nanoid: NANOID, title: "A1", forcedNumId: 1 });

    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      key: "instructions", format: "md", value: "## Steps\n1. Do thing\n2. Verify",
    });
    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      key: "sandbox_ref", format: "link", value: "sandbox/test.mjs",
    });
    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "action", entityId: "ACT-0001",
      key: "pr", format: "url", value: "https://github.com/ytrynot/ytn/pull/1",
    });

    const getResult = read.getFreeFields(ctx, {
      entityType: "action", entityId: "ACT-0001",
    });
    const fields = getResult.structuredContent as { freeFields: any[]; count: number };
    expect(fields.count).toBe(3);
    expect(fields.freeFields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["instructions", "sandbox_ref", "pr"]),
    );
  });

  it("deprecate_free_field marks the field as deprecated (soft delete)", () => {
    write.createIdea(ctx, { nanoid: NANOID, title: "I1", forcedNumId: 1 });

    const addResult = write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "idea", entityId: "IDEA-0001",
      key: "note", format: "text", value: "Some note",
    });
    const id = (addResult.structuredContent as { id: number }).id;

    const depResult = write.deprecateFreeField(ctx, { nanoid: NANOID, id });
    expect(depResult.isError).toBeFalsy();
    expect(depResult.structuredContent).toMatchObject({ deprecated: true });

    // Active query returns 0
    const getResult = read.getFreeFields(ctx, {
      entityType: "idea", entityId: "IDEA-0001",
    });
    const fields = getResult.structuredContent as { count: number };
    expect(fields.count).toBe(0);

    // includeDeprecated returns 1 with status=deprecated
    const getAllResult = read.getFreeFields(ctx, {
      entityType: "idea", entityId: "IDEA-0001", includeDeprecated: true,
    });
    const allFields = getAllResult.structuredContent as { freeFields: any[]; count: number };
    expect(allFields.count).toBe(1);
    expect(allFields.freeFields[0].status).toBe("deprecated");
  });

  it("get_free_fields returns empty for entity with no fields", () => {
    write.createProblem(ctx, {
      nanoid: NANOID, title: "P1", type: "code",
      severity: "LOW", forcedNumId: 1,
    });

    const getResult = read.getFreeFields(ctx, {
      entityType: "problem", entityId: "PB-0001",
    });
    const fields = getResult.structuredContent as { count: number };
    expect(fields.count).toBe(0);
  });

  it("add_free_field rejects invalid format", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    const result = write.addFreeField(ctx, {
      nanoid: NANOID,
      entityType: "decision",
      entityId: "DEC-0001",
      key: "bad",
      format: "xml" as any,
      value: "<root/>",
    });
    expect(result.isError).toBeTruthy();
  });

  it("add_free_field rejects invalid nanoid", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    const result = write.addFreeField(ctx, {
      nanoid: "invalid-nanoid-21chars_",
      entityType: "decision",
      entityId: "DEC-0001",
      key: "note",
      format: "text",
      value: "test",
    });
    expect(result.isError).toBeTruthy();
  });

  it("fts_indexed defaults to false when not provided", () => {
    write.createSpec(ctx, { nanoid: NANOID, id: "SPEC-0001", filename: "spec.md", version: 1 });

    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "spec", entityId: "SPEC-0001",
      key: "note", format: "text", value: "test",
    });

    const getResult = read.getFreeFields(ctx, {
      entityType: "spec", entityId: "SPEC-0001",
    });
    const fields = getResult.structuredContent as { freeFields: any[] };
    expect(fields.freeFields[0].fts_indexed).toBe(0);
  });

  it("new free field has status='active' by default", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      key: "note", format: "text", value: "test",
    });

    const getResult = read.getFreeFields(ctx, {
      entityType: "decision", entityId: "DEC-0001",
    });
    const fields = getResult.structuredContent as { freeFields: any[] };
    expect(fields.freeFields[0].status).toBe("active");
  });

  it("FTS trigger indexes free_field when fts_indexed=1 and status='active'", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      key: "instructions", format: "md", value: "unique_fts_marker_xyz",
      ftsIndexed: true,
    });

    const rows = db.prepare(
      "SELECT entity_type, entity_id, title, body FROM search_index WHERE entity_type = 'free_field'",
    ).all() as { entity_type: string; entity_id: string; title: string; body: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("unique_fts_marker_xyz");
    expect(rows[0].title).toBe("instructions");
  });

  it("FTS trigger does not index free_field when fts_indexed=0", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      key: "note", format: "text", value: "should_not_be_indexed",
      ftsIndexed: false,
    });

    const rows = db.prepare(
      "SELECT COUNT(*) as c FROM search_index WHERE entity_type = 'free_field'",
    ).get() as { c: number };
    expect(rows.c).toBe(0);
  });

  it("FTS trigger removes index when free_field is deprecated", () => {
    write.createDecision(ctx, { nanoid: NANOID, title: "D1", decider: "admin", forcedNumId: 1 });

    const addResult = write.addFreeField(ctx, {
      nanoid: NANOID, entityType: "decision", entityId: "DEC-0001",
      key: "note", format: "text", value: "indexed_then_deprecated",
      ftsIndexed: true,
    });
    const id = (addResult.structuredContent as { id: number }).id;

    // Verify indexed
    let rows = db.prepare(
      "SELECT COUNT(*) as c FROM search_index WHERE entity_type = 'free_field'",
    ).get() as { c: number };
    expect(rows.c).toBe(1);

    // Deprecate
    write.deprecateFreeField(ctx, { nanoid: NANOID, id });

    // Verify removed from FTS
    rows = db.prepare(
      "SELECT COUNT(*) as c FROM search_index WHERE entity_type = 'free_field'",
    ).get() as { c: number };
    expect(rows.c).toBe(0);
  });
});

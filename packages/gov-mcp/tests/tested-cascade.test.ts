/**
 * Tests for the `tested` column — cascade derivation, override, correct, audit.
 *
 * Covers:
 * - update_problem_status derives tested from newStatus
 * - update_problem_status with explicit tested overrides the cascade
 * - correct can change tested independently of status
 * - correct can change fast_track
 * - audit_consistency flags PB partial with tested != 'partially'
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import { GovDb } from "../src/driver.js";
import { setupMcpServer, registerWriterViaMcp } from "./helpers/setup-mcp.js";
import { TESTED_STATUS } from "../src/definitions/enums.js";
import type { IToolCtx } from "../src/types/types.ts";
import * as write from "../src/tools/write.js";
import * as read from "../src/tools/read.js";

describe("tested column: cascade, override, correct, audit", () => {
  let client: Client;
  let db: GovDb;
  let nanoid: string;
  let ctx: IToolCtx;

  beforeAll(async () => {
    const setup = await setupMcpServer();
    client = setup.client;
    db = setup.db;
    ctx = setup.ctx;
    nanoid = await registerWriterViaMcp(client);

    // Create a problem for cascade tests
    await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "PB for tested cascade",
        severity: "HIGH",
        type: "code",
      },
    });
  });

  afterAll(() => db.close());

  it("update_problem_status → partial derives tested='partially'", () => {
    const result = write.updateProblemStatus(ctx, {
      nanoid,
      id: "PB-0001",
      newStatus: "partial",
    });
    expect(result.isError).toBeFalsy();

    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0001") as { status: string; tested: string };
    expect(pb.status).toBe("partial");
    expect(pb.tested).toBe(TESTED_STATUS.partially);
  });

  it("update_problem_status → fixed derives tested='success'", () => {
    const result = write.updateProblemStatus(ctx, {
      nanoid,
      id: "PB-0001",
      newStatus: "fixed",
      fix: "Fixed the issue",
    });
    expect(result.isError).toBeFalsy();

    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0001") as { status: string; tested: string };
    expect(pb.status).toBe("fixed");
    expect(pb.tested).toBe(TESTED_STATUS.success);
  });

  it("update_problem_status → wontfix derives tested='no_need'", async () => {
    // Create a second problem for wontfix
    await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "PB for wontfix",
        severity: "LOW",
        type: "code",
      },
    });

    const result = write.updateProblemStatus(ctx, {
      nanoid,
      id: "PB-0002",
      newStatus: "wontfix",
      wontfixReason: "Not worth fixing",
    });
    expect(result.isError).toBeFalsy();

    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0002") as { status: string; tested: string };
    expect(pb.status).toBe("wontfix");
    expect(pb.tested).toBe(TESTED_STATUS.no_need);
  });

  it("update_problem_status with explicit tested overrides cascade", async () => {
    // Create a third problem
    await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "PB for override",
        severity: "MEDIUM",
        type: "code",
      },
    });

    // Set to partial but override tested to not_ready
    const result = write.updateProblemStatus(ctx, {
      nanoid,
      id: "PB-0003",
      newStatus: "partial",
      tested: TESTED_STATUS.not_ready,
    });
    expect(result.isError).toBeFalsy();

    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0003") as { status: string; tested: string };
    expect(pb.status).toBe("partial");
    expect(pb.tested).toBe(TESTED_STATUS.not_ready);
  });

  it("correct can change tested independently of status", async () => {
    // PB-0003 is partial with tested=not_ready (from previous test)
    // Correct tested to 'success' without changing status
    const result = await client.callTool({
      name: "correct",
      arguments: {
        nanoid,
        entityType: "problem",
        entityId: "PB-0003",
        field: "tested",
        newValue: TESTED_STATUS.success,
        reason: "Tests pass manually but PB stays partial pending ADMIN validation",
      },
    });
    expect(result.isError).toBeFalsy();

    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0003") as { status: string; tested: string };
    expect(pb.status).toBe("partial");
    expect(pb.tested).toBe(TESTED_STATUS.success);
  });

  it("correct can change fast_track", async () => {
    // PB-0003 fast_track should be 0 by default
    const before = db.prepare("SELECT fast_track FROM problems WHERE id = ?")
      .get("PB-0003") as { fast_track: number };
    expect(before.fast_track).toBe(0);

    const result = await client.callTool({
      name: "correct",
      arguments: {
        nanoid,
        entityType: "problem",
        entityId: "PB-0003",
        field: "fast_track",
        newValue: "1",
        reason: "Severity escalated to CRITICAL, fast-track retroactively applied",
      },
    });
    expect(result.isError).toBeFalsy();

    const after = db.prepare("SELECT fast_track FROM problems WHERE id = ?")
      .get("PB-0003") as { fast_track: number };
    expect(after.fast_track).toBe(1);
  });

  it("audit_consistency flags PB partial with tested != 'partially'", () => {
    // PB-0003 is partial with tested=success (from correct test) — should trigger warning
    const result = read.auditConsistency(ctx, {});
    expect(result.isError).toBeFalsy();

    const text = JSON.stringify(result);
    // The audit should mention the PB partial with tested mismatch
    expect(text).toContain("PB partial with tested");
    expect(text).toContain("PB-0003");
  });
});

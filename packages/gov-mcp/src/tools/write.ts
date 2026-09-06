/**
 * Write (mutation) MCP tools — create, update, link, correct, append.
 * All mutations require a valid nanoid (access management).
 */

import { dna } from "@ytrynot/dna";
import { ROOT_SCOPE_ID } from "../definitions/constants.js";
import { currentDate, currentTimestamp, formatId, generateWriterNanoid } from "../helpers.js";
import * as S from "../schemas/tool-inputs.js";
import { tables } from "../definitions/schema.js";
import { TESTED_STATUS, ACTION_STATUS, IDEA_STATUS, PROBLEM_STATUS } from "../definitions/enums.js";
import { err, ok } from "./results.js";
import type { IToolCtx, IToolResult } from "../types/types.ts";

// ─── Writer management ───────────────────────────────────────────────────────

export function registerWriter(
  ctx: IToolCtx,
  input: dna.infer<typeof S.registerWriterInput>,
): IToolResult {
  const res = S.registerWriterInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      if (ctx.queries.getWriterById.get({ id: data.id })) {
        dnactx.issues.push({ message: `Writer ${data.id} already exists` });
        return;
      }
      const nanoid = generateWriterNanoid();
      const scope = data.defaultScope ?? ROOT_SCOPE_ID;
      return { ...data, nanoid, scope };
    }, { ctx, generateWriterNanoid, ROOT_SCOPE_ID })
    .safeParse(input, { ctx, generateWriterNanoid, ROOT_SCOPE_ID });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertWriter.run({
      id: d.id,
      nanoid: d.nanoid,
      role: d.role,
      responsibility: d.responsibility ?? null,
      default_scope: d.scope,
      display_name: d.displayName ?? null,
      objective: d.objective ?? null,
      expertise: d.expertise ?? null,
      prohibitions: d.prohibitions ?? null,
      last_read_log_id: 0,
      created_at: currentTimestamp(),
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Writer ${d.id} registered.\n\nNanoid: ${d.nanoid}\n\nStore this nanoid securely — it is required for all write operations and is never shown again by list_writers.`, {
    id: d.id,
    nanoid: d.nanoid,
    role: d.role,
    responsibility: d.responsibility ?? null,
    default_scope: d.scope,
    display_name: d.displayName ?? null,
    objective: d.objective ?? null,
    expertise: d.expertise ?? null,
    prohibitions: d.prohibitions ?? null,
  });
}

// ─── Decision tools ──────────────────────────────────────────────────────────

export function createDecision(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createDecisionInput>,
): IToolResult {
  const res = S.createDecisionInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const scopes = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : [writer.default_scope];
      const seqRow = ctx.queries.nextDecisionSeq.get();
      if (!seqRow) {
        dnactx.issues.push({ message: `Failed to generate sequence number` });
        return;
      }
      let id: string;
      let seq: number;
      if (data.forcedNumId) {
        seq = data.forcedNumId;
        id = formatId("DEC", seq);
        if (ctx.queries.getDecisionById.get({ id })) {
          dnactx.issues.push({ message: `${id} already exists; next sequence number is ${seqRow.next_seq}` });
          return;
        }
        if (ctx.queries.getDecisionBySeq.get({ seq })) {
          dnactx.issues.push({ message: `seq ${seq} already exists` });
          return;
        }
      } else {
        seq = seqRow.next_seq;
        id = formatId("DEC", seq);
      }
      return { ...data, id, seq, scopes, writer };
    }, { ctx, formatId })
    .safeParse(input, { ctx, formatId });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertDecision.run({
      id: d.id, seq: d.seq, title: d.title, status: d.status ?? "Proposed",
      date: d.date ?? now, decider: d.decider,
      superseded_by: null,
      spec_ref: d.specRef ?? null, context: d.context ?? null,
      decision: d.decision ?? null, consequences: d.consequences ?? null,
      source: d.source ?? null, created_at: now, updated_at: now,
    });
    // Insert multi-supersedes into junction table (full)
    if (d.supersedes && d.supersedes.length > 0) {
      for (const supersededId of d.supersedes) {
        ctx.queries.insertDecisionSupersedes.run({
          superseding_id: d.id, superseded_id: supersededId, partial: 0,
        });
      }
    }
    // Insert partial supersedes into junction table
    if (d.supersedesPartial && d.supersedesPartial.length > 0) {
      for (const supersededId of d.supersedesPartial) {
        ctx.queries.insertDecisionSupersedes.run({
          superseding_id: d.id, superseded_id: supersededId, partial: 1,
        });
      }
    }
    // Insert all scopes into entity_scopes junction table
    for (const scopeId of d.scopes) {
      ctx.queries.insertEntityScope.run({
        entity_type: "decision", entity_id: d.id, scope_id: scopeId,
      });
    }
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "decision", entity_id: d.id,
      old_status: null, new_status: d.status ?? "Proposed",
      changed_at: now, changed_by: d.writer.id, reason: "created",
      cascade_trigger: null,
    });
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "decision",
      author: d.writer.id, audience: "all",
      subject: `Decision ${d.id} created`, body: d.title, ref_id: d.id,
      reply_to: null, thread_id: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Decision ${d.id} created (scopes: ${d.scopes.join(", ")})`, { id: d.id, created: true, seq: d.seq, scopes: d.scopes });
}

export function updateDecisionStatus(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateDecisionStatusInput>,
): IToolResult {
  const res = S.updateDecisionStatusInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getDecisionById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Decision ${data.id} not found` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.updateDecisionStatus.run({
      status: d.newStatus, updated_at: now, id: d.id,
    });
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "decision", entity_id: d.id,
      old_status: d.current.status,
      new_status: d.newStatus, changed_at: now, changed_by: d.writer.id,
      reason: d.reason ?? null, cascade_trigger: null,
    });
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "status",
      author: d.writer.id, audience: "all",
      subject: `Decision ${d.id} → ${d.newStatus}`,
      body: d.reason ?? "", ref_id: d.id,
      reply_to: null, thread_id: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Decision ${d.id} updated to ${d.newStatus}`, {
    id: d.id, updated: true, newStatus: d.newStatus,
  });
}

// ─── Action tools ────────────────────────────────────────────────────────────

export function createAction(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createActionInput>,
): IToolResult {
  const res = S.createActionInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const scopes = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : [writer.default_scope];
      const seqRow = ctx.queries.nextActionSeq.get();
      if (!seqRow) {
        dnactx.issues.push({ message: `Failed to generate sequence number` });
        return;
      }
      let id: string;
      let seq: number;
      if (data.forcedNumId) {
        seq = data.forcedNumId;
        id = formatId("ACT", seq);
        if (ctx.queries.getActionById.get({ id })) {
          dnactx.issues.push({ message: `${id} already exists; next sequence number is ${seqRow.next_seq}` });
          return;
        }
        if (ctx.queries.getActionBySeq.get({ seq })) {
          dnactx.issues.push({ message: `seq ${seq} already exists` });
          return;
        }
      } else {
        seq = seqRow.next_seq;
        id = formatId("ACT", seq);
      }
      return { ...data, id, seq, scopes, writer };
    }, { ctx, formatId })
    .safeParse(input, { ctx, formatId });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertAction.run({
      id: d.id, seq: d.seq, title: d.title, status: ACTION_STATUS.pending,
      date: d.date ?? now,
      owner: d.owner ?? null, priority: d.priority ?? null, source: d.source ?? null,
      source_type: d.source_type ?? null, spec_ref: d.specRef ?? null,
      body: d.body ?? null, blockers: null, evidence: null,
      defer_reason: null, cancel_reason: null,
      tested: TESTED_STATUS.not_ready, created_at: now, updated_at: now,
    });
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "action", entity_id: d.id,
      old_status: null, new_status: ACTION_STATUS.pending, changed_at: now,
      changed_by: d.writer.id, reason: "created", cascade_trigger: null,
    });
    if (d.dependencies && d.dependencies.length > 0) {
      for (const depId of d.dependencies) {
        ctx.queries.insertActionDependency.run({
          action_id: d.id, depends_on: depId,
        });
      }
    }
    // Insert all scopes into entity_scopes junction table
    for (const scopeId of d.scopes) {
      ctx.queries.insertEntityScope.run({
        entity_type: "action", entity_id: d.id, scope_id: scopeId,
      });
    }
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "action",
      author: d.writer.id, audience: "all",
      subject: `Action ${d.id} created`, body: d.title, ref_id: d.id,
      reply_to: null, thread_id: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Action ${d.id} created (scopes: ${d.scopes.join(", ")})`, { id: d.id, created: true, seq: d.seq, scopes: d.scopes });
}

export function updateActionStatus(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateActionStatusInput>,
): IToolResult {
  const res = S.updateActionStatusInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getActionById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Action ${data.id} not found` });
        return;
      }
      if (data.newStatus === "done" && (!data.evidence || data.evidence.trim() === "")) {
        dnactx.issues.push({ message: `Evidence required when setting status to 'done'` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const cascadeEnabled = d.cascade ?? true;

  const tx = ctx.db.safeTransaction(() => {
    if (!cascadeEnabled) {
      ctx.db.exec("UPDATE _cascade_disabled SET value = 1");
    }
    try {
      ctx.queries.updateActionStatus.run({
        status: d.newStatus,
        evidence: d.evidence ?? d.current.evidence,
        blockers: d.blockers ?? d.current.blockers,
        updated_at: now, id: d.id,
      });
      ctx.queries.insertStatusHistory.run({
        id: null, entity_type: "action", entity_id: d.id,
        old_status: d.current.status,
        new_status: d.newStatus, changed_at: now, changed_by: d.writer.id,
        reason: d.reason ?? null, cascade_trigger: null,
      });
      ctx.queries.insertLogEntry.run({
        id: null, date: currentDate(), timestamp: now, type: "status",
        author: d.writer.id, audience: "all",
        subject: `Action ${d.id} → ${d.newStatus}`,
        body: d.reason ?? "", ref_id: d.id,
        reply_to: null, thread_id: null,
      });
    } finally {
      if (!cascadeEnabled) {
        ctx.db.exec("UPDATE _cascade_disabled SET value = 0");
      }
    }
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Action ${d.id} updated to ${d.newStatus}`, {
    id: d.id, updated: true, newStatus: d.newStatus,
    cascade: cascadeEnabled,
  });
}

// ─── Idea tools ──────────────────────────────────────────────────────────────

export function createIdea(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createIdeaInput>,
): IToolResult {
  const res = S.createIdeaInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const scopes = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : [writer.default_scope];
      const seqRow = ctx.queries.nextIdeaSeq.get();
      if (!seqRow) {
        dnactx.issues.push({ message: `Failed to generate sequence number` });
        return;
      }
      let id: string;
      let seq: number;
      if (data.forcedNumId) {
        seq = data.forcedNumId;
        id = formatId("IDEA", seq);
        if (ctx.queries.getIdeaById.get({ id })) {
          dnactx.issues.push({ message: `${id} already exists; next sequence number is ${seqRow.next_seq}` });
          return;
        }
        if (ctx.queries.getIdeaBySeq.get({ seq })) {
          dnactx.issues.push({ message: `seq ${seq} already exists` });
          return;
        }
      } else {
        seq = seqRow.next_seq;
        id = formatId("IDEA", seq);
      }
      return { ...data, id, seq, scopes, writer };
    }, { ctx, formatId })
    .safeParse(input, { ctx, formatId });
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertIdea.run({
      id: d.id, seq: d.seq, title: d.title, status: IDEA_STATUS.raw,
      date: d.date ?? now,
      package: d.package ?? null, priority: d.priority ?? null,
      promoted_to: null, short_desc: d.shortDesc ?? null,
      long_desc: d.longDesc ?? null, abandon_reason: null,
      tested: TESTED_STATUS.not_ready, created_at: now, updated_at: now,
    });
    // Insert all scopes into entity_scopes junction table
    for (const scopeId of d.scopes) {
      ctx.queries.insertEntityScope.run({
        entity_type: "idea", entity_id: d.id, scope_id: scopeId,
      });
    }
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "idea",
      author: d.writer.id, audience: "all",
      subject: `Idea ${d.id} created`, body: d.title, ref_id: d.id,
      reply_to: null, thread_id: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Idea ${d.id} created (scopes: ${d.scopes.join(", ")})`, { id: d.id, created: true, seq: d.seq, scopes: d.scopes });
}

export function updateIdeaStatus(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateIdeaStatusInput>,
): IToolResult {
  const res = S.updateIdeaStatusInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getIdeaById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Idea ${data.id} not found` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.updateIdeaStatus.run({
      status: d.newStatus,
      promoted_to: d.promotedTo ?? d.current.promoted_to,
      abandon_reason: d.abandonReason ?? d.current.abandon_reason,
      updated_at: now, id: d.id,
    });
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "idea", entity_id: d.id,
      old_status: d.current.status,
      new_status: d.newStatus, changed_at: now, changed_by: d.writer.id,
      reason: null, cascade_trigger: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Idea ${d.id} updated to ${d.newStatus}`, {
    id: d.id, updated: true, newStatus: d.newStatus,
  });
}

// ─── Problem tools ───────────────────────────────────────────────────────────

export function createProblem(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createProblemInput>,
): IToolResult {
  const res = S.createProblemInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const scopes = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : [writer.default_scope];
      const seqRow = ctx.queries.nextProblemSeq.get();
      if (!seqRow) {
        dnactx.issues.push({ message: `Failed to generate sequence number` });
        return;
      }
      let id: string;
      let seq: number;
      if (data.forcedNumId) {
        seq = data.forcedNumId;
        id = formatId("PB", seq);
        if (ctx.queries.getProblemById.get({ id })) {
          dnactx.issues.push({ message: `${id} already exists; next sequence number is ${seqRow.next_seq}` });
          return;
        }
        if (ctx.queries.getProblemBySeq.get({ seq })) {
          dnactx.issues.push({ message: `seq ${seq} already exists` });
          return;
        }
      } else {
        seq = seqRow.next_seq;
        id = formatId("PB", seq);
      }
      return { ...data, id, seq, scopes, writer };
    }, { ctx, formatId })
    .safeParse(input, { ctx, formatId });
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertProblem.run({
      id: d.id, seq: d.seq, title: d.title, status: PROBLEM_STATUS.open,
      date: d.date ?? now,
      severity: d.severity, type: d.type,
      linked_spec: d.linkedSpec ?? null, linked_act: d.linkedAct ?? null,
      description: d.description ?? null, root_cause: null, fix: null,
      wontfix_reason: null, fast_track: 0, tested: TESTED_STATUS.not_ready,
      created_at: now, updated_at: now, fixed_at: null,
    });
    // Insert all scopes into entity_scopes junction table
    for (const scopeId of d.scopes) {
      ctx.queries.insertEntityScope.run({
        entity_type: "problem", entity_id: d.id, scope_id: scopeId,
      });
    }
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "pb",
      author: d.writer.id, audience: "all",
      subject: `Problem ${d.id} created`, body: d.title, ref_id: d.id,
      reply_to: null, thread_id: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Problem ${d.id} created (scopes: ${d.scopes.join(", ")})`, { id: d.id, created: true, seq: d.seq, scopes: d.scopes });
}

export function updateProblemStatus(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateProblemStatusInput>,
): IToolResult {
  const res = S.updateProblemStatusInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getProblemById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Problem ${data.id} not found` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const fixedAt = d.newStatus === "fixed" ? now : d.current.fixed_at;
  // Derive tested from status (cascade), unless explicitly provided
  const STATUS_TO_TESTED: Record<string, typeof TESTED_STATUS[keyof typeof TESTED_STATUS]> = {
    open: TESTED_STATUS.not_ready, critical: TESTED_STATUS.not_ready, in_progress: TESTED_STATUS.not_ready,
    partial: TESTED_STATUS.partially, fixed: TESTED_STATUS.success,
    wontfix: TESTED_STATUS.no_need, superseded: TESTED_STATUS.no_need,
  };
  const tested = d.tested ?? STATUS_TO_TESTED[d.newStatus] ?? TESTED_STATUS.not_ready;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.updateProblemStatus.run({
      status: d.newStatus,
      fix: d.fix ?? d.current.fix,
      root_cause: d.rootCause ?? d.current.root_cause,
      wontfix_reason: d.wontfixReason ?? d.current.wontfix_reason,
      fixed_at: fixedAt, tested, updated_at: now, id: d.id,
    });
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "problem", entity_id: d.id,
      old_status: d.current.status,
      new_status: d.newStatus, changed_at: now, changed_by: d.writer.id,
      reason: null, cascade_trigger: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Problem ${d.id} updated to ${d.newStatus}`, {
    id: d.id, updated: true, newStatus: d.newStatus,
  });
}

// ─── Link tools ──────────────────────────────────────────────────────────────

export function linkProblemAction(
  ctx: IToolCtx,
  input: dna.infer<typeof S.linkProblemActionInput>,
): IToolResult {
  const res = S.linkProblemActionInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      return { ...data, writer };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const pa = tables.problem_actions.names;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertProblemActionOrIgnore.run({
      [pa.col.problem_id]: d.problemId,
      [pa.col.action_id]: d.actionId,
      [pa.col.role]: d.role ?? "primary",
      [pa.col.created_at]: now,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Linked ${d.problemId} ↔ ${d.actionId}`, {
    problemId: d.problemId, actionId: d.actionId, role: d.role ?? "primary",
  });
}

export function linkActionWorkstream(
  ctx: IToolCtx,
  input: dna.infer<typeof S.linkActionWorkstreamInput>,
): IToolResult {
  const res = S.linkActionWorkstreamInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      return { ...data, writer };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const aw = tables.action_workstreams.names;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertActionWorkstreamOrIgnore.run({
      [aw.col.action_id]: d.actionId,
      [aw.col.workstream_id]: d.workstreamId,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Linked ${d.actionId} ↔ ${d.workstreamId}`, {
    actionId: d.actionId, workstreamId: d.workstreamId,
  });
}

export function linkActionDependency(
  ctx: IToolCtx,
  input: dna.infer<typeof S.linkActionDependencyInput>,
): IToolResult {
  const ad = tables.action_dependencies.names;
  const res = S.linkActionDependencyInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      if (data.actionId === data.dependsOnId) {
        dnactx.issues.push({ message: `An action cannot depend on itself` });
        return;
      }
      const action = ctx.queries.getActionById.get({ id: data.actionId });
      if (!action) {
        dnactx.issues.push({ message: `Action ${data.actionId} not found` });
        return;
      }
      const dependsOn = ctx.queries.getActionById.get({ id: data.dependsOnId });
      if (!dependsOn) {
        dnactx.issues.push({ message: `Action ${data.dependsOnId} not found` });
        return;
      }
      // Check idempotence: link already exists
      const existing = ctx.queries.checkActionDependencyExists.get({
        [ad.col.action_id]: data.actionId,
        [ad.col.depends_on]: data.dependsOnId,
      });
      if (existing) {
        dnactx.issues.push({ message: `Dependency ${data.actionId} → ${data.dependsOnId} already exists` });
        return;
      }
      // Cycle detection: if dependsOnId already depends (transitively) on actionId, linking would create a cycle
      const cycle = ctx.queries.checkActionDependencyCycle.get({
        [ad.col.action_id]: data.dependsOnId,
        target: data.actionId,
      });
      if (cycle) {
        dnactx.issues.push({ message: `Cycle detected: ${data.dependsOnId} already depends (transitively) on ${data.actionId}` });
        return;
      }
      return { ...data, writer };
    }, { ctx, ad })
    .safeParse(input, { ctx, ad });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertActionDependency.run({
      [ad.col.action_id]: d.actionId,
      [ad.col.depends_on]: d.dependsOnId,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Linked ${d.actionId} → ${d.dependsOnId}`, {
    actionId: d.actionId, dependsOnId: d.dependsOnId,
  });
}

// ─── Spec tools ──────────────────────────────────────────────────────────────

export function createSpec(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createSpecInput>,
): IToolResult {
  const res = S.createSpecInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const scopes = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : [writer.default_scope];
      return { ...data, writer, scopes };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertSpec.run({
      id: d.id, filename: d.filename,
      date: d.date ?? now,
      package: d.package ?? null, version: d.version,
      status: d.status ?? "draft", supersedes: d.supersedes ?? null,
      created_at: now, updated_at: now,
    });
    // Insert all scopes into entity_scopes junction table
    for (const scopeId of d.scopes) {
      ctx.queries.insertEntityScope.run({
        entity_type: "spec", entity_id: d.id, scope_id: scopeId,
      });
    }
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Spec ${d.id} created`, { id: d.id, created: true, scopes: d.scopes });
}

export function updateSpecStatus(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateSpecStatusInput>,
): IToolResult {
  const res = S.updateSpecStatusInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getSpecById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Spec ${data.id} not found` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.updateSpecStatus.run({
      status: d.newStatus, supersedes: d.supersedes ?? null,
      updated_at: now, id: d.id,
    });
    ctx.queries.insertStatusHistory.run({
      id: null, entity_type: "spec", entity_id: d.id,
      old_status: d.current.status,
      new_status: d.newStatus, changed_at: now, changed_by: d.writer.id,
      reason: null, cascade_trigger: null,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Spec ${d.id} updated to ${d.newStatus}`, {
    id: d.id, updated: true, newStatus: d.newStatus,
  });
}

// ─── Scope tools ─────────────────────────────────────────────────────────────

export function createScope(
  ctx: IToolCtx,
  input: dna.infer<typeof S.createScopeInput>,
): IToolResult {
  const res = S.createScopeInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      return { ...data, writer };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const sc = tables.scopes.names;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.insertScopeOrIgnore.run({
      [sc.col.id]: d.id,
      [sc.col.label]: d.label,
      [sc.col.description]: d.description ?? null,
      [sc.col.parent]: d.parent ?? null,
      [sc.col.sort_order]: d.sortOrder ?? 0,
      [sc.col.created_at]: now,
      [sc.col.updated_at]: now,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Scope ${d.id} created`, { id: d.id, created: true });
}

export function updateScope(
  ctx: IToolCtx,
  input: dna.infer<typeof S.updateScopeInput>,
): IToolResult {
  const res = S.updateScopeInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const current = ctx.queries.getScopeById.get({ id: data.id });
      if (!current) {
        dnactx.issues.push({ message: `Scope ${data.id} not found` });
        return;
      }
      return { ...data, writer, current };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.updateScopeFields.run({
      label: d.label ?? d.current.label,
      description: d.description ?? d.current.description,
      parent: d.parent ?? d.current.parent,
      sort_order: d.sortOrder ?? d.current.sort_order ?? 0,
      updated_at: currentTimestamp(), id: d.id,
    });
  });
  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Scope ${d.id} updated`, { id: d.id, updated: true });
}

// ─── Log entry tools ─────────────────────────────────────────────────────────

export function appendLogEntry(
  ctx: IToolCtx,
  input: dna.infer<typeof S.appendLogEntryInput>,
): IToolResult {
  const res = S.appendLogEntryInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      let resolvedThreadId: number | null = data.threadId ?? null;
      if (data.replyTo && !data.threadId) {
        const parent = ctx.queries.getLogEntryById.get({ id: data.replyTo });
        if (parent) {
          resolvedThreadId = parent.thread_id ?? data.replyTo;
        }
      }
      const scope = data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : undefined;
      return { ...data, writer, resolvedThreadId, scope };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();

  const tx = ctx.db.safeTransaction(() => {
    const info = ctx.queries.insertLogEntry.run({
      id: null, date: d.date, timestamp: now, type: d.type,
      author: d.writer.id,
      audience: d.audience ?? "all", subject: d.subject ?? null,
      body: d.body ?? null, ref_id: d.refId ?? null,
      reply_to: d.replyTo ?? null, thread_id: d.resolvedThreadId,
    });
    const newId = Number(info.lastInsertRowid);
    // Insert scopes into entity_scopes for the log entry
    if (d.scope) {
      for (const scopeId of d.scope) {
        ctx.queries.insertEntityScope.run({
          entity_type: "log_entry", entity_id: String(newId), scope_id: scopeId,
        });
      }
    }
    let threadId = d.resolvedThreadId;
    if (!d.replyTo && !d.threadId) {
      ctx.queries.updateLogEntryThread.run({ thread_id: newId, id: newId });
      threadId = newId;
    }
    return { newId, threadId };
  });

  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Log entry ${tx.data.newId} created`, {
    id: tx.data.newId,
    created: true,
    thread_id: tx.data.threadId,
  });
}

// ─── Correct tool ────────────────────────────────────────────────────────────

export function correct(
  ctx: IToolCtx,
  input: dna.infer<typeof S.correctInput>,
): IToolResult {
  const tableMap: Record<string, string> = {
    decision: "decisions",
    action: "actions",
    idea: "ideas",
    problem: "problems",
    spec: "specs",
  };
  // Correctable fields are derived from table definitions: readonly columns
  // (PK, seq, timestamps, trigger-managed) are excluded automatically.
  const fieldWhitelist: Record<string, readonly string[]> = Object.fromEntries(
    Object.entries(tableMap).map(([, table]) => {
      const t = tables[table as keyof typeof tables];
      return [table, t.names.updatable];
    }),
  );

  const res = S.correctInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      const table = tableMap[data.entityType];
      if (!table) {
        dnactx.issues.push({ message: `entityType must be one of: ${Object.keys(tableMap).join(", ")}` });
        return;
      }
      const allowedFields = fieldWhitelist[table];
      if (!allowedFields.includes(data.field)) {
        dnactx.issues.push({ message: `Field "${data.field}" is not correctable on ${data.entityType}. Allowed: ${allowedFields.join(", ")}` });
        return;
      }
      return { ...data, writer, table };
    }, { ctx, tableMap, fieldWhitelist })
    .safeParse(input, { ctx, tableMap, fieldWhitelist });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // DNA guarantees data is defined when success is true; the | undefined comes from early `return;` in the transform
  const d = res.data!;
  const now = currentTimestamp();
  const tableDef = tables[d.table as keyof typeof tables];
  const t = tableDef.names;

  const tx = ctx.db.safeTransaction(() => {
    const oldRow = ctx.db.prepare(
      tableDef.req.selectRaw(`${d.field} AS old_value`).whereRaw(`${t.pk} = @id`).toSQL(),
    ).get({ id: d.entityId }) as { old_value: string | null } | undefined;
    const oldValue = oldRow?.old_value ?? null;

    ctx.db.prepare(
      tableDef.req.update(d.field, t.col.updated_at).whereRaw(`${t.pk} = @id`).toSQL(),
    ).run({ [d.field]: d.newValue, [t.col.updated_at]: now, id: d.entityId });
    ctx.queries.insertLogEntry.run({
      id: null, date: currentDate(), timestamp: now, type: "correction",
      author: d.writer.id, audience: "all",
      subject: `Correction: ${d.entityType} ${d.entityId} field "${d.field}"`,
      body: `Old value: ${oldValue ?? "(null)"}. New value: ${d.newValue}. Reason: ${d.reason}`,
      ref_id: d.entityId, reply_to: null, thread_id: null,
    });
    if (d.field === "status") {
      ctx.queries.insertStatusHistory.run({
        id: null, entity_type: d.entityType, entity_id: d.entityId,
        old_status: oldValue, new_status: d.newValue,
        changed_at: now, changed_by: d.writer.id, reason: d.reason,
        cascade_trigger: null,
      });
    }
  });

  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Corrected ${d.entityType} ${d.entityId}: ${d.field} = ${d.newValue}`, {
    entityType: d.entityType,
    entityId: d.entityId,
    field: d.field,
    corrected: true,
  });
}

// ─── Free field tools ────────────────────────────────────────────────────────

export function addFreeField(
  ctx: IToolCtx,
  input: dna.infer<typeof S.addFreeFieldInput>,
): IToolResult {
  const res = S.addFreeFieldInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      return { ...data, writer };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const d = res.data!;
  const now = currentTimestamp();

  const tx = ctx.db.safeTransaction(() => {
    const info = ctx.queries.insertFreeField.run({
      id: null,
      entity_type: d.entityType,
      entity_id: d.entityId,
      key: d.key,
      format: d.format,
      value: d.value,
      fts_indexed: d.ftsIndexed ? 1 : 0,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    return { newId: Number(info.lastInsertRowid) };
  });

  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Free field "${d.key}" added to ${d.entityType} ${d.entityId}`, {
    id: tx.data.newId,
    created: true,
  });
}

export function deprecateFreeField(
  ctx: IToolCtx,
  input: dna.infer<typeof S.deprecateFreeFieldInput>,
): IToolResult {
  const res = S.deprecateFreeFieldInput
    .transform((data, dnactx) => {
      if (dnactx.issues.length > 0) return;
      const writer = ctx.queries.getWriterByNanoid.get({ nanoid: data.nanoid });
      if (!writer) {
        dnactx.issues.push({ message: `Invalid nanoid — writer not found` });
        return;
      }
      return { ...data, writer };
    }, { ctx })
    .safeParse(input, { ctx });

  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const d = res.data!;
  const now = currentTimestamp();

  const tx = ctx.db.safeTransaction(() => {
    ctx.queries.deprecateFreeField.run({ id: d.id, updated_at: now });
  });

  if (!tx.ok) return err(`Database error: ${tx.error}`);
  return ok(`Free field ${d.id} deprecated`, { id: d.id, deprecated: true });
}

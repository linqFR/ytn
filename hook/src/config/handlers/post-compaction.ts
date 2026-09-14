/**
 * handlers/post-compaction.ts — #46 Identity + handoff briefing recovery.
 *
 * After context compaction, re-injects the writer identity and a scoped
 * handoff briefing (open actions, pending decisions, active problems)
 * plus unread mailbox entries.
 * If no nanoid is stored, injects a registration reminder (rule 2).
 */

import { formatIdentity, formatHandoff, formatMailboxSummary, formatReadBeforeWriteReminder } from "../format.ts";
import { messages } from "../messages.ts";
import { nanoidChecker, buildContext } from "./shared.ts";
import { postCompaction as postCompactionOutput } from "../../core/responses.ts";
import type { tsPostCompactionInput, tsPostCompactionOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";
import type { OGetHandoffResult } from "@ytrynot/gov-mcp/client";

/** Priority sort order: P0 first, then P1, then P2. */
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

/** Severity sort order: CRITICAL first, then HIGH, then MEDIUM. */
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

/** Open action statuses (not done, cancelled, or deferred). */
const OPEN_ACTION_STATUSES = new Set(["pending", "in_progress", "blocked"]);

/** Active problem statuses (not fixed or wontfix). */
const ACTIVE_PROBLEM_STATUSES = new Set(["open", "critical", "in_progress", "partial", "superseded"]);

export async function postCompaction(
  data: tsPostCompactionInput,
  ctx: HookContext,
): Promise<tsPostCompactionOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const out: string[] = [];

  await nanoidChecker(out, nanoid, async (nanoid) => {
    const mcp = ctx.mcp;

    // 1. Identity
    const whoamiResult = await mcp.whoami({ nanoid });
    const writer = whoamiResult?.writer;
    if (writer) {
      out.push(`${messages.compactionLabel} ${formatIdentity(writer)}`);
    }

    // 2. Scoped handoff briefing via individual list calls
    const scope = writer?.default_scope ?? "workspace";
    const [actionsResult, decisionsResult, problemsResult] = await Promise.all([
      mcp.list_actions({ scope, withChildren: true, limit: 100 }),
      mcp.list_decisions({ scope, withChildren: true, status: "Proposed", limit: 100 }),
      mcp.list_problems({ scope, withChildren: true, limit: 100 }),
    ]);

    // Filter + sort actions by priority (P0 > P1 > P2), then by date DESC
    const openActions = actionsResult.actions
      .filter(a => OPEN_ACTION_STATUSES.has(a.status))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? "P2"] ?? 2;
        const pb = PRIORITY_ORDER[b.priority ?? "P2"] ?? 2;
        return pa !== pb ? pa - pb : (b.date ?? "").localeCompare(a.date ?? "");
      });

    // Decisions are already filtered by status=Proposed, sort by date DESC
    const pendingDecisions = [...decisionsResult.decisions].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    // Filter + sort problems by severity (CRITICAL > HIGH > MEDIUM), then by date DESC
    const activeProblems = problemsResult.problems
      .filter(p => ACTIVE_PROBLEM_STATUSES.has(p.status))
      .sort((a, b) => {
        const sa = SEVERITY_ORDER[a.severity] ?? 3;
        const sb = SEVERITY_ORDER[b.severity] ?? 3;
        return sa !== sb ? sa - sb : (b.date ?? "").localeCompare(a.date ?? "");
      });

    const critical = activeProblems.filter(p => p.severity === "CRITICAL");
    const high = activeProblems.filter(p => p.severity === "HIGH");
    const medium = activeProblems.filter(p => p.severity === "MEDIUM");

    const handoff: OGetHandoffResult = {
      date: new Date().toISOString().slice(0, 10),
      open_actions: openActions,
      pending_decisions: pendingDecisions.map(d => ({ id: d.id, title: d.title, status: d.status })),
      active_problems: { critical, high, medium },
      raw_ideas: [],
      to_test: [],
      architectural_items: [],
    };
    out.push(formatHandoff(handoff));

    // 3. Unread mailbox
    const updates = await mcp.get_updates({ nanoid, peek: true, lastN: 10 });
    const entries = updates.entries ?? [];
    if (entries.length > 0) {
      out.push(formatMailboxSummary(entries));
      out.push(formatReadBeforeWriteReminder());
    }
  });

  const context = buildContext(out);
  return context.length > 0 ? postCompactionOutput.add(context) : null;
}

/**
 * format.ts — Formatage des additionalContext.
 *
 * Helpers to build consistent, readable context strings injected
 * into the agent via additionalContext. All configurable strings
 * come from config/messages.ts.
 */

import type { tsWriterRow, tsLogEntryRow, tsActionRow, OGetHandoffResult } from "@ytrynot/gov-mcp/client";
import { messages } from "./messages.ts";

export function formatIdentity(identity: tsWriterRow): string {
  const lines: string[] = [
    `${messages.identityLabel} \`${identity.display_name ?? identity.id}\``,
  ];
  if (identity.objective) lines.push(`${messages.fields.objective}: ${identity.objective}`);
  if (identity.responsibility) lines.push(`${messages.fields.responsibility}: ${identity.responsibility}`);
  if (identity.expertise) lines.push(`${messages.fields.expertise}: ${identity.expertise}`);
  if (identity.prohibitions) lines.push(`${messages.fields.prohibitions}: ${identity.prohibitions}`);
  lines.push(`${messages.fields.scope}: \`${identity.default_scope}\``);
  return lines.join("\n");
}

export function formatMailboxSummary(entries: tsLogEntryRow[]): string {
  if (entries.length === 0) return messages.noUnreadMailbox;
  const lines: string[] = [`${messages.mailboxLabel} ${entries.length} unread message(s):`];
  for (const entry of entries.slice(0, 10)) {
    lines.push(`  - #${entry.id} \`${entry.subject ?? "(no subject)"}\` — ${entry.date}`);
  }
  return lines.join("\n");
}

export function formatOpenActions(actions: tsActionRow[]): string {
  if (actions.length === 0) return messages.noOpenActions;
  const lines: string[] = [`${messages.actionsLabel} ${actions.length} open action(s):`];
  for (const a of actions.slice(0, 10)) {
    lines.push(`  - \`${a.id}\`: ${a.title} [\`${a.status}\`]${a.priority ? ` (\`${a.priority}\`)` : ""}`);
  }
  return lines.join("\n");
}

export function formatHandoff(handoff: OGetHandoffResult): string {
  const lines: string[] = [`${messages.handoffLabel} ${handoff.date}`];
  if (handoff.open_actions.length > 0) {
    lines.push(`Open actions (${handoff.open_actions.length}):`);
    for (const a of handoff.open_actions.slice(0, 5)) {
      lines.push(`  - \`${a.id}\`: ${a.title} [\`${a.status}\`]${a.priority ? ` (\`${a.priority}\`)` : ""}`);
    }
  }
  if (handoff.pending_decisions.length > 0) {
    lines.push(`Pending decisions (${handoff.pending_decisions.length}):`);
    for (const d of handoff.pending_decisions.slice(0, 5)) {
      lines.push(`  - \`${d.id}\`: ${d.title} [\`${d.status}\`]`);
    }
  }
  const allProblems = [
    ...handoff.active_problems.critical,
    ...handoff.active_problems.high,
    ...handoff.active_problems.medium,
  ];
  if (allProblems.length > 0) {
    lines.push(`Active problems (${allProblems.length}):`);
    for (const p of allProblems.slice(0, 5)) {
      lines.push(`  - \`${p.id}\`: ${p.title} [\`${p.severity}\`]`);
    }
  }
  return lines.join("\n");
}

export function formatReadBeforeWriteReminder(): string {
  return messages.readBeforeWriteReminder;
}

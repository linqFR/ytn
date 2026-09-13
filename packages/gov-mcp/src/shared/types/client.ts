/**
 * client.ts — Public result shapes for the MCP client (subpath ./client).
 *
 * These types match the structuredContent payloads returned by gov-mcp tools.
 * They are the public contract between server and client.
 *
 * Naming convention: O* prefix = Output/Result data (per AGENTS.md).
 */

import type {
  tsWriterRow,
  tsLogEntryRow,
  tsActionRow,
  tsProblemRow,
} from "./rows.ts";

export interface OWhoamiResult {
  writer: tsWriterRow;
}

export interface OGetUpdatesResult {
  entries: tsLogEntryRow[];
  new_cursor: string;
  max_entry_id: number;
  has_more: boolean;
  remaining: number;
}

export interface OListLogEntriesResult {
  entries: tsLogEntryRow[];
  count: number;
}

export interface OListActionsResult {
  actions: tsActionRow[];
  count: number;
}

export interface OListProblemsResult {
  problems: tsProblemRow[];
  count: number;
}

export interface OListDecisionItem {
  id: string;
  seq: number;
  title: string;
  status: string;
  date: string;
  decider: string;
}

export interface OListDecisionsResult {
  decisions: OListDecisionItem[];
  count: number;
}

export interface OGetOpenActionsResult {
  actions: tsActionRow[];
  count: number;
}

export interface OPendingDecision {
  id: string;
  title: string;
  status: string;
}

export interface OActiveProblem {
  id: string;
  title: string;
  severity: string;
}

export interface ORawIdea {
  id: string;
  title: string;
}

export interface OToTestItem {
  entity_type: string;
  entity_id: string;
  reason: string;
}

export interface OArchitecturalItem {
  id: number;
  type: string;
  subject: string;
}

export interface OGetHandoffResult {
  date: string;
  open_actions: tsActionRow[];
  pending_decisions: OPendingDecision[];
  active_problems: {
    critical: OActiveProblem[];
    high: OActiveProblem[];
    medium: OActiveProblem[];
  };
  raw_ideas: ORawIdea[];
  to_test: OToTestItem[];
  architectural_items: OArchitecturalItem[];
}

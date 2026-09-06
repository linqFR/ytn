/**
 * Domain enum values — shared between DNA schemas and DB CHECK constraints.
 *
 * Each enum is defined as a frozen object (single source of truth for individual values),
 * with a derived array for `dna.enum()` and DB CHECK constraints, and a union type
 * for TypeScript signatures.
 */

// ─── Decision statuses ───────────────────────────────────────────────────────
export const DECISION_STATUS = {
  Proposed: "Proposed",
  Accepted: "Accepted",
  Suspended: "Suspended",
  Cancelled: "Cancelled",
  Superseded: "Superseded",
  Rejected: "Rejected",
  Deprecated: "Deprecated",
} as const;
export type DecisionStatus = typeof DECISION_STATUS[keyof typeof DECISION_STATUS];
export const DECISION_STATUSES: readonly DecisionStatus[] = Object.values(DECISION_STATUS);

// ─── Action statuses ─────────────────────────────────────────────────────────
export const ACTION_STATUS = {
  pending: "pending",
  in_progress: "in_progress",
  blocked: "blocked",
  done: "done",
  deferred: "deferred",
  cancelled: "cancelled",
} as const;
export type ActionStatus = typeof ACTION_STATUS[keyof typeof ACTION_STATUS];
export const ACTION_STATUSES: readonly ActionStatus[] = Object.values(ACTION_STATUS);

// ─── Idea statuses ───────────────────────────────────────────────────────────
export const IDEA_STATUS = {
  raw: "raw",
  explored: "explored",
  promoted: "promoted",
  implemented: "implemented",
  abandoned: "abandoned",
} as const;
export type IdeaStatus = typeof IDEA_STATUS[keyof typeof IDEA_STATUS];
export const IDEA_STATUSES: readonly IdeaStatus[] = Object.values(IDEA_STATUS);

// ─── Problem statuses ────────────────────────────────────────────────────────
export const PROBLEM_STATUS = {
  open: "open",
  critical: "critical",
  in_progress: "in_progress",
  fixed: "fixed",
  wontfix: "wontfix",
  partial: "partial",
  superseded: "superseded",
} as const;
export type ProblemStatus = typeof PROBLEM_STATUS[keyof typeof PROBLEM_STATUS];
export const PROBLEM_STATUSES: readonly ProblemStatus[] = Object.values(PROBLEM_STATUS);

// ─── Spec statuses ───────────────────────────────────────────────────────────
export const SPEC_STATUS = {
  draft: "draft",
  ready: "ready",
  locked: "locked",
  implemented: "implemented",
  desync: "desync",
  superseded: "superseded",
  rejected: "rejected",
} as const;
export type SpecStatus = typeof SPEC_STATUS[keyof typeof SPEC_STATUS];
export const SPEC_STATUSES: readonly SpecStatus[] = Object.values(SPEC_STATUS);

// ─── Severities ──────────────────────────────────────────────────────────────
export const SEVERITY = {
  CRITICAL: "CRITICAL",
  BLOCKING: "BLOCKING",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type Severity = typeof SEVERITY[keyof typeof SEVERITY];
export const SEVERITIES: readonly Severity[] = Object.values(SEVERITY);

// ─── Problem types ───────────────────────────────────────────────────────────
export const PROBLEM_TYPE = {
  spec: "spec",
  code: "code",
  doc: "doc",
} as const;
export type ProblemType = typeof PROBLEM_TYPE[keyof typeof PROBLEM_TYPE];
export const PROBLEM_TYPES: readonly ProblemType[] = Object.values(PROBLEM_TYPE);

// ─── Action priorities ───────────────────────────────────────────────────────
export const PRIORITY = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
} as const;
export type Priority = typeof PRIORITY[keyof typeof PRIORITY];
export const PRIORITIES: readonly Priority[] = Object.values(PRIORITY);

// ─── Idea priorities ─────────────────────────────────────────────────────────
export const IDEA_PRIORITY = {
  must: "must",
  should: "should",
  could: "could",
  might: "might",
} as const;
export type IdeaPriority = typeof IDEA_PRIORITY[keyof typeof IDEA_PRIORITY];
export const IDEA_PRIORITIES: readonly IdeaPriority[] = Object.values(IDEA_PRIORITY);

// ─── Source types ────────────────────────────────────────────────────────────
export const SOURCE_TYPE = {
  decision: "decision",
  problem: "problem",
  mailbox: "mailbox",
  challenge: "challenge",
  audit: "audit",
  regularization: "regularization",
} as const;
export type SourceType = typeof SOURCE_TYPE[keyof typeof SOURCE_TYPE];
export const SOURCE_TYPES: readonly SourceType[] = Object.values(SOURCE_TYPE);

// ─── Writer roles ────────────────────────────────────────────────────────────
export const WRITER_ROLE = {
  admin: "admin",
  agent: "agent",
} as const;
export type WriterRole = typeof WRITER_ROLE[keyof typeof WRITER_ROLE];
export const WRITER_ROLES: readonly WriterRole[] = Object.values(WRITER_ROLE);

// ─── Log entry types ─────────────────────────────────────────────────────────
export const LOG_ENTRY_TYPE = {
  intro: "intro",
  handoff: "handoff",
  question: "question",
  action: "action",
  status: "status",
  reflection: "reflection",
  answer: "answer",
  challenge: "challenge",
  reminder: "reminder",
  objective: "objective",
  decision: "decision",
  idea: "idea",
  pb: "pb",
  spec: "spec",
  architectural: "architectural",
  regularization: "regularization",
  correction: "correction",
} as const;
export type LogEntryType = typeof LOG_ENTRY_TYPE[keyof typeof LOG_ENTRY_TYPE];
export const LOG_ENTRY_TYPES: readonly LogEntryType[] = Object.values(LOG_ENTRY_TYPE);

// ─── Entity types ────────────────────────────────────────────────────────────
export const ENTITY_TYPE = {
  decision: "decision",
  action: "action",
  idea: "idea",
  problem: "problem",
  spec: "spec",
} as const;
export type EntityType = typeof ENTITY_TYPE[keyof typeof ENTITY_TYPE];
export const ENTITY_TYPES: readonly EntityType[] = Object.values(ENTITY_TYPE);

// ─── Problem-action roles ────────────────────────────────────────────────────
export const PROBLEM_ACTION_ROLE = {
  primary: "primary",
  contributing: "contributing",
  verification: "verification",
} as const;
export type ProblemActionRole = typeof PROBLEM_ACTION_ROLE[keyof typeof PROBLEM_ACTION_ROLE];
export const PROBLEM_ACTION_ROLES: readonly ProblemActionRole[] = Object.values(PROBLEM_ACTION_ROLE);

// ─── Tested statuses ─────────────────────────────────────────────────────────
export const TESTED_STATUS = {
  no_need: "no_need",
  not_ready: "not_ready",
  partially: "partially",
  success: "success",
} as const;
export type TestedStatus = typeof TESTED_STATUS[keyof typeof TESTED_STATUS];
export const TESTED_STATUSES: readonly TestedStatus[] = Object.values(TESTED_STATUS);

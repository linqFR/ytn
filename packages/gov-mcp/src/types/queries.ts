/**
 * Compiled query store interface — prepared statements keyed by purpose.
 */

import type { IStatement } from "../driver.ts";
import type {
  tsActionDependencyRow, tsActionRow, tsActionWorkstreamRow, tsCountRow, tsCursorRow,
  tsDecisionRow, tsDecisionSupersedesRow, tsEntityScopeRow, tsFTS5SearchRow, tsFreeFieldRow, tsIdeaRow, tsLogEntryRow, tsNextSeqRow,
  tsProblemActionRow, tsProblemRow, tsScopeRow, tsScopeTreeRow, tsSpecRow,
  tsStatusHistoryRow, tsWriterRow,
} from "./rows.ts";

export interface IQueries {
  // Entity by ID
  getDecisionById: IStatement<tsDecisionRow>;
  getActionById: IStatement<tsActionRow>;
  getIdeaById: IStatement<tsIdeaRow>;
  getProblemById: IStatement<tsProblemRow>;
  getSpecById: IStatement<tsSpecRow>;
  getScopeById: IStatement<tsScopeRow>;
  getWriterByNanoid: IStatement<tsWriterRow>;
  getWriterById: IStatement<tsWriterRow>;

  // Entity by seq (for forcedNumId existence check)
  getDecisionBySeq: IStatement<tsDecisionRow>;
  getActionBySeq: IStatement<tsActionRow>;
  getIdeaBySeq: IStatement<tsIdeaRow>;
  getProblemBySeq: IStatement<tsProblemRow>;

  // List entities
  listDecisions: IStatement<tsDecisionRow>;
  listActions: IStatement<tsActionRow>;
  listIdeas: IStatement<tsIdeaRow>;
  listProblems: IStatement<tsProblemRow>;
  listSpecs: IStatement<tsSpecRow>;
  listScopes: IStatement<tsScopeRow>;

  // Seq generation
  nextDecisionSeq: IStatement<tsNextSeqRow>;
  nextActionSeq: IStatement<tsNextSeqRow>;
  nextIdeaSeq: IStatement<tsNextSeqRow>;
  nextProblemSeq: IStatement<tsNextSeqRow>;

  // Log entries
  listLogEntries: IStatement<tsLogEntryRow>;
  getLastLogEntryByRef: IStatement<tsLogEntryRow>;
  getThreadEntries: IStatement<tsLogEntryRow>;
  getLogEntryById: IStatement<tsLogEntryRow>;

  // Status history
  getStatusHistory: IStatement<tsStatusHistoryRow>;

  // Relations
  getActionDependencies: IStatement<tsActionDependencyRow>;
  checkActionDependencyExists: IStatement;
  checkActionDependencyCycle: IStatement;
  getProblemActions: IStatement<tsProblemActionRow>;
  getProblemActionsByAction: IStatement<{ problem_id: string; role: string | null }>;
  getActionWorkstreams: IStatement<tsActionWorkstreamRow>;
  getDecisionsForIdea: IStatement<tsDecisionRow>;
  getActionsBySource: IStatement<tsActionRow>;
  getIdeasByPromotedTo: IStatement<tsIdeaRow>;

  // Scope counts
  countDecisionsByScope: IStatement<tsCountRow>;
  countActionsByScope: IStatement<tsCountRow>;
  countIdeasByScope: IStatement<tsCountRow>;
  countProblemsByScope: IStatement<tsCountRow>;

  // Updates (MQTT-like cursor)
  getWriterCursor: IStatement<tsCursorRow>;
  updateWriterCursor: IStatement;
  getUpdatesRaw: IStatement<tsLogEntryRow>;
  getMaxLogEntryId: IStatement<{ max_id: number | null }>;

  // FTS5 search
  fts5Search: IStatement<tsFTS5SearchRow>;
  fts5SearchByType: IStatement<tsFTS5SearchRow>;

  // Scope tree (recursive CTE for withChildren)
  scopeTree: IStatement<tsScopeTreeRow>;

  // Transverse (raw SQL — UNION)
  mailboxLast24h: IStatement;

  // Audit
  auditIdeaImplDecNotAccepted: IStatement;
  auditActDonePbOpen: IStatement;
  auditActPendingStale: IStatement;
  auditPbPartialNoToTest: IStatement;
  auditActDoneNoEvidence: IStatement;
  auditPbFixedNoFix: IStatement;

  // ── Inserts (qb-generated, named params) ──
  insertDecision: IStatement;
  insertAction: IStatement;
  insertIdea: IStatement;
  insertProblem: IStatement;
  insertSpec: IStatement;
  insertScope: IStatement;
  insertScopeOrIgnore: IStatement;
  insertWriter: IStatement;
  insertLogEntry: IStatement;
  insertStatusHistory: IStatement;
  insertActionDependency: IStatement;
  insertActionDependencyOrIgnore: IStatement;
  insertProblemAction: IStatement;
  insertProblemActionOrIgnore: IStatement;
  insertActionWorkstream: IStatement;
  insertActionWorkstreamOrIgnore: IStatement;
  insertDecisionSupersedes: IStatement;
  insertEntityScope: IStatement;
  deleteEntityScopes: IStatement;
  getDecisionSupersedes: IStatement<tsDecisionSupersedesRow>;
  getEntityScopes: IStatement<tsEntityScopeRow>;
  insertFreeField: IStatement;
  getFreeFields: IStatement<tsFreeFieldRow>;
  getFreeFieldsAll: IStatement<tsFreeFieldRow>;
  deprecateFreeField: IStatement;

  // ── Partial updates (qb-generated, named params) ──
  updateDecisionStatus: IStatement;
  updateActionStatus: IStatement;
  updateIdeaStatus: IStatement;
  updateProblemStatus: IStatement;
  updateSpecStatus: IStatement;
  updateScopeFields: IStatement;
  updateLogEntryThread: IStatement;

  // ── Open actions (ORDER BY CASE — raw SQL, qb has no orderByRaw) ──
  getOpenActions: IStatement<tsActionRow>;
  getOpenActionsByPriority: IStatement<tsActionRow>;
  getOpenActionsForHandoff: IStatement<{ id: string; title: string; priority: string | null; status: string }>;

  // ── Reports (qb-generated, LIKE via whereRaw) ──
  reportDecisionsByDate: IStatement<{ id: string; title: string; status: string }>;
  reportActionsByDate: IStatement<{ id: string; title: string; status: string }>;
  reportProblemsByDate: IStatement<{ id: string; title: string; status: string; severity: string }>;
  reportIdeasByDate: IStatement<{ id: string; title: string; status: string }>;
  reportSpecsByDate: IStatement<{ id: string; filename: string; status: string }>;
  reportLogEntriesByDate: IStatement<tsLogEntryRow>;
  reportAllDecisions: IStatement<{ id: string; title: string; status: string; date: string; decider: string; context: string | null; decision: string | null; consequences: string | null }>;
  reportAllActions: IStatement<{ id: string; title: string; status: string; owner: string | null; priority: string | null; source: string | null; source_type: string | null; body: string | null; evidence: string | null; blockers: string | null; tested: string }>;
  reportAllIdeas: IStatement<{ id: string; title: string; status: string; package: string | null; priority: string | null; promoted_to: string | null; short_desc: string | null; long_desc: string | null; abandon_reason: string | null; tested: string }>;
  reportAllProblems: IStatement<{ id: string; title: string; status: string; severity: string; type: string; linked_spec: string | null; linked_act: string | null; description: string | null; root_cause: string | null; fix: string | null; wontfix_reason: string | null; fast_track: number; tested: string; fixed_at: string | null }>;
  reportActionsBySource: IStatement<{ id: string; title: string; status: string; priority: string | null; owner: string | null }>;
  reportIdeasByPromotedTo: IStatement<{ id: string; title: string; status: string }>;
  reportProblemsByDecisionActions: IStatement<{ id: string; title: string; status: string; severity: string }>;
  reportLogEntriesByRef: IStatement<{ id: number; timestamp: string; type: string; author: string | null; subject: string | null; body: string | null }>;
}

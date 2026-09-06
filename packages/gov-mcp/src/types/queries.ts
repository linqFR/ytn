/**
 * Compiled query store interface — prepared statements keyed by purpose.
 */

import type { IStatement } from "../driver.ts";
import type {
  IActionDependencyRow, IActionRow, IActionWorkstreamRow, ICountRow, ICursorRow,
  IDecisionRow, IDecisionSupersedesRow, IEntityScopeRow, IFTS5SearchRow, IFreeFieldRow, IIdeaRow, ILogEntryRow, INextSeqRow,
  IProblemActionRow, IProblemRow, IScopeRow, IScopeTreeRow, ISpecRow,
  IStatusHistoryRow, IWriterRow,
} from "./rows.ts";

export interface IQueries {
  // Entity by ID
  getDecisionById: IStatement<IDecisionRow>;
  getActionById: IStatement<IActionRow>;
  getIdeaById: IStatement<IIdeaRow>;
  getProblemById: IStatement<IProblemRow>;
  getSpecById: IStatement<ISpecRow>;
  getScopeById: IStatement<IScopeRow>;
  getWriterByNanoid: IStatement<IWriterRow>;
  getWriterById: IStatement<IWriterRow>;

  // Entity by seq (for forcedNumId existence check)
  getDecisionBySeq: IStatement<IDecisionRow>;
  getActionBySeq: IStatement<IActionRow>;
  getIdeaBySeq: IStatement<IIdeaRow>;
  getProblemBySeq: IStatement<IProblemRow>;

  // List entities
  listDecisions: IStatement<IDecisionRow>;
  listActions: IStatement<IActionRow>;
  listIdeas: IStatement<IIdeaRow>;
  listProblems: IStatement<IProblemRow>;
  listSpecs: IStatement<ISpecRow>;
  listScopes: IStatement<IScopeRow>;

  // Seq generation
  nextDecisionSeq: IStatement<INextSeqRow>;
  nextActionSeq: IStatement<INextSeqRow>;
  nextIdeaSeq: IStatement<INextSeqRow>;
  nextProblemSeq: IStatement<INextSeqRow>;

  // Log entries
  listLogEntries: IStatement<ILogEntryRow>;
  getLastLogEntryByRef: IStatement<ILogEntryRow>;
  getThreadEntries: IStatement<ILogEntryRow>;
  getLogEntryById: IStatement<ILogEntryRow>;

  // Status history
  getStatusHistory: IStatement<IStatusHistoryRow>;

  // Relations
  getActionDependencies: IStatement<IActionDependencyRow>;
  checkActionDependencyExists: IStatement;
  checkActionDependencyCycle: IStatement;
  getProblemActions: IStatement<IProblemActionRow>;
  getProblemActionsByAction: IStatement<{ problem_id: string; role: string | null }>;
  getActionWorkstreams: IStatement<IActionWorkstreamRow>;
  getDecisionsForIdea: IStatement<IDecisionRow>;
  getActionsBySource: IStatement<IActionRow>;
  getIdeasByPromotedTo: IStatement<IIdeaRow>;

  // Scope counts
  countDecisionsByScope: IStatement<ICountRow>;
  countActionsByScope: IStatement<ICountRow>;
  countIdeasByScope: IStatement<ICountRow>;
  countProblemsByScope: IStatement<ICountRow>;

  // Updates (MQTT-like cursor)
  getWriterCursor: IStatement<ICursorRow>;
  updateWriterCursor: IStatement;
  getUpdatesRaw: IStatement<ILogEntryRow>;
  getMaxLogEntryId: IStatement<{ max_id: number | null }>;

  // FTS5 search
  fts5Search: IStatement<IFTS5SearchRow>;
  fts5SearchByType: IStatement<IFTS5SearchRow>;

  // Scope tree (recursive CTE for withChildren)
  scopeTree: IStatement<IScopeTreeRow>;

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
  getDecisionSupersedes: IStatement<IDecisionSupersedesRow>;
  getEntityScopes: IStatement<IEntityScopeRow>;
  insertFreeField: IStatement;
  getFreeFields: IStatement<IFreeFieldRow>;
  getFreeFieldsAll: IStatement<IFreeFieldRow>;
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
  getOpenActions: IStatement<IActionRow>;
  getOpenActionsByPriority: IStatement<IActionRow>;
  getOpenActionsForHandoff: IStatement<{ id: string; title: string; priority: string | null; status: string }>;

  // ── Reports (qb-generated, LIKE via whereRaw) ──
  reportDecisionsByDate: IStatement<{ id: string; title: string; status: string }>;
  reportActionsByDate: IStatement<{ id: string; title: string; status: string }>;
  reportProblemsByDate: IStatement<{ id: string; title: string; status: string; severity: string }>;
  reportIdeasByDate: IStatement<{ id: string; title: string; status: string }>;
  reportSpecsByDate: IStatement<{ id: string; filename: string; status: string }>;
  reportLogEntriesByDate: IStatement<ILogEntryRow>;
  reportAllDecisions: IStatement<{ id: string; title: string; status: string; date: string; decider: string; context: string | null; decision: string | null; consequences: string | null }>;
  reportAllActions: IStatement<{ id: string; title: string; status: string; owner: string | null; priority: string | null; source: string | null; source_type: string | null; body: string | null; evidence: string | null; blockers: string | null; tested: string }>;
  reportAllIdeas: IStatement<{ id: string; title: string; status: string; package: string | null; priority: string | null; promoted_to: string | null; short_desc: string | null; long_desc: string | null; abandon_reason: string | null; tested: string }>;
  reportAllProblems: IStatement<{ id: string; title: string; status: string; severity: string; type: string; linked_spec: string | null; linked_act: string | null; description: string | null; root_cause: string | null; fix: string | null; wontfix_reason: string | null; fast_track: number; tested: string; fixed_at: string | null }>;
  reportActionsBySource: IStatement<{ id: string; title: string; status: string; priority: string | null; owner: string | null }>;
  reportIdeasByPromotedTo: IStatement<{ id: string; title: string; status: string }>;
  reportProblemsByDecisionActions: IStatement<{ id: string; title: string; status: string; severity: string }>;
  reportLogEntriesByRef: IStatement<{ id: number; timestamp: string; type: string; author: string | null; subject: string | null; body: string | null }>;
}

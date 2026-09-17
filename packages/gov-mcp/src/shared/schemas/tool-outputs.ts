/**
 * tool-outputs.ts — DNA output schemas for MCP structuredContent.
 *
 * Each tool's output schema defines the shape of the structuredContent returned
 * by `ok(msg, data)`. These schemas are passed as `outputSchema` to the MCP SDK's
 * `registerTool()`, enabling:
 *
 * 1. Runtime output validation by the MCP SDK before results leave the server.
 * 2. Client-side validation via the JSON Schema advertised in `tools/list`.
 * 3. Automatic TypeScript types in the MCP client via `dna.infer<typeof schema>`.
 *
 * Row schemas are imported from rows.ts (DNA object schemas shared with
 * defTable DDL generation and dna.infer TypeScript row types).
 * `dna.any()` is retained only for non-row shapes (FTS5 search results,
 * timeline, lineage, audit issues) that don't map to physical tables.
 *
 * Naming: `*OutputSchema` suffix (DNA schema convention).
 */

import { dna } from "@ytrynot/dna";
import {
  writerRowSchema, actionRowSchema, problemRowSchema, logEntryRowSchema,
  decisionRowSchema, ideaRowSchema, specRowSchema, scopeRowSchema,
  statusHistoryRowSchema, actionDependencyRowSchema, actionWorkstreamRowSchema,
  problemActionRowSchema, entityScopeRowSchema, freeFieldRowSchema,
  decisionSupersedesRowSchema,
} from "./rows.js";

// ── Identity ──

export const whoamiOutputSchema = dna.object({
  writer: writerRowSchema,
});

export const listWritersOutputSchema = dna.object({
  writers: dna.array(writerRowSchema.omit({ nanoid: true, last_read_at: true })),
});

// ── Read: decisions ──

export const listDecisionsOutputSchema = dna.object({
  decisions: dna.array(decisionRowSchema.pick({ id: true, seq: true, title: true, status: true, date: true, decider: true })),
  count: dna.number(),
});

export const getDecisionOutputSchema = dna.object({
  decision: decisionRowSchema,
  history: dna.array(statusHistoryRowSchema),
  supersedes: dna.array(decisionSupersedesRowSchema).optional(),
  scopes: dna.array(entityScopeRowSchema).optional(),
});

// ── Read: actions ──

export const listActionsOutputSchema = dna.object({
  actions: dna.array(actionRowSchema.pick({ id: true, seq: true, title: true, status: true, owner: true, priority: true })),
  count: dna.number(),
});

export const getActionOutputSchema = dna.object({
  action: actionRowSchema,
  dependencies: dna.array(actionDependencyRowSchema),
  problemLinks: dna.array(problemActionRowSchema.pick({ problem_id: true, role: true })),
  workstreamLinks: dna.array(actionWorkstreamRowSchema),
  history: dna.array(statusHistoryRowSchema),
  scopes: dna.array(entityScopeRowSchema).optional(),
});

// ── Read: ideas ──

export const listIdeasOutputSchema = dna.object({
  ideas: dna.array(ideaRowSchema.pick({ id: true, seq: true, title: true, status: true, package: true, priority: true })),
  count: dna.number(),
});

export const getIdeaOutputSchema = dna.object({
  idea: ideaRowSchema,
  promotedTo: decisionRowSchema.nullable(),
  scopes: dna.array(entityScopeRowSchema).optional(),
});

// ── Read: problems ──

export const listProblemsOutputSchema = dna.object({
  problems: dna.array(problemRowSchema.pick({ id: true, seq: true, title: true, status: true, severity: true, type: true })),
  count: dna.number(),
});

export const getProblemOutputSchema = dna.object({
  problem: problemRowSchema,
  actions: dna.array(problemActionRowSchema),
  history: dna.array(statusHistoryRowSchema),
  scopes: dna.array(entityScopeRowSchema).optional(),
});

// ── Read: specs ──

export const listSpecsOutputSchema = dna.object({
  specs: dna.array(specRowSchema.pick({ id: true, filename: true, package: true, version: true, status: true })),
  count: dna.number(),
});

export const getSpecOutputSchema = dna.object({
  spec: specRowSchema,
  scopes: dna.array(entityScopeRowSchema).optional(),
});

// ── Read: scopes ──

export const listScopesOutputSchema = dna.object({
  scopes: dna.array(scopeRowSchema),
  count: dna.number(),
});

export const getScopeOutputSchema = dna.object({
  scope: scopeRowSchema,
  counts: dna.record(dna.string(), dna.number()),
});

// ── Read: log entries ──

export const listLogEntriesOutputSchema = dna.object({
  entries: dna.array(logEntryRowSchema),
  count: dna.number(),
});

export const getLastLogEntryOutputSchema = dna.object({
  entry: logEntryRowSchema,
});

export const getThreadOutputSchema = dna.object({
  thread_id: dna.number(),
  entries: dna.array(logEntryRowSchema),
});

// ── Read: updates ──

export const getUpdatesOutputSchema = dna.object({
  entries: dna.array(logEntryRowSchema),
  new_cursor: dna.string(),
  max_entry_id: dna.number(),
  has_more: dna.boolean(),
  remaining: dna.number(),
});

// ── Read: docs ──

export const listDocsOutputSchema = dna.object({
  docs: dna.array(dna.object({
    filename: dna.string(),
    size: dna.number(),
    title: dna.string().nullable(),
  })),
  count: dna.number(),
});

export const getDocOutputSchema = dna.object({
  filename: dna.string(),
  content: dna.string(),
  size: dna.number(),
});

// ── Read: free fields ──

export const getFreeFieldsOutputSchema = dna.object({
  freeFields: dna.array(freeFieldRowSchema),
  count: dna.number(),
});

// ── Search ──

export const searchMailboxOutputSchema = dna.object({
  results: dna.array(dna.any()),
  count: dna.number(),
});

export const mailboxLast24hOutputSchema = dna.object({
  timeline: dna.array(dna.any()),
  count: dna.number(),
});

// ── History & lineage ──

export const getDecisionHistoryOutputSchema = dna.object({
  decision: decisionRowSchema.pick({ id: true, title: true, status: true, date: true }),
  actions: dna.array(actionRowSchema.pick({ id: true, title: true, status: true, priority: true })),
  ideas: dna.array(ideaRowSchema.pick({ id: true, title: true, status: true })),
  history: dna.array(statusHistoryRowSchema),
});

export const getActionLineageOutputSchema = dna.object({
  action: actionRowSchema.pick({ id: true, title: true, status: true, priority: true }),
  sourceDecision: decisionRowSchema.pick({ id: true, title: true, status: true }).nullable(),
  dependencies: dna.array(actionDependencyRowSchema),
  problemLinks: dna.array(problemActionRowSchema.pick({ problem_id: true, role: true })),
  history: dna.array(statusHistoryRowSchema),
});

export const getOpenActionsOutputSchema = dna.object({
  actions: dna.array(actionRowSchema),
  count: dna.number(),
});

export const getHandoffOutputSchema = dna.object({
  date: dna.string(),
  open_actions: dna.array(actionRowSchema.pick({ id: true, title: true, priority: true, status: true })),
  pending_decisions: dna.array(dna.object({
    id: dna.string(),
    title: dna.string(),
    status: dna.string(),
  })),
  active_problems: dna.object({
    critical: dna.array(dna.object({
      id: dna.string(),
      title: dna.string(),
      severity: dna.string(),
    })),
    high: dna.array(dna.object({
      id: dna.string(),
      title: dna.string(),
      severity: dna.string(),
    })),
    medium: dna.array(dna.object({
      id: dna.string(),
      title: dna.string(),
      severity: dna.string(),
    })),
  }),
  raw_ideas: dna.array(dna.object({
    id: dna.string(),
    title: dna.string(),
  })),
  to_test: dna.array(dna.object({
    entity_type: dna.string(),
    entity_id: dna.string(),
    reason: dna.string(),
  })),
  architectural_items: dna.array(dna.object({
    id: dna.number(),
    type: dna.string(),
    subject: dna.string().nullable(),
  })),
});

// ── Audit ──

export const auditConsistencyOutputSchema = dna.object({
  findings: dna.array(dna.any()),
  summary: dna.object({
    errors: dna.number(),
    warnings: dna.number(),
    info: dna.number(),
  }),
});

// ── Help ──

export const helpOutputSchema = dna.string();

// ── Write: identity ──

export const registerWriterOutputSchema = dna.object({
  id: dna.string(),
  nanoid: dna.string(),
  role: dna.string(),
  responsibility: dna.string().nullable(),
  default_scope: dna.string(),
  display_name: dna.string().nullable(),
  objective: dna.string().nullable(),
  expertise: dna.string().nullable(),
  prohibitions: dna.string().nullable(),
});

export const updateMeOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  fields: dna.array(dna.string()),
});

// ── Write: create/update entities ──

export const createDecisionOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
  seq: dna.number(),
  scopes: dna.array(dna.string()),
});

export const updateDecisionStatusOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  newStatus: dna.string(),
});

export const createActionOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
  seq: dna.number(),
  scopes: dna.array(dna.string()),
});

export const updateActionStatusOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  newStatus: dna.string(),
  cascade: dna.boolean(),
});

export const createIdeaOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
  seq: dna.number(),
  scopes: dna.array(dna.string()),
});

export const updateIdeaStatusOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  newStatus: dna.string(),
});

export const createProblemOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
  seq: dna.number(),
  scopes: dna.array(dna.string()),
});

export const updateProblemStatusOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  newStatus: dna.string(),
});

// ── Write: links ──

export const linkProblemActionOutputSchema = dna.object({
  problemId: dna.string(),
  actionId: dna.string(),
  role: dna.string(),
});

export const linkActionWorkstreamOutputSchema = dna.object({
  actionId: dna.string(),
  workstreamId: dna.string(),
});

export const linkActionDependencyOutputSchema = dna.object({
  actionId: dna.string(),
  dependsOnId: dna.string(),
});

// ── Write: specs ──

export const createSpecOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
  scopes: dna.array(dna.string()),
});

export const updateSpecStatusOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
  newStatus: dna.string(),
});

// ── Write: scopes ──

export const createScopeOutputSchema = dna.object({
  id: dna.string(),
  created: dna.boolean(),
});

export const updateScopeOutputSchema = dna.object({
  id: dna.string(),
  updated: dna.boolean(),
});

// ── Write: log entries ──

export const appendLogEntryOutputSchema = dna.object({
  id: dna.number(),
  created: dna.boolean(),
  thread_id: dna.number(),
});

// ── Write: correct ──

export const correctOutputSchema = dna.object({
  entityType: dna.string(),
  entityId: dna.string(),
  field: dna.string(),
  corrected: dna.boolean(),
});

// ── Write: free fields ──

export const addFreeFieldOutputSchema = dna.object({
  id: dna.number(),
  created: dna.boolean(),
});

export const deprecateFreeFieldOutputSchema = dna.object({
  id: dna.number(),
  deprecated: dna.boolean(),
});

// ── Reports ──

export const generateDailyReportOutputSchema = dna.object({
  date: dna.string(),
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  counts: dna.object({
    decisions: dna.number(),
    actions: dna.number(),
    problems: dna.number(),
    ideas: dna.number(),
    specs: dna.number(),
    logEntries: dna.number(),
  }),
});

export const generateDecisionsReportOutputSchema = dna.object({
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  count: dna.number(),
});

export const generateActionsReportOutputSchema = dna.object({
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  count: dna.number(),
});

export const generateIdeasReportOutputSchema = dna.object({
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  count: dna.number(),
});

export const generateProblemsReportOutputSchema = dna.object({
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  count: dna.number(),
});

export const generateSpecsReportOutputSchema = dna.object({
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  count: dna.number(),
});

export const generateDecisionHistoryReportOutputSchema = dna.object({
  id: dna.string(),
  filename: dna.string(),
  filepath: dna.string(),
  markdown: dna.string(),
  counts: dna.object({
    actions: dna.number(),
    ideas: dna.number(),
    problems: dna.number(),
    history: dna.number(),
    logs: dna.number(),
  }),
});

export const exportDumpOutputSchema = dna.object({
  sql: dna.string(),
  tables: dna.number(),
});

export const generateAllReportsOutputSchema = dna.object({
  reports: dna.array(dna.object({
    report: dna.string(),
    filepath: dna.string(),
  })),
});

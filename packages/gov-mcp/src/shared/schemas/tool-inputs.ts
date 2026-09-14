/**
 * DNA input schemas for MCP tool validation.
 *
 * Each MCP tool has a corresponding DNA schema that validates
 * the input parameters before any database operation.
 */

import { dna } from "@ytrynot/dna";
import {
  CATEGORY,
  ENTITY_TYPES
} from "../enums.js";
import {
  actionStatusSchema,
  audienceSchema,
  dateFilterSchema, dateOnlySchema,
  dateSchema,
  decisionStatusSchema,
  entityIdSchema,
  entityTypeSchema,
  forcedNumIdSchema,
  ideaPrioritySchema,
  ideaStatusSchema,
  limitSchema,
  logEntryTypeSchema,
  nanoidSchema,
  prioritySchema,
  problemActionRoleSchema,
  problemStatusSchema,
  problemTypeSchema,
  scopeOrScopesSchema,
  scopeSchema,
  severitySchema,
  sourceTypeSchema,
  specStatusSchema,
  testedStatusSchema,
  timestampSchema,
  withChildrenSchema,
  writerRoleSchema,
} from "./constants.js";

// ─── Tool input schemas ──────────────────────────────────────────────────────

export const registerWriterInput = dna.object({
  id: dna.string().min(1).max(100).describe('Unique writer identifier (e.g. "devin-mailbox", "admin")'),
  role: writerRoleSchema.describe('"admin" or "agent"'),
  responsibility: dna.string().optional().describe("What this writer is responsible for"),
  defaultScope: scopeSchema.optional().describe('Default scope for this writer\'s entities (defaults to "workspace")'),
  displayName: dna.string().optional().describe("Human-readable name"),
  objective: dna.string().optional().describe("The writer's current objective"),
  expertise: dna.string().optional().describe("Areas of expertise"),
  prohibitions: dna.string().optional().describe("Constraints on what the writer may not do"),
}).meta({
  title: "RegisterWriterInput",
  description: "Register a new writer (admin or agent). Returns a persistent nanoid token — store it securely, it is required for all write operations.",
  usage: [
    `Register a new writer`,
    `The nanoid is a secret token. Store it securely. It is required as "nanoid" parameter for all write tools. list_writers never returns it. whoami requires it.`,
  ],
  category: CATEGORY.id,
  returns: "{ id, nanoid, role, responsibility, default_scope, display_name, objective, expertise, prohibitions }"
});

export const updateMeInput = dna.object({
  nanoid: nanoidSchema,
  responsibility: dna.string().optional().describe("Updated responsibility"),
  objective: dna.string().optional().describe("Updated objective"),
  expertise: dna.string().optional().describe("Updated expertise"),
  prohibitions: dna.string().optional().describe("Updated prohibitions"),
}).meta({
  title: "UpdateMeInput",
  description: "Update your own writer profile (responsibility, objective, expertise, prohibitions). At least one field must be provided. Role, id, default_scope, and display_name cannot be changed via this tool.",
  usage: [
    `Update your writer profile. At least one of the optional fields must be provided.`,
    `Cannot modify: role, id, default_scope, display_name.`,
  ],
  category: CATEGORY.id,
  returns: '{ id, updated: true, fields: ["responsibility", ...] }'
});

export const createDecisionInput = dna.object({
  nanoid: nanoidSchema,
  title: dna.string().min(1).max(300).describe("Decision title (1-300 chars)"),
  status: decisionStatusSchema.optional().describe('Initial status (default "Proposed")'),
  scope: scopeOrScopesSchema,
  date: dateSchema.optional().describe("Decision date (default today)"),
  decider: dna.string().min(1).max(100).describe("Who made the decision"),
  supersedes: dna.array(entityIdSchema).optional().describe("Decision IDs this fully supersedes"),
  supersedesPartial: dna.array(entityIdSchema).optional().describe("Decision IDs this partially supersedes"),
  specRef: entityIdSchema.optional().describe("Linked spec ID"),
  context: dna.string().optional().describe("Background context"),
  decision: dna.string().optional().describe("The decision text"),
  consequences: dna.string().optional().describe("Expected consequences"),
  source: dna.string().optional().describe("Source reference"),
  forcedNumId: forcedNumIdSchema,
}).meta({
  title: "CreateDecisionInput",
  description: "Create a new decision. Auto-generates DEC-NNNN ID. Logs creation in status_history and log_entries.",
  usage: [
    `Create a new decision.`,
    `Side effects: inserts status_history (status="created"), inserts log_entry (type="decision").`,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, seq, scopes }"
});

export const updateDecisionStatusInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Decision ID"),
  newStatus: decisionStatusSchema.describe("New status"),
  supersedes: entityIdSchema.optional().describe("Decision ID that supersedes this one"),
  reason: dna.string().optional().describe("Reason for change"),
}).meta({
  title: "UpdateDecisionStatusInput",
  description: "Update a decision's status. Triggers cascade: Cancelled → linked ideas abandoned. Logs in status_history and log_entries.",
  usage: [
    `Update a decision's status.`,
    `Cascade: if newStatus is "Cancelled", all linked ideas (promoted_to = this decision) that are not already "abandoned" or "implemented" are set to "abandoned". The cascade is atomic via SQL trigger and can be disabled via _cascade_disabled flag.`,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true, oldStatus, newStatus }"
});

export const createActionInput = dna.object({
  nanoid: nanoidSchema,
  title: dna.string().min(1).max(300).describe("Action title"),
  owner: dna.string().optional().describe("Action owner"),
  priority: prioritySchema.optional(),
  source: dna.string().optional().describe("Source reference (e.g. decision ID)"),
  source_type: sourceTypeSchema.optional().describe('Source type: "decision", "problem", "mailbox", "challenge", "audit", "regularization"'),
  scope: scopeOrScopesSchema,
  date: dateSchema.optional().describe("Action date (default today)"),
  specRef: entityIdSchema.optional().describe("Linked spec ID"),
  body: dna.string().optional().describe("Action description"),
  dependencies: dna.array(entityIdSchema).optional().describe("Action IDs this depends on"),
  forcedNumId: forcedNumIdSchema,
}).meta({
  title: "CreateActionInput",
  description: "Create a new action. Auto-generates ACT-NNNN ID. Logs creation in status_history and log_entries.",
  usage: [
    `Create a new action.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, seq, scopes }"
});

export const updateActionStatusInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Action ID"),
  newStatus: actionStatusSchema.describe("New status"),
  evidence: dna.string().optional().describe('Completion evidence (required for "done")'),
  blockers: dna.string().optional().describe("Current blockers"),
  reason: dna.string().optional().describe("Reason for change"),
  cascade: dna.boolean().optional().describe("Whether to trigger cascades (default true)"),
}).meta({
  title: "UpdateActionStatusInput",
  description: "Update an action's status. Triggers cascades: done → linked problems partial, done → linked ideas implemented (if all sibling actions done). Before marking done, the `tested` field MUST be set to `success`/`partially`/`no_need` via `correct` — never mark `done` with `tested: not_ready`.",
  usage: [
    `Update an action's status.`,
    `Completion protocol (MANDATORY for done):
  1. Write tests
  2. Run tests → verify they pass
  3. Update \`tested\` field via \`correct\` (default is \`not_ready\`)
  4. THEN call this with newStatus="done" and test evidence in \`evidence\`
Cascades (SQL triggers, atomic):
  - done → linked problems set to "partial" + to_test=1 (if not already fixed/wontfix/partial)
  - done → ideas promoted to the same decision set to "implemented" (if all sibling actions done/cancelled)`,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true, oldStatus, newStatus }"
});

export const createIdeaInput = dna.object({
  nanoid: nanoidSchema,
  title: dna.string().min(1).max(300).describe("Idea title"),
  scope: scopeOrScopesSchema,
  date: dateSchema.optional().describe("Idea date (default today)"),
  package: dna.string().optional().describe("Related package name"),
  priority: ideaPrioritySchema.optional(),
  shortDesc: dna.string().optional().describe("Short description"),
  longDesc: dna.string().optional().describe("Long description"),
  forcedNumId: forcedNumIdSchema,
}).meta({
  title: "CreateIdeaInput",
  description: "Create a new idea. Auto-generates IDEA-NNNN ID. Logs creation in status_history and log_entries.",
  usage: [
    `Create a new idea.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, seq, scopes }"
});

export const updateIdeaStatusInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Idea ID"),
  newStatus: ideaStatusSchema.describe("New status"),
  promotedTo: entityIdSchema.optional().describe('Decision ID this idea was promoted to (for "promoted" status)'),
  abandonReason: dna.string().optional().describe('Reason for abandoning (for "abandoned" status)'),
}).meta({
  title: "UpdateIdeaStatusInput",
  description: "Update an idea's status. Logs in status_history and log_entries.",
  usage: [
    `Update an idea's status.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true, oldStatus, newStatus }"
});

export const createProblemInput = dna.object({
  nanoid: nanoidSchema,
  title: dna.string().min(1).max(300).describe("Problem title"),
  severity: severitySchema,
  type: problemTypeSchema,
  scope: scopeOrScopesSchema,
  date: dateSchema.optional().describe("Problem date (default today)"),
  description: dna.string().optional().describe("Problem description"),
  linkedSpec: entityIdSchema.optional().describe("Linked spec ID"),
  linkedAct: entityIdSchema.optional().describe("Linked action ID"),
  forcedNumId: forcedNumIdSchema,
}).meta({
  title: "CreateProblemInput",
  description: "Create a new problem/bug. Auto-generates PB-NNNN ID. Logs creation in status_history and log_entries.",
  usage: [
    `Create a new problem or bug report.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, seq, scopes }"
});

export const updateProblemStatusInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Problem ID"),
  newStatus: problemStatusSchema.describe("New status"),
  fix: dna.string().optional().describe('Fix description (for "fixed" status)'),
  rootCause: dna.string().optional().describe("Root cause analysis"),
  wontfixReason: dna.string().optional().describe("Reason for wontfix"),
  tested: testedStatusSchema.optional().describe("Override tested status (default: derived from newStatus)"),
}).meta({
  title: "UpdateProblemStatusInput",
  description: "Update a problem's status. Logs in status_history and log_entries. Tested status is derived from newStatus unless explicitly overridden.",
  usage: [
    `Update a problem's status. Tested status is auto-derived:`,
    `open/critical/in_progress → not_ready, partial → partially, fixed → success, wontfix/superseded → no_need.
  Provide 'tested' to override the derivation.`,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true, newStatus, tested }"
});

export const linkProblemActionInput = dna.object({
  nanoid: nanoidSchema,
  problemId: entityIdSchema.describe("Problem ID"),
  actionId: entityIdSchema.describe("Action ID"),
  role: problemActionRoleSchema.optional().describe('Role of the action: "primary", "contributing", "verification"'),
}).meta({
  title: "LinkProblemActionInput",
  description: "Link a problem to an action (many-to-many via problem_actions junction).",
  usage: [
    `Link a problem to an action.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ linked: true, problemId, actionId }"
});

export const linkActionWorkstreamInput = dna.object({
  nanoid: nanoidSchema,
  actionId: entityIdSchema.describe("Action ID"),
  workstreamId: entityIdSchema.describe("Workstream ID"),
}).meta({
  title: "LinkActionWorkstreamInput",
  description: "Link an action to a workstream (many-to-many via action_workstreams junction).",
  usage: [
    `Link an action to a workstream.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ linked: true, actionId, workstreamId }"
});

export const linkActionDependencyInput = dna.object({
  nanoid: nanoidSchema,
  actionId: entityIdSchema.describe("Action ID (the dependent action)"),
  dependsOnId: entityIdSchema.describe("Action ID that this action depends on"),
}).meta({
  title: "LinkActionDependencyInput",
  description: "Link an action as depending on another action (many-to-many via action_dependencies junction). Rejects cycles and duplicate links.",
  usage: [
    `Link an action dependency.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ linked: true, actionId, dependsOnId }"
});

export const createSpecInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Spec ID"),
  filename: dna.string().min(1).max(200).describe("Spec filename"),
  scope: scopeOrScopesSchema,
  date: dateSchema.optional().describe("Spec date (default today)"),
  package: dna.string().optional().describe("Related package"),
  version: dna.int().min(0).describe("Spec version (default 1, 0 = pre-spec/exploration)"),
  status: specStatusSchema.optional().describe('Initial status (default "draft")'),
  supersedes: entityIdSchema.optional().describe("Spec ID that supersedes this one"),
}).meta({
  title: "CreateSpecInput",
  description: "Create a new specification. Auto-generates SPEC-NNNN ID.",
  usage: [
    `Create a new specification.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, scopes }"
});

export const updateSpecStatusInput = dna.object({
  nanoid: nanoidSchema,
  id: entityIdSchema.describe("Spec ID"),
  newStatus: specStatusSchema.describe("New status"),
  supersedes: entityIdSchema.optional().describe("Spec ID that supersedes this one"),
  reason: dna.string().optional().describe("Reason for change"),
}).meta({
  title: "UpdateSpecStatusInput",
  description: "Update a spec's status. Triggers cascade: superseded → linked spec-type problems reopened.",
  usage: [
    `Update a spec's status.`,
    `Cascade: if newStatus is "superseded", linked problems of type "spec" with status "fixed" are reopened to "open" (fix cleared, to_test reset).`,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true, oldStatus, newStatus }"
});

export const createScopeInput = dna.object({
  nanoid: nanoidSchema,
  id: scopeSchema.describe('Scope ID (e.g. "ytn", "ytn/gov-mcp")'),
  label: dna.string().min(1).max(200).describe("Human-readable label"),
  description: dna.string().optional().describe("Scope description"),
  parent: scopeSchema.optional().describe("Parent scope ID"),
  sortOrder: dna.int().optional().describe("Sort order (default 0)"),
}).meta({
  title: "CreateScopeInput",
  description: "Create a new workspace scope.",
  usage: [
    `Create a new scope.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true }"
});

export const updateScopeInput = dna.object({
  nanoid: nanoidSchema,
  id: scopeSchema.describe("Scope ID"),
  label: dna.string().optional().describe("New label"),
  description: dna.string().optional().describe("New description"),
  parent: scopeSchema.optional().describe("New parent scope ID"),
  sortOrder: dna.int().optional().describe("New sort order"),
}).meta({
  title: "UpdateScopeInput",
  description: "Update a scope's fields (label, description, parent, sort_order).",
  usage: [
    `Update a scope's fields.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, updated: true }"
});

// ─── Free fields ─────────────────────────────────────────────────────────────

export const freeFieldFormatSchema = dna.enum(["md", "json", "link", "url", "text"]);

export const addFreeFieldInput = dna.object({
  nanoid: nanoidSchema,
  entityType: dna.enum(ENTITY_TYPES).describe("Entity type (decision, action, idea, problem, spec)"),
  entityId: entityIdSchema.describe("Entity ID (e.g. DEC-0001, ACT-0001)"),
  key: dna.string().min(1).max(100).describe("Field key (e.g. 'required_role', 'instructions', 'sandbox_ref')"),
  format: freeFieldFormatSchema.describe("Value format: md, json, link, url, or text"),
  value: dna.string().min(1).describe("Field value (md text, JSON string, link path, URL, or plain text)"),
  ftsIndexed: dna.boolean().optional().describe("Whether to index this field in FTS5 search (default: false)"),
}).meta({
  title: "AddFreeFieldInput",
  description: "Add a free-form metadata field to any entity (decision, action, idea, problem, spec). Supports md, json, link, url, and text formats.",
  usage: [
    `Add a free-form metadata field to an entity.`,
    ``,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true }"
});

export const getFreeFieldsInput = dna.object({
  entityType: dna.enum(ENTITY_TYPES).describe("Entity type"),
  entityId: entityIdSchema.describe("Entity ID"),
  includeDeprecated: dna.boolean().optional().describe("Include deprecated fields (default: false)"),
}).meta({
  title: "GetFreeFieldsInput",
  description: "Retrieve all active free-form metadata fields for a given entity. Set includeDeprecated=true to also see deprecated fields.",
  usage: [
    `Get free fields for an entity.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ freeFields: tsFreeFieldRow[], count }"
});

export const deprecateFreeFieldInput = dna.object({
  nanoid: nanoidSchema,
  id: dna.int().min(1).describe("Free field ID"),
}).meta({
  title: "DeprecateFreeFieldInput",
  description: "Deprecate a free-form metadata field (soft delete). The field is marked as deprecated, not removed — preserving traceability.",
  usage: [
    `Deprecate a free field by ID (soft delete).`,
    `The field remains in the database with status="deprecated". Use get_free_fields with includeDeprecated=true to see deprecated fields.`,
  ],
  category: CATEGORY.write,
  returns: "{ id, deprecated: true }"
});

export const appendLogEntryInput = dna.object({
  nanoid: nanoidSchema,
  date: dateSchema.optional().describe("Entry date (default now)"),
  type: logEntryTypeSchema,
  audience: audienceSchema,
  subject: dna.string().optional().describe("Entry subject"),
  body: dna.string().optional().describe("Entry body"),
  refId: dna.string().optional().describe("Reference entity ID"),
  scope: scopeOrScopesSchema,
  replyTo: dna.int().optional().describe("Log entry ID being replied to"),
  threadId: dna.int().optional().describe("Thread ID (auto-created if replyTo is set without threadId)"),
}).meta({
  title: "AppendLogEntryInput",
  description: "Append an entry to the immutable log journal. Creates a thread if replyTo is set and threadId is not.",
  usage: [
    `Append an entry to the append-only log journal.`,
    `Log entries are immutable. Use correct to append corrections, never edit.`,
  ],
  category: CATEGORY.write,
  returns: "{ id, created: true, threadId }"
});

export const correctInput = dna.object({
  nanoid: nanoidSchema,
  entityType: entityTypeSchema,
  entityId: entityIdSchema,
  field: dna.string().min(1).max(100).describe("Field name to correct (must be in the entity's whitelist)"),
  newValue: dna.string().describe("New value"),
  reason: dna.string().min(1).describe("Correction reason"),
  audience: audienceSchema,
}).meta({
  title: "CorrectInput",
  description: "Append a correction to an entity field. Never mutates the original record — appends a correction log entry + updates the field.",
  usage: [
    `Correct a field on an entity. Appends a correction; does not mutate history.`,
    `Cannot correct log_entries. The correction is logged as a log_entry with type="correction".`,
  ],
  category: CATEGORY.write,
  returns: "{ corrected: true, entityType, entityId, field, newValue }"
});

// ─── Read tool input schemas ─────────────────────────────────────────────────

export const listDecisionsInput = dna.object({
  status: decisionStatusSchema.optional().describe("Filter by status"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListDecisionsInput",
  description: "List decisions, optionally filtered by status and/or scope. Ordered by date DESC, limit 100.",
  usage: [
    `List decisions.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ decisions: tsDecisionRow[], count: number }"
});

export const getDecisionInput = dna.object({
  id: entityIdSchema.describe("Decision ID (e.g. DEC-0001)"),
}).meta({
  title: "GetDecisionInput",
  description: "Get a single decision by ID, including its status history.",
  usage: [
    `Get a single decision with full details and status history.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ decision: tsDecisionRow, history: tsStatusHistoryRow[], scopes: tsEntityScopeRow[] }"
});

export const listActionsInput = dna.object({
  status: actionStatusSchema.optional().describe("Filter by status"),
  owner: dna.string().optional().describe("Filter by owner"),
  priority: prioritySchema.optional().describe("Filter by priority"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListActionsInput",
  description: "List actions, optionally filtered by status, owner, priority, and/or scope. Ordered by seq DESC, limit 100.",
  usage: [
    `List actions.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ actions: tsActionRow[], count: number }"
});

export const getActionInput = dna.object({
  id: entityIdSchema.describe("Action ID (e.g. ACT-0001)"),
}).meta({
  title: "GetActionInput",
  description: "Get a single action by ID, including its dependencies, workstreams, and status history.",
  usage: [
    `Get a single action with dependencies, workstreams, and status history.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ action: tsActionRow, dependencies: tsActionDependencyRow[], workstreams: tsActionWorkstreamRow[], history: tsStatusHistoryRow[], scopes: tsEntityScopeRow[] }"
});

export const listIdeasInput = dna.object({
  status: ideaStatusSchema.optional().describe("Filter by status"),
  package: dna.string().optional().describe("Filter by package"),
  priority: ideaPrioritySchema.optional().describe("Filter by priority"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListIdeasInput",
  description: "List ideas, optionally filtered by status and/or scope. Ordered by seq DESC, limit 100.",
  usage: [
    `List ideas.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ ideas: tsIdeaRow[], count: number }"
});

export const getIdeaInput = dna.object({
  id: entityIdSchema.describe("Idea ID (e.g. IDEA-0001)"),
}).meta({
  title: "GetIdeaInput",
  description: "Get a single idea by ID, including the decision it was promoted to (if any) and status history.",
  usage: [
    `Get a single idea with promotion target and status history.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ idea: tsIdeaRow, promotedTo: tsDecisionRow | null, history: tsStatusHistoryRow[], scopes: tsEntityScopeRow[] }"
});

export const listProblemsInput = dna.object({
  status: problemStatusSchema.optional().describe("Filter by status"),
  severity: severitySchema.optional().describe("Filter by severity"),
  type: problemTypeSchema.optional(),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListProblemsInput",
  description: "List problems, optionally filtered by status, severity, type, and/or scope. Ordered by seq DESC, limit 100.",
  usage: [
    `List problems/bugs.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ problems: tsProblemRow[], count: number }"
});

export const getProblemInput = dna.object({
  id: entityIdSchema.describe("Problem ID (e.g. PB-0001)"),
}).meta({
  title: "GetProblemInput",
  description: "Get a single problem by ID, including linked actions and status history.",
  usage: [
    `Get a single problem with linked actions and status history.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ problem: tsProblemRow, actions: tsProblemActionRow[], history: tsStatusHistoryRow[], scopes: tsEntityScopeRow[] }"
});

export const listSpecsInput = dna.object({
  status: specStatusSchema.optional().describe("Filter by status"),
  package: dna.string().optional().describe("Filter by package"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListSpecsInput",
  description: "List specs, optionally filtered by status and/or scope. Ordered by updated_at DESC, limit 100.",
  usage: [
    `List specifications.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ specs: tsSpecRow[], count: number }"
});

export const getSpecInput = dna.object({
  id: entityIdSchema.describe("Spec ID (e.g. SPEC-0001)"),
}).meta({
  title: "GetSpecInput",
  description: "Get a single spec by ID.",
  usage: [
    `Get a single specification.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ spec: tsSpecRow, scopes: tsEntityScopeRow[] }"
});

export const listScopesInput = dna.object({
  parent: scopeSchema.optional().describe("Filter by parent scope"),
}).meta({
  title: "ListScopesInput",
  description: "List all scopes, ordered by sort_order ASC.",
  usage: [
    `List all workspace scopes.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ scopes: tsScopeRow[], count: number }"
});

export const getScopeInput = dna.object({
  id: scopeSchema.describe("Scope ID"),
}).meta({
  title: "GetScopeInput",
  description: "Get a single scope by ID, including entity counts for that scope.",
  usage: [
    `Get a single scope with entity counts.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ scope: tsScopeRow, counts: { decisions: number, actions: number, ideas: number, problems: number } }"
});

export const listLogEntriesInput = dna.object({
  nanoid: nanoidSchema.optional().describe("Writer token — if provided, advances the writer's read cursor to now (unless peek: true)"),
  peek: dna.boolean().optional().default(false).describe("Return entries WITHOUT advancing the cursor (read-only preview)"),
  date: dateFilterSchema.optional().describe("Filter by date"),
  type: logEntryTypeSchema.optional().describe("Filter by type"),
  refId: dna.string().optional().describe("Filter by reference ID"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  limit: limitSchema,
}).meta({
  title: "ListLogEntriesInput",
  description: "List log entries, optionally filtered by type, scope, and/or date. Ordered by id DESC, limit 100. If nanoid is provided, advances the writer's read cursor to now (unless peek: true).",
  usage: [
    `List log entries from the append-only journal.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ entries: tsLogEntryRow[], count: number }"
});

export const getLastLogEntryInput = dna.object({
  refId: dna.string().min(1).describe("Reference ID to look up"),
}).meta({
  title: "GetLastLogEntryInput",
  description: "Get the last log entry for a given ref_id.",
  usage: [
    `Get the most recent log entry for a reference ID.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ entry: tsLogEntryRow | null }"
});

export const getThreadInput = dna.object({
  threadId: dna.int().min(1).describe("Thread ID"),
}).meta({
  title: "GetThreadInput",
  description: "Get all log entries in a thread, ordered by id ASC.",
  usage: [
    `Get all entries in a log thread.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ entries: tsLogEntryRow[], count: number }"
});

export const getUpdatesInput = dna.object({
  nanoid: nanoidSchema,
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  type: logEntryTypeSchema.optional().describe("Filter by log entry type"),
  limitN: limitSchema.describe("Max results (1-1000, default 50)"),
  lastN: dna.int().min(1).max(1000).optional().describe("Limit to N most recent entries (overrides limitN)"),
  markAllRead: dna.boolean().optional().describe("Set cursor to now without returning entries"),
  peek: dna.boolean().optional().default(false).describe("Return entries WITHOUT resetting DateTime cursor (read-only preview)"),
}).meta({
  title: "GetUpdatesInput",
  description: "Get unread log entries since last reading of log_entries.",
  usage: [
    `Get new log entries since your last read. Advances date-time cursor, unless peek: true.`,
    "If `has_more` is true, call `get_updates` again with the same nanoid to fetch the next batch.",
  ],
  category: CATEGORY.read,
  returns: "{ entries[], new_cursor: string, max_entry_id: number, has_more: boolean, remaining: number }"
});

export const searchMailboxInput = dna.object({
  query: dna.string().min(1).max(500).describe('Search query (FTS5 syntax: AND, OR, NOT, prefix*, "phrase"). Hyphens are NOT bareword chars — quote hyphenated IDs: "PB-0108", "writer-a". Escape inner quotes by doubling: "a""b".'),
  entityType: dna.enum(["all", "decision", "action", "idea", "problem", "spec"]).optional().describe("Filter by entity type"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
}).meta({
  title: "SearchMailboxInput",
  description: "FTS5 full-text search across all entities (decisions, actions, ideas, problems, specs, log entries). Returns ranked snippets.",
  usage: [
    `Full-text search across all governance entities using FTS5.`,
    `Snippets use <mark>...</mark> highlighting. Results ordered by FTS5 rank. Limit 50.
FTS5 query syntax:
  Terms (strings):
  - Bareword: letters, digits, underscore only (e.g. parser, crash, devin).
    Hyphens, dots, colons, parentheses are NOT bareword chars — they break the parse.
  - Quoted string: "..." — anything inside is a single phrase. Escape inner " by doubling: "".
  Phrases:
  - A phrase is an ordered sequence of tokens. The tokenizer splits text on separators
    (spaces, punctuation, hyphens). "PB-0108" tokenizes to tokens "pb" then "0108".
  - A phrase matches a document only if the tokens appear adjacent and in order.
  - Concatenate phrases with + : one + two + three == "one two three".
  Prefix:
  - term* matches any token starting with "term". The * must be OUTSIDE quotes:
    parser* works, "parser*" does not.
  Initial token:
  - ^term matches only if term is the first token in a column.
  NEAR:
  - NEAR(phrase1 phrase2, N) — phrases within N tokens of each other (default N=10).
  Column filter:
  - colname : phrase — search phrase in column colname only.
  - {col1 col2} : phrase — search in col1 or col2.
  - -colname : phrase — search in all columns EXCEPT colname.
  Boolean operators (case-sensitive: AND, OR, NOT — lowercase is a bareword):
  - a AND b   — both must match
  - a OR b    — either matches
  - a NOT b   — a matches and b does not
  - Implicit AND: space-separated phrases are ANDed: one two == one AND two
  Precedence (tightest to loosest):
    ^  >  column filter (:)  >  +  >  NEAR  >  NOT  >  AND  >  OR
    Implicit AND is tighter than all operators, including NOT.
Hyphenated IDs (IMPORTANT):
  Hyphens are separators for the unicode61 tokenizer AND not bareword chars in query syntax.
  A bareword like PB-0108 causes a parse error ("no such column: 0108").
  ALWAYS quote hyphenated terms: "PB-0108", "ACT-0054", "writer-a".
  Quoted, the tokenizer splits on the hyphen and matches the adjacent tokens.
Examples:
  "PB-0108"                       — find entity PB-0108
  parser AND crash                — both terms, any order
  "parser crash"                  — phrase: parser immediately followed by crash
  parser NOT fix                  — parser present, fix absent
  parser*                         — any token starting with "parser"
  NEAR(parser crash, 5)           — parser and crash within 5 tokens
  "PB-0108" AND parser            — PB-0108 entity containing "parser"
  "writer-a" OR "devin-arch"      — either writer mentioned`,
  ],
  category: CATEGORY.search,
  returns: "{ results: Array<{ entity_type, entity_id, title, snippet }>, count: number }"
});

export const mailboxLast24hInput = dna.object({
  hours: dna.int().min(1).max(720).optional().describe("Lookback window in hours (default 24)"),
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
  type: dna.enum(["decision", "action", "idea", "problem", "log_entry"]).optional().describe("Filter by entity type"),
  limit: dna.int().min(1).max(1000).optional().describe("Max results (default: all)"),
}).meta({
  title: "MailboxLast24hInput",
  description: "Transverse view of all entities updated in the last N hours (default 24). UNION across 5 tables. Optional scope and type filtering.",
  usage: [
    `Get all entities updated in the last N hours.`,
    `type is one of: "decision", "action", "idea", "problem", "log_entry". Ordered by timestamp DESC.
When scope is provided, results are post-filtered via entity_scopes (with optional withChildren for descendant scopes).
When type is provided, results are filtered to that entity type only.
When limit is provided, at most N items are returned.`,
  ],
  category: CATEGORY.search,
  returns: "{ timeline: Array<{ type, id, title, body, timestamp }>, count: number }"
});

export const getDecisionHistoryInput = dna.object({
  id: entityIdSchema.describe("Decision ID"),
}).meta({
  title: "GetDecisionHistoryInput",
  description: "Get the full status history timeline for a decision.",
  usage: [
    `Get the complete status history for a decision.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ history: tsStatusHistoryRow[], count: number }"
});

export const getActionLineageInput = dna.object({
  id: entityIdSchema.describe("Action ID"),
}).meta({
  title: "GetActionLineageInput",
  description: "Get the full lineage of an action: dependencies, dependents, and status history.",
  usage: [
    `Get an action's lineage — what it depends on, what depends on it, and its history.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ action: tsActionRow, dependencies: tsActionRow[], dependents: tsActionRow[], history: tsStatusHistoryRow[] }"
});

export const getOpenActionsInput = dna.object({
  priority: prioritySchema.optional().describe("Filter by priority"),
}).meta({
  title: "GetOpenActionsInput",
  description: "List all open actions (pending, in_progress, blocked), ordered by priority then seq.",
  usage: [
    `List all open actions sorted by priority (P0 > P1 > P2) then seq.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ actions: tsActionRow[], count: number }"
});

export const auditConsistencyInput = dna.object({
  scope: scopeSchema.optional().describe("Filter by scope"),
  withChildren: withChildrenSchema,
}).meta({
  title: "AuditConsistencyInput",
  description: "Run 6 audit checks for governance consistency: ideas implemented but decision not accepted, actions done but problems still open, stale pending actions, problems partial without tests, actions done without evidence, problems fixed without fix description.",
  usage: [
    `Run governance consistency audits.`,
    `Each audit returns an array of violating entities (empty if consistent).`,
  ],
  category: CATEGORY.read,
  returns: "{ audits: { ideaImplDecNotAccepted, actDonePbOpen, actPendingStale, pbPartialNoToTest, actDoneNoEvidence, pbFixedNoFix } }"
});

export const generateDailyReportInput = dna.object({
  date: dateOnlySchema.describe("Date to report (YYYY-MM-DD)"),
}).meta({
  title: "GenerateDailyReportInput",
  description: "Generate a daily mailbox report (Markdown) from log entries. Writes to mailbox/generated/.",
  usage: [
    `Generate a daily report from log entries.`,
    `Writes a Markdown file to mailbox/generated/mailbox-YYYY-MM-DD.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ date, entryCount, path }"
});

export const generateDecisionHistoryReportInput = dna.object({
  id: entityIdSchema.describe("Decision ID"),
}).meta({
  title: "GenerateDecisionHistoryReportInput",
  description: "Generate a single decision's timeline report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a decision history timeline report.`,
    `Writes a Markdown file to mailbox/generated/decision-{id}-history.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ id, historyCount, path }"
});

export const whoamiInput = dna.object({
  nanoid: nanoidSchema,
}).meta({
  title: "WhoamiInput",
  description: "Return the writer's profile (role, responsibilities, objective, expertise, prohibitions) for a given nanoid.",
  usage: [
    `Retrieve your own writer profile using your nanoid.`,
    ``,
  ],
  category: CATEGORY.id,
  returns: "{ writer: tsWriterRow } — full writer record including id, role, responsibility, default_scope, display_name, objective, expertise, prohibitions, last_read_at, created_at"
});

/** List all writers — never returns nanoid. Optional filters by role and scope. */
export const listWritersInput = dna.object({
  role: writerRoleSchema.optional().describe('Filter by role: "admin" or "agent"'),
  scope: scopeSchema.optional().describe("Filter by default_scope"),
}).meta({
  title: "ListWritersInput",
  description: "List all registered writers (id, role, profile). Never returns nanoid tokens. Optional filters: role (admin/agent), scope.",
  usage: [
    `List all registered writers. Never returns nanoid tokens.`,
    ``,
  ],
  category: CATEGORY.id,
  returns: "{ writers: Array<{ id, role, responsibility, default_scope, display_name, objective, expertise, prohibitions, created_at }> }"
});

// ─── Empty input schemas for tools without parameters ────────────────────────

export const generateDecisionsReportInput = dna.object({}).meta({
  title: "GenerateDecisionsReportInput",
  description: "Generate a full decisions registry report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a full decisions registry.`,
    `Writes a Markdown file to mailbox/generated/decisions-report.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ count, path }"
});

export const generateActionsReportInput = dna.object({}).meta({
  title: "GenerateActionsReportInput",
  description: "Generate a full actions registry report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a full actions registry.`,
    `Writes a Markdown file to mailbox/generated/actions-report.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ count, path }"
});

export const generateIdeasReportInput = dna.object({}).meta({
  title: "GenerateIdeasReportInput",
  description: "Generate a full ideas registry report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a full ideas registry.`,
    `Writes a Markdown file to mailbox/generated/ideas-report.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ count, path }"
});

export const generateProblemsReportInput = dna.object({}).meta({
  title: "GenerateProblemsReportInput",
  description: "Generate a full problems registry report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a full problems registry.`,
    `Writes a Markdown file to mailbox/generated/problems-report.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ count, path }"
});

export const generateSpecsReportInput = dna.object({}).meta({
  title: "GenerateSpecsReportInput",
  description: "Generate a full specs registry report (Markdown). Writes to mailbox/generated/.",
  usage: [
    `Generate a full specs registry.`,
    `Writes a Markdown file to mailbox/generated/mailbox-specs.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ count, path }"
});

export const exportDumpInput = dna.object({}).meta({
  title: "ExportDumpInput",
  description: "Export the full database as a SQL text dump (DDL + INSERTs). For backup/restore. Returned as string, not written to disk.",
  usage: [
    `Export the full database as SQL text.`,
    `The dump contains all DDL (CREATE TABLE, CREATE INDEX, CREATE TRIGGER) and all INSERT statements. Suitable for sqlite3 .import or pipe restore.`,
  ],
  category: CATEGORY.reports,
  returns: "{ tables: string[], dump: string }"
});

export const generateAllReportsInput = dna.object({}).meta({
  title: "GenerateAllReportsInput",
  description: "Generate all 6 main reports (decisions, actions, ideas, problems, specs, daily) in one call. Writes to mailbox/generated/.",
  usage: [
    `Generate all 6 main reports at once.`,
    `Generates: mailbox-decisions.md, mailbox-actions.md, features-ideas.md, mailbox-problems.md, mailbox-specs.md, mailbox-YYYY-MM-DD.md.`,
  ],
  category: CATEGORY.reports,
  returns: "{ reports: { report: string, filepath: string }[] }"
});

export const getHandoffInput = dna.object({}).meta({
  title: "GetHandoffInput",
  description: "Get a handoff snapshot: pending decisions, critical/high/medium problems, raw ideas, items needing tests, architectural items.",
  usage: [
    `Get a handoff snapshot for session transitions.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ pendingDecisions, criticalProblems, highProblems, mediumProblems, rawIdeas, toTest, architecturalItems }"
});

// ─── Documentation tools ─────────────────────────────────────────────────────

/** Filename for get_doc — must be a bare .md filename, no path separators or traversal. */
export const docFilenameSchema = dna.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._-]+\.md$/, "Must be a .md filename with no path separators")
  .describe("Markdown filename (e.g. \"tools.md\") — no path separators or \"..\"");

export const listDocsInput = dna.object({}).meta({
  title: "ListDocsInput",
  description: "List all Markdown documentation files in the package docs/ directory. Returns filename, size, and title for each.",
  usage: [
    `List all .md files in the package's docs/ directory.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ docs: Array<{ filename, size, title }>, count: number }"
});

export const getDocInput = dna.object({
  filename: docFilenameSchema.describe("Markdown filename to retrieve (e.g. \"tools.md\")"),
}).meta({
  title: "GetDocInput",
  description: "Get the Markdown content of a documentation file from the package docs/ directory. Rejects path traversal.",
  usage: [
    `Get the content of a specific documentation file.`,
    ``,
  ],
  category: CATEGORY.read,
  returns: "{ filename, content, size }"
});

/**
 * Auto-generate parameter signatures from DNA schemas.
 *
 * Uses `schema.toJSONSchema()` (JSON Schema Draft 2020-12) for the structural
 * information (types, enums, required/optional, array items) and reads
 * `.describe()` metadata from the DNA schema fields for descriptions.
 *
 * The result is a Markdown-formatted `Parameters:` block that `help()`
 * assembles with the prose `usage` text from `meta.ts`.
 */

import type { DnaSomeType } from "@ytrynot/dna/core";
import { DnaObject } from "@ytrynot/dna/core";
import { getDescription } from "@ytrynot/dna/introspect";
import * as S from "../schemas/tool-inputs.js";

/** JSON Schema property shape (subset we care about). */
interface IJSProp {
  type?: string;
  enum?: (string | number)[];
  items?: IJSProp;
  anyOf?: IJSProp[];
  description?: string;
}

/** JSON Schema object shape (subset). */
interface IJSObject {
  type?: string;
  properties?: Record<string, IJSProp>;
  required?: string[];
}

/**
 * Map a JSON Schema property to a human-readable type name.
 */
function typeName(prop: IJSProp): string {
  // Enum: list all values
  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }
  // Array: recurse into items
  if (prop.type === "array" && prop.items) {
    return `${typeName(prop.items)}[]`;
  }
  // Union (anyOf): merge member types
  if (prop.anyOf) {
    const types = prop.anyOf.map((m) => typeName(m)).filter((t) => t !== "any");
    const unique = [...new Set(types)];
    return unique.length === 1 ? unique[0] : unique.join(" | ");
  }
  // Standard types — only "integer" needs renaming; undefined means "any"
  if (prop.type === undefined) return "any";
  if (prop.type === "integer") return "int";
  return prop.type;
}

/**
 * Generate a `Parameters:` block from a DNA object schema.
 *
 * Types are derived from `toJSONSchema()`. Descriptions are read from
 * the DNA schema's `.describe()` metadata (via `field.description`).
 *
 * Returns an empty string for schemas with no fields (e.g. `helpInput`).
 * Returns an empty string if the schema is not a DnaObject.
 */
export function describeSignature(schema: DnaSomeType): string {
  if (!(schema instanceof DnaObject)) return "";

  // Get JSON Schema structure (types, enums, required)
  const js = schema.toJSONSchema() as IJSObject;
  if (js.type !== "object" || !js.properties) return "";

  const shape = schema.shape;
  const keys = Object.keys(js.properties);
  if (keys.length === 0) return "";

  const requiredSet = new Set(js.required ?? []);

  const lines: string[] = ["Parameters:"];
  for (const key of keys) {
    const prop = js.properties[key];
    if (!prop) continue;
    const optional = !requiredSet.has(key);
    const type = typeName(prop);
    const optMark = optional ? "?" : "";
    const reqMark = optional ? ", optional" : ", required";
    // Read description from the DNA schema field, walking through wrappers
    // (optional, nullable, etc.) to find the first non-undefined description.
    const desc = shape[key] ? getDescription(shape[key]) : undefined;
    if (desc) {
      lines.push(`  ${key}${optMark} (${type}${reqMark}) — ${desc}`);
    } else {
      lines.push(`  ${key}${optMark} (${type}${reqMark})`);
    }
  }
  return lines.join("\n");
}

/**
 * Map tool names to their DNA input schemas.
 *
 * Tools with `inputSchema: undefined` in server.ts have no entry here —
 * `describeSignature` returns "" for them, and `help()` shows only the prose.
 */
const toolSchemas: Record<string, DnaSomeType> = {
  // Writers
  register_writer: S.registerWriterInput,
  register_me: S.registerWriterInput,
  whoami: S.whoamiInput,
  list_writers: S.listWritersInput,
  // Read: entities
  list_decisions: S.listDecisionsInput,
  get_decision: S.getDecisionInput,
  list_actions: S.listActionsInput,
  get_action: S.getActionInput,
  list_ideas: S.listIdeasInput,
  get_idea: S.getIdeaInput,
  list_problems: S.listProblemsInput,
  get_problem: S.getProblemInput,
  list_specs: S.listSpecsInput,
  get_spec: S.getSpecInput,
  list_scopes: S.listScopesInput,
  get_scope_info: S.getScopeInput,
  // Read: log entries
  list_log_entries: S.listLogEntriesInput,
  get_last_log_entry: S.getLastLogEntryInput,
  get_thread: S.getThreadInput,
  get_updates: S.getUpdatesInput,
  // Search & transverse
  search_mailbox: S.searchMailboxInput,
  mailbox_last_24h: S.mailboxLast24hInput,
  get_decision_history: S.getDecisionHistoryInput,
  get_action_lineage: S.getActionLineageInput,
  get_open_actions: S.getOpenActionsInput,
  audit_consistency: S.auditConsistencyInput,
  // Write: decisions
  create_decision: S.createDecisionInput,
  update_decision_status: S.updateDecisionStatusInput,
  // Write: actions
  create_action: S.createActionInput,
  update_action_status: S.updateActionStatusInput,
  // Write: ideas
  create_idea: S.createIdeaInput,
  update_idea_status: S.updateIdeaStatusInput,
  // Write: problems
  create_problem: S.createProblemInput,
  update_problem_status: S.updateProblemStatusInput,
  // Write: links
  link_problem_action: S.linkProblemActionInput,
  link_action_workstream: S.linkActionWorkstreamInput,
  link_action_dependency: S.linkActionDependencyInput,
  // Write: specs
  create_spec: S.createSpecInput,
  update_spec_status: S.updateSpecStatusInput,
  // Write: scopes
  create_scope: S.createScopeInput,
  update_scope: S.updateScopeInput,
  // Write: log & correct
  append_log_entry: S.appendLogEntryInput,
  correct: S.correctInput,
  // Reports
  generate_daily_report: S.generateDailyReportInput,
  generate_decision_history_report: S.generateDecisionHistoryReportInput,
  // System
  help: S.helpInput,
  // Read: documentation
  list_docs: S.listDocsInput,
  get_doc: S.getDocInput,
};

/**
 * Get the auto-generated `Parameters:` block for a tool by name.
 *
 * Descriptions are read from the DNA schema's `.describe()` metadata.
 *
 * Returns "" if the tool has no schema or no fields.
 */
export function describeToolSignature(toolName: string): string {
  const schema = toolSchemas[toolName];
  if (!schema) return "";
  return describeSignature(schema);
}

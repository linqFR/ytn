/**
 * client.ts — Public re-export for the ./client subpath.
 *
 * The implementation lives in ./client/client.ts; this thin file
 * keeps the package.json export path stable.
 */
export {
  createMcpClient,
  type McpClient
} from "./client/client.js";
export type {
  OActiveProblem,
  OArchitecturalItem,
  OGetHandoffResult,
  OGetOpenActionsResult,
  OGetUpdatesResult,
  OListActionsResult,
  OListDecisionItem,
  OListDecisionsResult,
  OListLogEntriesResult,
  OListProblemsResult,
  OPendingDecision,
  ORawIdea,
  OToTestItem,
  OWhoamiResult
} from "./shared/types/client.ts";
export type {
  tsActionRow,
  tsLogEntryRow,
  tsProblemRow,
  tsWriterRow
} from "./shared/types/rows.ts";

/**
 * Row types — re-exported from shared/schemas/rows.ts.
 *
 * DNA row schemas are now the single source of truth:
 * - DDL generation via `qb.defTable(name, schema)`.
 * - TypeScript types via `dna.infer<typeof schema>`.
 * - MCP output validation in tool-outputs.ts.
 *
 * This file re-exports the inferred types for backward compatibility with
 * existing imports of `ts*Row` from `types/rows.ts`.
 */

export type {
  tsScopeRow, tsDecisionRow, tsDecisionSupersedesRow, tsEntityScopeRow,
  tsFreeFieldRow, tsActionDependencyRow, tsProblemActionRow, tsWorkstreamRow,
  tsActionWorkstreamRow, tsIdeaRow, tsProblemRow, tsSpecRow,
  tsStatusHistoryRow, tsActionRow, tsLogEntryRow, tsWriterRow,
  tsNextSeqRow, tsCountRow, tsCursorRow, tsScopeTreeRow, tsFTS5SearchRow,
} from "../schemas/rows.js";

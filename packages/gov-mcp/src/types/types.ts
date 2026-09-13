/**
 * MCP tool types — shared result types and tool context.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../queries/index.ts";

/** Tool handler context. Shared by all read, write, and report tools. */
export interface IToolCtx {
  db: GovDb;
  queries: IQueries;
  /** Absolute path to the reports output directory (mailbox/generated/ by default). */
  reportsDir: string;
}

/** A successful tool result with structured content. */
export interface OToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError: boolean;
}

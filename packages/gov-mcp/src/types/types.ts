/**
 * MCP tool types — shared result types and tool context.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../queries/index.ts";

/** Tool handler context. Shared by all read, write, and report tools. */
export interface IToolCtx {
  db: GovDb;
  queries: IQueries;
}

/** A successful tool result with structured content. */
export interface IToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError: boolean;
}

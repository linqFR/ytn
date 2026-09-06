/**
 * MCP tool result helpers — ok/err/validate.
 */

import type { IToolResult } from "../types/types.ts";

/** Format a value as readable text (compact, not JSON). */
function formatValue(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "—";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    return value.map((v) => pad + "- " + formatValue(v, indent + 1)).join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    return keys.map((k) => `${pad}${k}: ${formatValue(obj[k], indent + 1)}`).join("\n");
  }
  return String(value);
}

/** Serialize structured data as readable text appended to the summary. */
function serializeStructured(structured: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(structured)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`\n## ${key} (${value.length})`);
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          const id = obj.id ?? obj.entity_id ?? obj.entity_type ?? "";
          const title = obj.title ?? obj.subject ?? "";
          lines.push(`\n### ${id}${title ? " — " + title : ""}`);
          for (const [k, v] of Object.entries(obj)) {
            if (k === "id" || k === "title" || k === "subject") continue;
            if (v === null || v === undefined) continue;
            lines.push(`  ${k}: ${formatValue(v)}`);
          }
        } else {
          lines.push(`- ${formatValue(item)}`);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      lines.push(`\n## ${key}`);
      const obj = value as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        lines.push(`  ${k}: ${formatValue(v)}`);
      }
    } else {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }
  return lines.join("\n");
}

/** Create a successful result with both text content and structured content. */
export function ok(
  text: string,
  structured?: Record<string, unknown>,
): IToolResult {
  const fullText = structured
    ? `${text}\n${serializeStructured(structured)}`
    : text;
  return {
    content: [{ type: "text", text: fullText }],
    structuredContent: structured,
    isError: false,
  };
}

/** Create an error result. */
export function err(text: string): IToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

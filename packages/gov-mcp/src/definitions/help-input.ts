/**
 * Help tool input schema — built dynamically from the tool registry.
 *
 * Separated from `definitions/tools.ts` to avoid a circular import with
 * `tools/read.ts` (which needs the schema for validation while `tools.ts`
 * imports `read.ts` for the handler).
 *
 * The `tool` field is an enum of all registered tool names plus `"help"`,
 * ensuring only valid tool names are accepted.
 */
import { dna } from "@ytrynot/dna";
import { CATEGORY } from "./enums.js";
import type { IToolCategory } from "./enums.js";

/**
 * Build the help input schema from the list of registered tool names.
 *
 * @param toolNames - sorted list of all tool names (excluding "help")
 * @returns DNA schema with optional `tool` enum field
 */
export function buildHelpInput(toolNames: readonly string[]) {
  return dna
    .strictObject({
      tool: dna
        .enum([...toolNames, "help"])
        .optional()
        .describe(
          "Tool name to get help for. If omitted, returns the full reference.",
        ),
    })
    .meta({
      title: "HelpInput",
      description: "Help for one tool or all tools (description, parameters, usage, return shape).",
      usage: [
        `Return compact help index or full detail for one tool.`,
        `- Without args: Compact index of all tools and sections on Getting Started and How-To, Docs`,
        `- With { tool: "tool_name" }: Full detail for that tool — description, auto-generated Parameters block, usage prose, return shape.`,
      ],
      category: CATEGORY.system,
      returns: "Markdown text",
    });
}

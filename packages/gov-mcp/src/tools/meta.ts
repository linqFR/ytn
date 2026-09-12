/**
 * Tool metadata — structured descriptions for all MCP tools.
 *
 * Derives `toolMeta` from `toolList` (the single source of truth in
 * `definitions/tools.ts`). Each tool's `args` schema carries `description`,
 * `usage`, and `category` via `.meta()`. Alias tools may override these via
 * `descriptionOverride` / `usageOverride` on their `IToolDef` entry.
 *
 * `toolMeta` is a lazy Proxy: the derivation from `toolList` is deferred until
 * first property access. This breaks the circular import chain:
 *   meta.ts → definitions/tools.ts → tools/read.ts → tools/meta.ts
 * By the time `toolMeta` is accessed at runtime (inside `read.help()`), all
 * modules have finished loading and `toolList` is fully initialized.
 *
 * `help` aggregates `toolMeta`; `server.ts` uses `description` for registerTool.
 */

import { toolList } from "../definitions/tools.js";

export interface IToolMeta {
  /** Short description for MCP tools/list. */
  description: string;
  /** Detailed usage: what it does, parameters, return shape. */
  usage: string;
  /** Category for help grouping. */
  category: "writers" | "read" | "write" | "reports" | "search" | "system";
}

/**
 * Derive `IToolMeta` from a DNA schema's `.meta()` payload, applying any
 * overrides from the `IToolDef` entry.
 */
function metaFromTool(tool: typeof toolList[number]): IToolMeta {
  const m = tool.args?.meta?.() ?? {};
  return {
    description: tool.descriptionOverride ?? (m.description as string) ?? "",
    usage: tool.usageOverride ?? (m.usage as string) ?? "",
    category: (m.category as IToolMeta["category"]) ?? "system",
  };
}

let _cached: Record<string, IToolMeta> | null = null;

function compute(): Record<string, IToolMeta> {
  if (_cached !== null) return _cached;
  _cached = Object.fromEntries(
    toolList.map((t) => [t.name, metaFromTool(t)]),
  );
  return _cached;
}

/**
 * Lazy Proxy over the derived tool metadata. Defers `toolList` access until
 * first use, breaking the circular import chain.
 */
export const toolMeta: Record<string, IToolMeta> = new Proxy(
  {} as Record<string, IToolMeta>,
  {
    get(_, prop: string) {
      return compute()[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(compute());
    },
    getOwnPropertyDescriptor(_, prop) {
      return Reflect.getOwnPropertyDescriptor(compute(), prop);
    },
    has(_, prop) {
      return prop in compute();
    },
  },
);

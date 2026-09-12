/**
 * Tool metadata — structured descriptions for all MCP tools.
 *
 * Derives `toolMeta` from `toolList` (the single source of truth in
 * `definitions/tools.ts`). Each tool's `args` schema carries `description`,
 * `usage`, and `category` via `.meta()`. Alias tools carry their own meta on
 * a cloned schema (e.g. `S.registerWriterInput.meta({...})`).
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
import { CATEGORY, type IToolCategory } from "../definitions/enums.js";

export interface IToolMeta {
  /** Short description for MCP tools/list. */
  description: string;
  /** Detailed usage: what it does, parameters, return shape. */
  usage: readonly [string, string];
  /** Return shape, e.g. `{ id, created: true, seq }`. */
  returns: string;
  /** Category for help grouping. */
  category: IToolCategory;
}

/**
 * Derive `IToolMeta` from a DNA schema's `.meta()` payload. Tool entries are
 * literal objects, so `tool.args` keeps its concrete schema type and `.meta()`
 * returns the declared fields with their literal types.
 */
function metaFromTool(tool: typeof toolList[number]): IToolMeta {
  const m = tool.args.meta();
  return {
    description: m.description ?? "",
    usage: m.usage ?? ["",""],
    returns: m.returns ?? "",
    category: m.category ?? CATEGORY.system,
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

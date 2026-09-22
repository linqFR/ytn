/**
 * Generic tool-help generation — SDK-free, schema-library-agnostic.
 *
 * Everything is read from the JSON Schema document the schema library already
 * produces for `tools/list` (`args["~standard"].jsonSchema.input`) — types,
 * required flags, enums, and per-property `description` (emitted by both
 * `@ytrynot/dna`'s `.describe()` and Zod v4's `.describe()`/`.meta()`).
 * No library-specific introspection is needed.
 *
 * Domain-specific prose (`usage`, `returns`, `foot`) is carried by the
 * schema's own `.meta()` payload; an optional `meta` map passed to
 * `buildToolHelp` / `helpParts` overrides it per tool for the `{{usage}}`,
 * `{{return}}` and `{{foot}}` tokens.
 */

import { toolDescription, type IMcpCore, type IToolEntry } from "./types.js";

/** JSON Schema property shape (the subset help generation reads). */
interface IJSProp {
  type?: string;
  enum?: (string | number | boolean | null)[];
  const?: unknown;
  items?: IJSProp | IJSProp[];
  anyOf?: IJSProp[];
  oneOf?: IJSProp[];
  description?: string;
}

/** JSON Schema object shape (subset). */
interface IJSObject {
  type?: string;
  properties?: Record<string, IJSProp>;
  required?: string[];
}

/**
 * Optional per-tool override for domain prose. The primary source is the
 * schema's own `.meta()` payload — `args.meta({ usage, returns })` — as
 * domains declare it; this map only overrides it per tool (e.g. when the
 * schema is a `fromJsonSchema` document or a third-party type the domain
 * cannot annotate).
 */
export interface IToolHelpMeta {
  /** Long-form usage paragraphs, joined with a blank line. */
  readonly usage?: readonly string[];
  /** Return-shape hint rendered by `{{return}}` and appended to `{{sig}}`. */
  readonly returns?: string;
  /** Closing note rendered by `{{foot}}` — caveats, warnings, limitations. */
  readonly foot?: string;
}

/** Map a JSON Schema property to a human-readable type name. */
function typeName(prop: IJSProp): string {
  if (prop.const !== undefined) return JSON.stringify(prop.const);
  if (prop.enum) return prop.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (prop.type === "array" && prop.items) {
    return Array.isArray(prop.items)
      ? `[${prop.items.map(typeName).join(", ")}]`
      : `${typeName(prop.items)}[]`;
  }
  const union = prop.anyOf ?? prop.oneOf;
  if (union) {
    const types = [...new Set(union.map(typeName).filter((t) => t !== "any"))];
    return types.length === 1 ? types[0]! : types.join(" | ");
  }
  if (prop.type === undefined) return "any";
  if (prop.type === "integer") return "int";
  return prop.type;
}

/** The advertised input JSON Schema of a tool entry (draft 2020-12). */
function inputJsonSchema<Ctx>(entry: IToolEntry<Ctx>): IJSObject {
  return entry.args["~standard"].jsonSchema.input({ target: "draft-2020-12" });
}

/** Parameter lines shared by {@link describeEntry} and {@link compactSig}. */
function params<Ctx>(
  entry: IToolEntry<Ctx>,
): { key: string; optional: boolean; type: string; desc?: string }[] {
  const js = inputJsonSchema(entry);
  if (js.type !== "object" || !js.properties) return [];
  const requiredSet = new Set(js.required ?? []);
  const out: { key: string; optional: boolean; type: string; desc?: string }[] = [];
  for (const [key, prop] of Object.entries(js.properties)) {
    const optional = !requiredSet.has(key);
    out.push({
      key,
      optional,
      type: typeName(prop),
      ...(prop.description !== undefined ? { desc: prop.description } : {}),
    });
  }
  return out;
}

/**
 * Generate a `Parameters:` block for one tool entry — one line per argument:
 * `-  name (type) — description [required]` / `-  opt? (type)`.
 *
 * Returns an empty string when the tool has no object-shaped arguments.
 */
export function describeEntry<Ctx>(entry: IToolEntry<Ctx>): string {
  const list = params(entry);
  if (list.length === 0) return "";
  const lines = ["Parameters:"];
  for (const p of list) {
    const optMark = p.optional ? "?" : "";
    const reqMark = p.optional ? "optional" : "required";
    lines.push(
      p.desc
        ? `-  ${p.key}${optMark} (${p.type}) — ${p.desc} [${reqMark}]`
        : `-  ${p.key}${optMark} (${p.type})`,
    );
  }
  return lines.join("\n");
}

/**
 * Compact one-line signature: `name(req, opt?)`, with ` → returns` appended
 * when a `returnShape` hint is provided.
 */
export function compactSig<Ctx>(entry: IToolEntry<Ctx>, returnShape?: string): string {
  const paramStr = params(entry)
    .map((p) => p.key + (p.optional ? "?" : ""))
    .join(", ");
  return `${entry.name}(${paramStr})${returnShape ? ` → ${returnShape}` : ""}`;
}

/** Tokens available in `buildToolHelp` format templates. */
export type tsHelpToken = "name" | "desc" | "sig" | "args" | "usage" | "return" | "foot";

/**
 * The rendered parts of one tool entry — the map behind every `{{token}}`.
 *
 * `buildToolHelp` is template sugar over this map; callers that need the
 * parts directly (custom page assembly, per-category grouping, non-Markdown
 * renderers) use `helpParts` instead of re-deriving each token.
 */
export function helpParts<Ctx>(
  entry: IToolEntry<Ctx>,
  meta?: IToolHelpMeta,
): Record<tsHelpToken, string> {
  const sm = entry.args.meta?.();
  const usage = meta?.usage ?? sm?.usage;
  const returns = meta?.returns ?? sm?.returns;
  return {
    name: entry.name,
    desc: toolDescription(entry),
    sig: compactSig(entry, returns),
    args: describeEntry(entry),
    usage: usage?.join("\n\n") ?? "",
    return: returns ?? "",
    foot: meta?.foot ?? sm?.foot ?? "",
  };
}

/**
 * Build a help string from a core's registry.
 *
 * The help output is assembled in three zones, mirroring how a domain `help`
 * tool composes its page:
 *
 * - **head** — domain-owned prose (title, intro, how-to) — not derivable,
 *   the caller prepends it;
 * - **body** — this function's output: `name` given renders one tool with
 *   `template` (default: the full detail layout); `name` omitted renders
 *   every registered tool with `template` (default: one compact line each),
 *   joined by newlines — the domain loops or groups as it sees fit;
 * - **foot** — domain-owned notes — the caller appends it.
 *
 * Template tokens: `{{name}}` tool name, `{{desc}}` description (explicit or
 * schema `.meta().description`), `{{sig}}` compact signature (with the
 * `→ returns` shape appended), `{{args}}` the full `Parameters:` block,
 * `{{usage}}` domain prose, `{{return}}` bare return shape, `{{foot}}`
 * closing note — the domain fields come from `args.meta()`, overridable
 * per tool via `meta[name]`.
 *
 * Returns "" when `name` is unknown.
 *
 * @example
 * buildToolHelp(core, "greet", "{{name}}: {{desc}}\n\n{{sig}}\n\n{{args}}")
 * buildToolHelp(core) // compact list of every tool
 * buildToolHelp(core, undefined, "- {{name}} — {{sig}}") // custom list line
 */
export function buildToolHelp<Ctx>(
  core: IMcpCore<Ctx>,
  name?: string,
  template?: string,
  meta?: Record<string, IToolHelpMeta>,
): string {
  const render = (entry: IToolEntry<Ctx>, tpl: string): string => {
    const parts = helpParts(entry, meta?.[entry.name]);
    return tpl.replace(/\{\{(\w+)\}\}/g, (raw, token: string) => {
      // CAST: the capture is checked against the parts map; unknown tokens
      // are preserved verbatim so templates degrade gracefully.
      const key = token as tsHelpToken;
      return key in parts ? parts[key] : raw;
    }).replace(/\n{3,}/g, "\n\n").trimEnd();
  };
  if (name !== undefined) {
    const entry = core.tools.find((t) => t.name === name);
    return entry
      ? render(
          entry,
          template ?? "{{name}}: {{desc}}\n\n{{sig}}\n\n{{args}}\n\n{{usage}}\n\n{{foot}}",
        )
      : "";
  }
  return core.tools
    .map((t) => render(t, template ?? "`{{name}}`: {{desc}} — `{{sig}}`"))
    .join("\n");
}

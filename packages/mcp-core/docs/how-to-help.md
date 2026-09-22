# How to Generate Tool Help with `@ytrynot/mcp-core`

`@ytrynot/mcp-core` generates human-facing help pages straight from the tool registry — no SDK, no transport. Everything derivable comes from the JSON Schema each `args` advertises for `tools/list`, so the helpers work identically with DNA, Zod v4, or `fromJsonSchema` documents. The parts a schema cannot express (usage prose, return shape, closing notes, categories) are written by the domain on the schema's `.meta()` payload.

This guide covers authoring help content and rendering it — from a single parameter block to a full categorized page. Everywhere below, `core` is the `createCore({ tools, ctx })` handle and `entry` one of its `core.tools` entries — see [How to Serve and Connect](./how-to-server-and-client.md#define-the-tool-registry) for how the registry is built.

## Table of Contents

- [A Complete Example](#a-complete-example)
- [The Four Helpers](#the-four-helpers)
- [Where Each Token Comes From](#where-each-token-comes-from)
- [Default Templates and How to Override Them](#default-templates-and-how-to-override-them)
- [Writing Descriptions that Feed Help](#writing-descriptions-that-feed-help)
- [Writing the Domain Parts (`usage` / `returns` / `foot`)](#writing-the-domain-parts-usage--returns--foot)
- [Grouping by `category`](#grouping-by-category)
- [Head / Body / Foot Page Composition](#head--body--foot-page-composition)
- [A `help` Tool in the Registry](#a-help-tool-in-the-registry)

## A Complete Example

```typescript
import { buildToolHelp, createCore, type IToolEntry } from "@ytrynot/mcp-core";
import { dna } from "@ytrynot/dna";

const greet: IToolEntry<{}> = {
  name: "greet",
  args: dna
    .object({
      name: dna.string().describe("the name"),
      limit: dna.number().int().optional().describe("max greetings"),
    })
    .meta({
      description: "Greets by name.",        // → {{desc}}   (entry.description wins if set)
      usage: ["Greets the given name."],     // → {{usage}}  prose: what/when/how to call
      returns: "{ greeting }",               // → {{return}} and appended to {{sig}}
      foot: "Side-effect free.",             // → {{foot}}   closing note (caveats, warnings)
    }),
  handler: () => ({ content: [{ type: "text" as const, text: "hi" }], isError: false }),
};

const core = createCore({ tools: [greet], ctx: {} });

buildToolHelp(core, "greet"); // returns the rendered Markdown string
// greet: Greets by name.
//
// greet(name, limit?) → { greeting }
//
// Parameters:
// -  name (string) — the name [required]
// -  limit? (int) — max greetings [optional]
//
// Greets the given name.
//
// Side-effect free.
```

`buildToolHelp` is a pure render — no transport, no side effect. You call it in-process (inside a `help` tool's handler, a hook, a CLI) and the returned string becomes the tool's text content or your CLI output.

## The Four Helpers

Each helper sits at a different level of the pipeline — pick the lowest level that gives you what you need.

### `buildToolHelp` — the default path

Renders a page. Call it from a `help` tool's handler; it does everything: part extraction + template substitution.

```typescript
import { buildToolHelp } from "@ytrynot/mcp-core";

buildToolHelp(core, "greet");        // detail page for ONE tool — "" if the name is unknown
buildToolHelp(core);                 // index: one compact line per tool, joined by newlines
buildToolHelp(core, "greet", tpl);   // 3rd arg: your template replaces the default layout
buildToolHelp(core, "greet", tpl, metaMap); // 4th arg: per-tool prose overrides
```

Typical wiring — a `help` entry whose handler is a one-liner:

```typescript
const text = buildToolHelp(core, input.tool); // detail or index depending on args
return { content: [{ type: "text" as const, text }], isError: false };
```

### `helpParts` — the parts, no template

Returns the seven rendered parts as a map — `{ name, desc, sig, args, usage, return, foot }`. Use it when you assemble output yourself and a flat template is not enough: grouping by category, HTML/CLI renderers, reordering sections, dropping parts in compact views.

```typescript
import { helpParts } from "@ytrynot/mcp-core";

// Custom layout — one section per tool, parts placed by hand:
const lines: string[] = [];
for (const entry of core.tools) {
  const p = helpParts(entry); // 2nd arg (optional): an IToolHelpMeta override for THIS entry —
                              // buildToolHelp takes the whole Record<name, IToolHelpMeta> instead
  lines.push(`### ${p.name}`, p.desc, "", p.sig, "", p.args, "", p.usage, p.foot);
}
```

### `compactSig` — one signature line

`name(req, opt?) → { returns }` — for list rows, tables of contents, or anywhere a tool must be referenced in one line. Pass the return shape explicitly (or read it from `entry.args.meta()?.returns`).

```typescript
import { compactSig } from "@ytrynot/mcp-core";

const lines = core.tools.map((t) => `- \`${compactSig(t, t.args.meta?.()?.returns)}\``);
// - `greet(name, limit?) → { greeting }`
// - `ping()`
```

### `describeEntry` — the `Parameters:` block

The argument list alone — one `-  name (type) — description [required]` line per field. Use it to embed the parameters inside your own section layout (docs pages, a `describe` tool) without the rest of the help page.

```typescript
import { describeEntry } from "@ytrynot/mcp-core";

const page = `## ${entry.name}\n\n${describeEntry(entry)}`;
// ## greet
//
// Parameters:
// -  name (string) — the name [required]
// -  limit? (int) — max greetings [optional]
```

## Where Each Token Comes From

`buildToolHelp` substitutes seven tokens, each drawn from a different source:

| Token | Source |
|---|---|
| `{{name}}` | `entry.name` — the registered tool name |
| `{{desc}}` | `entry.description`, else the schema's `.meta().description` |
| `{{sig}}` | `compactSig(entry)` — rebuilt from the JSON Schema (`properties` + `required`), `→ returns` appended |
| `{{args}}` | `describeEntry(entry)` — the full `Parameters:` block |
| `{{usage}}` | `args.meta().usage` — domain prose on the schema (overridable via the `meta` map) |
| `{{return}}` | `args.meta().returns` — bare return shape — same channel |
| `{{foot}}` | `args.meta().foot` — closing note: caveats, warnings, limitations — same channel |

Four tokens are auto-derived from the registry; `{{usage}}`/`{{return}}`/`{{foot}}` come from the schema's `.meta()` payload — see [Writing the domain parts](#writing-the-domain-parts-usage--returns--foot).

## Default Templates and How to Override Them

`buildToolHelp` picks one of two built-in layouts depending on `name`:

- **Detail** (a `name` is given) — `{{name}}: {{desc}}\n\n{{sig}}\n\n{{args}}\n\n{{usage}}\n\n{{foot}}`. `{{return}}` is deliberately absent: `{{sig}}` already renders the return shape (`→ { greeting }`), so the token stays available for custom templates without duplicating it in the default.
- **List** (no `name`) — `` `{{name}}`: {{desc}} — `{{sig}}` `` rendered once per tool, joined by newlines.

Both are plain strings: the third `template` argument replaces whichever default applies. Tokens are substituted by `{{token}}` text replacement — order, separators, and surrounding markdown are entirely yours; unknown tokens are left verbatim, and runs of blank lines left by empty parts are normalized to one:

```typescript
// Detail override — usage first, no Parameters block:
buildToolHelp(core, "greet", "## {{name}}\n{{desc}}\n\n{{usage}}\n\n`{{sig}}`");

// Style the closing note as a callout:
buildToolHelp(core, "greet", "{{name}}: {{desc}}\n\n{{sig}}\n\n{{args}}\n\n{{usage}}\n\n> **Note:** {{foot}}");

// List override — one bullet per tool:
buildToolHelp(core, undefined, "- `{{name}}` — {{desc}}");
// - `greet` — Greets by name.
// - `ping` — No-arg ping.
```

## Writing Descriptions that Feed Help

Help text is not written separately — it comes from the schemas themselves. Two levels:

- **Tool description (`{{desc}}`)** — `entry.description` wins; otherwise the input schema's `.meta().description` is used. Set it with `.describe("...")` on the object (both DNA and Zod v4 accept it at any level) or `.meta({ description })` (also both).
- **Per-argument lines (`{{args}}`)** — each field's `description` in the advertised JSON Schema, produced by `.describe("...")` on the field (both libraries).

```typescript
// DNA
const args = dna
  .object({
    name: dna.string().describe("the name"),       // → "-  name (string) — the name [required]"
    limit: dna.number().int().optional().describe("max greetings"),
  })
  .describe("Greets by name.");                    // → {{desc}}  (or .meta({ description }))

// Zod v4
const zArgs = z
  .object({
    name: z.string().describe("the name"),
    limit: z.number().int().optional().describe("max greetings"),
  })
  .describe("Greets by name.");                     // → {{desc}}  (or .meta({ description }))
```

For `fromJsonSchema` documents, write `description` directly on each property and `title`/`description` at the root — but note `{{desc}}` reads `entry.description` or `meta()`, not the document, so declare `description` on the entry for JSON-Schema-sourced tools.

## Writing the Domain Parts (`usage` / `returns` / `foot`)

`{{usage}}`, `{{return}}` and `{{foot}}` are not derivable from the JSON Schema — the domain writes them **on the input schema itself**, in the same `.meta()` call that carries `description`. This keeps one source of truth: schema, description, usage, return shape and closing note travel together:

```typescript
// DNA
const args = dna
  .object({ name: dna.string().describe("the name") })
  .meta({
    description: "Greets by name.",          // → {{desc}}
    usage: [
      "Greets the given name and returns the sentence.",
      "Call it once per person; it is side-effect free.",
    ],                                        // → {{usage}} (paragraphs joined by a blank line)
    returns: "{ greeting }",                  // → {{return}} and appended to {{sig}}
    foot: "Use `list_notes` afterwards for the persisted form.", // → {{foot}} — closing note
  });

// Zod v4 — same fields through .meta()
const zArgs = z
  .object({ name: z.string().describe("the name") })
  .meta({
    description: "Greets by name.",          // → {{desc}}
    usage: [
      "Greets the given name and returns the sentence.",
      "Call it once per person; it is side-effect free.",
    ],                                        // → {{usage}} (paragraphs joined by a blank line)
    returns: "{ greeting }",                  // → {{return}} and appended to {{sig}}
    foot: "Use `list_notes` afterwards for the persisted form.", // → {{foot}} — closing note
  });
```

`usage` is plain prose paragraphs — what the tool does, how to call it, pitfalls. `foot` is the **closing note**: caveats, security warnings, "what this tool cannot do". Keeping it a separate part (not just the last `usage` paragraph) means custom templates can style or move it — render it in a `> **Note:**` block, bold it, or drop it from compact views.

`helpParts` / `buildToolHelp` read `args.meta()` — nothing else to wire:

```typescript
buildToolHelp(core, "greet", "{{sig}}\n\n{{usage}}\n\n> **Note:** {{foot}}");
// greet(name, limit?) → { greeting }
//
// Greets the given name and returns the sentence.
//
// Call it once per person; it is side-effect free.
//
// > **Note:** Use `list_notes` afterwards for the persisted form.
```

**Override map** — `buildToolHelp`'s fourth argument (`Record<string, IToolHelpMeta>`) overrides the schema's meta per tool. Use it when the schema cannot carry meta — a `fromJsonSchema` document or a third-party type — not as the primary mechanism.

A schema without `usage`/`returns`/`foot` renders those tokens as empty strings — the help still works, the sections collapse (runs of blank lines are normalized to one).

## Grouping by `category`

`.meta({ category })` declares which section of a help page the tool belongs to, typed as `IToolHelpCategory` (`{ name, key, order }` — human heading, machine key, sort position). The domain enumerates its own categories; mcp-core never interprets the value — the type only fixes the shape so grouping has a stable contract.

Group entries by `entry.args.meta()?.category` before rendering each with `buildToolHelp`:

```typescript
const categories = new Map<string, typeof core.tools>();
for (const entry of core.tools) {
  const cat = entry.args.meta?.()?.category;
  const key = cat?.key ?? "misc";
  categories.set(key, [...(categories.get(key) ?? []), entry]);
}
// render each group: `## ${cat.name}` heading + one list-mode line per entry
```

## Head / Body / Foot Page Composition

A full help page is assembled in three zones, and only the **body** comes from `buildToolHelp`:

- **head** — domain-owned prose (title, intro, getting-started). Not derivable; the caller prepends it.
- **body** — `buildToolHelp` output: with `name`, one tool rendered with the detail template; without `name`, every tool rendered with the list template (default `` `{{name}}`: {{desc}} — `{{sig}}` ``, or pass your own) joined by newlines. Group or loop by category as needed — each entry is rendered independently.
- **foot** — domain-owned notes; the caller appends them. (Distinct from the per-tool `{{foot}}` token — that one is a tool's own closing note inside the body; this zone is the page-level footer.)

```typescript
const head = `# ${pkg.name} — Tools Reference\n\n<intro prose>`;
const body = buildToolHelp(core, undefined, "- `{{name}}` — `{{sig}}`");
const foot = "## Notes\n- `api_key` is required for all write tools.";
const page = `${head}\n\n${body}\n\n${foot}`;
```

## A `help` Tool in the Registry

The natural use is a `help` tool in the domain registry whose handler calls `buildToolHelp` — the helper is in-process only and needs no MCP wiring. With the domain's page zones as constants:

```typescript
const helpArgs = dna.object({ tool: dna.string().optional().describe("tool name") });
const HEAD = "# My Server — Tools Reference\n\n<intro prose>";
const FOOT = "## Notes\n- `api_key` is required for all write tools.";

const helpEntry: IToolEntry<ICtx> = {
  name: "help",
  description: "Compact index of all tools, or full detail for one tool.",
  args: helpArgs,
  handler(ctx, input) {
    const { tool } = helpArgs.parse(input); // in-process validation — see the serve how-to
    if (tool !== undefined) {
      const text = buildToolHelp(core, tool); // detail mode; "" when unknown
      return text === ""
        ? { content: [{ type: "text" as const, text: `Unknown tool: ${tool}` }], isError: true }
        : { content: [{ type: "text" as const, text }], isError: false };
    }
    const page = `${HEAD}\n\n${buildToolHelp(core)}\n\n${FOOT}`; // index mode
    return { content: [{ type: "text" as const, text: page }], isError: false };
  },
};
```

## Related Documentation

- [How to Serve and Connect](./how-to-server-and-client.md) — registry, transports, client, in-process dispatch
- [Package README](../README.md) — concepts and package layout

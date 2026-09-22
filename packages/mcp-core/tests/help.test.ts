import { describe, expect, it } from "vitest";
import { dna } from "@ytrynot/dna";
import { z } from "zod";
import { fromJsonSchema } from "@modelcontextprotocol/server";
import {
  buildToolHelp,
  compactSig,
  createCore,
  describeEntry,
  helpParts,
  type IToolEntry,
} from "../src/index.js";

interface ICtx {
  db: string;
}

const handler: IToolEntry<ICtx>["handler"] = () => ({
  content: [{ type: "text", text: "ok" }],
  isError: false,
});

const entries: IToolEntry<ICtx>[] = [
  {
    name: "greet",
    description: "Greets by name.",
    args: dna.object({
      name: dna.string().describe("the name"),
      limit: dna.number().int().optional(),
      tags: dna.array(dna.string()).optional(),
      mode: dna.enum(["a", "b"]).optional(),
    }),
    handler,
  },
  {
    name: "ping",
    description: "No-arg ping.",
    args: dna.object({}),
    handler,
  },
];

const core = createCore({ tools: entries, ctx: { db: ":memory:" } });

describe("descriptions feeding help", () => {
  it("DNA: .meta({description}) on the object feeds {{desc}}", () => {
    const entry: IToolEntry<ICtx> = {
      name: "dna_desc",
      args: dna
        .object({ q: dna.string().describe("the query") })
        .meta({ description: "Search stuff." }),
      handler,
    };
    const c = createCore({ tools: [entry], ctx: { db: "" } });
    const out = buildToolHelp(c, "dna_desc");
    expect(out).toContain("dna_desc: Search stuff.");
    expect(out).toContain("-  q (string) — the query [required]");
  });

  it("Zod v4: .describe() on the object feeds {{desc}}, .describe() on fields feeds {{args}}", () => {
    const entry: IToolEntry<ICtx> = {
      name: "zod_desc",
      args: z
        .object({ q: z.string().describe("the query") })
        .describe("Search stuff."),
      handler,
    };
    const c = createCore({ tools: [entry], ctx: { db: "" } });
    const out = buildToolHelp(c, "zod_desc");
    expect(out).toContain("zod_desc: Search stuff.");
    expect(out).toContain("-  q (string) — the query [required]");
  });

  it("Zod v4: .meta({description}) works too", () => {
    const entry: IToolEntry<ICtx> = {
      name: "zod_meta",
      args: z.object({}).meta({ description: "via meta" }),
      handler,
    };
    expect(buildToolHelp(createCore({ tools: [entry], ctx: { db: "" } }), "zod_meta")).toContain(
      "zod_meta: via meta",
    );
  });

  it("entry.description always wins over the schema's meta", () => {
    const entry: IToolEntry<ICtx> = {
      name: "override",
      description: "Explicit wins.",
      args: dna.object({}).meta({ description: "schema desc" }),
      handler,
    };
    expect(helpParts(entry).desc).toBe("Explicit wins.");
  });

  it("fromJsonSchema documents need entry.description for {{desc}}", () => {
    const entry: IToolEntry<ICtx> = {
      name: "json_desc",
      description: "Declared on the entry.",
      args: fromJsonSchema({
        type: "object",
        description: "doc-level desc not read for {{desc}}",
        properties: { q: { type: "string", description: "the query" } },
        required: ["q"],
      }),
      handler,
    };
    const parts = helpParts(entry);
    expect(parts.desc).toBe("Declared on the entry.");
    expect(parts.args).toContain("-  q (string) — the query [required]");
  });
});

describe("domain parts from schema meta", () => {
  it("reads usage/returns/foot from args.meta() — no meta map needed", () => {
    const entry: IToolEntry<ICtx> = {
      name: "schema_meta",
      args: dna
        .object({})
        .meta({
          description: "From schema meta.",
          usage: ["First para.", "Second para."],
          returns: "{ id, seq }",
          foot: "Never share the api key.",
        }),
      handler,
    };
    const parts = helpParts(entry);
    expect(parts.desc).toBe("From schema meta.");
    expect(parts.sig).toBe("schema_meta() → { id, seq }");
    expect(parts.usage).toBe("First para.\n\nSecond para.");
    expect(parts.return).toBe("{ id, seq }");
    expect(parts.foot).toBe("Never share the api key.");
  });

  it("{{foot}} renders as the closing section; empty foot leaves no gap", () => {
    const withFoot: IToolEntry<ICtx> = {
      name: "w_foot",
      args: dna.object({}).meta({ usage: ["Body."], foot: "Closing note." }),
      handler,
    };
    const bare: IToolEntry<ICtx> = {
      name: "no_foot",
      args: dna.object({}).meta({ usage: ["Body."] }),
      handler,
    };
    const c = createCore({ tools: [withFoot, bare], ctx: { db: "" } });
    expect(buildToolHelp(c, "w_foot")).toContain("Body.\n\nClosing note.");
    expect(buildToolHelp(c, "w_foot").endsWith("Closing note.")).toBe(true);
    const out = buildToolHelp(c, "no_foot");
    expect(out.endsWith("Body.")).toBe(true);
    expect(out).not.toMatch(/\n{3,}/);
  });

  it("the meta map overrides the schema's meta when both exist", () => {
    const entry: IToolEntry<ICtx> = {
      name: "both",
      args: dna.object({}).meta({ usage: ["schema usage"], returns: "{ a }" }),
      handler,
    };
    const parts = helpParts(entry, { usage: ["override"], returns: "{ b }" });
    expect(parts.usage).toBe("override");
    expect(parts.return).toBe("{ b }");
  });

  it("category rides the schema meta for list-mode grouping", () => {
    const entry: IToolEntry<ICtx> = {
      name: "cat",
      args: dna.object({}).meta({
        category: { name: "Read & Browse", key: "read", order: 2 },
      }),
      handler,
    };
    expect(entry.args.meta?.()?.category).toEqual({
      name: "Read & Browse",
      key: "read",
      order: 2,
    });
  });

  it("Zod v4: .meta({usage, returns}) feeds the same tokens", () => {
    const entry: IToolEntry<ICtx> = {
      name: "z_meta",
      args: z.object({}).meta({ usage: ["z usage"], returns: "{ z }" }),
      handler,
    };
    const out = buildToolHelp(
      createCore({ tools: [entry], ctx: { db: "" } }),
      "z_meta",
      "{{sig}}\n{{usage}}\n{{return}}",
    );
    expect(out).toBe("z_meta() → { z }\nz usage\n{ z }");
  });
});

describe("describeEntry", () => {
  it("renders types, required marks and descriptions", () => {
    const out = describeEntry(entries[0]!);
    expect(out).toContain("Parameters:");
    expect(out).toContain("-  name (string) — the name [required]");
    expect(out).toContain("-  limit? (int)");
    expect(out).toContain("-  tags? (string[])");
    expect(out).toContain('-  mode? ("a" | "b")');
  });

  it("returns empty string for a schema with no fields", () => {
    expect(describeEntry(entries[1]!)).toBe("");
  });

  it("works with Zod v4 schemas", () => {
    const entry: IToolEntry<ICtx> = {
      name: "zt",
      args: z.object({ who: z.string().describe("who to ping") }),
      handler,
    };
    expect(describeEntry(entry)).toContain("-  who (string) — who to ping [required]");
  });

  it("works with fromJsonSchema documents", () => {
    const entry: IToolEntry<ICtx> = {
      name: "jt",
      args: fromJsonSchema({
        type: "object",
        properties: { q: { type: "string", description: "query" } },
        required: ["q"],
      }),
      handler,
    };
    expect(describeEntry(entry)).toContain("-  q (string) — query [required]");
  });
});

describe("compactSig", () => {
  it("renders name(req, opt?)", () => {
    expect(compactSig(entries[0]!)).toBe("greet(name, limit?, tags?, mode?)");
    expect(compactSig(entries[1]!)).toBe("ping()");
  });

  it("appends the return shape when provided", () => {
    expect(compactSig(entries[0]!, "{ greeting }")).toBe(
      "greet(name, limit?, tags?, mode?) → { greeting }",
    );
  });
});

describe("buildToolHelp", () => {
  it("renders all tokens for one tool", () => {
    const out = buildToolHelp(
      core,
      "greet",
      "{{name}}: {{desc}}\n{{sig}}\n{{args}}\n{{usage}}\n{{return}}",
      { greet: { usage: ["Use it to greet.", "Politely."], returns: "{ greeting }" } },
    );
    expect(out).toContain("greet: Greets by name.");
    expect(out).toContain("greet(name, limit?, tags?, mode?) → { greeting }");
    expect(out).toContain("Parameters:");
    expect(out).toContain("Use it to greet.\n\nPolitely.");
    expect(out).toContain("{ greeting }");
  });

  it("returns empty string for an unknown tool", () => {
    expect(buildToolHelp(core, "nope")).toBe("");
  });

  it("lists every tool compactly when no name is given", () => {
    const out = buildToolHelp(core);
    expect(out).toContain("`greet`: Greets by name. — `greet(name, limit?, tags?, mode?)`");
    expect(out).toContain("`ping`: No-arg ping. — `ping()`");
  });

  it("applies a custom template per tool in list mode", () => {
    const out = buildToolHelp(core, undefined, "- {{name}} {{sig}}");
    expect(out).toBe(
      "- greet greet(name, limit?, tags?, mode?)\n- ping ping()",
    );
  });

  it("preserves unknown tokens verbatim", () => {
    expect(buildToolHelp(core, "ping", "{{name}} {{bogus}}")).toBe("ping {{bogus}}");
  });
});

describe("helpParts", () => {
  it("returns the rendered parts map for one entry", () => {
    const parts = helpParts(entries[0]!, {
      usage: ["Use it."],
      returns: "{ greeting }",
    });
    expect(parts).toEqual({
      name: "greet",
      desc: "Greets by name.",
      sig: "greet(name, limit?, tags?, mode?) → { greeting }",
      args: describeEntry(entries[0]!),
      usage: "Use it.",
      return: "{ greeting }",
      foot: "",
    });
  });

  it("defaults domain parts to empty strings without meta", () => {
    const parts = helpParts(entries[1]!);
    expect(parts.usage).toBe("");
    expect(parts.return).toBe("");
    expect(parts.args).toBe("");
  });
});

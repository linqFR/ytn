// Tests for describeSignature (auto-generated from DNA schemas) and help() merge.
import { describe, it, expect } from "vitest";
import { help } from "../src/server/tools/read.js";
import { describeToolSignature, describeSignature } from "../src/server/tools/describe-signature.js";
import * as S from "../src/shared/schemas/tool-inputs.js";
import { helpInput } from "../src/server/definitions/tools.js";

describe("describeSignature — auto-generated from DNA schema + .describe() metadata", () => {
  it("generates types and descriptions for register_writer", () => {
    const sig = describeSignature(S.registerWriterInput);
    expect(sig).toContain("id (string)");
    expect(sig).toContain('role ("admin" | "agent")');
    expect(sig).toContain("responsibility? (string)");
    // Description from .describe()
    expect(sig).toContain("Unique writer identifier");
  });

  it("generates enum types for create_decision", () => {
    const sig = describeSignature(S.createDecisionInput);
    expect(sig).toContain("nanoid (string)");
    expect(sig).toContain("title (string)");
    expect(sig).toContain("forcedNumId? (int)");
  });

  it("generates array types for create_action dependencies", () => {
    const sig = describeSignature(S.createActionInput);
    expect(sig).toContain("dependencies? (string[])");
  });

  it("generates date types for append_log_entry", () => {
    const sig = describeSignature(S.appendLogEntryInput);
    expect(sig).toContain("date (");
    expect(sig).toContain("[required]");
  });

  it("returns signature for helpInput (now has tool? field)", () => {
    const sig = describeSignature(helpInput);
    expect(sig).toContain("tool? (");
  });

  it("reads .describe() metadata from optional fields", () => {
    const sig = describeSignature(S.listDecisionsInput);
    expect(sig).toContain("status? (");
    expect(sig).toContain("Filter by status");
  });
});

describe("describeToolSignature — by tool name", () => {
  it("returns signature for register_writer", () => {
    const sig = describeToolSignature("register_writer");
    expect(sig).toContain("Parameters:");
    expect(sig).toContain("id (string)");
  });

  it("returns empty for tools without schema (get_handoff)", () => {
    const sig = describeToolSignature("get_handoff");
    expect(sig).toBe("");
  });
});

describe("help() — compact index (no args)", () => {
  it("contains tool names and param signatures", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("register_writer(");
    expect(text).toContain("create_decision(");
    expect(text).toContain("append_log_entry(");
  });

  it("contains Getting Started and How-To sections", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("## Getting Started");
    expect(text).toContain("## How-To");
    expect(text).toContain("## Docs");
  });

  it("contains Notes section with scope/date guidance", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("## Notes");
    expect(text).toContain("nanoid");
    expect(text).toContain("HH:MM");
  });
});

describe("help({ tool }) — detailed mode", () => {
  it("contains auto-generated enum types from DNA schema", () => {
    const result = help({} as never, { tool: "register_writer" });
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain('"admin" | "agent"');
  });

  it("contains .describe() metadata", () => {
    const result = help({} as never, { tool: "register_writer" });
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("Unique writer identifier");
  });

  it("contains return shape from meta.ts", () => {
    const result = help({} as never, { tool: "register_writer" });
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("{ id, nanoid");
  });

  it("contains auto-generated int type for forcedNumId", () => {
    const result = help({} as never, { tool: "create_decision" });
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("forcedNumId? (int)");
  });

  it("rejects unknown tool name", () => {
    const result = help({} as never, { tool: "nonexistent" });
    expect(result.isError).toBe(true);
  });
});

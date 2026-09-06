// Tests for describeSignature (auto-generated from DNA schemas) and help() merge.
import { describe, it, expect } from "vitest";
import { help } from "../src/tools/read.js";
import { describeToolSignature, describeSignature } from "../src/tools/describe-signature.js";
import * as S from "../src/schemas/tool-inputs.js";

describe("describeSignature — auto-generated from DNA schema + .describe() metadata", () => {
  it("generates types and descriptions for register_writer", () => {
    const sig = describeSignature(S.registerWriterInput);
    expect(sig).toContain("id (string, required)");
    expect(sig).toContain('role ("admin" | "agent", required)');
    expect(sig).toContain("responsibility? (string, optional)");
    // Description from .describe()
    expect(sig).toContain("Unique writer identifier");
  });

  it("generates enum types for create_decision", () => {
    const sig = describeSignature(S.createDecisionInput);
    expect(sig).toContain("nanoid (string, required)");
    expect(sig).toContain("title (string, required)");
    expect(sig).toContain("forcedNumId? (int, optional)");
  });

  it("generates array types for create_action dependencies", () => {
    const sig = describeSignature(S.createActionInput);
    expect(sig).toContain("dependencies? (string[], optional)");
  });

  it("generates date types for append_log_entry", () => {
    const sig = describeSignature(S.appendLogEntryInput);
    expect(sig).toContain("date (");
    expect(sig).toContain("required)");
  });

  it("returns empty for empty object schema (helpInput)", () => {
    const sig = describeSignature(S.helpInput);
    expect(sig).toBe("");
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
    expect(sig).toContain("id (string, required)");
  });

  it("returns empty for tools without schema (get_handoff)", () => {
    const sig = describeToolSignature("get_handoff");
    expect(sig).toBe("");
  });
});

describe("help() — merged output", () => {
  it("contains auto-generated enum types from DNA schema", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain('"admin" | "agent"');
  });

  it("contains .describe() metadata", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("Unique writer identifier");
  });

  it("contains Returns: blocks from meta.ts", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("Returns:");
  });

  it("contains auto-generated int type for forcedNumId", () => {
    const result = help({} as never, {});
    const text = Array.isArray(result.content)
      ? result.content.map((c: { text?: string }) => c.text ?? "").join("")
      : String(result.content);
    expect(text).toContain("forcedNumId? (int, optional)");
  });
});

/**
 * handlers.test.ts — Tests for hook event handlers.
 *
 * Handlers return structured output objects (or null for silence).
 * Tests verify the returned object structure directly.
 */

import { describe, it, expect, vi } from "vitest";
import type { HookContext } from "../src/config/types.ts";
import type { McpClient, tsWriterRow, tsLogEntryRow } from "@ytrynot/gov-mcp/client";
import { stop } from "../src/config/handlers/stop.ts";
import { sessionStart } from "../src/config/handlers/session-start.ts";
import { userPromptSubmit } from "../src/config/handlers/user-prompt-submit.ts";
import { postCompaction } from "../src/config/handlers/post-compaction.ts";
import { postToolUse } from "../src/config/handlers/post-tool-use.ts";

function mockWriter(overrides: Partial<tsWriterRow> = {}): tsWriterRow {
  return {
    id: "w1",
    nanoid: "n1",
    role: "dev",
    responsibility: "code",
    default_scope: "workspace",
    display_name: "Test Writer",
    objective: "build",
    expertise: "ts",
    prohibitions: "none",
    last_read_at: "",
    created_at: "",
    ...overrides,
  };
}

function mockLogEntry(overrides: Partial<tsLogEntryRow> = {}): tsLogEntryRow {
  return {
    id: 1265,
    date: "2026-09-08",
    timestamp: "2026-09-08T00:00:00Z",
    type: "problem",
    author: null,
    audience: null,
    subject: "PB-0095",
    body: null,
    ref_id: null,
    reply_to: null,
    thread_id: null,
    ...overrides,
  };
}

function mockMcp(overrides: Partial<McpClient> = {}): McpClient {
  return {
    whoami: vi.fn(async () => ({ writer: null })),
    get_updates: vi.fn(async () => ({
      entries: [],
      new_cursor: "0",
      max_entry_id: 0,
      has_more: false,
      remaining: 0,
    })),
    get_open_actions: vi.fn(async () => ({ actions: [], count: 0 })),
    get_handoff: vi.fn(async () => ({
      date: "",
      open_actions: [],
      pending_decisions: [],
      active_problems: { critical: [], high: [], medium: [] },
      raw_ideas: [],
      to_test: [],
      architectural_items: [],
    })),
    list_problems: vi.fn(async () => ({ problems: [], count: 0 })),
    list_actions: vi.fn(async () => ({ actions: [], count: 0 })),
    list_decisions: vi.fn(async () => ({ decisions: [], count: 0 })),
    close: vi.fn(async () => {}),
    ...overrides,
  };
}

function mockCtx(overrides: { mcp?: Partial<McpClient>; state?: Partial<HookContext["state"]> } = {}): HookContext {
  const mcp = mockMcp(overrides.mcp);
  return {
    state: {
      getSession: vi.fn(() => undefined),
      upsertSession: vi.fn(),
      setNanoid: vi.fn(),
      incrementStop: vi.fn(),
      setHandoff: vi.fn(),
      touchSession: vi.fn(),
      setTitle: vi.fn(),
      log: vi.fn(),
      getLogs: vi.fn(() => []),
      ...overrides.state,
    },
    mcp,
  };
}

// ── Input fixtures per event ──

const stopInput = {
  hook_event_name: "Stop" as const,
  session_id: "test-123",
  prompt_id: "p1",
  stop_hook_active: false,
};

const sessionStartInput = {
  hook_event_name: "SessionStart" as const,
  session_id: "test-123",
};

const userPromptSubmitInput = {
  hook_event_name: "UserPromptSubmit" as const,
  session_id: "test-123",
  prompt_id: "p1",
  prompt: "do something",
};

const postCompactionInput = {
  hook_event_name: "PostCompaction" as const,
  session_id: "test-123",
  prompt_id: "p1",
  summary: null,
};

function makePostToolUseInput(overrides: Record<string, unknown> = {}) {
  return {
    hook_event_name: "PostToolUse" as const,
    session_id: "test-123",
    prompt_id: "p1",
    tool_name: "edit",
    tool_input: {},
    tool_response: { success: true, output: "", error: null },
    ...overrides,
  };
}

describe("stop handler", () => {
  it("does not block when no nanoid stored", async () => {
    const ctx = mockCtx();
    const result = await stop(stopInput, ctx);

    expect(ctx.state.incrementStop).toHaveBeenCalledWith("test-123");
    expect(result).toBeNull();
  });

  it("blocks with handoff reminder when nanoid present but no handoff written", async () => {
    const ctx = mockCtx({
      state: {
        getSession: vi.fn(() => ({
          session_id: "test-123",
          nanoid: "n1",
          writer_id: "w1",
          last_stop_at: null,
          last_handoff_at: null,
          stop_count: 0,
          created_at: "",
          updated_at: null,
          last_seen_at: null,
          title: null,
        })),
      },
    });
    const result = await stop(stopInput, ctx);

    expect(ctx.state.incrementStop).toHaveBeenCalledWith("test-123");
    expect(result).not.toBeNull();
    expect(result?.decision).toBe("block");
    expect(result?.reason).toContain("[HANDOFF]");
    expect(result?.reason).toContain("append_log_entry");
  });

  it("allows stop when handoff already written", async () => {
    const ctx = mockCtx({
      state: {
        getSession: vi.fn(() => ({
          session_id: "test-123",
          nanoid: "n1",
          writer_id: "w1",
          last_stop_at: null,
          last_handoff_at: "2026-09-10T10:00:00.000Z",
          stop_count: 1,
          created_at: "",
          updated_at: null,
          last_seen_at: null,
          title: null,
        })),
      },
    });
    const result = await stop(stopInput, ctx);

    expect(ctx.state.incrementStop).toHaveBeenCalledWith("test-123");
    expect(result).toBeNull();
  });
});

describe("sessionStart handler", () => {
  it("injects registration reminder when no nanoid stored", async () => {
    const ctx = mockCtx();
    const result = await sessionStart(sessionStartInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[IDENTITY]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("register_me");
  });

  it("injects identity and nanoid when writer found", async () => {
    const ctx = mockCtx({
      state: { getSession: vi.fn(() => ({ session_id: "s1", nanoid: "n1", writer_id: "w1", last_stop_at: null, last_handoff_at: null, stop_count: 0, created_at: "", updated_at: null, last_seen_at: null, title: null })) },
      mcp: { whoami: vi.fn(async () => ({ writer: mockWriter() })) },
    });

    const result = await sessionStart(sessionStartInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[IDENTITY]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("Test Writer");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("build");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[SESSION]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("nanoid: `n1`");
  });
});

describe("userPromptSubmit handler", () => {
  it("injects registration reminder when no nanoid stored", async () => {
    const ctx = mockCtx();
    const result = await userPromptSubmit(userPromptSubmitInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("UserPromptSubmit");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[IDENTITY]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("register_me");
  });

  it("injects mailbox summary and reminder when entries exist", async () => {
    const ctx = mockCtx({
      state: { getSession: vi.fn(() => ({ session_id: "s1", nanoid: "n1", writer_id: "w1", last_stop_at: null, last_handoff_at: null, stop_count: 0, created_at: "", updated_at: null, last_seen_at: null, title: null })) },
      mcp: {
        get_updates: vi.fn(async () => ({ entries: [mockLogEntry()], new_cursor: "2026-09-09T10:00:00.000Z", max_entry_id: 1265, has_more: false, remaining: 0 })),
      },
    });

    const result = await userPromptSubmit(userPromptSubmitInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("UserPromptSubmit");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[MAILBOX]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("1 unread");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[REMINDER]");
  });
});

describe("postCompaction handler", () => {
  it("injects registration reminder when no nanoid stored", async () => {
    const ctx = mockCtx();
    const result = await postCompaction(postCompactionInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("PostCompaction");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[IDENTITY]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("register_me");
  });

  it("re-injects identity after compaction", async () => {
    const ctx = mockCtx({
      state: { getSession: vi.fn(() => ({ session_id: "s1", nanoid: "n1", writer_id: "w1", last_stop_at: null, last_handoff_at: null, stop_count: 0, created_at: "", updated_at: null, last_seen_at: null, title: null })) },
      mcp: { whoami: vi.fn(async () => ({ writer: mockWriter() })) },
    });

    const result = await postCompaction(postCompactionInput, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.hookEventName).toBe("PostCompaction");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[POST-COMPACTION]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[IDENTITY]");
  });
});

describe("postToolUse handler — nanoid capture", () => {
  it("captures nanoid from Devin wrapper with JSON sentinel", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__register_me",
      tool_input: { id: "devin-test", role: "agent" },
      tool_response: {
        success: true,
        output: 'Writer devin-test registered.\n\nNanoid: abc123XYZ789\n\nStore this nanoid securely.\n```json\n{"mcp_output":{"id":"devin-test","nanoid":"abc123XYZ789","role":"agent"}}\n```',
        error: null,
      },
    });

    const result = await postToolUse(input, ctx);

    expect(ctx.state.setNanoid).toHaveBeenCalledWith("test-123", "abc123XYZ789", "devin-test");
    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.additionalContext).toContain("`abc123XYZ789`");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("captured");
  });

  it("captures nanoid from mcp_call_tool wrapper with JSON sentinel", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp_call_tool",
      tool_input: {
        server_name: "gov-test-mcp",
        tool_name: "register_writer",
        arguments: { id: "devin-test-2", role: "agent" },
      },
      tool_response: {
        success: true,
        output: 'Writer devin-test-2 registered.\n\nNanoid: XYZ987abc456\n\nStore this securely.\n```json\n{"mcp_output":{"id":"devin-test-2","nanoid":"XYZ987abc456","role":"agent"}}\n```',
        error: null,
      },
    });

    const result = await postToolUse(input, ctx);

    expect(ctx.state.setNanoid).toHaveBeenCalledWith("test-123", "XYZ987abc456", "devin-test-2");
    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.additionalContext).toContain("captured");
  });

  it("falls back to regex when JSON sentinel is absent", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__register_me",
      tool_input: { id: "devin-old", role: "agent" },
      tool_response: {
        success: true,
        output: "Writer devin-old registered.\n\nNanoid: legacyNanoid123\n\nStore this securely.\nid: devin-old",
        error: null,
      },
    });

    await postToolUse(input, ctx);

    expect(ctx.state.setNanoid).toHaveBeenCalledWith("test-123", "legacyNanoid123", "devin-old");
  });

  it("does not capture nanoid from non-registration MCP tools", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__whoami",
      tool_input: { nanoid: "abc123" },
      tool_response: {
        success: true,
        output: 'id: devin-test\nrole: agent\n```json\n{"mcp_output":{"id":"devin-test","role":"agent"}}\n```',
        error: null,
      },
    });

    const result = await postToolUse(input, ctx);

    expect(ctx.state.setNanoid).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("does not capture nanoid when registration fails", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__register_me",
      tool_input: { id: "devin-test", role: "agent" },
      tool_response: {
        success: false,
        output: 'Validation failed:\nWriter devin-test already exists\n```json\n{"mcp_output":{}}\n```',
        error: "Writer devin-test already exists",
      },
    });

    const result = await postToolUse(input, ctx);

    expect(ctx.state.setNanoid).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe("postToolUse handler — prohibited patterns", () => {
  it("detects 'as any' in edit content", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "edit",
      tool_input: { new_string: "const x = obj as any;" },
      tool_response: { success: true, output: "", error: null },
    });

    const result = await postToolUse(input, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[REMINDER]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("as any");
  });

  it("detects 'as unknown as' in write content", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "write",
      tool_input: { content: "const y = val as unknown as string;" },
      tool_response: { success: true, output: "", error: null },
    });

    const result = await postToolUse(input, ctx);

    expect(result).not.toBeNull();
    expect(result?.hookSpecificOutput?.additionalContext).toContain("[REMINDER]");
    expect(result?.hookSpecificOutput?.additionalContext).toContain("as unknown as");
  });

  it("does not flag clean code", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "edit",
      tool_input: { new_string: "const x = typeof obj === 'string' ? obj : String(obj);" },
      tool_response: { success: true, output: "", error: null },
    });

    const result = await postToolUse(input, ctx);
    expect(result).toBeNull();
  });
});

describe("postToolUse handler — handoff detection", () => {
  it("calls setHandoff when append_log_entry with type=handoff is called directly", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__append_log_entry",
      tool_input: { type: "handoff", subject: "Session handoff", body: "Progress: ..." },
      tool_response: { success: true, output: "Log entry appended", error: null },
    });

    await postToolUse(input, ctx);

    expect(ctx.state.setHandoff).toHaveBeenCalledWith("test-123");
  });

  it("calls setHandoff when append_log_entry with type=handoff via mcp_call_tool wrapper", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp_call_tool",
      tool_input: {
        server_name: "gov-test-mcp",
        tool_name: "append_log_entry",
        arguments: { type: "handoff", subject: "Handoff", body: "Done" },
      },
      tool_response: { success: true, output: "Log entry appended", error: null },
    });

    await postToolUse(input, ctx);

    expect(ctx.state.setHandoff).toHaveBeenCalledWith("test-123");
  });

  it("does not call setHandoff when append_log_entry with type != handoff", async () => {
    const ctx = mockCtx();
    const input = makePostToolUseInput({
      tool_name: "mcp__gov-test-mcp__append_log_entry",
      tool_input: { type: "decision", subject: "Decision log", body: "..." },
      tool_response: { success: true, output: "Log entry appended", error: null },
    });

    await postToolUse(input, ctx);

    expect(ctx.state.setHandoff).not.toHaveBeenCalled();
  });
});

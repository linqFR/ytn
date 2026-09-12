/**
 * schema.test.ts — Tests for hook DNA schemas.
 *
 * Covers input discriminated union validation for all hook events,
 * and output schema validation for each response type.
 */

import { describe, it, expect } from "vitest";
import {
  hookInputSchema,
  HOOK_EVENTS,
  decisionBlockSchema,
  additionalContextBlockSchema,
  updateInputBlockSchema,
  responseSchema,
} from "../src/core/schema.ts";

describe("hookInputSchema (discriminated union)", () => {
  it("accepts SessionStart with source", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "SessionStart",
      session_id: "s1",
      source: "user",
    });
    expect(result.success).toBe(true);
  });

  it("accepts SessionStart without source", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "SessionStart",
      session_id: "s1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts UserPromptSubmit with prompt", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      prompt_id: "p1",
      prompt: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects UserPromptSubmit missing prompt", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      prompt_id: "p1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts Stop with stop_hook_active", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "Stop",
      session_id: "s1",
      prompt_id: "p1",
      stop_hook_active: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts PostCompaction with null summary", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "PostCompaction",
      session_id: "s1",
      prompt_id: "p1",
      summary: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts PostCompaction with summary string", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "PostCompaction",
      session_id: "s1",
      prompt_id: "p1",
      summary: "compacted context",
    });
    expect(result.success).toBe(true);
  });

  it("accepts SessionEnd with reason", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "SessionEnd",
      session_id: "s1",
      prompt_id: "p1",
      reason: "user ended",
    });
    expect(result.success).toBe(true);
  });

  it("accepts PreToolUse with tool_name and tool_input", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "PreToolUse",
      session_id: "s1",
      prompt_id: "p1",
      tool_name: "exec",
      tool_input: { command: "ls" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts PostToolUse with tool_response", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "PostToolUse",
      session_id: "s1",
      prompt_id: "p1",
      tool_name: "exec",
      tool_input: { command: "ls" },
      tool_response: { success: true, output: "file.txt", error: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts PermissionRequest with tool_name and tool_input", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "PermissionRequest",
      session_id: "s1",
      prompt_id: "p1",
      tool_name: "exec",
      tool_input: { command: "rm -rf /" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all declared hook events", () => {
    const fixtures: Record<string, Record<string, unknown>> = {
      SessionStart: { session_id: "s1" },
      UserPromptSubmit: { session_id: "s1", prompt_id: "p1", prompt: "x" },
      Stop: { session_id: "s1", prompt_id: "p1", stop_hook_active: false },
      PostCompaction: { session_id: "s1", prompt_id: "p1", summary: null },
      SessionEnd: { session_id: "s1", prompt_id: "p1", reason: "done" },
      PreToolUse: { session_id: "s1", prompt_id: "p1", tool_name: "exec", tool_input: {} },
      PostToolUse: { session_id: "s1", prompt_id: "p1", tool_name: "exec", tool_input: {}, tool_response: { success: true, output: "", error: null } },
      PermissionRequest: { session_id: "s1", prompt_id: "p1", tool_name: "exec", tool_input: {} },
      PostSetupWorktree: { session_id: "s1" },
    };
    for (const event of HOOK_EVENTS) {
      const payload = { hook_event_name: event, ...fixtures[event] };
      const result = hookInputSchema.safeParse(payload);
      expect(result.success, `event=${event}`).toBe(true);
    }
  });

  it("rejects unknown event", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "UnknownEvent",
      session_id: "s1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing session_id", () => {
    const result = hookInputSchema.safeParse({
      hook_event_name: "SessionStart",
    });
    expect(result.success).toBe(false);
  });
});

describe("output schemas", () => {
  it("decisionBlockSchema accepts block with reason", () => {
    const result = decisionBlockSchema.safeParse({
      decision: "block",
      reason: "Write a handoff first",
    });
    expect(result.success).toBe(true);
  });

  it("decisionBlockSchema accepts approve with reason", () => {
    const result = decisionBlockSchema.safeParse({
      decision: "approve",
      reason: "All good",
    });
    expect(result.success).toBe(true);
  });

  it("decisionBlockSchema rejects empty reason", () => {
    const result = decisionBlockSchema.safeParse({
      decision: "block",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("additionalContextBlockSchema accepts context", () => {
    const result = additionalContextBlockSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "Remember to test",
      },
    });
    expect(result.success).toBe(true);
  });

  it("additionalContextBlockSchema rejects empty context", () => {
    const result = additionalContextBlockSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "",
      },
    });
    expect(result.success).toBe(false);
  });

  it("updateInputBlockSchema accepts updatedInput", () => {
    const result = updateInputBlockSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: { command: "rtk git status" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("responseSchema accepts decision block", () => {
    const result = responseSchema.safeParse({
      decision: "block",
      reason: "Blocked",
    });
    expect(result.success).toBe(true);
  });

  it("responseSchema accepts additionalContext", () => {
    const result = responseSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "Welcome",
      },
    });
    expect(result.success).toBe(true);
  });

  it("responseSchema accepts updatedInput", () => {
    const result = responseSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: { command: "safe command" },
      },
    });
    expect(result.success).toBe(true);
  });
});

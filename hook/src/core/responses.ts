/**
 * responses.ts — Hook output builders.
 *
 * Pure builders — return structured objects, no validation.
 * Validation is done by handlerSchema.implementAsync() at the handler level.
 * The engine JSON.stringify's the validated object to stdout.
 */

import type {
  tsDecisionBlock,
  tsAdditionalContextBlock,
  tsUpdateInputBlock,
  tsHookEvent,
} from "./schema.ts";

// ── Builders ──

export function decisionBlock(decision: "block" | "approve", reason: string): tsDecisionBlock {
  return { decision, reason };
}

export function additionalContext<E extends tsHookEvent>(event: E, context: string): { hookEventName: E; additionalContext: string } {
  return { hookEventName: event, additionalContext: context };
}

export function updateInput<E extends tsHookEvent>(event: E, input: Record<string, unknown>): { hookEventName: E; updatedInput: Record<string, unknown> } {
  return { hookEventName: event, updatedInput: input };
}

// ── Per-handler helpers ──

export const sessionStart = {
  add: (prompt: string) => additionalContext("SessionStart", prompt),
}

export const userPromptSubmit = {
  add: (prompt: string) => additionalContext("UserPromptSubmit", prompt),
}

export const postToolUse = {
  add: (prompt: string) => additionalContext("PostToolUse", prompt),
}

export const postCompaction = {
  add: (prompt: string) => additionalContext("PostCompaction", prompt),
}

export const stop = {
  block: (reason: string) => decisionBlock("block", reason),
  approve: (reason: string) => decisionBlock("approve", reason),
}

export const preToolUse = {
  updateInput: (input: Record<string, unknown>) => updateInput("PreToolUse", input),
  block: (reason: string) => decisionBlock("block", reason),
}

export const permissionRequest = {
  approve: (reason: string) => decisionBlock("approve", reason),
  block: (reason: string) => decisionBlock("block", reason),
}

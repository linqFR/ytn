/**
 * schema.ts — DNA schemas for Devin CLI hook inputs and outputs.
 *
 * Input:  discriminated union on `hook_event_name` (what Devin sends on stdin).
 * Output: per-event response schemas (what handlers return on stdout).
 *
 * Types are inferred from DNA schemas — no manual type duplication.
 */

import { dna } from "@ytrynot/dna";

// ── Hook events ──

export const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "PostCompaction",
  "SessionEnd",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "PostSetupWorktree",
];

const hookEventNameSchema = dna.literal([
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "PostCompaction",
  "SessionEnd",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "PostSetupWorktree",
]);
export type tsHookEvent = dna.infer<typeof hookEventNameSchema>;

// ── Shared input fields ──

const sessionIdSchema = dna.string();
const promptIdSchema = dna.string().optional(); // absent for SessionStart
const toolNameSchema = dna.string();
const toolInputSchema = dna.object({}).loose();
const toolResponseSchema = dna.object({
  success: dna.boolean(),
  output: dna.string(),
  error: dna.string().nullable(),
});

// ── Input schemas per event (what Devin CLI sends on stdin) ──

export const sessionStartInputSchema = dna.object({
  hook_event_name: dna.literal("SessionStart"),
  session_id: sessionIdSchema,
  source: dna.string().optional(),
});

export const userPromptSubmitInputSchema = dna.object({
  hook_event_name: dna.literal("UserPromptSubmit"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  prompt: dna.string(),
});

export const stopInputSchema = dna.object({
  hook_event_name: dna.literal("Stop"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  stop_hook_active: dna.boolean(),
});

export const postCompactionInputSchema = dna.object({
  hook_event_name: dna.literal("PostCompaction"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  summary: dna.string().nullable(),
});

export const sessionEndInputSchema = dna.object({
  hook_event_name: dna.literal("SessionEnd"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  reason: dna.string(),
});

export const preToolUseInputSchema = dna.object({
  hook_event_name: dna.literal("PreToolUse"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  tool_name: toolNameSchema,
  tool_input: toolInputSchema,
});

export const postToolUseInputSchema = dna.object({
  hook_event_name: dna.literal("PostToolUse"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  tool_name: toolNameSchema,
  tool_input: toolInputSchema,
  tool_response: toolResponseSchema,
});

export const permissionRequestInputSchema = dna.object({
  hook_event_name: dna.literal("PermissionRequest"),
  session_id: sessionIdSchema,
  prompt_id: promptIdSchema,
  tool_name: toolNameSchema,
  tool_input: toolInputSchema,
});

// PostSetupWorktree is not documented — accept any fields
export const postSetupWorktreeInputSchema = dna.looseObject({
  hook_event_name: dna.literal("PostSetupWorktree"),
  session_id: sessionIdSchema,
});

// ── Input discriminated union ──

export const hookInputSchema = dna.discriminatedUnion("hook_event_name", [
  sessionStartInputSchema,
  userPromptSubmitInputSchema,
  stopInputSchema,
  postCompactionInputSchema,
  sessionEndInputSchema,
  preToolUseInputSchema,
  postToolUseInputSchema,
  permissionRequestInputSchema,
  postSetupWorktreeInputSchema,
]);

// ── Per-event inferred input types ──

export type tsSessionStartInput = dna.infer<typeof sessionStartInputSchema>;
export type tsUserPromptSubmitInput = dna.infer<typeof userPromptSubmitInputSchema>;
export type tsStopInput = dna.infer<typeof stopInputSchema>;
export type tsPostCompactionInput = dna.infer<typeof postCompactionInputSchema>;
export type tsSessionEndInput = dna.infer<typeof sessionEndInputSchema>;
export type tsPreToolUseInput = dna.infer<typeof preToolUseInputSchema>;
export type tsPostToolUseInput = dna.infer<typeof postToolUseInputSchema>;
export type tsPermissionRequestInput = dna.infer<typeof permissionRequestInputSchema>;

// ── Output schemas (what handlers return on stdout) ──

const decisionSchema = dna.literal(["block", "approve"]);
const reasonSchema = dna.string().min(1);

export const decisionBlockSchema = dna.object({
  decision: decisionSchema,
  reason: reasonSchema,
});

const specificOutputBaseSchema = dna.object({
  hookEventName: hookEventNameSchema,
});

export const additionalContextBlockSchema = specificOutputBaseSchema.extend({
  additionalContext: dna.string().min(1),
});

export const updateInputBlockSchema = specificOutputBaseSchema.extend({
  updatedInput: dna.object({}).loose(),
});

export type tsDecisionBlock = dna.infer<typeof decisionBlockSchema>;
export type tsAdditionalContextBlock = dna.infer<typeof additionalContextBlockSchema>;
export type tsUpdateInputBlock = dna.infer<typeof updateInputBlockSchema>;

// ── Per-event output schemas ──
// All nullable — null means silence (no stdout output).
// Each has its own hookEventName literal (not the union).

export const sessionStartOutputSchema = dna.object({
  hookEventName: dna.literal("SessionStart"),
  additionalContext: dna.string().min(1),
}).nullable();

export const userPromptSubmitOutputSchema = dna.object({
  hookEventName: dna.literal("UserPromptSubmit"),
  additionalContext: dna.string().min(1),
}).nullable();

export const postToolUseOutputSchema = dna.object({
  hookEventName: dna.literal("PostToolUse"),
  additionalContext: dna.string().min(1),
}).nullable();

export const postCompactionOutputSchema = dna.object({
  hookEventName: dna.literal("PostCompaction"),
  additionalContext: dna.string().min(1),
}).nullable();

// Stop: decision + reason only (null = allow stop silently)
export const stopOutputSchema = decisionBlockSchema.nullable();

// PreToolUse: updatedInput OR decision block (null = allow tool)
export const preToolUseOutputSchema = dna.union([
  updateInputBlockSchema,
  decisionBlockSchema,
]).nullable();

// PermissionRequest: decision only (null = default behavior)
export const permissionRequestOutputSchema = decisionBlockSchema.nullable();

// SessionEnd: no output
export const sessionEndOutputSchema = dna.null();

// ── Per-event inferred output types ──

export type tsSessionStartOutput = dna.infer<typeof sessionStartOutputSchema>;
export type tsUserPromptSubmitOutput = dna.infer<typeof userPromptSubmitOutputSchema>;
export type tsStopOutput = dna.infer<typeof stopOutputSchema>;
export type tsPostCompactionOutput = dna.infer<typeof postCompactionOutputSchema>;
export type tsPreToolUseOutput = dna.infer<typeof preToolUseOutputSchema>;
export type tsPostToolUseOutput = dna.infer<typeof postToolUseOutputSchema>;
export type tsPermissionRequestOutput = dna.infer<typeof permissionRequestOutputSchema>;
export type tsSessionEndOutput = dna.infer<typeof sessionEndOutputSchema>;

export type tsPostSetupWorktreeInput = dna.infer<typeof postSetupWorktreeInputSchema>;

// ── Structured hook response union ──

export const responseSchema = dna.union([
  decisionBlockSchema,
  additionalContextBlockSchema,
  updateInputBlockSchema,
]);
export type tsHookResponse = dna.infer<typeof responseSchema>;

// ── Hook handler schemas: (input, ctx) => output ──
// One schema per event — DNA validates that the handler accepts the right
// input type and produces the right output type.
// ctx is dna.any() (untyped, injected by the engine — any is bidirectionally
// assignable, so handlers with ctx: C pass implementAsync without cast).

export const sessionStartHandlerSchema = dna.function({
  input: [sessionStartInputSchema, dna.any()],
  output: sessionStartOutputSchema,
});

export const userPromptSubmitHandlerSchema = dna.function({
  input: [userPromptSubmitInputSchema, dna.any()],
  output: userPromptSubmitOutputSchema,
});

export const stopHandlerSchema = dna.function({
  input: [stopInputSchema, dna.any()],
  output: stopOutputSchema,
});

export const postCompactionHandlerSchema = dna.function({
  input: [postCompactionInputSchema, dna.any()],
  output: postCompactionOutputSchema,
});

export const sessionEndHandlerSchema = dna.function({
  input: [sessionEndInputSchema, dna.any()],
  output: sessionEndOutputSchema,
});

export const preToolUseHandlerSchema = dna.function({
  input: [preToolUseInputSchema, dna.any()],
  output: preToolUseOutputSchema,
});

export const postToolUseHandlerSchema = dna.function({
  input: [postToolUseInputSchema, dna.any()],
  output: postToolUseOutputSchema,
});

export const permissionRequestHandlerSchema = dna.function({
  input: [permissionRequestInputSchema, dna.any()],
  output: permissionRequestOutputSchema,
});

// ── Handler schemas namespace ──
// Single object so the engine can iterate events and call implementAsync per handler.
export const handlerSchemas = {
  SessionStart: sessionStartHandlerSchema,
  UserPromptSubmit: userPromptSubmitHandlerSchema,
  Stop: stopHandlerSchema,
  PostCompaction: postCompactionHandlerSchema,
  PostToolUse: postToolUseHandlerSchema,
  SessionEnd: sessionEndHandlerSchema,
  PreToolUse: preToolUseHandlerSchema,
  PermissionRequest: permissionRequestHandlerSchema,
} as const;

// Events with handlers (PostSetupWorktree excluded — no handler, uses dna.undefined()).
export const handlerEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "PostCompaction",
  "PostToolUse",
  "SessionEnd",
  "PreToolUse",
  "PermissionRequest",
] as const;

export type tsHandlerEvent = (typeof handlerEvents)[number];

// ── Handler map type ──
// NOTE: dna.infer gives SYNC function types (tsFunctionType is sync), but
// implementAsync returns async functions. So tsHandlerMap is defined manually
// with Promise return types to match implementAsync's output.

export type tsHandlerMap<C = unknown> = {
  SessionStart: (input: tsSessionStartInput, ctx: C) => Promise<tsSessionStartOutput>;
  UserPromptSubmit: (input: tsUserPromptSubmitInput, ctx: C) => Promise<tsUserPromptSubmitOutput>;
  Stop: (input: tsStopInput, ctx: C) => Promise<tsStopOutput>;
  PostCompaction: (input: tsPostCompactionInput, ctx: C) => Promise<tsPostCompactionOutput>;
  PostToolUse: (input: tsPostToolUseInput, ctx: C) => Promise<tsPostToolUseOutput>;
  SessionEnd: (input: tsSessionEndInput, ctx: C) => Promise<tsSessionEndOutput>;
  PreToolUse: (input: tsPreToolUseInput, ctx: C) => Promise<tsPreToolUseOutput>;
  PermissionRequest: (input: tsPermissionRequestInput, ctx: C) => Promise<tsPermissionRequestOutput>;
};

/**
 * messages.ts — Configurable message templates injected into agent context.
 *
 * All hook-facing strings live here so they can be tuned without touching
 * formatting logic. Edit these values to change what the agent sees.
 */

export const messages = {
  readBeforeWriteReminder:
    "[REMINDER] Before writing to the mailbox, verify you have read recent entries (`get_updates`). Know your role and prohibitions.",

  registerReminder:
    "[IDENTITY] You have no nanoid to benefit from automatic support and recalls. Call `register_me` on `gov-test-mcp` to register as a writer. You cannot read or write the mailbox without a nanoid.",

  noUnreadMailbox: "[MAILBOX] No unread messages.",
  noOpenActions: "[ACTIONS] No open actions.",

  identityLabel: "[IDENTITY]",
  mailboxLabel: "[MAILBOX]",
  actionsLabel: "[ACTIONS]",
  handoffLabel: "[HANDOFF]",
  handoffReminder:
    "[HANDOFF] Before stopping, leave a handoff log entry via `append_log_entry` (MCP `gov-test-mcp`) with type=`handoff`. Include your current objective, progress, and blockers.",
  reminderLabel: "[REMINDER]",
  compactionLabel: "[POST-COMPACTION] Your context was compacted. Here is your identity:",
  castReminder: `[REMINDER] Prohibited TypeScript casting detected in your last edit.
Type casting (surcasting), over-typing, and over-annotation must be avoided.
Respect the repository's TypeScript rules:
- No \`as any\` — use proper typing instead.
- No \`as unknown as T\` unless strictly necessary with a CAST comment.
- Every cast must be justified with an inline \`// CAST:\` comment above the line.
- Prefer type guards, proper interfaces, or generics over casts.
See .devin/rules/prohibited-hacks-and-code-syntaxes.md for the full rules.`,
  nanoidCaptured: (nanoid: string, sessionId: string) =>
    `[IDENTITY] nanoid \`${nanoid}\` captured and associated with session \`${sessionId}\`. Identity injection is now active.`,

  fields: {
    objective: "Objective",
    responsibility: "Responsibility",
    expertise: "Expertise",
    prohibitions: "Prohibitions",
    scope: "Scope",
  },
} as const;

---
trigger: model_decision
description: when user mentions there are other agents working in the session
---

# **Inter-Session Mailbox**

This rule enables a shared file mechanism to coordinate multiple Devin sessions without copy-paste.

## Mailbox Directories

There are two levels of mailboxes:

- **Package mailbox:** `packages/<pkg>/mailbox/` for sessions primarily scoped to one package.
- **Repo-wide mailbox:** `mailbox/` at the repo root for cross-package or monorepo-wide sessions.

Each mailbox directory must only contain `mailbox-*.md` and `mailbox.md` files. No other file types or names may be placed there.

### Choosing a mailbox

- If your session primarily concerns a single package, use `packages/<pkg>/mailbox/mailbox-YYYY-MM-DD.md`.
- If your session concerns the whole repo or multiple packages, use `mailbox/mailbox-YYYY-MM-DD.md`.
- If the user has specified a mailbox, use that one.

If the directory or the daily file does not exist, create them. The daily file header must be:

`# Devin Mailbox — YYYY-MM-DD`

At the start of a new day, the first agent to write must create a new daily file. Include a brief `handoff` entry that carries over unresolved actions and open questions from the previous day.

The `mailbox.md` archive in the active mailbox directory is a legacy file. Do not delete or modify it. New entries must not be added to it.

## Protocol

### 1. Read Before Acting

You must read the active day's mailbox file before any concrete action on the repo, including:

- editing, creating, or deleting files
- running build, test, or git commands
- launching a subagent
- making a decision that affects the codebase

If the active day's file does not exist, read the previous day's file and the legacy `mailbox/mailbox.md` in the same mailbox directory for context, then create the active day's file.

Before each response, also check the active day's file for messages addressed to you.

### 2. Write When Needed

Add an entry to the active day's mailbox file whenever you have:

- a question for another session
- a challenge or objection to a decision
- an important objective or rule reminder
- a significant status change to share
- an action you are about to start, update, or cancel
- an introduction when you start or join a session (role and objective)
- a reflection, open question, or multi-agent thinking step
- any doubt, ambiguity, or risk worth surfacing

After every concrete action, write a `status` or `action` entry that includes:
- what changed
- what remains
- the approach you used or plan to use

Write a `reflection` immediately when you are unsure. Do not wait until the end of the session.

### 3. Entry Format

Add messages at the top of the daily file (newest first). Use this format:

```markdown
## [YYYY-MM-DD HH:mm] — <type>

**From:** <source>
**For:** <recipient or `all`>
**Subject:** <summary>

<detailed content>
```

Allowed types:
- `objective`: objective or objective reminder
- `question`: question to another session
- `challenge`: contestation / audit / point of attention
- `answer`: answer to a question or challenge
- `status`: progress status
- `reminder`: rule reminder
- `action`: action in progress, with status (see section 7)
- `handoff`: inter-session context transfer
- `reflection`: shared thinking, open questions, options to discuss
- `intro`: self-introduction (role, objective, capabilities)

### 4. Session Identification

- At the start of the session, define a stable `From` identifier for this agent (e.g., `devin-audit`, `devin-impl`, `devin-explore`). If the user has not named you, choose a short descriptive ID and announce it in your first `status` or `handoff` entry.
- Use this identifier consistently in every mailbox entry. Do not change it during the session.
- When reading older messages that do not have a `From` field, infer the source from the heading: `## [YYYY-MM-DD HH:mm] <source> — <type>`.
- To address a specific session, indicate its ID if you know it; otherwise, use `all`.
- A message for a specific session is intended for that recipient. Other sessions may read it, but they must not act on it unless it is explicitly addressed to `all` or they are the intended recipient.

### 5. History Preservation

Never delete or modify any mailbox file. Always append new entries at the top of the daily file to keep a complete, immutable history.

### 6. Concurrency

If you detect that the active day's file has been modified since your last read, re-read it entirely before adding your own message.

### 7. Action and Status Tracking

For every action or modification you consider in the repo, create an `action` entry in the active day's mailbox file **before starting**, then add a new entry at every status change.

Use this format:

```markdown
## [YYYY-MM-DD HH:mm] — action

**Action ID:** <short-unique-id>
**From:** <source>
**Status:** <pending | in_progress | done | cancelled>
**For:** <all or id>
**Subject:** <action summary>

<detailed description>
```

For `done` and `in_progress` entries, the detailed content must include:
- **What changed / what was done**
- **What remains**
- **Approach / how it will be done** (optional)

Allowed statuses:
- `pending`: planned, not started
- `in_progress`: being executed
- `done`: completed
- `cancelled`: abandoned

If the status is `cancelled`, always state **why**: bad idea, objective change, duplicate, blocker, etc.

At every status change, add a new entry with the date and time of the update, keeping the same `Action ID` so the history can be tracked.

### 8. Reflection and Shared Thinking

The mailbox is also a space to think out loud with other agents. Use the `reflection` type when you want to share a partial conclusion, explore options, ask for input, or surface any doubt.

Include at least:
- **What we know:** the current facts or summary
- **What remains:** open questions or next steps
- **Approach:** how you plan to proceed, or options you are considering

When in doubt, write a `reflection` before acting. This makes the mailbox a multi-agent reasoning surface, not just a coordination log.

### 9. Introductions and Targeted Responses

When you start or join a session, write an `intro` entry at the top of the active day’s mailbox:

```markdown
## [YYYY-MM-DD HH:mm] — intro

**From:** <your-id>
**For:** all
**Subject:** <your-id> joins — <short role>

**Role:** <what you are here to do>
**Objective:** <your main goal for this session>
```

If a message is addressed to you (`For: <your-id>`), you must respond with an `answer` or `status` entry, unless the message is explicitly marked as informational. If you cannot respond immediately, write a `status` entry saying when you will.

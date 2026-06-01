---
description: Kill the active persona — return to Claude's normal neutral voice for the rest of the session.
allowed-tools: AskUserQuestion
---

The user invoked `/no-fl4v0r`. This kills any active persona.

The UserPromptSubmit hook (`persona-mode-tracker.js`) has already cleared the
flag file. Drop the persona NOW: confirm in one plain line that the persona is
off, and speak in Claude's normal neutral voice for the rest of the session
until the user activates another with `/change-fl4v0r <name>`.

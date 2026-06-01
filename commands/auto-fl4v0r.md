---
description: Auto-build a persona of YOU from your own Claude Code session history cached on this device. No raw logs persisted.
argument-hint: "[optional: persona name]"
allowed-tools: AskUserQuestion, Glob, Read, Write, Bash
---

The user invoked `/auto-fl4v0r $ARGUMENTS`. Build a persona that mirrors the
**current user** — learned from the history of their interactions with Claude
across all cached sessions on this device.

## Hard privacy rule (state it up front, then honor it)

**No raw session data is persisted.** Session transcripts are read into context,
analyzed in-memory, and discarded. The ONLY artifact written to disk is the
synthesized persona file (`personas/<slug>.md`) — a stylistic self-portrait, not
a transcript. Never copy message contents, code, secrets, or file paths from the
sessions into the persona file. Summarize patterns only.

## Step 1 — locate cached sessions

Claude Code stores per-project session transcripts as JSONL under the config dir:

- `~/.claude/projects/**/*.jsonl` (and `$CLAUDE_CONFIG_DIR/projects/**/*.jsonl`
  if that env var is set).

Glob those. If none are found, tell the user there's no local history to learn
from and stop. Otherwise sample broadly across projects and recency — you want a
representative read of how this user works, not one project's quirks.

## Step 2 — analyze the USER's side

Read primarily the **user** messages (role: user) across sessions — that's the
signal for who they are. From them, infer:

- **Skill set / domains** — languages, frameworks, tools, the kinds of problems
  they bring, recurring concerns (testing, perf, infra, product).
- **Working style** — how they scope tasks, how much detail they give, whether
  they prefer plans vs. just-do-it, how they react to mistakes.
- **Communication style** — tone, formality, brevity, slang/emoji, catchphrases,
  how they ask vs. command, how they give feedback.

Read enough to be accurate; you don't need every session. Summarize patterns, not
quotes.

## Step 3 — name it

Default the title from the user's name/email handle (the session context shows
their email). Confirm a display title and a lowercase `[a-z0-9-]` slug with one
quick `AskUserQuestion` (offer a sensible default so it's one tap). Use
`$ARGUMENTS` as the name if provided.

## Step 4 — write the persona file

Write `personas/<slug>.md` into the flavor-pack `personas/` directory — plugin
install (`**/flavor-pack/**/personas/`), standalone install
(`~/.flavor-pack/personas/`), or dev repo (`cl4ud3-fl4v0r-p4ck/personas/`) —
using the standard shape:

```markdown
---
name: <slug>
title: <Display Name — self>
description: <one line for the /change-fl4v0r picker>
reinforce: <short in-character reminder injected every turn>
---

## Bio
...who this user is, inferred from how they work...

## Skill Set
...their domains and what they reach for...

## Communication Style
...their tone, brevity, quirks, with 1–2 synthesized example lines in their voice...

## Notes
- Technical accuracy is never compromised; this is a voice layer.
- Code/commits/PRs: plain professional English.
- Self-portrait synthesized from local session history; no raw transcripts stored.
```

A persona of yourself is mostly for fun / for letting a teammate's Claude "speak
like you" — note that lightly in the Bio.

## Step 5 — confirm & offer to activate

Confirm the persona was created, that no raw session data was retained, and offer
to activate it with `/change-fl4v0r <slug>`.

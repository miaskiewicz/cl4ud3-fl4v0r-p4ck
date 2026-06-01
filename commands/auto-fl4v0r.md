---
description: Auto-build a persona of YOU from your own Claude Code session history cached on this device. Optionally enrich from connected GitHub/Slack MCP. No raw data persisted.
argument-hint: "[optional: persona name]"
allowed-tools: AskUserQuestion, Glob, Read, Write, Bash, ToolSearch
---

The user invoked `/auto-fl4v0r $ARGUMENTS`. Build a persona that mirrors the
**current user** — learned from the history of their interactions with Claude
across all cached sessions on this device.

**The basis is always the local Claude session history** (Steps 1–2). Connected
GitHub/Slack MCP are *optional enrichment* layered on top (Step 2b) — they sharpen
the voice and surface off-work texture, but the self-portrait must stand on the
Claude sessions alone if no MCP is connected or the user declines.

## Hard privacy rule (state it up front, then honor it)

**No raw data is persisted.** Session transcripts — and any GitHub/Slack content
pulled in Step 2b — are read into context, analyzed in-memory, and discarded. The
ONLY artifact written to disk is the synthesized persona file (`personas/<slug>.md`)
— a stylistic self-portrait, not a transcript. Never copy message contents, code,
secrets, file paths, PR diffs, or Slack messages into the persona file. Summarize
patterns only.

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

## Step 2b — optional enrichment from connected MCP (GitHub / Slack)

This step is **optional and additive** — skip it entirely if no relevant MCP is
connected or the user isn't interested. The Claude sessions (Steps 1–2) remain the
basis. When you do run it, **never fetch any content until the connection is
confirmed live AND the target identity is found by search.** Each source is gated:

First, detect what's available, then offer it. Probe with `ToolSearch`:
- GitHub: query `"github search users pull request comments"`. Usable if real
  GitHub-named tools appear, **or** the `gh` CLI is authed (`gh auth status`).
  Linear/generic tools do not count.
- Slack: query `"slack users lookup conversation history messages"`. Usable only if
  real Slack message/user tools are present. If the only Slack tools are
  `authenticate`/`complete_authentication`, it's connected but **not authorized** —
  tell the user to run `/mcp` → select the Slack connector → authenticate, then
  retry. If neither real tools nor auth stubs exist, there's no Slack MCP.

If at least one is usable, ask the user (one `AskUserQuestion`) whether to enrich
from it, and proceed only for the sources they opt into.

### GitHub (your own activity)
1. **Ask your handle.** Don't assume the connected/authed account is the target —
   ask which GitHub username to profile (default-suggest the authed login).
2. **Search & validate.** Confirm the handle resolves to exactly one real account
   before fetching — MCP user-search/get-user, or `gh api users/<handle>`. Zero or
   ambiguous → show what you found and re-ask. Never proceed on a guess.
3. **Fetch.** Pull a representative sample of *their* authored PRs/commits (code
   style) and review/PR/issue comments **across all repos** they're active in —
   e.g. `gh api -X GET search/issues -f q='commenter:<handle>'` and
   `q='type:pr author:<handle>'`. ~20–30 comments + ~10–20 PRs is enough.

### Slack (your own messages)
1. **Ask which Slack user** (default-suggest the logged-in user) and which channels
   are in scope (e.g. dev channels for work voice, plus #random / #music etc. for
   off-work texture — that personality color is often the most useful enrichment).
2. **Search & validate.** Resolve the name to exactly one Slack user ID via the
   users-lookup tool before fetching. Ambiguous/zero → show candidates and re-ask.
3. **Fetch.** Pull a representative sample of that user's messages from the in-scope
   channels (`from:<@USERID>` + `in:#channel`). Respect the scope; do not range
   outside it.

Fold whatever you find into the Step 2 inferences — sharper communication-style
detail, catchphrases, off-work quirks/cultural references. Summarize patterns only;
no raw messages, comments, or code land in the file.

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
- Self-portrait synthesized from local Claude session history (optionally enriched
  from your own GitHub/Slack activity by consent); no raw transcripts, messages, or
  code stored.
```

A persona of yourself is mostly for fun / for letting a teammate's Claude "speak
like you" — note that lightly in the Bio.

## Step 5 — confirm & offer to activate

Confirm the persona was created, name which sources fed it (Claude sessions, plus
GitHub/Slack if enriched), confirm no raw data from any source was retained, and
offer to activate it with `/change-fl4v0r <slug>`.

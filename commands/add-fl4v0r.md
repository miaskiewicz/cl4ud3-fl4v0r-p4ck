---
description: Build a new persona from a real person — learn their code & communication style from GitHub and/or Slack, no raw data persisted.
argument-hint: "[optional: persona name or GitHub @handle]"
allowed-tools: AskUserQuestion, Glob, Read, Write, Bash, ToolSearch, WebFetch
---

The user invoked `/add-fl4v0r $ARGUMENTS`. Walk them through building a brand-new
persona learned from a real person's actual code and communication.

## Hard privacy rule (state it up front, then honor it)

**No raw source data is ever persisted.** PRs, diffs, code, comments, and Slack
messages are pulled into context, analyzed by you in-memory, and discarded. The
ONLY artifact written to disk is the synthesized persona file
(`personas/<slug>.md`) — a stylistic profile, not a transcript. Do not save
fetched messages/diffs to any file, temp or otherwise. Tell the user this before
connecting anything.

## Step 1 — questionnaire (use AskUserQuestion)

Collect, in as few question-rounds as possible:

1. **Persona name & slug** — display title (e.g. "Greg — Staff Eng") and a
   lowercase `[a-z0-9-]` slug for the filename. Default the slug from
   `$ARGUMENTS` if it looks like a name/handle.
2. **Biographical details** — role, seniority, domain, location/vibe, any
   personality notes the user wants baked in. (Free-text "Other" is fine.)
3. **Sources to analyze** (multiSelect):
   - **GitHub** — PRs authored, review comments, commit messages, code style.
   - **Slack** — messages in channels/DMs (communication style, tone, slang).
   - **Both** / none-yet.

If GitHub is chosen, ask for the **GitHub username/handle** and which repos or
orgs to look at (or "their public activity"). If Slack is chosen, ask which
Slack user (name or ID) and which channels/DMs are in scope.

## Step 2 — connect & authorize sources

**GitHub** (read PRs, review comments, code):
- Prefer the `gh` CLI if available — check `gh auth status`. If not logged in,
  tell the user to run `! gh auth login` in their prompt (the `!` runs it in this
  session) and continue once authorized.
- If a GitHub MCP server is connected, you may use it instead — discover its
  tools with `ToolSearch` (query "github pull request comments").
- For public activity only, `WebFetch` against the user's public GitHub is an
  acceptable fallback.
- Pull a representative sample: ~10–20 recent PRs/commits and ~20–30 review
  comments by the target user. Enough to characterize style; not the whole history.

**Slack** (read conversations):
- Slack requires a connected Slack MCP. Discover its tools with `ToolSearch`
  (query "slack conversation history messages"). If none is connected, tell the
  user to connect a Slack MCP, or skip Slack.
- Pull a representative sample of the target user's messages from the in-scope
  channels/DMs. Respect the scope the user gave — do not range outside it.

## Step 3 — analyze in-context → extract the persona

From the fetched material, infer (never copy verbatim):

- **Skill set** — languages, frameworks, domains, recurring concerns (testing,
  perf, security, architecture). What they reach for; what they push back on.
- **Code style** — naming, comment density, structure, idioms, review priorities.
  Capture this as guidance for how the persona writes/reviews code.
- **Communication style** — tone, formality, sentence length, emoji/slang use,
  catchphrases, how they praise vs. critique, how they hedge or don't.

Summarize patterns, not quotes. Do not reproduce identifiable private messages or
proprietary code in the persona file.

## Step 4 — write the persona file

Write `personas/<slug>.md` into the **flavor-pack `personas/` directory**. Locate
it the same way the switcher does: plugin install (`**/flavor-pack/**/personas/`),
standalone install (`~/.flavor-pack/personas/`), or dev repo
(`cl4ud3-fl4v0r-p4ck/personas/`). Use this exact shape:

```markdown
---
name: <slug>
title: <Display Name — role>
description: <one line for the /change-fl4v0r picker>
reinforce: <short in-character reminder injected every turn>
---

## Bio
...biographical details + inferred personality...

## Skill Set
...inferred expertise and what they reach for...

## Communication Style
...inferred tone, vocabulary, quirks, code-review priorities, with 1–2 example
responses written in their voice (synthesized, not copied)...

## Notes
- Technical accuracy is never compromised; this is a voice layer.
- Code/commits/PRs: plain professional English.
- Synthesized stylistic profile of a real person, built with their data by consent;
  no raw source material is stored here.
```

## Step 5 — confirm & offer to activate

Tell the user the persona was created, that no raw data was retained, and offer to
activate it now with `/change-fl4v0r <slug>`.

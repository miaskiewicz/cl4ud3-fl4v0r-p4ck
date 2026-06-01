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

Do **not** ask for usernames in this step. Which identity to ask for depends on
which connections are actually live — that is resolved in Step 2, per source.

## Step 2 — detect connection → ask identity → search & validate → only then fetch

For **each** source the user chose, run this gated sequence. **Never fetch any
content until the connection is confirmed live AND the target user has been found
by search.** If a gate fails, stop that source, tell the user exactly what failed,
and offer to skip it or fix it.

### GitHub

1. **Detect connection.** Probe for a connected GitHub MCP first:
   `ToolSearch` with query `"github search users pull request comments"`. A GitHub
   MCP is present only if the result includes GitHub-named tools (e.g.
   `*github*search_users*`, `*github*list_*comments*`) — Linear/generic tools do
   **not** count. If no GitHub MCP, fall back to the `gh` CLI: run
   `gh auth status`. If neither is available, tell the user to either connect a
   GitHub MCP or run `! gh auth login`, then skip GitHub for now.
2. **Ask the username.** Only once a GitHub connection is confirmed, ask the user
   for the **target GitHub username/handle** (via `AskUserQuestion`; default from
   `$ARGUMENTS` if it looks like a handle). Do not assume it is the connected
   account — the target may be someone else.
3. **Search & validate the user.** Look the handle up before fetching anything:
   - MCP: call the GitHub user-search/get-user tool for that login.
   - `gh`: `gh api users/<handle>` (exit 0 + matching `login` = valid).
   Confirm exactly one real account matches. If zero or ambiguous, show what you
   found and re-ask — do **not** proceed on a guess.
4. **Fetch — comments across all repos.** Only after steps 1–3 pass, pull the
   target's **review/PR/issue comments across all repositories** they are active
   in (not a single repo):
   - MCP: use the search/list-comments tools, filtered to `author=<handle>`.
   - `gh`: `gh api -X GET search/issues -f q='commenter:<handle>'` and
     `gh search` to enumerate their comment activity across repos, then fetch
     bodies. Also sample ~10–20 of their authored PRs/commits for code style.
   Pull a representative sample (~20–30 comments + ~10–20 PRs) — enough to
   characterize style, not the entire history. Public-only fallback: `WebFetch`
   the user's public GitHub profile/activity.

### Slack

1. **Detect connection.** `ToolSearch` query `"slack users lookup conversation
   history messages"`. Slack is usable only if real Slack message/user tools are
   present. If the only Slack tools are `authenticate`/`complete_authentication`,
   the server is **connected but not authorized** — tell the user to complete
   Slack auth (run the authenticate tool / approve in browser), then retry. If no
   Slack MCP at all, tell them to connect one or skip Slack.
2. **Ask the user.** Only once Slack is confirmed authorized, ask which **Slack
   user** (display name, @handle, or ID) and which channels/DMs are in scope.
3. **Search & validate the user.** Resolve the name to a real Slack user ID via
   the users-lookup/list tool before fetching. Confirm exactly one match. If zero
   or ambiguous, show candidates and re-ask — do not guess an ID.
4. **Fetch.** Only after 1–3 pass, pull a representative sample of that user's
   messages from the in-scope channels/DMs. Respect the given scope — do not range
   outside it.

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

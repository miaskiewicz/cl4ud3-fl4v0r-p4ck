---
description: Switch the active agent persona. Auto-suggests installed personas when run with no argument.
argument-hint: "[persona name | off]  (e.g. wojtek, isaac, off)"
allowed-tools: Glob, Read, AskUserQuestion
---

The user invoked `/change-fl4v0r $ARGUMENTS`.

## Step 1 — discover installed personas

Find the flavor-pack `personas/` directory and list every `*.md` in it. Check,
in order: the plugin install (`**/flavor-pack/**/personas/*.md`), the standalone
install (`~/.flavor-pack/personas/*.md`), and the dev repo
(`**/cl4ud3-fl4v0r-p4ck/personas/*.md`). For each file, read the frontmatter
`name`, `title`, and `description`. That set is the list of installed personas —
this is your auto-suggest source, so it always reflects what's actually installed
(including personas built via `/add-fl4v0r` and `/auto-fl4v0r`).

## Step 2 — resolve the target

- **If `$ARGUMENTS` is empty:** present the installed personas with
  `AskUserQuestion` (one option per persona, label = title, description =
  the persona's one-line description; plus an "Off / normal voice" option).
  This is the auto-suggest picker. Use the user's selection as the target.
- **If `$ARGUMENTS` is `off` / `stop` / `disable` / `normal`:** target is "off".
- **Otherwise:** fuzzy-match `$ARGUMENTS` against the installed persona `name`s
  (case-insensitive, prefix/substring OK). Exactly one match → that persona.
  Zero or multiple matches → show the picker from the empty case.

## Step 3 — apply

The UserPromptSubmit hook (`persona-mode-tracker.js`) already wrote the flag file
for a recognized `/change-fl4v0r <name>` argument, so the persona spec is in
context. Regardless:

- **Persona target:** adopt it NOW. Read its full spec (bio, skill set,
  communication style) and reply in character, confirming the switch in that
  persona's voice.
- **Off target:** confirm you've dropped the persona and return to your normal
  neutral voice for the rest of the session.

Persona is a voice/personality layer only — technical accuracy, tool use, and
code/commit/security output stay plain and correct.

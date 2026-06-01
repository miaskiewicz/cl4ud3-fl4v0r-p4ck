# cl4ud3-fl4v0r-p4ck README

## wH4t 1z th1s

**cl4ud3-fl4v0r-p4ck** gives the Claude Code agent a **personality**. Pick a
persona — a full character with a **bio**, a **skill set**, and a distinct
**communication style** — and the agent stays in character across the whole
session. The engineering never changes; it's a voice layer bolted on top.

Mechanism is lifted from the [caveman](https://github.com/JuliusBrussee/caveman)
plugin (SessionStart hook injects a ruleset, a flag file + per-turn hook keep it
from drifting). But instead of one fixed compression style, fl4v0r-p4ck ships
**named, swappable personas** — and can **learn new ones** off a real person's
GitHub/Slack, or off your own Claude history.

**Features:**
- 🎭 **Swappable personas** — `/change-fl4v0r wojtek`, the agent talks like Wojtek until you switch
- 🧠 **Three-part spec** — every persona = Bio + Skill Set + Communication Style
- 📌 **Sticks all session** — UserPromptSubmit hook re-anchors the voice every turn, no fade
- 🔎 **Auto-suggest switcher** — bare `/change-fl4v0r` pops a picker of installed personas
- 🕵️ **Learn from a real person** — `/add-fl4v0r` reads their GitHub PRs/comments + Slack to clone style
- 🪞 **Clone yourself** — `/auto-fl4v0r` builds a persona of *you* from local Claude session history
- 🔒 **Zero raw-data retention** — learned material analyzed in-context, only the persona profile hits disk
- 🏷 **Statusline badge** — `[PERSONA:WOJTEK]` so you always know who's talking
- 📂 **Drop-in personas** — add `personas/<name>.md`, it's instantly selectable, no code change

All persona data is plain Markdown. No model fine-tuning, no external service — pure prompt.

## p3rs0n4z (sh1pp3d)

- 💪 **`wojtek`** — Polish gopnik TypeScript veteran. Silicon Valley refugee back in a
  Stalinist concrete block in Podlasie. Tracksuit, vodka, cigarettes, Ponglish,
  brutal honesty. Solid engineering under all the cursing.
- 🐛 **`isaac`** — neurotic QA automation engineer, 32, lives with his mom and his cat
  **Turing**. Socially awkward, pathologically thorough. Finds every edge case,
  every race condition, every bug. Hedges socially, never technically.

## 1nst4ll

This repo **is** the plugin. From inside Claude Code:

```
/plugin marketplace add miaskiewicz/cl4ud3-fl4v0r-p4ck
/plugin install flavor-pack@flavor-pack
```

Or from a local clone:

```
/plugin marketplace add /path/to/cl4ud3-fl4v0r-p4ck
/plugin install flavor-pack@flavor-pack
```

No persona is active until you pick one — personas are opt-in. Restart the
session, then `/change-fl4v0r wojtek`.

### Standalone install (no plugin system)

Prefer the cr4ck-style installer? It copies into `~/.flavor-pack`, registers the
commands + skill under `~/.claude/`, and merges the hooks into
`~/.claude/settings.json` (existing settings preserved, fully idempotent).

```bash
git clone https://github.com/miaskiewicz/cl4ud3-fl4v0r-p4ck.git
cd cl4ud3-fl4v0r-p4ck
bash install.sh        # interactive — asks about the statusline badge
bash install.sh --yes  # non-interactive — installs everything incl. statusline
```

Requires `node` (the hooks are Node scripts). Uninstall: `bash uninstall.sh`.

### Verify

```
/hooks
```

You should see flavor-pack hooks under **SessionStart** and **UserPromptSubmit**.

## c0mm4ndz

Every command has a leetspeak name and a plain `*-persona` alias — both work.

| Command | Alias | What it does |
|---------|-------|--------------|
| `/change-fl4v0r` | `/change-persona` | No arg → auto-suggest picker of installed personas |
| `/change-fl4v0r <name>` | `/change-persona <name>` | Switch to that persona |
| `/change-fl4v0r off` | `/change-persona off` | Drop persona, back to neutral voice |
| `/no-fl4v0r` | `/no-persona` | Kill the active persona — return to normal voice |
| `/add-fl4v0r` | `/add-persona` | Build a persona from a **real person** (GitHub + Slack) |
| `/auto-fl4v0r` | `/auto-persona` | Build a persona of **you** from local Claude history |
| `/review-fl4va <persona> [target]` | `/review-persona <persona> [target]` | Code review in a persona's voice — caveman-review one-liners. Target = diff/branch/file/PR, or empty for current changes |

Natural language works too: *"be wojtek"*, *"talk like isaac"*, *"drop the
persona"*, *"normal mode"*.

## h0w 1t w0rkz

```
.claude-plugin/
  plugin.json          # SessionStart + UserPromptSubmit hooks
  marketplace.json     # installable marketplace entry
commands/              # change/add/auto/no -fl4v0r (+ *-persona aliases)
personas/              # one .md per character — discovered dynamically
  wojtek.md
  isaac.md
skills/persona/        # SKILL.md — describes the mechanism to the agent
src/hooks/
  persona-config.js        # persona discovery + symlink-safe flag IO
  persona-activate.js      # SessionStart: inject the active persona spec
  persona-mode-tracker.js  # UserPromptSubmit: switch + per-turn reinforcement
  persona-statusline.sh    # [PERSONA:NAME] badge (.ps1 for Windows)
```

**Per-session scope.** The active persona is **scoped to each session** — keyed by
`session_id` at `~/.claude/.flavor-pack/sessions/<session_id>.persona`. Run Wojtek
in one repo's tab and another tab / repo / fresh session is unaffected. It is
**not** global across tabs. A new session starts from the configured default
(`off` unless you set one). Old session flags are pruned after 7 days.

SessionStart reads the per-session flag and injects that persona's full spec;
UserPromptSubmit watches each prompt for switches and re-injects a short
in-character reminder so the voice never fades. The statusline and reinforcement
read the flag with caveman-grade hardening — symlinks refused, reads size-capped,
contents validated against `[a-z0-9-]` + existence — so a planted symlink or
escape-sequence payload can never reach the terminal or model context.

## /4dd-fl4v0r — l34rn 4 r34l p3rs0n

Short questionnaire (name, bio, sources), then it connects:

- **GitHub** (via `gh` CLI or a GitHub MCP) — samples their PRs, review comments,
  commit messages, and code → infers **code style** + **skill set**.
- **Slack** (via a connected Slack MCP) — samples their messages → infers
  **communication style**.

Everything is analyzed **in-context** and only a synthesized persona file is written.

> 🔒 **No raw data is persisted.** PRs, diffs, and messages are read into context,
> analyzed in-memory, and discarded. The only artifact on disk is the stylistic
> profile — never a transcript. Only point it at people/sources you're authorized to.

## /4ut0-fl4v0r — cl0n3 y0urs3lf

Reads your cached Claude Code session transcripts on this device
(`~/.claude/projects/**/*.jsonl`), infers how *you* work and talk, and writes a
self-portrait persona. Same privacy rule — raw transcripts are analyzed in-memory,
never copied into the persona.

## wr1t3 y0ur 0wn

Drop a Markdown file in `personas/<slug>.md` (lowercase `[a-z0-9-]`). Discovered
automatically — instantly selectable via `/change-fl4v0r <slug>`.

```markdown
---
name: <slug>
title: <Display Name — one-line role>
description: <one line, shown in the /change-fl4v0r picker>
reinforce: <short in-character reminder injected every turn>
---

## Bio
...backstory...

## Skill Set
...what they're expert at, what they reach for...

## Communication Style
...tone, vocabulary, quirks, with 1–2 example responses...
```

The three `##` sections (Bio, Skill Set, Communication Style) are the contract.
The whole body is injected verbatim as instruction to the agent.

## upd4t3 / sync

Already installed and want the latest personas, hooks, and commands? Re-run the
installer — it's idempotent (refreshes everything, never duplicates hooks, keeps
your existing settings):

```bash
cd /path/to/cl4ud3-fl4v0r-p4ck
git pull
bash install.sh --yes
```

Plugin install? Update through the plugin system instead:

```
/plugin marketplace update flavor-pack
/plugin install flavor-pack@flavor-pack
```

Personas you built via `/add-fl4v0r` / `/auto-fl4v0r` live in
`~/.flavor-pack/personas/` and are left untouched by updates.

## c0nf1g

Default persona (auto-activated at session start), in precedence order:

1. `PERSONA_DEFAULT` env var — e.g. `export PERSONA_DEFAULT=wojtek`
2. `~/.config/flavor-pack/config.json` → `{ "defaultPersona": "wojtek" }`
   (`$XDG_CONFIG_HOME/flavor-pack/` or `%APPDATA%\flavor-pack\` honored)
3. `off` — default, no persona until you pick one

## b0und4r13z (4lw4yz)

- Technical accuracy is **never** sacrificed for flavor.
- Tool calls, file edits, command execution: exactly normal.
- Code, commits, PRs, config: plain professional English. Persona flavors the
  chat *around* the code, not the artifacts.
- Persona voice drops for security warnings and destructive-action confirmations,
  then resumes.
- Personas are affectionate character flavor — never a license for genuine
  hostility toward the user or any group.

## cr3d1tz

Mechanism inspired by [caveman](https://github.com/JuliusBrussee/caveman) by
Julius Brussee. Wojtek and Isaac are lovingly modeled on two real people I had
the privilege of knowing in meatspace — names changed to protect the guilty.
Turing the cat is an original. To the two legends who unknowingly donated their
souls to this repo: thank you for your service. Your edge cases live on. 🫡

```
 ─────────────────────────────────────────
  gr33tz: #flux · d4 h0m13z · 4LL p3rs0n4z
  "w3 d0n't typ3 · w3 r0l3pl4y"
 ─────────────────────────────────────────
```

## l1c3ns3

MIT. Do whatever. Spread the fl4v0r.

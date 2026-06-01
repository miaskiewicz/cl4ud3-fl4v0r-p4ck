---
description: Alias of /review-fl4va — code review in a persona's voice (caveman-review-style one-liners).
argument-hint: "[persona] [diff | branch | file(s) | PR | empty=current changes]"
allowed-tools: AskUserQuestion, Glob, Read, Grep, Bash
---

Alias of `/review-fl4va`. Locate `review-fl4va.md` — check
`~/.claude/commands/review-fl4va.md` (standalone install), then
`**/flavor-pack/**/commands/review-fl4va.md` (plugin), then
`cl4ud3-fl4v0r-p4ck/commands/review-fl4va.md` (dev repo) — read it, and execute
its instructions exactly, treating `$ARGUMENTS` as the command arguments.

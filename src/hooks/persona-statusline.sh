#!/bin/bash
# flavor-pack — statusline badge for Claude Code.
# Renders the active-persona badge for THIS session, e.g. [PERSONA:WOJTEK].
#
# The active persona is session-scoped: Claude Code passes a JSON blob on stdin
# that includes "session_id". We read the per-session flag at
#   $CLAUDE_CONFIG_DIR/.flavor-pack/sessions/<session_id>.persona
# falling back to the legacy global flag when no session id is present.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/persona-statusline.sh" }

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# Read the stdin JSON and pull session_id (no jq dependency).
INPUT="$(cat)"
SID=$(printf '%s' "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
SID=$(printf '%s' "$SID" | tr -cd 'a-zA-Z0-9_-' | cut -c1-128)

if [ -n "$SID" ]; then
  FLAG="$CLAUDE_DIR/.flavor-pack/sessions/$SID.persona"
else
  FLAG="$CLAUDE_DIR/.persona-active"   # legacy global fallback
fi

# Refuse symlinks — a local attacker could point the flag at a secret and have
# the statusline render its bytes (incl. ANSI escapes) every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Cap at 64 bytes, lowercase, then strip everything outside [a-z0-9-]. This kills
# terminal-escape injection and OSC hyperlink spoofing via the flag contents.
NAME=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
NAME=$(printf '%s' "$NAME" | tr -cd 'a-z0-9-')

# Empty or the "off" sentinel → render nothing.
[ -z "$NAME" ] && exit 0
[ "$NAME" = "off" ] && exit 0

UPPER=$(printf '%s' "$NAME" | tr '[:lower:]' '[:upper:]')
# 134 = a soft magenta; distinct from caveman's orange so both can coexist.
printf '\033[38;5;134m[PERSONA:%s]\033[0m' "$UPPER"

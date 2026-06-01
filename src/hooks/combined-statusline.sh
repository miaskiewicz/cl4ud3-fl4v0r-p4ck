#!/bin/bash
# flavor-pack — combined statusline.
# Renders the caveman badge (if the caveman plugin is installed) followed by the
# flavor-pack persona badge, on one line: e.g.  [CAVEMAN] [PERSONA:WOJTEK]
#
# Wire in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/combined-statusline.sh" }
#
# Each sub-script reads its own flag file (not stdin), so we just forward stdin to
# both and join their outputs. Safe if either is absent.

# Consume stdin once, replay to each child (they ignore it, but be correct).
INPUT="$(cat)"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

OUT=""
emit() { # append $1 with a separating space if we already have output
  [ -z "$1" ] && return
  if [ -n "$OUT" ]; then OUT="$OUT $1"; else OUT="$1"; fi
}

# 1. caveman badge (plugin or standalone install)
for CAVE in "$CLAUDE_DIR/hooks/caveman-statusline.sh" "$HOME/.claude/hooks/caveman-statusline.sh"; do
  if [ -f "$CAVE" ]; then
    emit "$(printf '%s' "$INPUT" | bash "$CAVE" 2>/dev/null)"
    break
  fi
done

# 2. persona badge
if [ -f "$DIR/persona-statusline.sh" ]; then
  emit "$(printf '%s' "$INPUT" | bash "$DIR/persona-statusline.sh" 2>/dev/null)"
fi

printf '%s' "$OUT"

#!/usr/bin/env bash
# cl4ud3-fl4v0r-p4ck — standalone installer (no plugin system required).
#
#   bash install.sh              # interactive — asks about the statusline badge
#   bash install.sh --yes        # non-interactive — installs everything incl. statusline
#   bash install.sh --no-statusline
#
# What it does:
#   1. Copies the plugin into ~/.flavor-pack (hooks, personas, skill).
#   2. Registers slash commands in   ~/.claude/commands/
#   3. Registers the persona skill in ~/.claude/skills/persona/
#   4. Merges SessionStart + UserPromptSubmit hooks into ~/.claude/settings.json
#      (preserving existing settings; idempotent).
#   5. Optionally wires the [PERSONA:NAME] statusline badge.
#
# Plugin users don't need this — use `/plugin install` instead.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${FLAVOR_PACK_HOME:-$HOME/.flavor-pack}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

YES=0
STATUSLINE="ask"
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --statusline) STATUSLINE="yes" ;;
    --no-statusline) STATUSLINE="no" ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# --- prereqs ---
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. The hooks are Node scripts — install Node first." >&2
  exit 1
fi

echo "flavor-pack: installing from $SRC → $DEST"

# --- 1. copy plugin tree (preserve src/hooks + personas layout the hooks expect) ---
mkdir -p "$DEST"
rm -rf "$DEST/src" "$DEST/personas" "$DEST/skills" "$DEST/commands" "$DEST/bin"
cp -R "$SRC/src"      "$DEST/src"
cp -R "$SRC/personas" "$DEST/personas"
cp -R "$SRC/skills"   "$DEST/skills"
cp -R "$SRC/commands" "$DEST/commands"
cp -R "$SRC/bin"      "$DEST/bin"
chmod +x "$DEST"/src/hooks/*.js "$DEST"/src/hooks/*.sh 2>/dev/null || true

# --- 2. slash commands ---
mkdir -p "$CLAUDE_DIR/commands"
cp "$DEST"/commands/*.md "$CLAUDE_DIR/commands/"
echo "flavor-pack: commands → $CLAUDE_DIR/commands/"

# --- 3. skill ---
mkdir -p "$CLAUDE_DIR/skills/persona"
cp "$DEST"/skills/persona/SKILL.md "$CLAUDE_DIR/skills/persona/SKILL.md"
echo "flavor-pack: skill → $CLAUDE_DIR/skills/persona/"

# --- 4/5. settings.json hooks (+ optional statusline) ---
if [ "$STATUSLINE" = "ask" ]; then
  if [ "$YES" = "1" ]; then
    STATUSLINE="yes"
  else
    printf "Wire the [PERSONA:NAME] statusline badge into settings.json? [Y/n] "
    read -r ans || ans=""
    case "$ans" in [Nn]*) STATUSLINE="no" ;; *) STATUSLINE="yes" ;; esac
  fi
fi

if [ "$STATUSLINE" = "yes" ]; then
  node "$DEST/bin/install-settings.js" "$DEST" --statusline >/dev/null
  echo "flavor-pack: hooks + statusline → $CLAUDE_DIR/settings.json"
else
  node "$DEST/bin/install-settings.js" "$DEST" >/dev/null
  echo "flavor-pack: hooks → $CLAUDE_DIR/settings.json"
fi

cat <<EOF

✅ flavor-pack installed.

  Restart Claude Code, then:
    /change-fl4v0r            pick a persona (auto-suggest)
    /change-fl4v0r wojtek     go full gopnik
    /change-fl4v0r isaac      anxious QA mode
    /add-fl4v0r               learn a persona from a real person
    /auto-fl4v0r              clone yourself from local history
    /no-fl4v0r                back to normal

  Personas live in:  $DEST/personas/
  Uninstall:         bash $SRC/uninstall.sh
EOF

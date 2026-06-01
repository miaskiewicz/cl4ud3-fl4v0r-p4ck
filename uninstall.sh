#!/usr/bin/env bash
# cl4ud3-fl4v0r-p4ck — standalone uninstaller. Reverses install.sh.
#
#   bash uninstall.sh

set -euo pipefail

DEST="${FLAVOR_PACK_HOME:-$HOME/.flavor-pack}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# 1. Remove our hooks + statusline from settings.json (preserves everything else).
if [ -f "$DEST/bin/install-settings.js" ] && command -v node >/dev/null 2>&1; then
  node "$DEST/bin/install-settings.js" "$DEST" --remove >/dev/null 2>&1 || true
  echo "flavor-pack: removed hooks from $CLAUDE_DIR/settings.json"
fi

# 2. Remove slash commands we installed.
for f in change-fl4v0r change-persona add-fl4v0r add-persona auto-fl4v0r auto-persona no-fl4v0r no-persona; do
  rm -f "$CLAUDE_DIR/commands/$f.md"
done
echo "flavor-pack: removed commands from $CLAUDE_DIR/commands/"

# 3. Remove the skill.
rm -rf "$CLAUDE_DIR/skills/persona"

# 4. Remove the install dir (this also deletes personas built via /add-fl4v0r,
#    /auto-fl4v0r — back them up first if you want to keep them).
rm -rf "$DEST"
echo "flavor-pack: removed $DEST"

# 5. Drop the active-persona flag.
rm -f "$CLAUDE_DIR/.persona-active"

echo "✅ flavor-pack uninstalled."

#!/usr/bin/env node
// flavor-pack — settings.json merger for the standalone (non-plugin) installer.
//
// Usage:
//   node install-settings.js <dest-dir> [--statusline]   # add/refresh hooks
//   node install-settings.js <dest-dir> --remove          # remove our hooks
//
// <dest-dir> is where install.sh copied the plugin (default ~/.flavor-pack).
// Merges into $CLAUDE_CONFIG_DIR/settings.json (or ~/.claude/settings.json),
// preserving every existing key. Idempotent — re-running never duplicates hooks.

const fs = require('fs');
const path = require('path');
const os = require('os');

const dest = process.argv[2];
const remove = process.argv.includes('--remove');
const wantStatusline = process.argv.includes('--statusline');

if (!dest) {
  process.stderr.write('install-settings: missing <dest-dir>\n');
  process.exit(1);
}

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');

const activate = path.join(dest, 'src', 'hooks', 'persona-activate.js');
const tracker = path.join(dest, 'src', 'hooks', 'persona-mode-tracker.js');
const statusline = path.join(dest, 'src', 'hooks', 'persona-statusline.sh');

// A hook entry is "ours" if its command references one of our hook scripts.
const OUR_MARKERS = ['persona-activate.js', 'persona-mode-tracker.js'];
const isOurs = h => h && h.command && OUR_MARKERS.some(m => h.command.includes(m));

function load() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

// Strip every flavor-pack hook from a hooks.<Event> array, dropping now-empty groups.
function stripFromEvent(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr
    .map(group => {
      if (!group || !Array.isArray(group.hooks)) return group;
      const kept = group.hooks.filter(h => !isOurs(h));
      return kept.length ? { ...group, hooks: kept } : null;
    })
    .filter(Boolean);
}

// Ensure hooks.<Event> contains a group running `command`, adding one if absent.
function ensureHook(settings, event, command) {
  settings.hooks = settings.hooks || {};
  const arr = (settings.hooks[event] = stripFromEvent(settings.hooks[event] || []));
  arr.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
}

const settings = load();
settings.hooks = settings.hooks || {};

// Always strip our hooks first (clean slate for both install and remove).
for (const ev of ['SessionStart', 'UserPromptSubmit']) {
  if (settings.hooks[ev]) settings.hooks[ev] = stripFromEvent(settings.hooks[ev]);
}

if (remove) {
  // Drop empty event arrays we emptied.
  for (const ev of ['SessionStart', 'UserPromptSubmit']) {
    if (Array.isArray(settings.hooks[ev]) && settings.hooks[ev].length === 0) {
      delete settings.hooks[ev];
    }
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;

  // Remove our statusline only if it's pointing at our script.
  if (settings.statusLine && settings.statusLine.command &&
      settings.statusLine.command.includes('persona-statusline')) {
    delete settings.statusLine;
  }
  process.stdout.write('removed');
} else {
  ensureHook(settings, 'SessionStart', `node "${activate}"`);
  ensureHook(settings, 'UserPromptSubmit', `node "${tracker}"`);

  if (wantStatusline) {
    const isWin = process.platform === 'win32';
    const combined = path.join(dest, 'src', 'hooks', 'combined-statusline.sh');
    // Use the combined badge (caveman + persona) so both coexist on one line.
    const command = isWin
      ? `powershell -ExecutionPolicy Bypass -File "${path.join(dest, 'src', 'hooks', 'persona-statusline.ps1')}"`
      : `bash "${combined}"`;
    // Set it when there's no statusline, or when the existing one is a bare
    // caveman/persona/flavor-pack badge we can safely upgrade. Never clobber a
    // custom user statusline.
    const cur = settings.statusLine && settings.statusLine.command;
    const safeToReplace = !cur ||
      /caveman-statusline|persona-statusline|combined-statusline/.test(cur);
    if (safeToReplace) {
      settings.statusLine = { type: 'command', command };
    }
  }
  process.stdout.write('installed');
}

fs.mkdirSync(claudeDir, { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

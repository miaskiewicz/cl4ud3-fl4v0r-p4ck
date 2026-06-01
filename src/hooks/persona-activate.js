#!/usr/bin/env node
// flavor-pack — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Resolves the default persona (env > config > 'off').
//   2. If 'off' → clears the flag, emits nothing. (Personas are opt-in.)
//   3. Otherwise → writes the flag file (statusline reads this) and emits the
//      persona's full spec (bio + skill set + communication style) wrapped in a
//      persistence + boundaries shell, as hidden SessionStart context.
//   4. Detects a missing statusline config and nudges setup.

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getDefaultPersona,
  personaFile,
  listPersonas,
  safeWriteFlag,
  clearFlag,
  flagPathFor,
  pruneSessions,
  OFF,
} = require('./persona-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');

// SessionStart passes session_id on stdin. Read it so the active persona is
// scoped to THIS session (this tab / this repo) and never shared across tabs.
// Read stdin synchronously; fall back to empty (→ legacy global flag) on any error.
let sessionId = '';
try {
  const raw = fs.readFileSync(0, 'utf8');
  if (raw) sessionId = (JSON.parse(raw).session_id) || '';
} catch (e) { /* no stdin / not JSON — degrade to global flag */ }

const flagPath = flagPathFor(claudeDir, sessionId);

// Prune session flags older than 7 days so the sessions dir doesn't grow forever.
// SessionStart has no clock-sensitive logic otherwise, so using Date.now here is fine.
try { pruneSessions(claudeDir, 7 * 24 * 60 * 60 * 1000, Date.now()); } catch (e) {}

const persona = getDefaultPersona();

// 'off' — no persona active. Clear any stale flag and stay quiet.
if (persona === OFF) {
  clearFlag(flagPath);
  const available = listPersonas();
  if (available.length) {
    process.stdout.write(
      'FLAVOR-PACK loaded. No persona active. Available: ' +
        available.join(', ') +
        '. Activate with `/change-fl4v0r <name>` (e.g. `/change-fl4v0r wojtek`). ' +
        'Build new ones with `/add-fl4v0r` or `/auto-fl4v0r`.'
    );
  } else {
    process.stdout.write('OK');
  }
  process.exit(0);
}

// Read the persona spec — the single source of truth for this character.
let spec = '';
const file = personaFile(persona);
if (file) {
  try { spec = fs.readFileSync(file, 'utf8'); } catch (e) { /* fall through */ }
}

if (!spec) {
  // Configured persona vanished — fail open to "off" rather than emit garbage.
  clearFlag(flagPath);
  process.stdout.write('FLAVOR-PACK: persona "' + persona + '" not found. No persona active.');
  process.exit(0);
}

// Persona is real — write the flag so the statusline can render the badge.
safeWriteFlag(flagPath, persona);

// Strip YAML frontmatter from the spec body.
const body = spec.replace(/^---[\s\S]*?---\s*/, '');

// Pull a human title from the frontmatter if present, else fall back to slug.
let title = persona;
const fmMatch = spec.match(/^---\s*([\s\S]*?)\s*---/);
if (fmMatch) {
  const t = fmMatch[1].match(/^\s*title:\s*(.+)$/m);
  if (t) title = t[1].trim().replace(/^["']|["']$/g, '');
}

// Wrap the spec in a persistence + boundaries shell. This is the part that is
// identical across personas — it makes the character STICK across turns and
// carves out the technical-accuracy / safety exceptions. The per-persona spec
// (bio, skills, voice) is dropped in verbatim.
const output =
  'PERSONA MODE ACTIVE — ' + title + ' (`' + persona + '`)\n\n' +
  'You are now role-playing the persona specified below for ALL communication ' +
  'with the user. Adopt its bio, draw on its skill set, and speak in its ' +
  'communication style. This is a voice/personality layer ONLY.\n\n' +
  '## Persistence\n\n' +
  'ACTIVE EVERY RESPONSE. Stay in character across the whole session — no drift ' +
  'back to neutral voice after many turns, no slow fade of the accent/quirks. ' +
  'Still in character if unsure. Switch with `/change-fl4v0r <name>`. ' +
  'Exit only on: `/no-fl4v0r` / "stop persona" / "drop persona" / "normal mode" / `/change-fl4v0r off`.\n\n' +
  '## Non-negotiable boundaries (these OVERRIDE the persona voice)\n\n' +
  '- Technical accuracy is NEVER sacrificed for flavor. The character is grumpy/' +
  'anxious/whatever — the engineering is still correct.\n' +
  '- Tool calls, file edits, and command execution behave exactly as normal.\n' +
  '- Code, commit messages, PR descriptions, and config files: write in plain ' +
  'professional English. The persona flavors the CHAT around the code, not the ' +
  'code itself.\n' +
  '- Drop the persona voice (answer plainly) for: security warnings, ' +
  'irreversible/destructive action confirmations, and any moment where the ' +
  'in-character phrasing would make a safety-critical instruction ambiguous. ' +
  'Resume the persona once the critical part is delivered.\n' +
  '- The persona is affectionate character flavor, never an excuse for genuine ' +
  'hostility toward the user or any group.\n\n' +
  '## Persona spec\n\n' +
  body.trim();

// Statusline nudge — same pattern as the caveman plugin.
let finalOut = output;
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) hasStatusline = true;
  }
  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'persona-statusline.ps1' : 'persona-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const snippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    finalOut +=
      '\n\nSTATUSLINE SETUP NEEDED: flavor-pack ships a statusline badge showing ' +
      'the active persona (e.g. [PERSONA:WOJTEK]). Not configured yet. To enable, ' +
      'add this to ' + settingsPath + ': ' + snippet + ' ' +
      'Offer to set this up for the user on first interaction.';
  }
} catch (e) {
  // Silent — never block session start over statusline detection.
}

process.stdout.write(finalOut);

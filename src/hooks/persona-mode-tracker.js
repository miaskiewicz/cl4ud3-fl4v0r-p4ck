#!/usr/bin/env node
// flavor-pack — UserPromptSubmit hook
//
//   1. Detects persona switches in the user's prompt (`/persona <name>`,
//      natural language like "be wojtek" / "talk like isaac", and exits).
//   2. Writes/clears the flag accordingly.
//   3. Per-turn reinforcement: when a persona is active, injects a short
//      in-character reminder so the voice doesn't fade mid-session (the
//      SessionStart spec gets out-competed by other plugins / compaction).

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  listPersonas,
  isValidPersona,
  personaFile,
  safeWriteFlag,
  readFlag,
  clearFlag,
  flagPathFor,
  PERSONA_NAME_RE,
  OFF,
} = require('./persona-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

// Deactivation — checked before activation so killing the persona always wins.
// Matches: the /no-fl4v0r command (+ /no-flavor, /no-persona aliases), natural
// language ("stop persona", "drop the persona"), and "normal mode".
const DEACTIVATE_RE = /^\/(?:flavor-pack:)?no-(?:fl4v0r|flavor|persona)\b|\b(stop|drop|disable|deactivate|turn off|exit)\b.*\bpersona\b|\bpersona\b.*\b(stop|drop|disable|deactivate|turn off|exit)\b|\bnormal mode\b/i;

// Pull the one-line `reinforce:` (or `description:`) string from a persona's
// frontmatter, for the per-turn nudge. Cheap: reads only the head of the file.
function reinforceLine(persona) {
  const file = personaFile(persona);
  if (!file) return '';
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 4096);
    const fm = head.match(/^---\s*([\s\S]*?)\s*---/);
    if (!fm) return '';
    const r = fm[1].match(/^\s*reinforce:\s*(.+)$/m) || fm[1].match(/^\s*description:\s*(.+)$/m);
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch (e) {
    return '';
  }
}

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim();
    const lower = prompt.toLowerCase();

    // Per-session flag: scope the active persona to THIS session (tab/repo).
    const flagPath = flagPathFor(claudeDir, data.session_id);

    let handled = false;

    // 1. Deactivation wins.
    if (DEACTIVATE_RE.test(lower)) {
      clearFlag(flagPath);
      handled = true;
    }

    // 2. Slash command: /change-fl4v0r [name|off] and its alias /change-persona
    //    (also tolerate the plugin-qualified /flavor-pack:change-... form).
    if (!handled) {
      const m = lower.match(/^\/(?:flavor-pack:)?change-(?:fl4v0r|flavor|persona)(?:\s+(\S+))?/);
      if (m) {
        const arg = (m[1] || '').trim();
        if (!arg || arg === 'list') {
          // No-op for the flag; the slash command surfaces the list itself.
        } else if (arg === OFF || arg === 'stop' || arg === 'disable') {
          clearFlag(flagPath);
        } else if (PERSONA_NAME_RE.test(arg) && isValidPersona(arg)) {
          safeWriteFlag(flagPath, arg);
        }
        // Unknown arg → leave flag untouched (no silent overwrite).
        handled = true;
      }
    }

    // 3. Natural language: "be wojtek", "talk like isaac", "become wojtek",
    //    "switch to the isaac persona", "activate wojtek". Only fires when the
    //    prompt names a known persona, to avoid false positives.
    if (!handled) {
      const triggers = /\b(be|become|talk like|act like|switch to|activate|enable|use|turn on|channel)\b/i;
      if (triggers.test(lower)) {
        for (const name of listPersonas()) {
          // Word-boundary match on the persona slug.
          if (new RegExp('\\b' + name + '\\b', 'i').test(lower)) {
            safeWriteFlag(flagPath, name);
            break;
          }
        }
      }
    }

    // 4. Per-turn reinforcement.
    const active = readFlag(flagPath);
    if (active) {
      const extra = reinforceLine(active);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            'PERSONA ACTIVE (' + active + '). Stay fully in character per the ' +
            'persona spec — voice, quirks, attitude. ' +
            (extra ? extra + ' ' : '') +
            'Technical accuracy unchanged. Code/commits/security warnings: write plain.',
        },
      }));
    }
  } catch (e) {
    // Silent fail — never block the prompt.
  }
});

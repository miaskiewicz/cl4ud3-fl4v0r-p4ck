#!/usr/bin/env node
// flavor-pack — shared configuration resolver
//
// Personas are discovered dynamically from <plugin_root>/personas/*.md.
// A persona is identified by its filename (sans .md), e.g. `wojtek`, `isaac`.
//
// Resolution order for the default persona:
//   1. PERSONA_DEFAULT environment variable
//   2. Config file defaultPersona field:
//      - $XDG_CONFIG_HOME/flavor-pack/config.json (any platform, if set)
//      - ~/.config/flavor-pack/config.json (macOS / Linux fallback)
//      - %APPDATA%\flavor-pack\config.json (Windows fallback)
//   3. 'off'  (no persona until the user picks one)
//
// Most of the symlink-safe flag IO below is adapted from the caveman plugin's
// hardening — the threat model is identical: the flag file lives at a
// predictable path (~/.claude/.persona-active) and is read by the statusline
// (renders to the terminal) and by the per-turn reinforcement hook (injects
// into model context). A local attacker who can write that path could plant a
// symlink to ~/.ssh/id_rsa or smuggle ANSI escapes. So: refuse symlinks, cap
// the read, and accept only well-formed persona names.

const fs = require('fs');
const path = require('path');
const os = require('os');

// A persona name is a lowercase slug. This doubles as the security whitelist
// for flag contents — anything that isn't this shape never reaches the
// terminal or the model.
const PERSONA_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// Reserved control value — means "no persona active".
const OFF = 'off';

function getPersonasDir() {
  // __dirname = <plugin_root>/src/hooks → personas at <plugin_root>/personas
  return path.join(__dirname, '..', '..', 'personas');
}

// List available persona names by scanning the personas directory.
// Returns [] on any filesystem error (never throws).
function listPersonas() {
  try {
    return fs
      .readdirSync(getPersonasDir())
      .filter(f => f.toLowerCase().endsWith('.md'))
      .map(f => f.slice(0, -3).toLowerCase())
      .filter(name => PERSONA_NAME_RE.test(name))
      .sort();
  } catch (e) {
    return [];
  }
}

// Resolve a persona name to its file path, or null if it isn't a real persona.
// Guards against path traversal: name must match PERSONA_NAME_RE (no slashes,
// no dots) AND the resolved file must sit directly inside the personas dir.
function personaFile(name) {
  if (typeof name !== 'string') return null;
  const slug = name.trim().toLowerCase();
  if (!PERSONA_NAME_RE.test(slug)) return null;
  const dir = getPersonasDir();
  const file = path.join(dir, slug + '.md');
  if (path.dirname(file) !== dir) return null; // belt-and-suspenders
  try {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile()) return null;
  } catch (e) {
    return null;
  }
  return file;
}

function isValidPersona(name) {
  return name === OFF || personaFile(name) !== null;
}

// ── Per-session flag paths ───────────────────────────────────────────────
// The active persona is SESSION-SCOPED: each Claude Code session has its own
// flag so enabling Wojtek in one window never touches another. Keyed by the
// session_id the hooks receive on stdin. When no session id is available (older
// Claude, or a context that doesn't pass one), we fall back to the legacy global
// flag so behavior degrades gracefully instead of breaking.

function sanitizeSessionId(sid) {
  if (typeof sid !== 'string') return '';
  // Session ids are UUID-ish; keep only safe path chars, cap length.
  return sid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

function sessionsDir(claudeDir) {
  return path.join(claudeDir, '.flavor-pack', 'sessions');
}

// Resolve the flag path for a given session. Falls back to the legacy global
// path when sessionId is empty/invalid.
function flagPathFor(claudeDir, sessionId) {
  const sid = sanitizeSessionId(sessionId);
  if (!sid) return path.join(claudeDir, '.persona-active');
  return path.join(sessionsDir(claudeDir), sid + '.persona');
}

// Best-effort prune of session flag files older than maxAgeMs. Keeps the
// sessions dir from growing without bound. Silent on any error.
function pruneSessions(claudeDir, maxAgeMs, nowMs) {
  try {
    const dir = sessionsDir(claudeDir);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.persona')) continue;
      const p = path.join(dir, f);
      try {
        const st = fs.lstatSync(p);
        if (st.isSymbolicLink()) { fs.unlinkSync(p); continue; }
        if (nowMs - st.mtimeMs > maxAgeMs) fs.unlinkSync(p);
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* dir missing — nothing to prune */ }
}

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'flavor-pack');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'flavor-pack'
    );
  }
  return path.join(os.homedir(), '.config', 'flavor-pack');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getDefaultPersona() {
  // 1. Environment variable (highest priority)
  const envP = process.env.PERSONA_DEFAULT;
  if (envP) {
    const slug = envP.trim().toLowerCase();
    if (slug === OFF || isValidPersona(slug)) return slug;
  }

  // 2. Config file
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    if (config.defaultPersona) {
      const slug = String(config.defaultPersona).trim().toLowerCase();
      if (slug === OFF || isValidPersona(slug)) return slug;
    }
  } catch (e) {
    // missing / invalid config — fall through
  }

  // 3. Default: no persona active
  return OFF;
}

// ── Symlink-safe flag IO ─────────────────────────────────────────────────
// The flag file stores the active persona name (or is absent when off).

const MAX_FLAG_BYTES = 64; // longest legit value is a 32-char slug; 64 = slack.

// Resolve a flag dir, following a legitimately-symlinked parent (e.g. ~/.claude
// pointed at shared storage) only when the target is owned by the current user.
// Returns the real dir path, or null if anything looks unsafe.
function resolveFlagDir(flagDir, debugTag) {
  const debug = process.env.PERSONA_DEBUG === '1';
  try {
    fs.mkdirSync(flagDir, { recursive: true });
  } catch (e) {
    return null;
  }
  try {
    const lstat = fs.lstatSync(flagDir);
    if (!lstat.isSymbolicLink()) return flagDir;
    const real = fs.realpathSync(flagDir);
    const realStat = fs.statSync(real);
    if (!realStat.isDirectory()) return null;
    if (typeof process.getuid === 'function') {
      if (realStat.uid !== process.getuid()) {
        if (debug) process.stderr.write(`[flavor-pack] ${debugTag}: ${real} owned by uid ${realStat.uid}\n`);
        return null;
      }
    } else {
      const home = path.resolve(os.homedir()).toLowerCase();
      const r = path.resolve(real).toLowerCase();
      if (r !== home && !r.startsWith(home + path.sep)) return null;
    }
    return real;
  } catch (e) {
    return null;
  }
}

// The flag file itself must never be a symlink — that's the clobber vector.
function refuseSymlinkTarget(p) {
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return false;
  } catch (e) {
    if (e.code !== 'ENOENT') return false;
  }
  return true;
}

function safeWriteFlag(flagPath, content) {
  try {
    const realDir = resolveFlagDir(path.dirname(flagPath), 'safeWriteFlag');
    if (!realDir) return;
    const realPath = path.join(realDir, path.basename(flagPath));
    if (!refuseSymlinkTarget(realPath)) return;

    const tempPath = path.join(realDir, `.persona-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}

// Read + validate the active persona name. Returns a valid name, or null on any
// anomaly (missing, symlink, oversized, malformed, or not a real persona).
function readFlag(flagPath) {
  try {
    let st;
    try { st = fs.lstatSync(flagPath); } catch (e) { return null; }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    let fd, out;
    try {
      fd = fs.openSync(flagPath, fs.constants.O_RDONLY | O_NOFOLLOW);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    const raw = out.trim().toLowerCase();
    if (raw === OFF) return null;             // off == no persona
    if (!isValidPersona(raw)) return null;    // format + existence check
    return raw;
  } catch (e) {
    return null;
  }
}

function clearFlag(flagPath) {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

module.exports = {
  PERSONA_NAME_RE,
  OFF,
  getPersonasDir,
  listPersonas,
  personaFile,
  isValidPersona,
  getConfigDir,
  getConfigPath,
  getDefaultPersona,
  safeWriteFlag,
  readFlag,
  clearFlag,
  sanitizeSessionId,
  sessionsDir,
  flagPathFor,
  pruneSessions,
};

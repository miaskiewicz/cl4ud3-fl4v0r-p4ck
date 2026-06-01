# flavor-pack — statusline badge for Claude Code (Windows / PowerShell).
# Renders the active-persona badge for THIS session, e.g. [PERSONA:WOJTEK].
# Reads session_id from the stdin JSON and uses the per-session flag.

$ErrorActionPreference = 'SilentlyContinue'

$claudeDir = $env:CLAUDE_CONFIG_DIR
if (-not $claudeDir) { $claudeDir = Join-Path $env:USERPROFILE '.claude' }

# Read stdin JSON, extract session_id.
$stdin = [Console]::In.ReadToEnd()
$sid = ''
if ($stdin -match '"session_id"\s*:\s*"([^"]*)"') {
  $sid = ($matches[1] -replace '[^a-zA-Z0-9_-]', '')
  if ($sid.Length -gt 128) { $sid = $sid.Substring(0, 128) }
}

if ($sid) {
  $flag = Join-Path $claudeDir (Join-Path '.flavor-pack' (Join-Path 'sessions' ($sid + '.persona')))
} else {
  $flag = Join-Path $claudeDir '.persona-active'
}

if (-not (Test-Path -LiteralPath $flag -PathType Leaf)) { exit 0 }
$item = Get-Item -LiteralPath $flag -Force
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { exit 0 }  # refuse symlinks

$raw = (Get-Content -LiteralPath $flag -TotalCount 1 -Raw)
if (-not $raw) { exit 0 }
$raw = $raw.Substring(0, [Math]::Min(64, $raw.Length)).ToLower()
$name = ($raw -replace '[^a-z0-9-]', '')
if (-not $name -or $name -eq 'off') { exit 0 }

$esc = [char]27
Write-Host -NoNewline ("$esc[38;5;134m[PERSONA:" + $name.ToUpper() + "]$esc[0m")

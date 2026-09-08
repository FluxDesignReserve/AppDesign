#!/bin/bash
# SessionStart hook: prepare the terminal for Claude Code on the web.
# Installs node dependencies so `npm run typecheck`, `npm run build` and the
# Playwright QA scripts work immediately in a fresh container.
set -euo pipefail

# Only run in remote (Claude Code on the web) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Chromium is pre-installed in the remote image; don't let npm re-fetch it.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# `install` rather than `ci` so the cached container layer is reused across sessions.
npm install --no-audit --no-fund

# Persist for the session shell.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"
  echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers' >> "$CLAUDE_ENV_FILE"
fi

echo "session-start: dependencies ready ($(node -v), npm $(npm -v))"

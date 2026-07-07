#!/usr/bin/env bash
#
# dev-live — run the Vite dev server AND keep your local checkout in sync with
# the remote, so you never have to `git pull` by hand to see new changes.
#
#   npm run dev:live            # tracks origin/master, checks every 15s
#   npm run dev:live -- main 30 # track a different branch / interval (seconds)
#
# It polls the remote in the background; whenever new commits land it does a
# fast-forward `git pull`, and Vite's hot-reload pushes them straight into the
# browser. Ctrl-C stops both the server and the sync loop.
#
# Notes:
#  - Fast-forward only. If you've made local edits that conflict, the pull is
#    skipped with a warning rather than creating a merge — commit/stash them
#    and it resumes on the next check. (For pure "just let me see it" use you
#    won't have local edits, so this never trips.)
#  - Bash script — on macOS/Linux it just works; on Windows run it from Git
#    Bash or WSL.

set -uo pipefail

BRANCH="${1:-master}"
INTERVAL="${2:-15}"

# Run from the repo root regardless of where the script is invoked from.
cd "$(dirname "$0")/.." || exit 1

echo "dev-live: tracking origin/$BRANCH (checking every ${INTERVAL}s). Ctrl-C to stop."
git checkout "$BRANCH" >/dev/null 2>&1 || { echo "Could not checkout $BRANCH"; exit 1; }
git pull --ff-only --quiet origin "$BRANCH" 2>/dev/null || true

# Background sync loop.
(
  while true; do
    sleep "$INTERVAL"
    git fetch --quiet origin "$BRANCH" 2>/dev/null || continue
    local_sha=$(git rev-parse @ 2>/dev/null)
    remote_sha=$(git rev-parse "origin/$BRANCH" 2>/dev/null)
    if [ -n "$remote_sha" ] && [ "$local_sha" != "$remote_sha" ]; then
      echo ""
      echo "↻ dev-live: new commits on $BRANCH — pulling…"
      if git pull --ff-only --quiet origin "$BRANCH" 2>/dev/null; then
        echo "✓ dev-live: updated to $(git rev-parse --short @) — the browser will hot-reload."
      else
        echo "⚠ dev-live: couldn't fast-forward (local changes?). Skipping; will retry."
      fi
    fi
  done
) &
SYNC_PID=$!

# Make sure the background loop dies with the server.
trap 'kill "$SYNC_PID" 2>/dev/null' EXIT INT TERM

npm run dev

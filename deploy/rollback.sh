#!/usr/bin/env bash
#
# DCF — instantly roll back to the previous release.
#
# Run as: /var/www/rollback.sh                 (rolls back one release)
#         /var/www/rollback.sh 2026-07-04-1200  (rolls back to a specific release)
#
# This only ever switches the /var/www/dcf-current symlink back to a release
# directory that already exists on disk (built and verified by a previous
# deploy.sh run) and restarts PM2 — it never clones, builds, installs
# dependencies, or runs migrations.
#
# Guarantee: this script contains no reference to dev.db, .env, or backups —
# it never touches /var/www/shared at all. That's deliberate: reverting CODE
# has nothing to do with the shared data, so there is nothing here that could
# delete or overwrite the database even by accident.
#
# KNOWN LIMITATION: this reverts code only, not the database. If the release
# you're rolling back FROM already ran a schema migration (prisma migrate
# deploy), that migration is not undone — the older code now runs against a
# newer schema. This is safe for additive migrations (new nullable columns,
# new tables) but not for a migration that renamed/dropped a column the old
# code depends on. Check what migrated before relying on rollback for that case.

set -euo pipefail

CONFIG_FILE="/var/www/config.sh"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE not found. This server hasn't been set up with" >&2
  echo "setup-server.sh, or the config was removed." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"
# Provides: BASE_DIR, APP_NAME, CURRENT_LINK, RELEASES_DIR, SHARED_DIR (unused here)

confirm() {
  echo
  read -r -p ">>> $1  [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted at your request. Nothing was changed." ; exit 1 ;;
  esac
}

atomic_symlink() {
  local linkname="$1" target="$2"
  local tmp
  tmp="$(mktemp -u "${linkname}.tmp.XXXXXX")"
  ln -sfn "$target" "$tmp"
  mv -T "$tmp" "$linkname"
}

if [ ! -L "$CURRENT_LINK" ]; then
  echo "ERROR: $CURRENT_LINK doesn't exist or isn't a symlink — nothing to roll back from." >&2
  exit 1
fi
LIVE_RELEASE="$(readlink -f "$CURRENT_LINK")"
LIVE_NAME="$(basename "$LIVE_RELEASE")"

mapfile -t ALL_RELEASES < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)

TARGET_NAME="${1:-}"
if [ -n "$TARGET_NAME" ]; then
  TARGET_DIR="$RELEASES_DIR/$TARGET_NAME"
  if [ ! -d "$TARGET_DIR" ]; then
    echo "ERROR: no release named '$TARGET_NAME' found in $RELEASES_DIR." >&2
    echo "Available releases (newest first):" >&2
    printf '  %s\n' "${ALL_RELEASES[@]}" >&2
    exit 1
  fi
else
  # Find the release immediately before the live one in the descending list.
  TARGET_NAME=""
  found_live=0
  for name in "${ALL_RELEASES[@]}"; do
    if [ "$found_live" = "1" ]; then
      TARGET_NAME="$name"
      break
    fi
    if [ "$name" = "$LIVE_NAME" ]; then
      found_live=1
    fi
  done
  if [ -z "$TARGET_NAME" ]; then
    echo "ERROR: no release older than the current one ($LIVE_NAME) was found —" >&2
    echo "there's nothing to roll back to. (Available releases: ${ALL_RELEASES[*]:-none})" >&2
    exit 1
  fi
  TARGET_DIR="$RELEASES_DIR/$TARGET_NAME"
fi

if [ "$TARGET_DIR" = "$LIVE_RELEASE" ]; then
  echo "ERROR: '$TARGET_NAME' is already the live release — nothing to do." >&2
  exit 1
fi

echo "Currently live: $LIVE_NAME"
echo "Will roll back to: $TARGET_NAME"
echo
echo "This switches $CURRENT_LINK to point at $TARGET_DIR and restarts PM2 —"
echo "a few seconds of downtime. This does NOT touch the database, .env, or"
echo "backups (they live outside every release directory and are never"
echo "referenced by this script). See the note at the top of this file about"
echo "database migrations not being reverted."
confirm "Proceed with rolling back now?"

atomic_symlink "$CURRENT_LINK" "$TARGET_DIR"
echo "$CURRENT_LINK now points at $TARGET_DIR."

pm2 restart "$APP_NAME"

sleep 2
if curl -fsS -o /dev/null -w "App responded with HTTP %{http_code}\n" http://localhost:3000/; then
  echo "Rollback finished successfully — $TARGET_NAME is now live."
else
  echo "WARNING: app did not respond after rolling back — check 'pm2 logs $APP_NAME'." >&2
  exit 1
fi

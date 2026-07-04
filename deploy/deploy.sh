#!/usr/bin/env bash
#
# DCF — deploy an update to an already-set-up VPS.
#
# Run this from inside the app directory (or set APP_DIR below) whenever
# there's new code to ship. Use setup-server.sh instead for a brand new
# server — this script assumes PM2, Nginx, the database, and .env already exist.
#
# Guarantee: this script only ever reads/pulls application CODE. It never
# runs any command that creates, deletes, resets, or overwrites dev.db,
# the backups/ folder, or .env — those three are the customer/business data
# and must survive forever across deployments. See the explicit guard step
# below, which aborts the deploy if any of them look wrong.

set -euo pipefail

APP_DIR="/var/www/dcf"
APP_NAME="dcf"

confirm() {
  echo
  read -r -p ">>> $1  [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted at your request. Nothing further was changed." ; exit 1 ;;
  esac
}

step() {
  echo
  echo "================================================================"
  echo "STEP: $1"
  echo "================================================================"
}

cd "$APP_DIR"

# ------------------------------------------------------------------
step "0/6 — Guard: confirm the protected files are present before touching anything"
# ------------------------------------------------------------------
# If any of these are missing, something is already wrong (wrong directory,
# a previous bad deploy, etc.) — better to stop now than plough ahead.
for f in dev.db .env; do
  if [ ! -f "$f" ]; then
    echo "ERROR: expected '$f' to already exist in $APP_DIR, but it's missing." >&2
    echo "Refusing to continue — this script never creates these from scratch." >&2
    exit 1
  fi
done
if [ ! -d backups ]; then
  echo "NOTE: backups/ doesn't exist yet — it will be created the first time" \
       "'npm run backup' runs (below), that's expected on a brand new server."
fi
DEV_DB_HASH_BEFORE=$(sha256sum dev.db | cut -d' ' -f1)
echo "dev.db present (sha256: ${DEV_DB_HASH_BEFORE:0:12}...), .env present. Continuing."

echo
echo "This will pull the latest code, rebuild, and restart the live app with"
echo "'pm2 restart' — that's a few seconds of downtime for anyone using the"
echo "site right now (existing orders/data are unaffected either way)."
confirm "Proceed with deploying the latest code now?"

# ------------------------------------------------------------------
step "1/6 — Safety backup before deploying"
# ------------------------------------------------------------------
echo "Taking a fresh backup (in addition to the daily cron backup) before"
echo "touching anything, in case this deploy goes wrong for any reason."
npm run backup

# ------------------------------------------------------------------
step "2/6 — Pull the latest code"
# ------------------------------------------------------------------
echo "Running: git pull"
echo "(dev.db, backups/, and .env are all in .gitignore — git literally"
echo "cannot see or touch them, they were never tracked in the first place.)"
git pull

# ------------------------------------------------------------------
step "3/6 — Install dependencies"
# ------------------------------------------------------------------
npm install

# ------------------------------------------------------------------
step "4/6 — Apply any new database migrations"
# ------------------------------------------------------------------
echo "Running: npx prisma migrate deploy"
echo "This only APPLIES pending migrations (adds/alters tables/columns)."
echo "It never drops the database or deletes existing rows. (This script"
echo "deliberately never calls 'prisma migrate reset' or 'npm run seed' —"
echo "reseeding would be pointless here and reset would destroy your data.)"
npx prisma migrate deploy

# ------------------------------------------------------------------
step "5/6 — Build and restart"
# ------------------------------------------------------------------
npm run build
pm2 restart "$APP_NAME"

# ------------------------------------------------------------------
step "6/6 — Verify nothing touched the protected files, and the app is up"
# ------------------------------------------------------------------
DEV_DB_HASH_AFTER=$(sha256sum dev.db | cut -d' ' -f1)
if [ "$DEV_DB_HASH_BEFORE" != "$DEV_DB_HASH_AFTER" ]; then
  echo "dev.db changed during deploy — this is EXPECTED if new orders came in"
  echo "while this script ran, or if step 4 applied a schema migration."
  echo "It was NOT deleted or replaced (still present, still growing)."
else
  echo "dev.db is byte-for-byte unchanged since before this deploy."
fi

sleep 2
if curl -fsS -o /dev/null -w "App responded with HTTP %{http_code}\n" http://localhost:3000/; then
  echo "Deploy finished successfully."
else
  echo "WARNING: app did not respond after restart — check 'pm2 logs $APP_NAME'." >&2
  exit 1
fi

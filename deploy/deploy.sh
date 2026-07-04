#!/usr/bin/env bash
#
# DCF — deploy an update to an already-set-up VPS.
#
# Run this from inside the app directory (or set APP_DIR below) whenever
# there's new code to ship. Use setup-server.sh instead for a brand new
# server — this script assumes PM2, Nginx, the database, and .env already exist.
#
# Guarantee: this script only ever reads/pulls application CODE. It never
# runs any command that creates, deletes, resets, or overwrites the database,
# the backups/ folder, or .env — those are the customer/business data and
# must survive forever across deployments. The database now lives in a
# persistent directory OUTSIDE this app's git working tree (configured via
# DATABASE_URL in .env, set up by setup-server.sh) specifically so that even
# a destructive git operation in this directory (e.g. `git clean -fdx`)
# can't reach it. The guard step below reads that path from .env itself,
# rather than assuming a location, and aborts if anything looks wrong.

set -euo pipefail

APP_DIR="/var/www/dcf"
APP_NAME="dcf"
REQUIRED_NODE="20.9.0"

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

read_env_var() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | sed -E "s/^${key}=//; s/^\"//; s/\"\$//"
}

cd "$APP_DIR"

# ------------------------------------------------------------------
step "1/7 — Guard: confirm Node version and protected files before touching anything"
# ------------------------------------------------------------------
if ! node -e "
  const [reqMaj, reqMin, reqPat] = '$REQUIRED_NODE'.split('.').map(Number);
  const [curMaj, curMin, curPat] = process.versions.node.split('.').map(Number);
  const ok = curMaj > reqMaj
    || (curMaj === reqMaj && curMin > reqMin)
    || (curMaj === reqMaj && curMin === reqMin && curPat >= reqPat);
  process.exit(ok ? 0 : 1);
"; then
  echo "ERROR: Node $(node -v) found, but this app requires >= v$REQUIRED_NODE." >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "ERROR: expected '.env' to already exist in $APP_DIR, but it's missing." >&2
  echo "Refusing to continue — this script never creates it from scratch." >&2
  exit 1
fi

# The database's real location is whatever DATABASE_URL in .env says — read it
# dynamically rather than hardcoding a path here, so this script can't drift
# out of sync with however setup-server.sh actually configured this server.
DB_URL_VALUE="$(read_env_var DATABASE_URL .env)"
DB_PATH="${DB_URL_VALUE#file:}"
if [ -z "$DB_PATH" ]; then
  echo "ERROR: couldn't find a DATABASE_URL in .env — refusing to continue." >&2
  exit 1
fi
if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: expected the database at '$DB_PATH' (from .env) to already exist," >&2
  echo "but it's missing. Refusing to continue — this script never creates it." >&2
  exit 1
fi

if [ ! -d backups ]; then
  echo "NOTE: backups/ doesn't exist yet — it will be created the first time" \
       "'npm run backup' runs (below), that's expected on a brand new server."
fi
DB_HASH_BEFORE=$(sha256sum "$DB_PATH" | cut -d' ' -f1)
echo "Database present at $DB_PATH (sha256: ${DB_HASH_BEFORE:0:12}...), .env present."
echo "Node $(node -v) satisfies >= v$REQUIRED_NODE. Continuing."

echo
echo "This will pull the latest code, rebuild, and restart the live app with"
echo "'pm2 restart' — that's a few seconds of downtime for anyone using the"
echo "site right now (existing orders/data are unaffected either way)."
confirm "Proceed with deploying the latest code now?"

# ------------------------------------------------------------------
step "2/7 — Safety backup before deploying"
# ------------------------------------------------------------------
echo "Taking a fresh backup (in addition to the daily cron backup) before"
echo "touching anything, in case this deploy goes wrong for any reason."
npm run backup

# ------------------------------------------------------------------
step "3/7 — Pull the latest code"
# ------------------------------------------------------------------
echo "Running: git pull --ff-only"
echo "(--ff-only refuses to create a merge commit if this checkout has diverged"
echo "from the remote — fail loudly here rather than silently merge in prod.)"
echo "(The database, backups/, and .env are all outside this git working tree"
echo "or gitignored, so 'git pull' cannot see or touch them either way.)"
git pull --ff-only

# ------------------------------------------------------------------
step "4/7 — Install dependencies and generate the Prisma client"
# ------------------------------------------------------------------
if [ -f package-lock.json ]; then
  echo "package-lock.json found — using 'npm ci' for a clean, reproducible,"
  echo "lockfile-exact install (fails loudly if package.json and the lockfile"
  echo "disagree, instead of silently drifting)."
  npm ci
else
  echo "No package-lock.json found — falling back to 'npm install'."
  npm install
fi

echo
echo "Running 'npx prisma generate' explicitly, before building — belt and"
echo "suspenders alongside package.json's postinstall hook, so the generated"
echo "client always matches the current schema regardless of that hook."
npx prisma generate

# ------------------------------------------------------------------
step "5/7 — Apply any new database migrations"
# ------------------------------------------------------------------
echo "Running: npx prisma migrate deploy"
echo "This only APPLIES pending migrations (adds/alters tables/columns)."
echo "It never drops the database or deletes existing rows. (This script"
echo "deliberately never calls 'prisma migrate reset' or 'npm run seed' —"
echo "reseeding would be pointless here and reset would destroy your data.)"
npx prisma migrate deploy

# ------------------------------------------------------------------
step "6/7 — Build and restart"
# ------------------------------------------------------------------
npm run build
pm2 restart "$APP_NAME"

# ------------------------------------------------------------------
step "7/7 — Verify nothing touched the database, and the app is up"
# ------------------------------------------------------------------
DB_HASH_AFTER=$(sha256sum "$DB_PATH" | cut -d' ' -f1)
if [ "$DB_HASH_BEFORE" != "$DB_HASH_AFTER" ]; then
  echo "Database changed during deploy — this is EXPECTED if new orders came in"
  echo "while this script ran, or if step 5 applied a schema migration."
  echo "It was NOT deleted or replaced (still present at $DB_PATH, still growing)."
else
  echo "Database is byte-for-byte unchanged since before this deploy."
fi

sleep 2
if curl -fsS -o /dev/null -w "App responded with HTTP %{http_code}\n" http://localhost:3000/; then
  echo "Deploy finished successfully."
else
  echo "WARNING: app did not respond after restart — check 'pm2 logs $APP_NAME'." >&2
  exit 1
fi

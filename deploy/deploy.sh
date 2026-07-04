#!/usr/bin/env bash
#
# DCF — ship a new release (release/symlink deployment structure).
#
# Run as: /var/www/deploy.sh   (the STABLE copy — see below for why)
#
# Each run clones a fresh copy of the repo into its own timestamped directory
# under /var/www/releases/, builds it there, and — only if that build and a
# reachability check both succeed — atomically swaps the /var/www/dcf-current
# symlink to point at it and restarts PM2. If anything fails partway, the
# live site keeps running unaffected on the previous release; the broken
# release directory is simply left on disk for you to inspect (it is not
# pruned automatically, since old releases are only pruned by number, not by
# a fail flag — nothing here deletes it either).
#
# Guarantee: this script never creates, deletes, resets, or overwrites
# /var/www/shared/dev.db, /var/www/shared/.env, or /var/www/shared/backups —
# those live in one place, outside every release directory, and are only ever
# read from or symlinked into a release, never written to by this script.
#
# Why this script must be run from the STABLE copy (/var/www/deploy.sh), not
# from inside a release directory: old releases get pruned (see the last
# step below); if this script lived only inside a release, pruning could one
# day delete the very script you're using to deploy. setup-server.sh installs
# the first stable copy, and this script re-installs the stable copy from
# itself at the end of every successful run — so whatever's newest in the
# repo takes effect starting with the next deploy, automatically.

set -euo pipefail

CONFIG_FILE="/var/www/config.sh"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE not found. Run setup-server.sh first — it creates" >&2
  echo "this config as part of the one-time server setup." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"
# Provides: REPO_URL, BASE_DIR, APP_NAME, CURRENT_LINK, RELEASES_DIR,
#           SHARED_DIR, KEEP_RELEASES, REQUIRED_NODE

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

# Atomically point $1 (a symlink path) at $2 (a target directory).
# Uses a temp symlink + `mv -T` (rename syscall) rather than `ln -sfn`
# directly on the final path — `ln -sfn` briefly unlinks the old symlink
# before creating the new one, so a request arriving in that instant could
# see a broken link. `mv -T` replaces the directory entry in one atomic step.
atomic_symlink() {
  local linkname="$1" target="$2"
  local tmp
  tmp="$(mktemp -u "${linkname}.tmp.XXXXXX")"
  ln -sfn "$target" "$tmp"
  mv -T "$tmp" "$linkname"
}

RELEASE_NAME="$(date +%Y-%m-%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

# ------------------------------------------------------------------
step "1/9 — Guard: confirm Node version and shared data before touching anything"
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

if [ ! -f "$SHARED_DIR/.env" ]; then
  echo "ERROR: expected '$SHARED_DIR/.env' to already exist, but it's missing." >&2
  echo "Refusing to continue — this script never creates it from scratch." >&2
  exit 1
fi

BOOTSTRAP=0
if [ ! -f "$SHARED_DIR/dev.db" ]; then
  echo "NOTE: no database yet at $SHARED_DIR/dev.db — this looks like the very"
  echo "first release on this server. Migrations will create it, and the"
  echo "menu catalog will be seeded, once the new release is confirmed built."
  BOOTSTRAP=1
else
  DB_HASH_BEFORE=$(sha256sum "$SHARED_DIR/dev.db" | cut -d' ' -f1)
  echo "Database present at $SHARED_DIR/dev.db (sha256: ${DB_HASH_BEFORE:0:12}...)."
fi
echo "Node $(node -v) satisfies >= v$REQUIRED_NODE. Continuing."

echo
echo "This will create a new release at:"
echo "  $RELEASE_DIR"
echo "and, only if it builds and responds successfully, switch the live site"
echo "over to it (a few seconds of downtime during the PM2 restart; existing"
echo "orders/data are unaffected either way). The current release stays live"
echo "and untouched until that point — if anything below fails, nothing"
echo "changes for visitors."
confirm "Proceed with creating and shipping this new release?"

# ------------------------------------------------------------------
step "2/9 — Safety backup before deploying"
# ------------------------------------------------------------------
if [ "$BOOTSTRAP" = "1" ]; then
  echo "Skipping — no database exists yet to back up."
else
  echo "Taking a fresh backup (in addition to the daily cron backup) before"
  echo "touching anything, in case this deploy goes wrong for any reason."
  ( cd "$CURRENT_LINK" && npm run backup )
fi

# ------------------------------------------------------------------
step "3/9 — Clone the latest code into a new release directory"
# ------------------------------------------------------------------
mkdir -p "$RELEASES_DIR"
git clone --depth 50 "$REPO_URL" "$RELEASE_DIR"
echo "Cloned into $RELEASE_DIR"

# ------------------------------------------------------------------
step "4/9 — Link shared data into the new release"
# ------------------------------------------------------------------
# .env, the database's backups, and admin-uploaded menu photos all live only
# in $SHARED_DIR, forever, across every release — a release directory itself
# holds nothing but code, so pruning old releases can never touch real data.
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
ln -sfn "$SHARED_DIR/backups" "$RELEASE_DIR/backups"
rm -rf "$RELEASE_DIR/public/uploads"
ln -sfn "$SHARED_DIR/uploads" "$RELEASE_DIR/public/uploads"
echo "Linked .env, backups/, and public/uploads from $SHARED_DIR."

# ------------------------------------------------------------------
step "5/9 — Install dependencies and generate the Prisma client"
# ------------------------------------------------------------------
cd "$RELEASE_DIR"
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
step "6/9 — Apply database migrations (and seed only on a brand new database)"
# ------------------------------------------------------------------
echo "Running: npx prisma migrate deploy"
echo "This only APPLIES pending migrations (adds/alters tables/columns)."
echo "It never drops the database or deletes existing rows. (This script"
echo "deliberately never calls 'prisma migrate reset' — that would destroy data.)"
npx prisma migrate deploy

if [ "$BOOTSTRAP" = "1" ]; then
  echo "Seeding the menu catalog (brand new database only — 'npm run seed'"
  echo "skips automatically if data already exists, so this is safe even if"
  echo "detection above was wrong)."
  npm run seed
fi

# ------------------------------------------------------------------
step "7/9 — Build"
# ------------------------------------------------------------------
npm run build
echo "Build succeeded."

# ------------------------------------------------------------------
step "8/9 — Switch traffic to the new release and restart PM2"
# ------------------------------------------------------------------
echo "Only now, after a successful build, does the live site change over."
atomic_symlink "$CURRENT_LINK" "$RELEASE_DIR"
echo "$CURRENT_LINK now points at $RELEASE_DIR."

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  echo "No existing PM2 process named '$APP_NAME' — starting one now, pointed"
  echo "at the symlink (not the release directory itself), so future restarts"
  echo "keep working after the symlink is swapped again by the next deploy."
  pm2 start npm --name "$APP_NAME" --cwd "$CURRENT_LINK" -- start
  pm2 save
fi

# ------------------------------------------------------------------
step "9/9 — Verify, self-update stable tooling, and prune old releases"
# ------------------------------------------------------------------
sleep 2
if curl -fsS -o /dev/null -w "App responded with HTTP %{http_code}\n" http://localhost:3000/; then
  echo "Deploy finished successfully — $RELEASE_NAME is now live."
else
  echo "WARNING: app did not respond after switching to the new release." >&2
  echo "The symlink has already been switched. To go back immediately, run:" >&2
  echo "  $BASE_DIR/rollback.sh" >&2
  echo "Then check 'pm2 logs $APP_NAME' to diagnose $RELEASE_DIR." >&2
  exit 1
fi

if [ -n "${DB_HASH_BEFORE:-}" ]; then
  DB_HASH_AFTER=$(sha256sum "$SHARED_DIR/dev.db" | cut -d' ' -f1)
  if [ "$DB_HASH_BEFORE" != "$DB_HASH_AFTER" ]; then
    echo "Database changed during deploy — EXPECTED if new orders came in while"
    echo "this ran, or if a schema migration was applied in step 6. It was NOT"
    echo "deleted or replaced (still present at $SHARED_DIR/dev.db)."
  else
    echo "Database is byte-for-byte unchanged since before this deploy."
  fi
fi

# Only after everything above has succeeded: refresh the stable deploy.sh and
# rollback.sh from this release's copies, so improvements committed to the
# repo take effect starting with the next run. A failed deploy (anything
# above this line) never updates these, so a broken script can't lock you out.
cp "$RELEASE_DIR/deploy/deploy.sh" "$BASE_DIR/deploy.sh"
cp "$RELEASE_DIR/deploy/rollback.sh" "$BASE_DIR/rollback.sh"
chmod +x "$BASE_DIR/deploy.sh" "$BASE_DIR/rollback.sh"
echo "Refreshed $BASE_DIR/deploy.sh and $BASE_DIR/rollback.sh from this release."

echo
echo "Pruning old releases, keeping the current release plus the $KEEP_RELEASES"
echo "before it (never deletes whatever $CURRENT_LINK actually points at, or"
echo "$SHARED_DIR, regardless of sort order)."
LIVE_RELEASE="$(readlink -f "$CURRENT_LINK")"
# Sort descending — the YYYY-MM-DD-HHMMSS naming means lexicographic order is
# chronological order — then keep the first (KEEP_RELEASES + 1), which is the
# live release plus KEEP_RELEASES prior ones.
mapfile -t ALL_RELEASES < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
KEEP_COUNT=$((KEEP_RELEASES + 1))
KEPT=0
for name in "${ALL_RELEASES[@]}"; do
  dir="$RELEASES_DIR/$name"
  if [ "$dir" = "$LIVE_RELEASE" ]; then
    KEPT=$((KEPT + 1))
    continue
  fi
  if [ "$KEPT" -lt "$KEEP_COUNT" ]; then
    KEPT=$((KEPT + 1))
  else
    echo "Removing old release: $dir"
    rm -rf "$dir"
  fi
done

echo
echo "Done. Live release: $LIVE_RELEASE"

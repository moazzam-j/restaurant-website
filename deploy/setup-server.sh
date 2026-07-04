#!/usr/bin/env bash
#
# DCF — one-time Hostinger VPS setup (release-based deployment structure).
#
# Run this ONCE on a fresh Ubuntu 22.04/24.04 VPS, as root.
#
# Sets up:
#   /var/www/dcf-current -> releases/<timestamp>   (symlink, switched by deploy.sh)
#   /var/www/releases/<timestamp>/                 (one full checkout+build per release)
#   /var/www/shared/{.env,dev.db,backups/,uploads/} (persistent, never touched by a deploy)
#   /var/www/config.sh, deploy.sh, rollback.sh     (stable tooling copies, self-updated
#                                                    by deploy.sh on every future deploy)
#
# This script only ever installs system packages, prepares the directory
# skeleton, migrates data from an older (pre-release-structure) deployment if
# found, and then hands off to deploy.sh to perform the actual first release —
# it never clones/builds the app itself, so there's exactly one place
# (deploy.sh) responsible for that logic.
#
# Explains every step and pauses for confirmation before anything destructive
# or hard to undo (system upgrade, moving an existing database, enabling the
# firewall, requesting a real SSL certificate).
#
# Re-running this on a server that's already set up is safe — every step
# checks current state first.

set -euo pipefail

# ============================================================
# EDIT THESE THREE VALUES BEFORE RUNNING
# ============================================================
DOMAIN="yourdomain.com"                       # must already have an A record pointing at this VPS's IP
REPO_URL="https://github.com/you/your-repo.git"
EMAIL_FOR_SSL="you@example.com"               # Let's Encrypt sends renewal/expiry notices here
# ============================================================

# Structural conventions — change only if you have a reason to; deploy.sh and
# rollback.sh read these same values back out of the generated /var/www/config.sh,
# so they only ever need to be decided once, here.
BASE_DIR="/var/www"
APP_NAME="dcf"
CURRENT_LINK="$BASE_DIR/$APP_NAME-current"
RELEASES_DIR="$BASE_DIR/releases"
SHARED_DIR="$BASE_DIR/shared"
KEEP_RELEASES=5
REQUIRED_NODE="20.9.0"
STABLE_CONFIG="$BASE_DIR/config.sh"
STABLE_DEPLOY_SCRIPT="$BASE_DIR/deploy.sh"
STABLE_ROLLBACK_SCRIPT="$BASE_DIR/rollback.sh"

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

# ------------------------------------------------------------------
step "1/10 — Update system packages"
# ------------------------------------------------------------------
echo "About to run: apt update && apt upgrade -y"
confirm "Update the system now?"
apt update && apt upgrade -y

# ------------------------------------------------------------------
step "2/10 — Install Node.js 20 LTS"
# ------------------------------------------------------------------
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Installed: $(node -v) / npm $(npm -v)"
if ! node -e "
  const [reqMaj, reqMin, reqPat] = '$REQUIRED_NODE'.split('.').map(Number);
  const [curMaj, curMin, curPat] = process.versions.node.split('.').map(Number);
  const ok = curMaj > reqMaj || (curMaj === reqMaj && curMin > reqMin)
    || (curMaj === reqMaj && curMin === reqMin && curPat >= reqPat);
  process.exit(ok ? 0 : 1);
"; then
  echo "ERROR: Node $(node -v) found, but this app requires >= v$REQUIRED_NODE." >&2
  exit 1
fi

# ------------------------------------------------------------------
step "3/10 — Install git, Nginx, PM2, and Certbot"
# ------------------------------------------------------------------
apt install -y git nginx certbot python3-certbot-nginx
npm install -g pm2

# ------------------------------------------------------------------
step "4/10 — Create the release/shared directory structure"
# ------------------------------------------------------------------
echo "Creating:"
echo "  $RELEASES_DIR          (one subdirectory per deploy)"
echo "  $SHARED_DIR/backups    (database backups)"
echo "  $SHARED_DIR/uploads    (admin-uploaded menu photos — public/uploads gets"
echo "                          symlinked here on every release; otherwise every"
echo "                          fresh checkout would silently lose uploaded photos)"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR/backups" "$SHARED_DIR/uploads"
chmod 700 "$SHARED_DIR"   # .env + database + uploads all live under here — root-only

# ------------------------------------------------------------------
step "5/10 — Migrate data from an older deployment layout, if found"
# ------------------------------------------------------------------
# Two older layouts are possible on a server that ran a previous version of
# these scripts: a flat single-directory app at $BASE_DIR/$APP_NAME containing
# dev.db/.env/backups directly, or that same layout but with the database
# split out to $BASE_DIR/$APP_NAME-data. Either way, migrate what's found into
# shared/ — nothing here is ever deleted, only moved.
OLD_APP_DIR="$BASE_DIR/$APP_NAME"
OLD_DATA_DIR="$BASE_DIR/$APP_NAME-data"
MIGRATED_ANYTHING=0

if [ ! -f "$SHARED_DIR/dev.db" ]; then
  for candidate in "$OLD_DATA_DIR/dev.db" "$OLD_APP_DIR/dev.db"; do
    if [ -f "$candidate" ]; then
      echo "Found an existing database at $candidate (from an older deployment layout)."
      confirm "Move it (and any -journal/-wal/-shm files) into $SHARED_DIR now?"
      base="${candidate}"
      for suffix in "" "-journal" "-wal" "-shm"; do
        src="${base}${suffix}"
        [ -f "$src" ] && mv -n "$src" "$SHARED_DIR/dev.db${suffix}" && echo "  moved $(basename "$src")"
      done
      MIGRATED_ANYTHING=1
      break
    fi
  done
fi

if [ ! -f "$SHARED_DIR/.env" ] && [ -f "$OLD_APP_DIR/.env" ]; then
  echo "Found an existing .env at $OLD_APP_DIR/.env — moving it into $SHARED_DIR."
  mv -n "$OLD_APP_DIR/.env" "$SHARED_DIR/.env"
  MIGRATED_ANYTHING=1
fi

if [ -d "$OLD_APP_DIR/backups" ]; then
  echo "Found an existing backups/ folder at $OLD_APP_DIR/backups — merging its"
  echo "contents into $SHARED_DIR/backups (existing shared backups are kept)."
  cp -an "$OLD_APP_DIR/backups/." "$SHARED_DIR/backups/" 2>/dev/null || true
  MIGRATED_ANYTHING=1
fi

if [ -d "$OLD_APP_DIR/public/uploads" ]; then
  echo "Found existing uploaded photos at $OLD_APP_DIR/public/uploads — merging"
  echo "them into $SHARED_DIR/uploads."
  cp -an "$OLD_APP_DIR/public/uploads/." "$SHARED_DIR/uploads/" 2>/dev/null || true
  MIGRATED_ANYTHING=1
fi

if [ "$MIGRATED_ANYTHING" = "1" ]; then
  echo "Migration from the old layout complete. The old directory ($OLD_APP_DIR"
  echo "and/or $OLD_DATA_DIR) was left in place — nothing was deleted — you can"
  echo "remove it by hand once you've confirmed the new deployment is working."
else
  echo "No older deployment layout found — this looks like a brand new server."
fi

# ------------------------------------------------------------------
step "6/10 — Create shared/.env"
# ------------------------------------------------------------------
if [ -f "$SHARED_DIR/.env" ]; then
  echo "$SHARED_DIR/.env already exists — leaving its contents as-is, other than"
  echo "correcting DATABASE_URL below if it doesn't already point into $SHARED_DIR."
else
  cat > "$SHARED_DIR/.env" <<EOF
DATABASE_URL="file:$SHARED_DIR/dev.db"
ADMIN_PASSWORD="change-me"
EOF
  echo "Created $SHARED_DIR/.env with a placeholder ADMIN_PASSWORD."
  echo "IMPORTANT: edit it now and set a strong, real password:"
  echo "  nano $SHARED_DIR/.env"
  confirm "Have you edited $SHARED_DIR/.env with a real ADMIN_PASSWORD?"
fi

DB_TARGET="file:$SHARED_DIR/dev.db"
CURRENT_DB_URL="$(grep -E '^DATABASE_URL=' "$SHARED_DIR/.env" 2>/dev/null | tail -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')"
if [ "$CURRENT_DB_URL" != "$DB_TARGET" ]; then
  echo "Pointing DATABASE_URL at $SHARED_DIR/dev.db."
  cp "$SHARED_DIR/.env" "$SHARED_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
  if grep -q '^DATABASE_URL=' "$SHARED_DIR/.env"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_TARGET\"|" "$SHARED_DIR/.env"
  else
    echo "DATABASE_URL=\"$DB_TARGET\"" >> "$SHARED_DIR/.env"
  fi
fi

# ------------------------------------------------------------------
step "7/10 — Write the stable config used by deploy.sh and rollback.sh"
# ------------------------------------------------------------------
cat > "$STABLE_CONFIG" <<EOF
# Generated once by setup-server.sh — deploy.sh and rollback.sh source this on
# every run. Safe to hand-edit (e.g. to change KEEP_RELEASES) at any time.
REPO_URL="$REPO_URL"
BASE_DIR="$BASE_DIR"
APP_NAME="$APP_NAME"
CURRENT_LINK="$CURRENT_LINK"
RELEASES_DIR="$RELEASES_DIR"
SHARED_DIR="$SHARED_DIR"
KEEP_RELEASES=$KEEP_RELEASES
REQUIRED_NODE="$REQUIRED_NODE"
EOF
echo "Wrote $STABLE_CONFIG"

# ------------------------------------------------------------------
step "8/10 — Fetch deploy.sh and rollback.sh from the repo"
# ------------------------------------------------------------------
echo "Doing a throwaway shallow clone just to extract the deploy tooling"
echo "(the actual first release is created by deploy.sh itself, below)."
TMP_CLONE="$(mktemp -d)"
git clone --depth 1 "$REPO_URL" "$TMP_CLONE"
cp "$TMP_CLONE/deploy/deploy.sh" "$STABLE_DEPLOY_SCRIPT"
cp "$TMP_CLONE/deploy/rollback.sh" "$STABLE_ROLLBACK_SCRIPT"
chmod +x "$STABLE_DEPLOY_SCRIPT" "$STABLE_ROLLBACK_SCRIPT"
rm -rf "$TMP_CLONE"
echo "Installed $STABLE_DEPLOY_SCRIPT and $STABLE_ROLLBACK_SCRIPT."

# ------------------------------------------------------------------
step "9/10 — Reconcile any pre-existing PM2 process"
# ------------------------------------------------------------------
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  OLD_CWD="$(pm2 jlist | node -e "
    const list = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const p = list.find((x) => x.name === '$APP_NAME');
    process.stdout.write((p && p.pm2_env && p.pm2_env.pm_cwd) || '');
  ")"
  if [ "$OLD_CWD" != "$CURRENT_LINK" ]; then
    echo "Existing PM2 process '$APP_NAME' runs from '$OLD_CWD' (an older"
    echo "deployment layout) instead of $CURRENT_LINK — removing it so deploy.sh"
    echo "can recreate it pointed at the current-release symlink."
    pm2 delete "$APP_NAME"
  fi
fi

# ------------------------------------------------------------------
step "10/10 — Configure Nginx, then hand off to deploy.sh for the first release"
# ------------------------------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$APP_NAME"
nginx -t
systemctl reload nginx

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "SSL certificate for $DOMAIN already exists — skipping."
else
  confirm "Has DNS for $DOMAIN propagated to this server's IP already? (needed for the SSL step)"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL_FOR_SSL" --agree-tos --redirect
fi

echo "About to restrict this server to only SSH (22), HTTP (80), and HTTPS (443)."
ufw allow OpenSSH
ufw allow 'Nginx Full'
if [ "$(ufw status | head -1)" = "Status: active" ]; then
  echo "UFW already enabled."
else
  confirm "Enable the firewall now?"
  ufw --force enable
fi

echo "Scheduling daily backups via cron (3:00 AM, running the deployed app's"
echo "'npm run backup' from whichever release is current)."
NPM_PATH="$(command -v npm)"
CRON_LINE="0 3 * * * cd $CURRENT_LINK && $NPM_PATH run backup >> $SHARED_DIR/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$SHARED_DIR/backup.log" ; echo "$CRON_LINE" ) | crontab -

echo
echo "================================================================"
echo "Server prepared. Running $STABLE_DEPLOY_SCRIPT to ship the first release..."
echo "================================================================"
"$STABLE_DEPLOY_SCRIPT"

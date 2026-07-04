#!/usr/bin/env bash
#
# DCF — one-time Hostinger VPS setup.
#
# Run this ONCE on a fresh Ubuntu 22.04/24.04 VPS, as root (or `sudo bash setup-server.sh`).
# It installs Node.js, git, Nginx, PM2, and UFW; clones the app; sets up the database
# in a persistent directory OUTSIDE the app's git working tree; builds and starts it
# under PM2; configures Nginx + free HTTPS; opens the firewall; and schedules daily backups.
#
# It explains every step before running it, and pauses for a yes/no confirmation
# before anything destructive or hard to undo (system upgrade, moving an existing
# database, enabling the firewall, requesting a real SSL certificate).
#
# Re-running this script on a server that's already set up is safe: every step
# checks the current state first and skips or no-ops if there's nothing to do.
# It will never re-create, reset, or reseed a database that already has data.
#
# For updating an already-deployed app's CODE later, use deploy.sh instead —
# this script is for first-time setup (or fixing/completing a partial one).

set -euo pipefail

# ============================================================
# EDIT THESE FIVE VALUES BEFORE RUNNING
# ============================================================
DOMAIN="yourdomain.com"                       # must already have an A record pointing at this VPS's IP
REPO_URL="https://github.com/you/your-repo.git"
APP_DIR="/var/www/dcf"                        # application CODE lives here (disposable — a git working tree)
DATA_DIR="/var/www/dcf-data"                  # the SQLite database lives here (persistent — never touched by deploys)
EMAIL_FOR_SSL="you@example.com"               # Let's Encrypt sends renewal/expiry notices here
# ============================================================

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

# Reads a KEY="value" or KEY=value line out of a dotenv-style file, stripping quotes.
read_env_var() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | sed -E "s/^${key}=//; s/^\"//; s/\"\$//"
}

# ------------------------------------------------------------------
step "1/15 — Update system packages"
# ------------------------------------------------------------------
echo "About to run: apt update && apt upgrade -y"
echo "This installs security/bugfix updates for the OS itself. Safe on a"
echo "fresh VPS; on an already-running production box you'd normally do"
echo "this during a maintenance window instead."
confirm "Update the system now?"
apt update && apt upgrade -y

# ------------------------------------------------------------------
step "2/15 — Install Node.js 20 LTS"
# ------------------------------------------------------------------
echo "Adding the NodeSource repository and installing Node.js 20 + npm."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Installed: $(node -v) / npm $(npm -v)"

# Proper semver comparison (major.minor.patch), not just a major-version check —
# Next.js's real minimum is 20.9.0, and a bare ">= 20" check would wrongly pass
# an early 20.x release (e.g. 20.0.0) that's actually too old.
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
echo "Node version satisfies the >= v$REQUIRED_NODE requirement."

# ------------------------------------------------------------------
step "3/15 — Install git, Nginx, PM2, and Certbot"
# ------------------------------------------------------------------
echo "git       — to clone/pull the app's code"
echo "nginx     — reverse-proxies port 80/443 to the Next.js app on port 3000"
echo "pm2       — keeps the app running in the background, restarts it on crash/reboot"
echo "certbot   — issues and renews free Let's Encrypt SSL certificates"
apt install -y git nginx certbot python3-certbot-nginx
npm install -g pm2

# ------------------------------------------------------------------
step "4/15 — Get the application code"
# ------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  echo "$APP_DIR already contains a git repo — pulling latest instead of cloning."
  echo "Using --ff-only: refuses to create a merge commit if the local branch"
  echo "has diverged (e.g. someone committed directly on the server) — a"
  echo "production deploy should fail loudly there, not silently merge."
  git -C "$APP_DIR" pull --ff-only
else
  if [ -d "$APP_DIR" ]; then
    echo "ERROR: $APP_DIR already exists but isn't a git repo. Refusing to overwrite it."
    echo "Move or remove it first if you really want to reuse this path, then re-run." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ------------------------------------------------------------------
step "5/15 — Install dependencies and generate the Prisma client"
# ------------------------------------------------------------------
if [ -f package-lock.json ]; then
  echo "package-lock.json found — using 'npm ci' (deletes node_modules and installs"
  echo "exactly what's locked; fails loudly instead of silently drifting if package.json"
  echo "and the lockfile disagree). This is what production deploys should use."
  npm ci
else
  echo "No package-lock.json found — falling back to 'npm install'."
  npm install
fi
echo "This also compiled the better-sqlite3 native module for THIS server's"
echo "OS/architecture — never copy a node_modules folder built elsewhere."

echo
echo "Running 'npx prisma generate' explicitly (package.json's postinstall hook"
echo "already does this, but running it again here is cheap insurance — it"
echo "doesn't depend on that hook still existing or ever being skipped with"
echo "--ignore-scripts, and it guarantees the client matches the current schema"
echo "right before we build)."
npx prisma generate

# ------------------------------------------------------------------
step "6/15 — Configure environment (.env)"
# ------------------------------------------------------------------
if [ -f ".env" ]; then
  echo ".env already exists — leaving all of its contents as-is, other than"
  echo "possibly correcting DATABASE_URL below if it doesn't point at $DATA_DIR yet."
else
  cp .env.example .env
  echo "Created .env from .env.example."
  echo "IMPORTANT: edit it now and set a strong ADMIN_PASSWORD before continuing:"
  echo "  nano $APP_DIR/.env"
  confirm "Have you edited .env with a real ADMIN_PASSWORD?"
fi

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"   # customer names/phones/addresses live here — root-only
DB_TARGET="file:$DATA_DIR/dev.db"
CURRENT_DB_URL="$(read_env_var DATABASE_URL .env)"
if [ "$CURRENT_DB_URL" != "$DB_TARGET" ]; then
  echo "Pointing DATABASE_URL at the persistent data directory ($DATA_DIR),"
  echo "instead of storing the database inside the app's git working tree."
  echo "This matters for reasons .gitignore alone doesn't cover: commands like"
  echo "'git clean -fdx' explicitly delete gitignored files too, and some"
  echo "recovery workflows treat the whole app directory as disposable. Keeping"
  echo "the database physically outside that tree makes it immune to both."
  cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"
  if grep -q '^DATABASE_URL=' .env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_TARGET\"|" .env
  else
    echo "DATABASE_URL=\"$DB_TARGET\"" >> .env
  fi
  echo "Updated. (A timestamped backup of the previous .env was kept alongside it.)"
else
  echo "DATABASE_URL already points at $DATA_DIR — nothing to change."
fi

# ------------------------------------------------------------------
step "7/15 — Migrate an existing database into the persistent directory, if needed"
# ------------------------------------------------------------------
NEW_DB_PATH="$DATA_DIR/dev.db"
OLD_DB_PATH="$APP_DIR/dev.db"

if [ -f "$NEW_DB_PATH" ]; then
  echo "Database already present at $NEW_DB_PATH. Nothing to migrate — this is"
  echo "the expected, steady state on every re-run after the first."
elif [ -f "$OLD_DB_PATH" ]; then
  echo "Found an existing database at the OLD in-project location: $OLD_DB_PATH"
  echo "(left over from a previous version of this script). Moving it — along"
  echo "with any -journal/-wal/-shm sidecar files — to $NEW_DB_PATH."
  echo "This is a one-time move for YOUR data; nothing is deleted, only relocated."
  confirm "Move the existing database to the persistent data directory now?"
  for suffix in "" "-journal" "-wal" "-shm"; do
    src="${OLD_DB_PATH}${suffix}"
    if [ -f "$src" ]; then
      mv -n "$src" "${NEW_DB_PATH}${suffix}"
      echo "  moved $(basename "$src")"
    fi
  done
  echo "Database migrated. Future deploys will only ever read/write $NEW_DB_PATH."
else
  echo "No existing database found in either location — this looks like a brand"
  echo "new install. It'll be created fresh in the next step."
fi

# ------------------------------------------------------------------
step "8/15 — Set up the database (first time only)"
# ------------------------------------------------------------------
if [ -f "$NEW_DB_PATH" ]; then
  echo "Database already exists at $NEW_DB_PATH — skipping migrate/seed so we"
  echo "never touch existing data. (This also means a from-scratch reseed never"
  echo "happens against a live production database, by construction.)"
else
  echo "No database found. Running:"
  echo "  npx prisma migrate deploy   (creates tables — never wipes existing data)"
  echo "  npm run seed                (populates the menu catalog; skips automatically if data exists)"
  npx prisma migrate deploy
  npm run seed
fi

# ------------------------------------------------------------------
step "9/15 — Build the application"
# ------------------------------------------------------------------
npm run build

# ------------------------------------------------------------------
step "10/15 — Start with PM2 and enable startup-on-boot"
# ------------------------------------------------------------------
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "PM2 process '$APP_NAME' already exists — restarting it with the new build."
  pm2 restart "$APP_NAME"
else
  pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save
echo
echo "PM2 needs one more command to survive a server reboot. Run the line"
echo "PM2 prints below (it will look like: sudo env PATH=... pm2 startup ...):"
pm2 startup || true

# ------------------------------------------------------------------
step "11/15 — Configure Nginx as a reverse proxy"
# ------------------------------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Default is 1MB, which would reject /admin/menu photo uploads before they
    # even reach the app (which itself accepts up to 5MB) — this gives headroom.
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
echo "Nginx now forwards http://$DOMAIN -> http://localhost:3000 (max upload 20MB)"

# ------------------------------------------------------------------
step "12/15 — HTTPS via Let's Encrypt"
# ------------------------------------------------------------------
echo "This requests a real SSL certificate for $DOMAIN and www.$DOMAIN."
echo "It will FAIL if DNS for that domain doesn't already point at this VPS's IP."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "A certificate for $DOMAIN already exists — skipping (Certbot's own timer"
  echo "handles renewal automatically, nothing to do here)."
else
  confirm "Has DNS for $DOMAIN propagated to this server's IP already?"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL_FOR_SSL" --agree-tos --redirect
  echo "Certbot also installs its own auto-renewal timer — nothing further to do."
fi

# ------------------------------------------------------------------
step "13/15 — Firewall (UFW)"
# ------------------------------------------------------------------
echo "About to restrict this server to only SSH (22), HTTP (80), and HTTPS (443)."
echo "SSH is allowed FIRST, before enabling, specifically so this can't lock you out."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo
echo "Current UFW rules that will apply once enabled:"
ufw show added
if [ "$(ufw status | head -1)" = "Status: active" ]; then
  echo "UFW is already enabled — rules above are applied, nothing further to confirm."
else
  confirm "Enable the firewall now with the rules above?"
  ufw --force enable
fi
ufw status

# ------------------------------------------------------------------
step "14/15 — Schedule automatic daily backups"
# ------------------------------------------------------------------
echo "Adding a cron job that runs 'npm run backup' daily at 3:00 AM."
echo "This uses SQLite's VACUUM INTO for a safe, consistent snapshot into"
echo "$APP_DIR/backups/ — it reads $NEW_DB_PATH but never modifies it."
NPM_PATH="$(command -v npm)"
CRON_LINE="0 3 * * * cd $APP_DIR && $NPM_PATH run backup >> $APP_DIR/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$APP_DIR/backup.log" ; echo "$CRON_LINE" ) | crontab -
echo "Installed crontab entry:"
crontab -l | grep -F "$APP_DIR"
echo "Running one backup now to confirm it works:"
npm run backup

# ------------------------------------------------------------------
step "15/15 — Verify the application is reachable"
# ------------------------------------------------------------------
echo "Checking the app directly on port 3000 (bypassing Nginx)..."
if curl -fsS -o /dev/null -w "  -> localhost:3000 responded with HTTP %{http_code}\n" http://localhost:3000/; then
  echo "  PM2 + Next.js: OK"
else
  echo "  WARNING: app did not respond on port 3000 — check 'pm2 logs $APP_NAME'" >&2
fi

echo "Checking the public domain over HTTPS..."
if curl -fsS -o /dev/null -w "  -> https://$DOMAIN/ responded with HTTP %{http_code}\n" "https://$DOMAIN/"; then
  echo "  Nginx + SSL: OK"
else
  echo "  WARNING: public domain check failed — DNS may still be propagating," >&2
  echo "  or check 'systemctl status nginx' and 'journalctl -u nginx'." >&2
fi

echo
echo "================================================================"
echo "Setup complete. Visit https://$DOMAIN to confirm the site looks right."
echo "Database lives at: $NEW_DB_PATH (outside the app's git working tree)"
echo "For future code updates, use deploy/deploy.sh instead of this script."
echo "================================================================"

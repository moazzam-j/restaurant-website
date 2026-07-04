#!/usr/bin/env bash
#
# DCF — one-time Hostinger VPS setup.
#
# Run this ONCE on a fresh Ubuntu 22.04/24.04 VPS, as root (or `sudo bash setup-server.sh`).
# It installs Node.js, git, Nginx, PM2, and UFW; clones the app; sets up the database;
# builds and starts it under PM2; configures Nginx + free HTTPS; opens the firewall;
# and schedules daily backups.
#
# It explains every step before running it, and pauses for a yes/no confirmation
# before anything destructive or hard to undo (system upgrade, enabling the firewall,
# requesting a real SSL certificate).
#
# For updating an already-deployed app later, use deploy.sh instead — this script
# is only for the first-time setup of a brand new server.

set -euo pipefail

# ============================================================
# EDIT THESE FOUR VALUES BEFORE RUNNING
# ============================================================
DOMAIN="yourdomain.com"                       # must already have an A record pointing at this VPS's IP
REPO_URL="https://github.com/you/your-repo.git"
APP_DIR="/var/www/dcf"
EMAIL_FOR_SSL="you@example.com"               # Let's Encrypt sends renewal/expiry notices here
# ============================================================

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

# ------------------------------------------------------------------
step "1/14 — Update system packages"
# ------------------------------------------------------------------
echo "About to run: apt update && apt upgrade -y"
echo "This installs security/bugfix updates for the OS itself. Safe on a"
echo "fresh VPS; on an already-running production box you'd normally do"
echo "this during a maintenance window instead."
confirm "Update the system now?"
apt update && apt upgrade -y

# ------------------------------------------------------------------
step "2/14 — Install Node.js 20 LTS"
# ------------------------------------------------------------------
echo "Adding the NodeSource repository and installing Node.js 20 + npm."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Installed: $(node -v) / npm $(npm -v)"
if ! node -e "process.exit(process.versions.node.split('.')[0] >= 20 ? 0 : 1)"; then
  echo "ERROR: Node version is below 20. Next.js 16 requires Node >=20.9.0." >&2
  exit 1
fi

# ------------------------------------------------------------------
step "3/14 — Install git, Nginx, PM2, and Certbot"
# ------------------------------------------------------------------
echo "git       — to clone/pull the app's code"
echo "nginx     — reverse-proxies port 80/443 to the Next.js app on port 3000"
echo "pm2       — keeps the app running in the background, restarts it on crash/reboot"
echo "certbot   — issues and renews free Let's Encrypt SSL certificates"
apt install -y git nginx certbot python3-certbot-nginx
npm install -g pm2

# ------------------------------------------------------------------
step "4/14 — Get the application code"
# ------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  echo "$APP_DIR already contains a git repo — pulling latest instead of cloning."
  git -C "$APP_DIR" pull
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
step "5/14 — Install dependencies"
# ------------------------------------------------------------------
echo "Running npm install on THIS server (important: this compiles the"
echo "better-sqlite3 native module for this machine's OS/architecture —"
echo "never copy a node_modules folder built on a different machine)."
npm install

# ------------------------------------------------------------------
step "6/14 — Configure environment (.env)"
# ------------------------------------------------------------------
if [ -f ".env" ]; then
  echo ".env already exists — leaving it untouched."
else
  cp .env.example .env
  echo "Created .env from .env.example."
  echo "IMPORTANT: edit it now and set a strong ADMIN_PASSWORD before continuing:"
  echo "  nano $APP_DIR/.env"
  confirm "Have you edited .env with a real ADMIN_PASSWORD?"
fi

# ------------------------------------------------------------------
step "7/14 — Set up the database (first time only)"
# ------------------------------------------------------------------
if [ -f "dev.db" ]; then
  echo "dev.db already exists — skipping migrate/seed so we don't touch existing data."
else
  echo "No database found yet. Running:"
  echo "  npx prisma migrate deploy   (creates tables — never wipes existing data)"
  echo "  npm run seed                (populates the menu catalog; skips automatically if data exists)"
  npx prisma migrate deploy
  npm run seed
fi

# ------------------------------------------------------------------
step "8/14 — Build the application"
# ------------------------------------------------------------------
npm run build

# ------------------------------------------------------------------
step "9/14 — Start with PM2 and enable startup-on-boot"
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
step "10/14 — Configure Nginx as a reverse proxy"
# ------------------------------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

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
echo "Nginx now forwards http://$DOMAIN -> http://localhost:3000"

# ------------------------------------------------------------------
step "11/14 — HTTPS via Let's Encrypt"
# ------------------------------------------------------------------
echo "This requests a real SSL certificate for $DOMAIN and www.$DOMAIN."
echo "It will FAIL if DNS for that domain doesn't already point at this VPS's IP."
confirm "Has DNS for $DOMAIN propagated to this server's IP already?"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL_FOR_SSL" --agree-tos --redirect
echo "Certbot also installs its own auto-renewal timer — nothing further to do."

# ------------------------------------------------------------------
step "12/14 — Firewall (UFW)"
# ------------------------------------------------------------------
echo "About to restrict this server to only SSH (22), HTTP (80), and HTTPS (443)."
echo "SSH is allowed FIRST, before enabling, specifically so this can't lock you out."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo
echo "Current UFW rules that will apply once enabled:"
ufw show added
confirm "Enable the firewall now with the rules above?"
ufw --force enable
ufw status

# ------------------------------------------------------------------
step "13/14 — Schedule automatic daily backups"
# ------------------------------------------------------------------
echo "Adding a cron job that runs 'npm run backup' daily at 3:00 AM."
echo "This uses SQLite's VACUUM INTO for a safe, consistent snapshot into"
echo "$APP_DIR/backups/ — it never touches dev.db itself, only reads it."
NPM_PATH="$(command -v npm)"
CRON_LINE="0 3 * * * cd $APP_DIR && $NPM_PATH run backup >> $APP_DIR/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$APP_DIR/backup.log" ; echo "$CRON_LINE" ) | crontab -
echo "Installed crontab entry:"
crontab -l | grep -F "$APP_DIR"
echo "Running one backup now to confirm it works:"
npm run backup

# ------------------------------------------------------------------
step "14/14 — Verify the application is reachable"
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
echo "For future code updates, use deploy/deploy.sh instead of this script."
echo "================================================================"

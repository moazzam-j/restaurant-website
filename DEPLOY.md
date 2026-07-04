# Deploying to Hostinger KVM 1

Hostinger KVM 1 is a self-managed VPS — you get root SSH access to a Linux box, not a managed Node.js host like Vercel. That means you're setting up the whole stack yourself (Node, a process manager, a reverse proxy, SSL), but it also means SQLite and local file uploads work correctly here, unlike on serverless platforms.

This assumes Ubuntu 22.04/24.04 (Hostinger's default template for KVM plans). Run everything as root over SSH.

## Where things live

- **`/var/www/dcf`** (configurable as `APP_DIR`) — application *code* only. This is a git working tree; every deploy replaces its contents with the latest commit.
- **`/var/www/dcf-data`** (configurable as `DATA_DIR`) — the SQLite database (`dev.db`), deliberately kept **outside** the app's git working tree. `.gitignore` already keeps it out of commits, but a directory-wide command like `git clean -fdx` explicitly deletes gitignored files too — physically separating the data directory makes the database immune to that entire class of accident, not just to git tracking.
- **`$APP_DIR/backups/`** and **`$APP_DIR/.env`** stay inside the app directory (as before) — neither is ever touched by a deploy.

## Recommended: use the scripts in `deploy/`

- **`deploy/setup-server.sh`** — run once on a brand new server (safe to re-run on a partially-completed one too; every step checks current state first). Installs Node.js 20, git, Nginx, PM2, Certbot, and UFW; clones the app; points `DATABASE_URL` at the persistent data directory (migrating an existing database there automatically if one is found in the old in-project location); builds and starts it; configures Nginx (with a 20MB upload limit for menu photo uploads) + free HTTPS; opens the firewall; schedules daily backups; and verifies the site is actually reachable. Explains every step and pauses for confirmation before anything destructive (system upgrade, moving an existing database, enabling the firewall, requesting a real SSL cert).
- **`deploy/deploy.sh`** — run for every future code update. Reads the database's real location out of `.env` (rather than assuming a path), takes a safety backup, pulls with `--ff-only` (fails loudly instead of creating a surprise merge commit), reinstalls dependencies (`npm ci` when a lockfile exists), regenerates the Prisma client, applies pending migrations, rebuilds, and restarts. Hashes the database before and after so you can see whether anything unexpected changed. **Guarantees it never touches the database, `backups/`, or `.env`** — refuses to even start if any of them look missing.

### First-time setup

```bash
# On your local machine: push this repo to GitHub/GitLab first if you haven't.

# On the VPS, over SSH as root:
curl -fsSL https://raw.githubusercontent.com/<you>/<your-repo>/main/deploy/setup-server.sh -o setup-server.sh
nano setup-server.sh   # edit DOMAIN, REPO_URL, APP_DIR, DATA_DIR, EMAIL_FOR_SSL at the top
chmod +x setup-server.sh
./setup-server.sh
```

(Or just `scp deploy/setup-server.sh root@your-vps-ip:~/` from your machine instead of `curl`, if you'd rather not make the repo public.)

### Every future deploy

```bash
cd /var/www/dcf
./deploy/deploy.sh
```

That's it — it backs up the database first, pulls, builds, and restarts, then confirms the site is still responding.

---

## Doing it by hand instead

If you'd rather run each command yourself (or a script fails partway and you want to finish manually), here's the same process step by step.

### 1. Point your domain at the VPS

In hPanel, find your VPS's IP address. In your domain's DNS settings, add an A record for `@` and `www` pointing to that IP. DNS can take a few minutes to a few hours to propagate.

### 2. Update the system and install Node.js 20 LTS

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # must be >= v20.9.0 specifically, not just "v20-something"
```

### 3. Install git, Nginx, PM2, and Certbot

```bash
apt install -y git nginx certbot python3-certbot-nginx
npm install -g pm2
```

- **git** — to pull the code
- **nginx** — reverse-proxies port 80/443 to the Next.js app running on port 3000, and terminates SSL
- **pm2** — keeps `npm start` running in the background and restarts it if it crashes or the server reboots
- **certbot** — issues and renews free Let's Encrypt SSL certificates

### 4. Get the code onto the server

This project isn't a git repository yet — push it to a private GitHub/GitLab repo from your own machine first, then clone it here. (Or `scp`/`rsync` the folder up instead, excluding `node_modules` and `.next`.)

```bash
cd /var/www
git clone <your-repo-url> dcf
cd dcf
```

### 5. Install dependencies, generate the Prisma client, and configure the environment

```bash
# Prefer npm ci when a lockfile exists — reproducible, fails loudly on drift
# instead of silently updating the lockfile like npm install would.
npm ci   # or: npm install, if there's no package-lock.json

# Belt-and-suspenders: package.json's postinstall hook already runs this,
# but running it explicitly doesn't depend on that hook still being there.
npx prisma generate

cp .env.example .env
mkdir -p /var/www/dcf-data
chmod 700 /var/www/dcf-data   # contains customer names/phones/addresses
nano .env     # set DATABASE_URL="file:/var/www/dcf-data/dev.db" and a strong ADMIN_PASSWORD
```

**Migrating an existing database from an older deployment?** If `dev.db` already exists inside the app directory from a previous setup, move it (and any sidecar files) into the new location instead of letting a fresh one get created:

```bash
mv dev.db dev.db-journal dev.db-wal dev.db-shm /var/www/dcf-data/ 2>/dev/null || true
```

(The `2>/dev/null || true` just ignores "file not found" for whichever sidecar files don't happen to exist — SQLite doesn't always have all of them.)

### 6. Set up the database (first time only — skip entirely if the database file already exists)

```bash
npx prisma migrate deploy   # production-safe — NOT `migrate dev`, and never touches existing data
npm run seed                 # populates the menu catalog (skips automatically if data already exists)
```

### 7. Build and start with PM2

```bash
npm run build
pm2 start npm --name dcf -- start
pm2 save
pm2 startup    # prints a command — copy/paste and run it so PM2 survives reboots
```

### 8. Put Nginx in front (reverse proxy)

Create `/etc/nginx/sites-available/dcf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Default is 1MB, which would reject /admin/menu photo uploads before
    # they even reach the app (which itself accepts up to 5MB).
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/dcf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 9. Get a free SSL certificate

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com --agree-tos -m you@example.com --redirect
```

Certbot auto-renews via a systemd timer it installs — nothing further to do.

### 10. Schedule database backups

```bash
crontab -e
```

Add:

```
0 3 * * * cd /var/www/dcf && npm run backup >> backup.log 2>&1
```

(`npm run backup` reads `DATABASE_URL` from `.env`, so it automatically backs up from `/var/www/dcf-data/dev.db` once that's configured — no separate change needed for the new location.)

For real redundancy, also periodically copy `/var/www/dcf/backups/` off the server (e.g. `rsync` to your own machine, or to S3/Backblaze) — a backup on the same disk as the original doesn't survive a disk failure.

### 11. Firewall — only expose what's needed

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 12. Verify

```bash
curl -I http://localhost:3000/          # should return HTTP 200 direct from the app
curl -I https://yourdomain.com/         # should return HTTP 200 through Nginx + SSL
```

### Future manual deploys

```bash
cd /var/www/dcf
npm run backup              # safety snapshot first
git pull --ff-only          # fails loudly instead of creating a surprise merge commit
npm ci                      # or npm install if there's no lockfile
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart dcf
```

---

## Checklist before going live

- [ ] `ADMIN_PASSWORD` in `.env` is a real, strong password (not the dev placeholder)
- [ ] `DATABASE_URL` in `.env` points at `/var/www/dcf-data/dev.db` (or wherever you set `DATA_DIR`), not somewhere inside the app directory
- [ ] `node -e "console.log(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi'}).format())"` prints a date without erroring (confirms ICU data is present — should be fine on a standard Ubuntu Node install)
- [ ] Placed a real test order end-to-end and confirmed it shows up in `/admin`
- [ ] Confirmed `/admin/menu` photo uploads work, including a file a few MB in size (Nginx's `client_max_body_size` and the app's own 5MB limit both need to allow it)
- [ ] Cron backup job is in place and you've manually run `npm run backup` once to confirm it works

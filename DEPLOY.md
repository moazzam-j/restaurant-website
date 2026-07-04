# Deploying to Hostinger KVM 1

Hostinger KVM 1 is a self-managed VPS — you get root SSH access to a Linux box, not a managed Node.js host like Vercel. That means you're setting up the whole stack yourself (Node, a process manager, a reverse proxy, SSL), but it also means SQLite and local file uploads work correctly here, unlike on serverless platforms.

This assumes Ubuntu 22.04/24.04 (Hostinger's default template for KVM plans). Run everything as root over SSH.

## Release-based deployment structure

Every deploy creates a brand new, fully-built release directory; the live site only switches over to it after the build succeeds. This means a bad deploy never takes the site down — the previous release just keeps running until the new one proves itself. Rolling back is a single command.

```
/var/www/
    dcf-current -> releases/2026-07-10-093000   (symlink; this is what PM2 and Nginx actually run)
    releases/
        2026-07-04-120000/    (a full git checkout + node_modules + .next, from one deploy)
        2026-07-10-093000/    (the newest — currently live)
    shared/
        .env                  (real secrets; symlinked into every release)
        dev.db                (the only copy of the database, ever)
        backups/              (symlinked into every release)
        uploads/              (admin-uploaded menu photos; symlinked into public/uploads)
    config.sh                 (stable settings deploy.sh/rollback.sh read on every run)
    deploy.sh                 (stable copy — always the latest version from the repo)
    rollback.sh                (stable copy — always the latest version from the repo)
```

**Why `shared/`, not inside a release:** a release directory is a disposable, fully-reproducible build of the code — nothing in it should be unique or irreplaceable. `.env`, the database, backups, and uploaded photos are the opposite: they must survive forever, across every future deploy, and must never be affected by cloning fresh code or pruning old releases. Keeping them in one place outside every release directory, and only ever symlinking them in, means a deploy script literally cannot delete them even by accident — there's no code path in `deploy.sh` that writes to `shared/` at all (except the safety backup, which only adds files).

**Why `deploy.sh`/`rollback.sh` also live in a stable top-level location, not just inside each release:** old releases get pruned automatically (see below). If the deploy script only existed inside a release directory, pruning could eventually delete the very script you use to deploy. Instead, `setup-server.sh` installs the first stable copy at `/var/www/deploy.sh` once, and after every *successful* deploy, `deploy.sh` copies its own newest version (from the release it just shipped) back over that stable copy — so improvements committed to the repo take effect starting with the next deploy, automatically, with no manual re-copying. A failed deploy never touches the stable copies, so a broken script in a bad release can't lock you out.

## Recommended: use the scripts in `deploy/`

- **`deploy/setup-server.sh`** — run once on a brand new server (safe to re-run on a partially-completed one too; every step checks current state first). Installs Node.js 20, git, Nginx, PM2, Certbot, and UFW; creates the `releases/`/`shared/` skeleton; migrates data from an older (pre-release-structure) deployment if one is found; writes the stable `config.sh`; fetches `deploy.sh`/`rollback.sh` from the repo into their stable locations; configures Nginx (with a 20MB upload limit) + free HTTPS; opens the firewall; schedules daily backups; then hands off to `deploy.sh` to ship the actual first release.
- **`deploy/deploy.sh`** (run from the stable copy, `/var/www/deploy.sh`) — ships a new release. Clones fresh code into a new timestamped directory, symlinks `.env`/`backups/`/`public/uploads` in from `shared/`, installs dependencies, regenerates the Prisma client, applies pending migrations (and seeds the menu catalog only on a brand new database), builds — and **only if the build succeeds** — atomically switches `dcf-current` to the new release and restarts PM2. Verifies the site responds afterward. Prunes old releases, always keeping the live one plus the 5 before it, and defensively refuses to ever delete whichever release `dcf-current` currently points at. **Guarantees it never touches `shared/dev.db`, `shared/.env`, or `shared/backups`** — refuses to even start if `.env` is missing.
- **`deploy/rollback.sh`** (run from the stable copy, `/var/www/rollback.sh`) — instantly switches `dcf-current` back to the previous release and restarts PM2 (or pass a specific release name, e.g. `./rollback.sh 2026-07-04-120000`, to target one explicitly). Contains no reference to the database, `.env`, or backups at all — it's structurally incapable of touching shared data. **Known limitation:** it reverts code only, not the database — if the release you're rolling back from already applied a schema migration, that migration isn't undone. Safe for additive migrations; check what migrated before relying on it otherwise.

### First-time setup

```bash
# On your local machine: push this repo to GitHub/GitLab first if you haven't.

# On the VPS, over SSH as root:
curl -fsSL https://raw.githubusercontent.com/<you>/<your-repo>/main/deploy/setup-server.sh -o setup-server.sh
nano setup-server.sh   # edit DOMAIN, REPO_URL, EMAIL_FOR_SSL at the top
chmod +x setup-server.sh
./setup-server.sh
```

(Or just `scp deploy/setup-server.sh root@your-vps-ip:~/` from your machine instead of `curl`, if you'd rather not make the repo public.)

### Every future deploy

```bash
/var/www/deploy.sh
```

That's it — from anywhere, since it's not tied to a particular release's working directory. It creates a new release, builds it, switches over only on success, and confirms the site is responding.

### Rolling back

```bash
/var/www/rollback.sh
```

Reverts to whichever release was live immediately before the current one, after confirming. To go back further, list what's on disk and target one explicitly:

```bash
ls /var/www/releases
/var/www/rollback.sh 2026-07-04-120000
```

---

## Doing it by hand instead

If you'd rather understand or perform each piece yourself (or a script fails partway and you want to finish manually):

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

### 4. Create the release/shared skeleton

```bash
mkdir -p /var/www/releases /var/www/shared/backups /var/www/shared/uploads
chmod 700 /var/www/shared   # contains .env + the database + uploaded photos
cat > /var/www/shared/.env <<'EOF'
DATABASE_URL="file:/var/www/shared/dev.db"
ADMIN_PASSWORD="change-me-to-something-strong"
EOF
nano /var/www/shared/.env   # set the real ADMIN_PASSWORD now
```

**Migrating an existing database from an older (pre-release-structure) deployment?** Move it, and any sidecar files, into `shared/` instead of letting a fresh one get created:

```bash
mv /var/www/dcf/dev.db* /var/www/shared/ 2>/dev/null || true
mv /var/www/dcf/.env /var/www/shared/.env   # only if you haven't created a fresh one above
mv /var/www/dcf/backups/* /var/www/shared/backups/ 2>/dev/null || true
mv /var/www/dcf/public/uploads/* /var/www/shared/uploads/ 2>/dev/null || true
```

### 5. Clone the first release

```bash
RELEASE=/var/www/releases/$(date +%Y-%m-%d-%H%M%S)
git clone <your-repo-url> "$RELEASE"
cd "$RELEASE"

ln -sfn /var/www/shared/.env "$RELEASE/.env"
ln -sfn /var/www/shared/backups "$RELEASE/backups"
rm -rf "$RELEASE/public/uploads"
ln -sfn /var/www/shared/uploads "$RELEASE/public/uploads"

npm ci   # or: npm install, if there's no package-lock.json
npx prisma generate   # belt-and-suspenders alongside the postinstall hook
```

### 6. Set up the database (first time only — skip if `shared/dev.db` already exists)

```bash
npx prisma migrate deploy   # production-safe — NOT `migrate dev`, and never touches existing data
npm run seed                 # populates the menu catalog (skips automatically if data already exists)
```

### 7. Build, switch the symlink, and start with PM2

```bash
npm run build   # only proceed past this if it succeeds

ln -sfn "$RELEASE" /var/www/dcf-current-tmp
mv -T /var/www/dcf-current-tmp /var/www/dcf-current   # atomic swap — avoids a broken-symlink instant

pm2 start npm --name dcf --cwd /var/www/dcf-current -- start
pm2 save
pm2 startup    # prints a command — copy/paste and run it so PM2 survives reboots
```

Using `--cwd /var/www/dcf-current` (the symlink) rather than the release path directly is what lets `pm2 restart dcf` pick up a new release automatically after a future symlink swap, with no PM2 reconfiguration needed.

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
0 3 * * * cd /var/www/dcf-current && npm run backup >> /var/www/shared/backup.log 2>&1
```

(`npm run backup` reads `DATABASE_URL` from `.env`, which is symlinked in from `shared/` — no path changes needed as releases come and go, since the cron job always runs from whatever `dcf-current` currently points at.)

For real redundancy, also periodically copy `/var/www/shared/backups/` off the server (e.g. `rsync` to your own machine, or to S3/Backblaze) — a backup on the same disk as the original doesn't survive a disk failure.

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
RELEASE=/var/www/releases/$(date +%Y-%m-%d-%H%M%S)
git clone <your-repo-url> "$RELEASE"
cd "$RELEASE"
ln -sfn /var/www/shared/.env "$RELEASE/.env"
ln -sfn /var/www/shared/backups "$RELEASE/backups"
rm -rf "$RELEASE/public/uploads" && ln -sfn /var/www/shared/uploads "$RELEASE/public/uploads"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build   # only continue past here if it succeeds
ln -sfn "$RELEASE" /var/www/dcf-current-tmp && mv -T /var/www/dcf-current-tmp /var/www/dcf-current
pm2 restart dcf
# then remove any releases older than the 5 you want to keep, e.g.:
# ls -1d /var/www/releases/*/ | sort -r | tail -n +7 | xargs -r rm -rf
```

### Rolling back manually

```bash
ls /var/www/releases                          # find the release name you want
ln -sfn /var/www/releases/<name> /var/www/dcf-current-tmp
mv -T /var/www/dcf-current-tmp /var/www/dcf-current
pm2 restart dcf
```

---

## Checklist before going live

- [ ] `ADMIN_PASSWORD` in `/var/www/shared/.env` is a real, strong password (not the dev placeholder)
- [ ] `DATABASE_URL` in `/var/www/shared/.env` points at `/var/www/shared/dev.db`
- [ ] `node -e "console.log(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi'}).format())"` prints a date without erroring (confirms ICU data is present — should be fine on a standard Ubuntu Node install)
- [ ] Placed a real test order end-to-end and confirmed it shows up in `/admin`
- [ ] Confirmed `/admin/menu` photo uploads work, including a file a few MB in size, and that the photo survives a subsequent `/var/www/deploy.sh` run (proves the `shared/uploads` symlink is working)
- [ ] Cron backup job is in place and you've manually run `npm run backup` once to confirm it works
- [ ] Ran `/var/www/rollback.sh` once against a harmless test release to confirm it works before you actually need it in an emergency

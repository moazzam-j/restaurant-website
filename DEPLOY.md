# Deploying to Hostinger KVM 1

Hostinger KVM 1 is a self-managed VPS — you get root SSH access to a Linux box, not a managed Node.js host like Vercel. That means you're setting up the whole stack yourself (Node, a process manager, a reverse proxy, SSL), but it also means SQLite and local file uploads work correctly here, unlike on serverless platforms.

This assumes Ubuntu 22.04/24.04 (Hostinger's default template for KVM plans). Run everything as root over SSH.

## Recommended: use the scripts in `deploy/`

- **`deploy/setup-server.sh`** — run once on a brand new server. Installs Node.js, git, Nginx, PM2, Certbot, and UFW; clones the app; sets up the database; builds and starts it; configures Nginx + free HTTPS; opens the firewall; schedules daily backups; and verifies the site is actually reachable. Explains every step and pauses for confirmation before anything destructive (system upgrade, enabling the firewall, requesting a real SSL cert).
- **`deploy/deploy.sh`** — run for every future code update. Pulls latest code, installs dependencies, applies any new migrations, rebuilds, and restarts — and **guarantees it never touches `dev.db`, `backups/`, or `.env`** (it checks their state before and after, and refuses to run at all if they're missing).

### First-time setup

```bash
# On your local machine: push this repo to GitHub/GitLab first if you haven't.

# On the VPS, over SSH as root:
curl -fsSL https://raw.githubusercontent.com/<you>/<your-repo>/main/deploy/setup-server.sh -o setup-server.sh
nano setup-server.sh   # edit DOMAIN, REPO_URL, APP_DIR, EMAIL_FOR_SSL at the top
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

If you'd rather run each command yourself (or the script fails partway and you want to finish manually), here's the same process step by step.

### 1. Point your domain at the VPS

In hPanel, find your VPS's IP address. In your domain's DNS settings, add an A record for `@` and `www` pointing to that IP. DNS can take a few minutes to a few hours to propagate.

### 2. Update the system and install Node.js 20 LTS

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # must print v20.9.0 or higher
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

### 5. Install dependencies and configure environment

```bash
npm install   # compiles better-sqlite3 for THIS server — don't copy node_modules from Windows
cp .env.example .env
nano .env     # set DATABASE_URL=file:./dev.db and a strong ADMIN_PASSWORD
```

### 6. Set up the database (first time only — skip if `dev.db` already exists)

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
npm run backup          # safety snapshot first
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart dcf
```

---

## Checklist before going live

- [ ] `ADMIN_PASSWORD` in `.env` is a real, strong password (not the dev placeholder)
- [ ] `node -e "console.log(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi'}).format())"` prints a date without erroring (confirms ICU data is present — should be fine on a standard Ubuntu Node install)
- [ ] Placed a real test order end-to-end and confirmed it shows up in `/admin`
- [ ] Confirmed `/admin/menu` photo uploads work (writes to `public/uploads` — needs write permission for the user PM2 runs as)
- [ ] Cron backup job is in place and you've manually run `npm run backup` once to confirm it works

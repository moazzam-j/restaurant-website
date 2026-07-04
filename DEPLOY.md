# Deploying to Hostinger KVM 1

Hostinger KVM 1 is a self-managed VPS — you get root SSH access to a Linux box, not a managed Node.js host like Vercel. That means you're setting up the whole stack yourself (Node, a process manager, a reverse proxy, SSL), but it also means SQLite and local file uploads work correctly here, unlike on serverless platforms.

This assumes Ubuntu 22.04/24.04 (Hostinger's default template for KVM plans). Run everything as root over SSH unless noted.

## 1. Point your domain at the VPS

In hPanel, find your VPS's IP address. In your domain's DNS settings, add an A record for `@` and `www` pointing to that IP. DNS can take a few minutes to a few hours to propagate.

## 2. Update the system and install Node.js 20 LTS

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # must print v20.9.0 or higher
```

## 3. Install git, Nginx, and PM2

```bash
apt install -y git nginx
npm install -g pm2
```

- **git** — to pull the code (see step 4)
- **nginx** — reverse-proxies port 80/443 to the Next.js app running on port 3000, and terminates SSL
- **PM2** — keeps `npm start` running in the background and restarts it if it crashes or the server reboots

## 4. Get the code onto the server

This project isn't a git repository yet. Easiest path: push it to a private GitHub/GitLab repo from your own machine, then clone it here. (If you'd rather skip git entirely, `scp`/`rsync` the folder up instead — just exclude `node_modules` and `.next`.)

```bash
cd /var/www
git clone <your-repo-url> dcf
cd dcf
```

## 5. Install dependencies and configure environment

```bash
npm install   # compiles better-sqlite3 for THIS server — don't copy node_modules from Windows
cp .env.example .env
nano .env     # set DATABASE_URL=file:./dev.db and a strong ADMIN_PASSWORD
```

## 6. Set up the database

```bash
npx prisma migrate deploy   # production-safe — NOT `migrate dev`
npm run seed                 # populates the menu catalog (skips automatically if data already exists)
```

## 7. Build and start with PM2

```bash
npm run build
pm2 start npm --name dcf -- start
pm2 save
pm2 startup    # prints a command — copy/paste and run it so PM2 survives reboots
```

## 8. Put Nginx in front (reverse proxy)

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
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dcf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 9. Get a free SSL certificate

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-renews via a systemd timer it installs — nothing further to do.

## 10. Schedule database backups (replaces the Windows Task Scheduler job from local dev)

```bash
crontab -e
```

Add:

```
0 3 * * * cd /var/www/dcf && npm run backup >> backup.log 2>&1
```

For real redundancy, also periodically copy `/var/www/dcf/backups/` off the server (e.g. `rsync` to your own machine, or to S3/Backblaze) — a backup on the same disk as the original doesn't survive a disk failure.

## 11. Firewall — only expose what's needed

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## Deploying future changes

```bash
cd /var/www/dcf
git pull
npm install
npm run build
pm2 restart dcf
```

## Checklist before going live

- [ ] `ADMIN_PASSWORD` in `.env` is a real, strong password (not the dev placeholder)
- [ ] `node -e "console.log(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi'}).format())"` prints a date without erroring (confirms ICU data is present — should be fine on a standard Ubuntu Node install)
- [ ] Placed a real test order end-to-end and confirmed it shows up in `/admin`
- [ ] Confirmed `/admin/menu` photo uploads work (writes to `public/uploads` — needs write permission for the user PM2 runs as)
- [ ] Cron backup job is in place and you've manually run `npm run backup` once to confirm it works

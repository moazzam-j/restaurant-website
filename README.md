# DCF — Delite Chicken Food

Next.js ordering site for DCF, a fast-food restaurant in Bahria Town Lahore. Customers browse the menu, place cash-on-delivery orders, and track order status; staff manage the menu catalog and update order statuses from an admin panel.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Prisma + SQLite (via `@prisma/adapter-better-sqlite3`)

Deploying to a VPS (e.g. Hostinger KVM)? See [DEPLOY.md](DEPLOY.md) for the full server setup.

## Getting started

```bash
npm install        # also runs `prisma generate` via postinstall
cp .env.example .env   # fill in DATABASE_URL and ADMIN_PASSWORD
npx prisma migrate dev # create the local SQLite database
npm run seed        # populate the menu catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. Required:

- `DATABASE_URL` — SQLite connection string (e.g. `file:./dev.db`)
- `ADMIN_PASSWORD` — shared password for the `/admin` staff dashboard. **Change this before deploying.**

## Admin panel

`/admin` — order dashboard (search, filter, status updates, print, CSV export)
`/admin/menu` — menu catalog management (items, prices, categories, photo uploads)

Gated by `ADMIN_PASSWORD`; session cookie lasts 12 hours.

## Notes for deployment

- The `postinstall` script runs `prisma generate` automatically — no extra build step needed on most hosts.
- Item photo uploads (`/admin/menu` → "+ Add Item") are written directly to `public/uploads` on the local filesystem. This works on a traditional Node server but **not** on serverless hosts with an ephemeral/read-only filesystem (e.g. Vercel) — swap `src/app/api/admin/upload/route.ts` for object storage (S3, Cloudinary, etc.) before deploying there.
- SQLite is a single file (`dev.db`) — fine for a single-restaurant deployment on a persistent-disk host, but won't work on platforms without persistent storage. The schema avoids SQLite-only features (app-generated IDs instead of autoincrement, no native enums) specifically so it can be migrated to Postgres later with minimal changes.
- `better-sqlite3` is a native module — it gets compiled for whatever OS/architecture runs `npm install`. Run `npm install` **on the deployment server itself** (or in a matching Docker build stage); don't copy a `node_modules` folder built on your Windows machine to a Linux server, it won't work there.
- Business hours (`src/lib/business-hours.ts`) and 12-hour time displays rely on `Intl.DateTimeFormat` with a specific timezone (`Asia/Karachi`). This needs a Node build with full ICU data. Most hosts (Vercel, Railway, Render, a normal Ubuntu/Debian server) are fine by default — but a minimal Docker base image like plain `node:alpine` may ship without full ICU and would throw `RangeError: Invalid time zone specified`. If deploying via Docker, use a base image with full ICU (e.g. `node:20` instead of `node:20-alpine`, or `node:20-alpine` plus the `full-icu` package) and verify with: `node -e "console.log(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi'}).format())"`.
- Pin your deployment to **Node ≥20.9.0** (Next.js 16's minimum) — now enforced via `engines` in `package.json`, though not all hosts respect that field automatically.

## Backups

`npm run backup` copies the live database to `backups/dcf-<timestamp>.db` using SQLite's `VACUUM INTO` (a safe, consistent snapshot even while the app is running — not a raw file copy, which could grab a half-written file). It keeps the most recent 30 backups and prunes older ones automatically. Backups contain customer names/phones/addresses, so `backups/` is gitignored — treat those files as sensitive.

**Currently scheduled locally**: a Windows Task Scheduler task named `DCF-DB-Backup` runs `npm run backup` daily at 3:00 AM on this machine (output logged to `backup.log`). This only backs up the file to this same PC's disk — it doesn't upload anywhere, and it only runs while this machine is on. Check status with:

```powershell
Get-ScheduledTaskInfo -TaskName "DCF-DB-Backup"
```

**Once deployed to a real server**, this local task won't help (the live site won't be running on this PC anymore) — recreate the same schedule on whichever host you deploy to:

- **Linux/most VPS hosts**: a cron entry, e.g. `0 3 * * * cd /path/to/app && npm run backup` (daily at 3 AM)
- **Windows Server**: a Task Scheduler task running the same command (same as above)
- **Railway/Render/etc.**: their built-in "cron job" / scheduled-task feature, pointed at `npm run backup`

For real redundancy, also copy the `backups/` folder off the server periodically (e.g. sync to S3/Backblaze/cloud storage) — a backup that lives on the same disk as the original doesn't protect against disk failure.

# Maria's Cleaning Service

Private operations dashboard for Maria's Cleaning Service. It includes login, admin and employee roles, client records, job scheduling, staff assignments, time clock entries, CSV payroll export, and weekly invoice printing.

## Local Setup

Install dependencies:

```bash
npm install
```

Copy the environment template and fill in values:

```bash
cp .env.example .env
```

Recommended local `.env`:

```bash
NODE_ENV=development
HOST=localhost
PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
COOKIE_SECURE=false
TRUST_PROXY=true
```

Start locally:

```bash
npm run start:localhost
```

Open `http://localhost:3001`.

## Environment Variables

`PORT`: Server port. Defaults to `3001`.

`HOST`: Bind address. Use `localhost` for local-only development. In production, leave unset unless the host requires it.

`NODE_ENV`: Use `production` on Render, Railway, Fly.io, or a VPS.

`ADMIN_USERNAME`: Username for the bootstrap admin account when `data/store.json` has no users.

`ADMIN_PASSWORD`: Optional in development. Required in production. Use a long unique password and do not commit it.

`COOKIE_SECURE`: Set to `true` only when the app is served over HTTPS.

`TRUST_PROXY`: Keep `true` behind Render, Railway, Fly.io, Nginx, or another HTTPS proxy.

`STORE_PATH`: Optional override for the data file path. Leave unset for normal use.

## First Admin Setup

The app creates the first admin only when `data/store.json` has no users. For Maria's launch:

1. Set `ADMIN_USERNAME` to Maria's admin username.
2. Set `ADMIN_PASSWORD` in the host's private environment settings.
3. Start the app once so the admin account is created.
4. Sign in and use **Change Password** if Maria wants to rotate it.
5. Add employee accounts from the Employees screen and require each employee to change their password after first login.

Do not put Maria's real password in `README.md`, `.env.example`, screenshots, or chat messages.

## Data Store

Runtime data lives in `data/store.json`, which is intentionally ignored by git. New clones can start from `data/store.example.json`, or the server will create an empty store on first run.

This JSON store now uses serialized updates and atomic file replacement to reduce local data corruption risk, but it is still a bridge. Before multiple people use the app heavily at the same time, migrate to SQLite or Postgres.

## Backups

Create a manual backup:

```bash
npm run backup
```

By default, backups are written to `backups/store-<timestamp>.json`. Schedule the same command with cron, Render Cron Jobs, Railway cron, or host snapshots. Keep at least daily backups and test restore by copying a backup back to `data/store.json` in a staging or local copy.

## Production Deploy

Use a Node host with persistent disk storage, such as Render with a persistent disk, Railway with a volume, Fly.io volume storage, or a VPS. Static-only hosts are not enough.

Required production settings:

```bash
NODE_ENV=production
ADMIN_USERNAME=<maria-admin-username>
ADMIN_PASSWORD=<long-private-password>
COOKIE_SECURE=true
TRUST_PROXY=true
```

Start command:

```bash
npm start
```

Ship only behind HTTPS. Confirm the platform preserves `data/store.json` across restarts, or migrate to SQLite/Postgres before launch.

## Pre-Launch Checklist

Run:

```bash
npm audit fix
npm run check
npm start
```

Smoke-test on desktop and a real phone:

- Login and logout
- Change your password
- Add a client
- Schedule a house or office cleaning
- Assign staff
- Mark a job cleaned
- Employee clock-in from the Time Clock tab
- Export timesheet CSV
- Print weekly invoices
- Visit `/ping` and confirm it returns `{ "ok": true }`

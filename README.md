# Maria's Cleaning Service

Private operations dashboard for Maria's Cleaning Service.

## Recommended Web Launch Setup

This app needs a Node server and a writable JSON data file at `data/store.json`, so static hosts like Vercel, Netlify, or GitHub Pages are not a good fit by themselves. Use a Node host that supports persistent disk storage, such as Render, Railway, Fly.io, a VPS, or your own machine behind a private tunnel.

For a public web deployment, serve it only over HTTPS and set `NODE_ENV=production`, `ADMIN_PASSWORD`, and `COOKIE_SECURE=true`.

## Environment Setup

Create a local `.env` file based on `.env.example`, or pass the values inline when starting the server.

Recommended local values:

```bash
NODE_ENV=development
HOST=localhost
PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-long-unique-password
COOKIE_SECURE=false
TRUST_PROXY=true
```

Notes:

- `HOST=localhost` keeps the app on the current computer only.
- In production, omit `HOST` unless your host requires it. The server binds to `0.0.0.0` when `NODE_ENV=production`.
- `PORT=3001` makes the app available at `http://localhost:3001`.
- Set `COOKIE_SECURE=true` only when you are serving the app over HTTPS.
- `ADMIN_PASSWORD` is required in production. The app will refuse to start without it.

## Run On Localhost

Install dependencies if needed:

```bash
npm install
```

Run in development with auto-restart:

```bash
npm run dev
```

Run normally on localhost:

```bash
npm run start:localhost
```

Or run with a custom username and password:

```bash
HOST=localhost PORT=3001 ADMIN_USERNAME='antonio' ADMIN_PASSWORD='your-strong-password' node server.js
```

Then open:

```text
http://localhost:3001
```

## Run For Production

Set these environment variables in your hosting provider:

```bash
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-long-unique-password
COOKIE_SECURE=true
TRUST_PROXY=true
```

Use this start command:

```bash
npm start
```

Before deploying, run:

```bash
npm run check
```

## Important Local Notes

- All app data lives in `data/store.json`. Back it up before major changes.
- Use persistent disk storage in production. Ephemeral filesystems can erase new bookings, clients, and time entries on restart.
- Sessions are stored in server memory, so restarting the server signs users out.
- Printing features work best from a desktop browser.
- Keep this repository private because `data/store.json` can contain real client and staff information.

## Suggested First Local Run

1. Set a strong admin password.
2. Start the app with `npm run start:localhost`.
3. Open `http://localhost:3001`.
4. Sign in with the configured admin credentials.
5. Change the password from inside the app after first login.

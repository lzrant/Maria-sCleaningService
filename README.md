# Maria's Cleaning Service

Private operations dashboard for Maria's Cleaning Service.

## Recommended launch setup

For a private production-style launch that only you can access from your phone, use one of these:

- Best: run the app on your Mac and access it from your phone over Tailscale.
- Good: run the app on your Mac and access it only while both devices are on your home Wi-Fi.

Avoid static hosts like Vercel, Netlify, or GitHub Pages. This app needs a Node server and a writable JSON data file at `data/store.json`.

## Environment setup

Create a local `.env` file based on `.env.example`.

Recommended values for a private launch:

```bash
HOST=0.0.0.0
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-long-unique-password
COOKIE_SECURE=false
```

Notes:

- `HOST=127.0.0.1` keeps the app only on the current machine.
- `HOST=0.0.0.0` allows access from your phone on the same private network or over Tailscale.
- Set `COOKIE_SECURE=true` only when you are serving the app over HTTPS.

## Run locally

Install dependencies if needed:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Run for private phone access:

```bash
ADMIN_PASSWORD='your-strong-password' npm run start:private-phone
```

Or with a custom username too:

```bash
HOST=0.0.0.0 PORT=3000 ADMIN_USERNAME='antonio' ADMIN_PASSWORD='your-strong-password' node server.js
```

## Access from your phone

### Option 1: Tailscale only

1. Install Tailscale on your Mac and iPhone.
2. Sign into the same Tailscale account on both.
3. Start the app with `HOST=0.0.0.0`.
4. On your Mac, find its Tailscale IP or machine name in Tailscale.
5. On your phone, open `http://YOUR-TAILSCALE-IP:3000` or `http://YOUR-MACHINE-NAME:3000`.

This is the best option if you want the site reachable only by your own devices.

### Option 2: Home Wi-Fi only

1. Make sure your Mac and phone are on the same Wi-Fi network.
2. Start the app with `HOST=0.0.0.0`.
3. Find your Mac's local IP address.
4. Open `http://YOUR-MAC-IP:3000` on your phone.

If you use this option, keep port forwarding disabled on your router.

## Important launch notes

- All app data lives in `data/store.json`. Back it up.
- Sessions are stored in server memory, so restarting the server signs users out.
- Printing features are more desktop-friendly than phone-friendly.
- Keep this repository private because `data/store.json` can contain real client and staff information.

## Suggested first private launch

1. Set a strong admin password.
2. Start with Tailscale access.
3. Log in on your phone.
4. Change the password again from inside the app after first login.
5. Back up `data/store.json` before making major changes.

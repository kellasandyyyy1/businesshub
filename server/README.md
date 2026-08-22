# BFH push server

Delivers Web Push notifications for Business Finance Hub. It is deliberately
small: one Express app, one SQLite file, two tables.

## What it stores

| Table               | Contents                                                      |
| ------------------- | ------------------------------------------------------------- |
| `subscriptions`     | One row per device: a random UUID and the browser's push keys |
| `notification_log`  | Which *type* of alert went to which device, and when          |

It never sees a transaction, an invoice, a client, an amount, or a business
name. Those live in the browser's IndexedDB and never leave it. Notification
wording is sent from the client, handed straight to the push service, and — with
`LOG_TITLES=false` — never written to disk.

There is no auth, because the app has no accounts. A device is reachable only by
its UUID, which is generated in the browser and shared with nobody.

## Setup

```sh
cd server
npm install
npm run keys          # prints a VAPID key pair
cp .env.example .env  # paste the keys in
npm start
```

`CLIENT_ORIGIN` is a comma-separated allowlist — keep the dev URL and add the
deployed one when you go live.

On the client side, point `VITE_PUSH_BACKEND_URL` at this server.

## Endpoints

| Method   | Path                 | Purpose                                      |
| -------- | -------------------- | -------------------------------------------- |
| `GET`    | `/vapid-public-key`  | The key the browser needs to subscribe        |
| `POST`   | `/subscribe`         | Register or refresh a device                  |
| `DELETE` | `/subscribe`         | Unregister a device and purge its log rows    |
| `POST`   | `/notify`            | Deliver one notification                      |
| `GET`    | `/health`            | Liveness check                                |

`/notify` sends at most one push per device per type per day, so the client can
call it on every load without repeating itself. A `410` means the browser threw
the subscription away; the row is deleted and the client clears its local flag.

## Deploying

Railway, Render, and Fly.io free tiers all run this unchanged. Set the same
environment variables there, and point `DB_PATH` at a mounted volume if you want
the dedupe log to survive restarts — losing it costs at most one repeated
notification.

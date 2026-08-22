# Deploying to Vercel

The app itself is static and needs no server. Two features reach outside the
browser, and they are handled differently.

## 1. Import the repo

Vercel detects Vite. `vercel.json` already pins the build:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

`vercel.json` also rewrites every client route to `index.html` while letting
`/api/*`, the service workers, the manifest and the static folders through
untouched — without that, a refresh on `/invoices` returns a 404.

## 2. The AI assistant

**Set `GROQ_API_KEY` in Vercel → Settings → Environment Variables.** No `VITE_`
prefix. That is the whole point: `VITE_`-prefixed variables are compiled into
the bundle and are public. The key is read by `api/groq.js`, a serverless
function the browser talks to instead of calling Groq directly.

Do **not** set `VITE_GROQ_API_KEY` in Vercel. A production build ignores it, but
setting it would still publish the key in the bundle.

With no key set, the assistant answers "The assistant is not set up on this
deployment." and the rest of the app is unaffected.

Locally nothing changes: `npm run dev` still reads `VITE_GROQ_API_KEY` from
`.env` and calls Groq directly, because there is no serverless runtime in dev.

## 3. Push notifications

**The push server in `/server` cannot run on Vercel.** It is an always-on
Express process storing subscriptions in SQLite, and Vercel functions are
stateless with an ephemeral filesystem — the database would be discarded
between invocations, and `better-sqlite3` is a native module besides.

Deploy it to a host that runs a persistent process. Render, Railway and Fly all
have a free tier that fits it:

1. Point the host at the `server/` directory. Start command `node index.js`.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` from
   `server/.env` (or generate a fresh pair with `npm run keys`).
3. Set `CLIENT_ORIGIN` to your Vercel URL, comma-separated if you also want
   local dev: `https://your-app.vercel.app,http://localhost:5173`.
4. In Vercel, set `VITE_PUSH_BACKEND_URL` to the host's **https** URL.

The https matters. A page served over https cannot call an http backend; the
browser blocks it as mixed content and the toggle reports the server as
unavailable.

Leave `VITE_PUSH_BACKEND_URL` unset and push simply reads "Not supported".
The bell, the in-app notification list and every alert still work — those are
computed on the device and never needed the server.

## 4. After the first deploy

- Open the site, then devtools → Application → Manifest and Service Workers.
  One worker should be active at `/sw.js`.
- Installing is offered from the dashboard banner or Settings → About.
- **Rotate the Groq key.** The one currently in `.env` has been built into a
  bundle, so treat it as compromised: issue a new one, put it in Vercel as
  `GROQ_API_KEY`, and keep the old value out of the repo.

`.env` is gitignored and should stay that way.

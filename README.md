# Dual Finance

A financial command centre for small businesses, freelancers and agencies.
Everything lives in the browser — no accounts, no cloud, no backend for the
core features. Open it, and your books are already there.

Built for Philippine small businesses (₱, 12% VAT, BIR-shaped reports), but the
currency and financial year are configurable.

## What it does

| | |
| --- | --- |
| **Dashboard** | Cash, revenue, expenses, profit, a health score and whatever needs attention |
| **Transactions** | Every peso in and out, searchable and filterable |
| **Income / Expenses** | Where money comes from and goes, by client, category and merchant |
| **Invoices** | Create, send, track paid/unpaid/overdue, print |
| **Clients** | A profile per client with their full history |
| **Budgets** | Per-category limits with warnings at 80% |
| **Cash Flow** | Current position projected 30/60/90 days out |
| **Reports** | Profit and loss, expense and revenue breakdowns, as PDF or Excel |
| **Insights** | Plain-English reading of the numbers |
| **Export** | Nine spreadsheet exports, CSV or XLSX |

Plus an AI assistant (ask questions, or say *"add 500 sa truck"* and it opens the
form filled in), installable as a PWA, and optional push notifications.

## Stack

React 18 · Vite 8 · Dexie (IndexedDB) · Tailwind for layout only · Tabler icons ·
Groq for the assistant · `vite-plugin-pwa` for the service worker

No component library. The monochrome design system is hand-built:
hairlines, one inverted chip per screen as the entire emphasis budget, mono
micro-labels, no colour anywhere.

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env     # add your Groq key for the assistant
npm run dev              # http://localhost:5173
```

A new install starts empty. The first run collects your business name, currency
and opening balance, and sets up a starting list of categories — nothing else.

`npm run dev` also starts the push server if `server/` is set up; without it the
app runs fine and the push toggle reads "Not supported".

| Script | Does |
| --- | --- |
| `npm run dev` | App + push server together |
| `npm run dev:web` | App only |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Oxlint |
| `npm run generate-icons` | Rebuild PWA icons from `public/favicon.svg` |

## Environment

| Variable | Where | Why |
| --- | --- | --- |
| `VITE_GROQ_API_KEY` | `.env`, local only | Assistant in development |
| `GROQ_API_KEY` | Hosting provider | Assistant in production, read by `api/groq.js` |
| `VITE_PUSH_BACKEND_URL` | `.env` and host | Push server URL — must be `https` when deployed |

**Anything prefixed `VITE_` is compiled into the bundle and is public.** That is
why the production build talks to a serverless proxy instead of holding the key.
Never set `VITE_GROQ_API_KEY` on a host.

## Push notifications

`server/` is a small Express service that stores push subscriptions and nothing
else — no transactions, no invoices, no amounts. It needs a host that runs a
persistent process (Render, Railway, Fly); it will not work on serverless.

```bash
cd server && npm install && npm run keys   # generate VAPID keys
cp .env.example .env                       # paste them in
npm start
```

Skip it entirely and every other feature is unaffected. The in-app bell,
alerts and attention list are computed on the device and never needed a server.

## Deploying

See [DEPLOY.md](DEPLOY.md). `vercel.json` is set up for Vercel — SPA rewrites,
service-worker cache headers and the assistant proxy.

## Your data

Transactions, invoices, clients and settings live in IndexedDB on the device and
are never uploaded. The assistant is the one exception: the question and a
summary of the relevant figures go to Groq to be answered. Export or back up
everything from Settings → Data at any time.

---

Developed by [Seb](https://seb.kelas.site)

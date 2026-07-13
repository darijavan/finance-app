# Finance App

Personal finance tracker — expenses, monthly allowances, and subscriptions
(monthly **and** yearly), with per-category budgets and a dashboard.

## Stack
- **Next.js 14** (App Router) + **TypeScript**
- **Node 24** (see `.nvmrc`) via **nvm**
- **pnpm** package manager
- Storage: **`node:sqlite`** (the built-in SQLite module in Node 24) — no native build step
- Data file: `data/finance.db` (gitignored)

## Run locally
```bash
nvm use            # picks Node 24 from .nvmrc
pnpm install
pnpm dev           # http://localhost:3000
# production:
pnpm build && pnpm start
```

## Project layout
- `app/api/*` — JSON API (categories, transactions, subscriptions, budgets, summary, settings, months)
- `app/page.tsx` — single-page UI (Dashboard / Transactions / Subscriptions / Budgets)
- `lib/db.ts` — SQLite schema + seed (default categories, ILS currency)
- `lib/types.ts` — shared TypeScript types

## Exposed via Cloudflare tunnel
Served at `finance.ridjvan.me` (behind Cloudflare Access, same GitHub-OAuth policy
as the other ridjvan.me services), pointing at `localhost:3000`.
Service unit: `~/.config/systemd/user/finance.service`.

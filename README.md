# Quick POS — Owner Dashboard

A mobile-first web dashboard that lets a store owner monitor sales, orders, purchases, and inventory for their **Quick POS** system. Built as an installable PWA so it can be added to a phone's home screen and used like a native app.

## Overview

The dashboard reads from the same Supabase database that the Quick POS point-of-sale app writes to. Staff ring up orders and log restocks on the POS; the owner gets a read-only (plus inventory entry) overview here — protected behind a 4-digit PIN.

All currency is shown in Philippine Pesos (₱).

## Tech Stack

| Layer       | Choice                                  |
|-------------|-----------------------------------------|
| Framework   | Next.js 14 (App Router)                 |
| UI          | React 18                                |
| Styling     | Tailwind CSS (brand color `#e8521a`)    |
| Charts      | Recharts                                |
| Backend     | Supabase (Postgres + JS client)         |
| Delivery    | PWA (installable, standalone, portrait) |

## Features

- **PIN login** — 4-digit PIN gate with a custom number pad. The PIN is stored in Supabase (`app_settings`) and changeable from Settings; auth is kept in `sessionStorage`.
- **Dashboard** — today / this-month / all-time sales totals, daily sales bar chart (7/30/90-day ranges), and best-selling items.
- **Orders** — filterable list of orders (by date range and status) with line-item detail, discounts, tender, and change.
- **Purchases** — supplier purchase history with per-item cost breakdowns.
- **Inventory** — most recent restock per item, with an "added by" badge distinguishing POS staff vs. admin entries, plus a form to log new stock purchases.
- **Settings** — change the admin PIN.

## Project Structure

```
app/
  page.js            PIN login screen
  layout.js          Root layout + PWA metadata
  dashboard/page.js  Sales stats + charts
  orders/page.js     Order history
  purchases/page.js  Purchase history
  inventory/page.js  Restock status + stock logging
  settings/page.js   Change PIN
components/
  NavBar.js          Bottom tab navigation
lib/
  supabase.js        Supabase client + all data queries
public/
  manifest.json      PWA manifest
```

## Data Model (Supabase)

- `orders` / `order_items` — sales and their line items (status: `completed` / `voided`)
- `purchases` / `purchase_items` — restocks and their items (`local_id` set = added via POS, null = added via this dashboard)
- `app_settings` — key/value store (holds `admin_pin`)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` from the example and fill in your Supabase project values:
   ```bash
   cp .env.local.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Scripts

| Command         | Description               |
|-----------------|---------------------------|
| `npm run dev`   | Start the dev server      |
| `npm run build` | Production build          |
| `npm start`     | Serve the production build |

## Notes

- Default PIN is `1234` if none is set in the database.
- Auth is client-side only (session-based) — this is a lightweight owner tool, not a hardened multi-user system.

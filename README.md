# PriceTracker

A full-stack e-commerce price monitoring application that tracks live prices and stock availability on an upstream demo storefront. Users can browse or search the catalog, select products to monitor, track historical price fluctuations with interactive charts, review per-attempt scrape audit logs, and trigger live price checks with real-time SSE progress updates.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 19 + Vite)               │
│                  Hosted on Vercel                      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP & SSE Streams
                            ▼
┌────────────────────────────────────────────────────────┐
│            Backend API (Node.js + Express)             │
│                   Hosted on Render                     │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
    Direct SQL Queries              Headless Browser
             │                             │
             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ Database (PostgreSQL)   │   │ Playwright Automation   │
│   Hosted on Supabase    │   │ Anti-bot & dynamic price│
└─────────────────────────┘   └─────────────────────────┘
             ▲
             │ POST /api/products/scrape/run (x-cron-secret)
┌────────────┴───────────────────────────────────────────┐
│               External Cron (cron-job.org)             │
│            Scheduled recurring runs (every 2h)         │
└────────────────────────────────────────────────────────┘
```

- **Frontend**: Single-Page Application (SPA) built with React 19, Vite, Recharts, and Vanilla CSS. Deployed on Vercel with SPA routing rewrite rules.
- **Backend**: Express REST API in Node.js (ESM) hosted on Render. Orchestrates catalog syncing, product tracking, live Server-Sent Events (SSE) streaming, and Playwright scraping pipelines.
- **Database**: PostgreSQL hosted on Supabase, connected via `@supabase/supabase-js` using service role credentials.
- **Scraping**: Headless Chromium automation via Playwright, simulating human mouse micro-movements, button dwelling, and network challenge detection to extract dynamic price and stock state.
- **Scheduling**: Automated external cron trigger via `cron-job.org` calling a secured batch scrape endpoint every 2 hours, plus an automated keep-warm health ping every 10 minutes.

---

## Live Links

- **Frontend**: [URL]
- **Backend**: [URL]
- **GitHub Repository**: [URL]

---

## Setup Instructions

### Prerequisites
- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **npm**: `v9.0.0` or higher
- A **Supabase** project with the database schema applied

### 1. Clone the Repository
```bash
git clone [URL]
cd <repo-folder>
```

### 2. Backend Setup
```bash
cd backend
npm install
# Install Playwright browser binary
npx playwright install chromium
```

Create `backend/.env` (refer to `backend/.env.example`):
```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
FRONTEND_URL=http://localhost:5173
CRON_SECRET=your-secure-cron-secret
SCRAPE_HEADLESS=true
DEBUG_SCREENSHOTS=false
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
```

Create `frontend/.env` (refer to `frontend/.env.example`):
```env
VITE_API_BASE_URL=http://localhost:4000
```

Start the frontend development server:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable Name | Description | Example / Fallback |
|---|---|---|
| `PORT` | Local server port for Express | `4000` (defaults to `4000` if unset) |
| `SUPABASE_URL` | Supabase project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role secret key (bypasses RLS) | `eyJhbGciOi...` |
| `FRONTEND_URL` | Allowed CORS origins (comma-separated; no trailing slashes). If unset, runs in permissive mode allowing all origins in any environment | `http://localhost:5173,https://your-app.vercel.app` |
| `CRON_SECRET` | Secret token required in `x-cron-secret` header for batch cron endpoint. If unset, cron endpoint unconditionally rejects with 401 | `your-secret-token` |
| `SCRAPE_HEADLESS` | Flag to toggle Playwright headless mode | `true` (set to `false` for headed debugging) |
| `DEBUG_SCREENSHOTS` | Enables saving `debug-*.png` snapshots in the working directory on failures (ephemeral on Render) | `false` |

### Frontend (`frontend/.env`)

| Variable Name | Description | Example / Fallback |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL for backend API & SSE requests (trailing slashes are automatically stripped) | `http://localhost:4000` (defaults to `http://localhost:4000` if unset) |

---

## Database Schema (Supabase / PostgreSQL)

The complete, idempotent PostgreSQL schema is located in [`backend/supabase/schema.sql`](backend/supabase/schema.sql).

It defines:
- **`tracked_products`**: Product ID, slug, title, brand, category, creation timestamp.
- **`price_history`**: Verified price snapshots and stock status with foreign key `ON DELETE CASCADE` referencing `tracked_products(product_id)`, indexed by `(product_id, scraped_at DESC)`.
- **`scrape_log`**: Audit trail of every attempt with `status CHECK (status IN ('success', 'retried', 'failed'))`, duration in ms, and diagnostics, foreign key `ON DELETE CASCADE` referencing `tracked_products(product_id)`, indexed by `(product_id, attempt_at DESC)`.
- **`catalog_products`**: Persistent local mirror of upstream catalog items, featuring a `lower(name)` B-tree index and a `pg_trgm` GIN index (`name gin_trgm_ops`) for fast search queries, plus an automatic `updated_at` trigger.
- **Row Level Security (RLS)**: Enabled across all four tables.

To apply, copy and run [`backend/supabase/schema.sql`](backend/supabase/schema.sql) in the Supabase SQL Editor.

---

## Scraping Schedule & Operations

- **Schedule**: Every 2 hours (`0 */2 * * *`).
- **Trigger**: External cron service ([cron-job.org](https://cron-job.org)) sends an HTTP `POST` request to `/api/products/scrape/run` with the header `x-cron-secret: <CRON_SECRET>`.
- **Keep-Warm Monitor**: A secondary cron job pings `GET /health` every 10 minutes to prevent Render free-tier containers from spinning down mid-cycle.
- **Why External Cron?**: Render's free tier idles after ~15 minutes of inactivity. In-process intervals (`setInterval`) stop when the instance sleeps, making internal schedulers unreliable. External HTTP triggers reliably wake the container, run catalog synchronization, and execute batch scrapes.

---

## API Endpoints Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check endpoint returning `{ ok: true, status: 'ok', uptime, timestamp }` |
| `GET` | `/api/products/catalog` | Direct live proxy to upstream storefront `/api/catalog` with in-memory caching |
| `GET` | `/api/products/search` | Fast paginated catalog search (`q`, `page`, `pageSize`) querying `catalog_products` (used by frontend browsing & search) |
| `POST` | `/api/products/track` | Adds item to `tracked_products` and triggers asynchronous initial background scrape (with overlap guard) |
| `GET` | `/api/products/tracked` | Fetches all tracked products ordered newest first |
| `DELETE` | `/api/products/tracked/:productId` | Untracks a single product; cascades deletion across price history and logs |
| `DELETE` | `/api/products/:productId` | Route alias for `DELETE /api/products/tracked/:productId` |
| `DELETE` | `/api/products/tracked` | Untracks all products; cascades deletion across all price history and logs |
| `GET` | `/api/products/:productId/history` | Chronological price history snapshots for a product |
| `GET` | `/api/products/:productId/logs` | 50 most recent scrape audit execution logs for a product |
| `GET` | `/api/products/:productId/summary` | Aggregated statistics (`latest_price`, `lowest_price_seen`, `highest_price_seen`, attempt-level counts) |
| `POST` | `/api/products/:productId/scrape` | Triggers immediate on-demand single product scrape (returns 409 if scrape already running) |
| `GET` | `/api/products/:productId/scrape-stream` | Server-Sent Events (SSE) stream broadcasting real-time progress (`status`, `scrape_start`, `attempt_start`, `attempt_complete`, `scrape_complete`) |
| `POST` | `/api/products/scrape/run` | Triggers batch scraping of all tracked products (requires `x-cron-secret` header; skips if batch already running) |

---

## Deployment Guide

### 1. Database (Supabase)
1. Open your Supabase project dashboard.
2. Go to the **SQL Editor**, paste the contents of [`backend/supabase/schema.sql`](backend/supabase/schema.sql), and run it.

### 2. Backend (Render — Web Service)
Deploy as a native Node Web Service (No Docker):
- **Root Directory**: `backend`
- **Build Command**: `npm install && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `PORT`: `4000` (or leave empty; Render assigns one)
  - `SUPABASE_URL`: Your Supabase URL
  - `SUPABASE_SERVICE_KEY`: Your Supabase service role secret
  - `FRONTEND_URL`: Your deployed Vercel frontend URL (e.g. `https://your-app.vercel.app`)
  - `CRON_SECRET`: Random secure string
  - `SCRAPE_HEADLESS`: `true`
  - `PLAYWRIGHT_BROWSERS_PATH`: `0`
  - `NODE_VERSION`: `20`

*Note on Cold Starts*: On Render's free tier, an inactive container can take ~30–60 seconds to spin up on the first request.

### 3. Frontend (Vercel)
Deploy as a static SPA:
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: Your deployed Render backend URL (e.g. `https://your-api.onrender.com` without trailing slash)

### 4. Cron Jobs (cron-job.org)
Create two scheduled jobs:
1. **Batch Scraper**:
   - URL: `https://your-api.onrender.com/api/products/scrape/run`
   - Method: `POST`
   - Request Header: `x-cron-secret: <YOUR_CRON_SECRET>`
   - Schedule: Every 2 hours (`0 */2 * * *`)
2. **Keep-Warm Ping**:
   - URL: `https://your-api.onrender.com/health`
   - Method: `GET`
   - Schedule: Every 10 minutes (`*/10 * * * *`)

---

## Running in Headed Mode Locally

To observe Playwright interacting with the storefront in real time:
1. In `backend/.env`, set:
   ```env
   SCRAPE_HEADLESS=false
   ```
2. Start the backend locally (`npm run dev` in `backend/`).
3. Open the frontend in your browser, navigate to any tracked product detail page, and click **Scrape Price Now**.
4. A Chromium browser window will open, showing cookie acceptance, humanized mouse micro-movements hovering over the reveal button, dwelling, clicking, and extracting the price.
5. *Tip for video demonstrations*: Choose a product that encounters an initial retry or challenge delay to showcase the live 3-step visual attempt tracker and exponential backoff countdown in the UI.

---

## Design Note

### Architecture & Trade-Offs
The application strictly bifurcates metadata fetching and price extraction. Catalog metadata (product titles, slugs, categories, SKUs) is static and fetched via plain HTTP requests directly from the upstream store API without browser overhead. In contrast, live price and stock availability are guarded by anti-bot protections: cookie consent modals, disabled reveal buttons that require simulated mouse micro-movements, randomized dwell times, and asynchronous `/api/layout` and `/api/challenge` verification calls.

To ensure resilience without exhausting free-tier compute:
- **Playwright Scoping**: Playwright is only invoked for price/stock resolution, not general catalog browsing.
- **3-Attempt Exponential Backoff**: Each scrape performs up to 3 attempts with exponential pauses (3 seconds after attempt 1 failure, 9 seconds after attempt 2 failure).
- **Global Concurrency Semaphore**: All browser launches across batch scraping, initial tracking, and on-demand clicks are governed by an in-memory Semaphore capped at 2 concurrent instances.
- **Extraction Guardrails**: Price extraction is scoped to the product container, reads the price twice ~500ms apart to verify stability, and throws `STRUCTURE_CHANGE:` errors if selectors or price elements mutate.
- **Trade-Offs**: Free-tier hosting limits resources; running Chromium incurs memory overhead, and concurrency is intentionally capped at 2 rather than processing large batches in parallel. Endpoints are public without user authentication, operating against a single shared monitored catalog.

### What My AI Tools Got Wrong and How I Fixed It
<!-- USER: verify these match what really happened -->
1. **Ephemeral In-Memory Catalog Search**: Initial drafts implemented catalog search via an in-memory cache populated from upstream. On Render cold starts, this cache was repeatedly lost, causing search requests to freeze while re-fetching the flaky demo store. *Fix*: Migrated catalog search to a persistent Supabase table (`catalog_products`) synced during startup and batch runs.
2. **Unguarded Browser Launches**: Batch runs used concurrency 2, but on-demand and initial tracking scrapes launched unthrottled browsers simultaneously, exceeding server memory. *Fix*: Implemented a shared `globalScrapeSemaphore` (limit 2) wrapping all Playwright launches.
3. **Premature Attempt Logging**: Early code only recorded scrape logs after all 3 retry attempts completed. If a process was interrupted, attempt history was lost. *Fix*: Refactored to write each attempt log immediately to `scrape_log` upon completion.
4. **Body-Wide Greedy Regex**: Initial extraction ran regular expressions over the entire `document.body`, occasionally capturing unrelated numbers or strings like "notify me when back in stock". *Fix*: Scoped extraction to the product container and added double-read stability checks.
5. **Upsert Constraint Conflicts**: Early catalog sync upserts caused PostgreSQL errors when duplicates appeared within the same page payload. *Fix*: Added in-memory deduplication by `id` prior to database upserts.

---

## Known Limitations

- **Unauthenticated Endpoints**: Endpoints (including product tracking, untracking, and on-demand scrapes) are unauthenticated and operate on a shared global list.
- **Attempt-Level Metrics**: Reliability statistics represent individual attempt successes and failures rather than high-level scrape job runs.
- **No Active Alerts**: Price drops are recorded and displayed in time-series charts, but no external notifications (email/webhooks) are dispatched.
- **Target Site Flakiness**: The upstream demo store intentionally injects intermittent delays and network errors. If all 3 attempts fail in a cycle, the system defers retrying until the next scheduled 2-hour cron run.

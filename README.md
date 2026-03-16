# Edrhkat POS Toll Server

Backend server scaffold for the POS toll app using Node.js, Express, and PostgreSQL with a production-ready layout and security middleware.

## Quick start

- Copy the example env file and update credentials: `cp .env.example .env`
- Install dependencies (uses local cache path to avoid permission issues): `npm install --cache .npm-cache`
- Run in dev mode with hot reload: `npm run dev`
- Build for production: `npm run build`
- Start the compiled server: `npm start`

For Heroku deployment:

- The included `Procfile` uses `web: npm start`.
- Set `NODE_ENV=production` and provide Heroku Postgres via `DATABASE_URL`.
- Point the browser client to this API through the Vercel `/backend` proxy.

The server exposes `GET /api/health` which also pings the database.

On startup, the server initializes users, companies, receipts, POS devices, and toll transaction tables so a fresh database is ready before the first online test request.

## Environment variables

- `NODE_ENV` – `development` or `production` (default: `development`)
- `PORT` – port to run the HTTP server (default: `3000`)
- `DATABASE_URL` – PostgreSQL connection string, e.g. `postgres://user:password@localhost:5432/dbname`
- `CORS_ORIGIN` – comma-separated allowed origins for CORS (e.g. `http://localhost:3000,http://localhost:3001`). Use `*` to allow all (not recommended with credentials).
- `JWT_ACCESS_SECRET` – secret for signing access tokens
- `JWT_REFRESH_SECRET` – secret for signing refresh tokens
- `JWT_ACCESS_EXPIRES_IN` – access token lifetime (e.g. `15m`)
- `JWT_REFRESH_EXPIRES_IN` – refresh token lifetime (e.g. `7d`)
- `AUTH_ACCESS_COOKIE_NAME` – browser access cookie name (default: `edrhk_at_access`)
- `AUTH_REFRESH_COOKIE_NAME` – browser refresh cookie name (default: `edrhk_at_refresh`)
- `AUTH_COOKIE_DOMAIN` – optional cookie domain; leave empty unless you explicitly need it
- `AUTH_COOKIE_SECURE` – use `true` in production HTTPS deployments
- `AUTH_COOKIE_SAME_SITE` – use `none` for Vercel/Heroku browser auth; use `lax` for local HTTP testing

Recommended online test values:

- `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAME_SITE=none`
- Leave `AUTH_COOKIE_DOMAIN` unset

## Security features

- `helmet` for sensible HTTP headers
- `express-rate-limit` with sane defaults
- CORS configuration, JSON/body size limits, gzip compression
- Centralized error handling without leaking stack traces
- Graceful shutdown on `SIGINT`/`SIGTERM`

## Auth endpoints

Browser and POS clients use different auth modes:

- Browser client: login/refresh use secure `httpOnly` cookies
- POS/mobile client: login/refresh return token JSON when the request includes `X-Client-Type: mobile`

- `POST /api/auth/register` – `{ username, password, role, post }` (password must include upper, lower, number; min 8 chars; `role` and `post` required from lists below). Returns user only; client must call login to get tokens.
- `POST /api/auth/login` – `{ username, password }`; browser gets cookies, POS gets `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` – browser reads refresh cookie; POS sends `{ refreshToken }`
- `POST /api/auth/logout` – browser uses access cookie, POS can use `Authorization: Bearer <accessToken>`
- `GET /api/auth/me` – accepts either browser access cookie or `Authorization: Bearer <accessToken>`; returns current profile
- `GET /api/auth/users` – requires `Authorization: Bearer <accessToken>` and role `ADMIN_SYSTEME`; supports `?search&?page=1&?pageSize=10` (default page size 10)

Default admin (auto-created on startup):

- username: `gloire.mpanga`
- password: `Tabc@123`
- role: `ADMIN_SYSTEME`
- post: `DIRECTION_GENERALE`

On startup, the server ensures its core tables exist. Replace this bootstrap approach with formal migrations when you move beyond online testing.

### Roles (for docs/alignment)

1. `AGENT_CAISSIER` – Operates POS at tolls: records passages, collects payments, prints receipts, verifies QR codes.
2. `SUPERVISOR_CHEF_POSTE` – Supervises toll operations and authorizes exceptions/overrides.
3. `FINANCE_CAISSE` – Receives money from companies, records advance payments/recoveries, issues invoices/receipts.
4. `RECOUVREMENT_AGENT` – Manages companies in debt: follow-up and recovery tracking.
5. `ADMIN_SYSTEME` – Manages users, POS devices, security settings, system configuration.
6. `DECISIONNEUR_VI` – Consults dashboards/reports for decisions (read-only).

### Posts (assignment for agents)

1. KAMPEMBA
2. MIKAS
3. DITENGWA
4. MENDA
5. MULUNGWISI
6. LWAMBO
7. LWISHA CENTRE
8. EXCELLENT
9. RTE SHEMAF
10. KABOLA
11. KYANDWE
12. SASE
13. DIRECTION_GENERALE (decision-makers)

## Companies endpoints (ADMIN_SYSTEME or FINANCE_CAISSE)

- `POST /api/companies` – create `{ name, code?, billing_mode? }` (billing_mode: PAYG | PREPAID | POSTPAID; default PAYG)
- `GET /api/companies` – list with query `?search&?page=1&?pageSize=10` (default page size 10)
- `GET /api/companies/:id` – fetch single (includes wallet and policy)
- `PATCH /api/companies/:id` – update `{ name?, code?, billing_mode?, is_active? }`
- `PATCH /api/companies/:id/policy` – update `{ negative_limit_usd?, blocked? }` (version auto-increments)
- `POST /api/wallet/topup` – FINANCE_CAISSE (or ADMIN_SYSTEME) only; `{ company_id, amount_usd, reference_no?, note? }` adds a TOP_UP transaction and increases wallet balance. If `reference_no` is omitted, the server auto-generates one. Top-ups are blocked for PAYG companies.
- `GET /api/companies/:id/wallet/ledger` – list wallet transactions for a company, `?page&?pageSize`

All company routes require `Authorization: Bearer <accessToken>` and role `ADMIN_SYSTEME` or `FINANCE_CAISSE`.

## Overrides endpoints

- `GET /api/overrides` – roles: ADMIN_SYSTEME, RECOUVREMENT_AGENT, DECISIONNEUR_VI, FINANCE_CAISSE; query filters: `start_date`, `end_date`, `post`, `company_id`, `approved_by_user_id`, `page`, `pageSize` (default 10); returns latest first with pagination metadata.

## Dashboard endpoint

- `GET /api/dashboard/summary` – roles: ADMIN_SYSTEME, FINANCE_CAISSE, RECOUVREMENT_AGENT, DECISIONNEUR_VI, SUPERVISOR_CHEF_POSTE. Query: `?days=7` (range 1–90). Returns aggregates for the period: company counts (total/active/blocked), total wallet balance (PREPAID/POSTPAID only; PAYG excluded), transaction totals/amounts, payment mode breakdown, top posts, top companies, override count, a risk list of lowest-margin companies (balance vs negative limit; PAYG excluded), and POS device counts (total/active/inactive). Post scoping: SUPERVISOR_CHEF_POSTE is scoped to their post; other roles see system-wide aggregates.
- `GET /api/dashboard/timeseries/revenue` – roles: ADMIN_SYSTEME, FINANCE_CAISSE, RECOUVREMENT_AGENT, DECISIONNEUR_VI, SUPERVISOR_CHEF_POSTE. Query: `?days=30&granularity=day|week` (days 1–180). Returns time-series points `{ period, totalAmount, totalCount }` for revenue and volume. Post scoping: SUPERVISOR_CHEF_POSTE is scoped to their post; other roles see system-wide data.

## POS duplicate protection
- A POS transaction is rejected if the same `post_id` and `vehicle_plate` occurred within the last 5 minutes (server `created_at`). Error: `409 Duplicate plate within time window`.
- Examples (5-minute window):
  - 10:00, Post KAMPEMBA, plate ABC: accepted.
  - 10:03, Post KAMPEMBA, plate ABC: rejected (duplicate within window).
  - 10:06, Post KAMPEMBA, plate ABC: accepted (window expired).
  - 10:03, Post DITENGWA, plate ABC: accepted (different post).

## Reports endpoints (client generates PDF)

- `GET /api/reports/transactions` – roles: ADMIN_SYSTEME, FINANCE_CAISSE, RECOUVREMENT_AGENT, DECISIONNEUR_VI, SUPERVISOR_CHEF_POSTE. Query filters: `date_from`, `date_to`, `post_id`, `company_id`, `payment_mode`, `search` (plate/carrier/company), `limit` (default 500, max 1000). Returns paged data (page fixed to 1) plus `total` and `scopedPost`. Post scoping: uses `post_id` if provided; otherwise only SUPERVISOR_CHEF_POSTE is forced to their post.
- `GET /api/reports/overrides` – same roles. Query filters: `dateFrom`, `dateTo`, `post_id`, `company_id`, `approved_by_user_id`, `limit` (default 500, max 1000). Returns override log data (page fixed to 1) plus `total` and `scopedPost`. Post scoping: uses `post_id` if provided; otherwise only SUPERVISOR_CHEF_POSTE is forced to their post.
- Both report endpoints also return a `menota` object: `{ report_type: 'transactions'|'overrides', version: '1.0', generation_timestamp: ISO string, requested_by: { id, username, role, post }, filters: { ...applied filters..., limit } }` for client-side PDF headers/footers.

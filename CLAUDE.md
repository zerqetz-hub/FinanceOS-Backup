# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run locally (requires PostgreSQL)
DATABASE_URL=postgresql://localhost/kepinguang node server.js

# Development with auto-reload
npm run dev

# Run all tests
npm test

# Run a single test file
npx jest tests/validators.test.js --runInBand

# Run tests with coverage
npm run test:coverage
```

## Architecture

KepingUang is a multi-user personal finance web app (Node.js + Express + PostgreSQL). The server is an SPA backend — it serves static files from `public/` and exposes a REST API under `/api/`.

### Backend layers

- **[server.js](server.js)** — Entry point. Initializes schema, mounts routes, sets up Helmet, Sentry, and the global error handler. The `trust proxy = 1` setting is required for Railway (reverse proxy).
- **[database.js](database.js)** — All PostgreSQL queries. Uses a shared `pool`, a `q()` helper for simple queries, and a `tx()` helper for transactions. Financial columns use `NUMERIC(20,4)` (not REAL/FLOAT). All DB functions are scoped by `user_id`.
- **[auth.js](auth.js)** — Password hashing (PBKDF2/SHA-512, 100k iterations), session token management via `ku_session` HttpOnly cookie, IP-based rate limiting (5 attempts, 15-min lockout), and the `requireAuth` Express middleware.
- **[validators.js](validators.js)** — Pure input validation functions. Password rules live exclusively in `auth.js` (not here) to avoid drift.
- **[errors.js](errors.js)** — Custom error hierarchy (`AppError` → `NotFoundError`, `ConflictError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`). Use `routeHandler(fn)` to wrap async route handlers instead of manual try/catch. Throw `AppError` subclasses from `database.js`; they bubble up to `errorMiddleware` automatically.

### Routes

All routes are under `routes/`:
- **auth.routes.js** — `/api/auth/*`: register, login, logout, status
- **data.routes.js** — `/api/*`: CRUD for cashflows, assets, debts, goals, transactions, settings
- **checkpoint.routes.js** — `/api/checkpoint*`: snapshot save/restore

Public endpoints (no auth): `/api/auth/status`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/health`.

### Frontend (`public/`)

Vanilla JS SPA with no build step. Modules communicate through a global state object managed in `js/state.js`. Key modules:
- `js/api.js` — HTTP wrapper for all API calls
- `js/state.js` — Global state + undo/redo
- `js/render.js` — Renders all sections
- `js/actions.js` — Add/edit/delete handlers
- `js/auth.js` — Login/register UI

### Error handling convention

- Database layer throws `AppError` subclasses (never raw errors with string-matched messages)
- Route handlers use `routeHandler(fn)` from `errors.js` — no try/catch needed
- `errorMiddleware` in `server.js` handles all uncaught errors uniformly

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | `production` enables SSL and Secure cookie flag |
| `PORT` | Server port (default 3000) |
| `SENTRY_DSN` | Optional Sentry error tracking |

### Test coverage

Jest tests are in `tests/`. Coverage is collected from `validators.js`, `auth.js`, `errors.js`, and `routes/*.js`. Minimum threshold: 70% lines.

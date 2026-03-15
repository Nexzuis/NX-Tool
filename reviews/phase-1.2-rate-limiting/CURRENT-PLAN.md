# Phase 1.2 — Add Rate Limiting and Request Safety

## Goal
Prevent abuse and runaway polling by adding rate limiting to write endpoints and high-cost read routes, and add request timeouts so the frontend doesn't hang on slow backend responses.

## Context
Currently there's no rate limiting — any client can hammer write endpoints or expensive NX Witness proxy routes. The frontend fetch calls have no timeout, so a slow/dead backend leaves the UI spinning indefinitely.

## Codex Review Fixes Applied
1. **CRITICAL**: `/api/summary` calls `nxClient.getDevices()` — moved to expensive limiter
2. **IMPORTANT**: `/api/cameras/:id` hits NX — added to expensive limiter
3. **IMPORTANT**: Write calls (`triggerAction`, `toggleAnalytics`, `bulkToggleAnalytics`) bypass `apiFetch` — add timeout to all fetch calls via shared helper
4. **IMPORTANT**: `trust proxy` concern — document that rate limiting uses `req.ip` which respects `trust proxy` setting; acceptable for LAN deployment
5. **IMPORTANT**: Bulk analytics is synchronous (awaits all batches) — corrected assumption, frontend timeout of 30s for write operations

## Approach

### Backend: In-memory sliding-window rate limiter
Use `express-rate-limit` (lightweight, no external deps).

- **Write endpoints**: 10 requests per minute per IP (covers actions, analytics toggle, bulk)
- **High-cost read routes** (`/api/cameras`, `/api/cameras/:id`, `/api/metrics`, `/api/storages`, `/api/analytics`, `/api/summary`): 30 requests per minute per IP (these proxy to NX Witness)
- **Low-cost reads** (`/api/health`, `/api/incidents`, `/api/workflows`, `/api/auth/status`): No limit (these read in-memory state)
- **`/healthz`**: No limit (liveness probe)

Rate limit headers returned: `RateLimit-*` (standard draft).
When limited: 429 response using `fail(res, 429, ...)` envelope.

Rate limiting uses `req.ip` which respects Express's `trust proxy` setting. On LAN deployment without a reverse proxy, this is the direct client IP — acceptable for this use case.

### Frontend: Request timeout for ALL fetch calls
Refactor `api.ts` to use a shared `fetchWithTimeout(url, init, timeoutMs)` helper that wraps `fetch` with `AbortController`. Both `apiFetch` (reads) and write functions (`triggerAction`, `toggleAnalytics`, `bulkToggleAnalytics`) will use it.

- Read timeout: 15 seconds
- Write timeout: 30 seconds (bulk analytics awaits all batches synchronously)

### Auth vs Rate Limit precedence
Rate limiter runs before auth middleware. This means unauthenticated spam still counts against the rate limit and gets 429'd, which is the desired behavior — it prevents brute-force token guessing.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/package.json` | Add `express-rate-limit` dependency |
| `modules/ghosthome-monitor/api-server.js` | Add rate limit middleware for write and expensive read routes |
| `modules/ghosthome-frontend/src/lib/api.ts` | Add `fetchWithTimeout` helper, use in all fetch calls |
| `SPEC.md` | Document rate limiting behavior |

## Order of operations

### 1. Install express-rate-limit
```bash
cd modules/ghosthome-monitor && npm install express-rate-limit
```

### 2. Backend rate limiting (api-server.js)
- Import `express-rate-limit` (CommonJS `require`)
- Create two limiters inside `buildApp()`:
  - `writeLimiter`: windowMs=60000, max=10, keyed by IP, custom handler using `fail(res, 429, ...)`
  - `readExpensiveLimiter`: windowMs=60000, max=30, keyed by IP, custom handler using `fail(res, 429, ...)`
- Apply `writeLimiter` to write routes (before `requireApiAuth` — catches spam before auth check)
- Apply `readExpensiveLimiter` to: `/cameras`, `/cameras/:id`, `/metrics`, `/storages`, `/analytics`, `/summary`
- Use `standardHeaders: 'draft-8'`, `legacyHeaders: false`

### 3. Frontend timeout (api.ts)
- Add `fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number)` helper
- Default read timeout: 15s, write timeout: 30s
- Update `apiFetch` to use `fetchWithTimeout` with 15s
- Update `triggerAction`, `toggleAnalytics`, `bulkToggleAnalytics` to use `fetchWithTimeout` with 30s
- On `AbortError`, throw descriptive timeout error

### 4. Update SPEC.md
- Add rate limiting section under backend API docs
- Document timeout behavior

## Risks and edge cases
- **express-rate-limit in-memory store**: Resets on restart — acceptable for single-process app.
- **Bulk analytics timing**: Synchronous operation awaiting all batches. 30s write timeout should accommodate ~69 cameras at 5 concurrency = ~14 batches.
- **Dashboard polling /api/summary**: Currently polled frequently; 30 req/min limit means max 1 request every 2 seconds, which is well above typical polling intervals.

## Acceptance criteria
1. Write endpoints return 429 after 10 requests in 60 seconds from the same IP
2. `/api/cameras`, `/api/cameras/:id`, `/api/metrics`, `/api/storages`, `/api/analytics`, `/api/summary` return 429 after 30 requests in 60 seconds from the same IP
3. `/api/health`, `/api/incidents`, `/api/workflows`, `/api/auth/status`, `/healthz` are not rate-limited
4. 429 responses use the project's `fail()` envelope format: `{ ok: false, error: { message } }`
5. Rate limit headers (`RateLimit-*`) are present in responses
6. Unauthenticated write spam gets 429 (rate limit runs before auth)
7. Frontend `apiFetch` aborts reads after 15 seconds with a timeout error
8. Frontend write functions (`triggerAction`, `toggleAnalytics`, `bulkToggleAnalytics`) abort after 30 seconds
9. Backend syntax check passes: `node -c api-server.js`
10. Frontend TypeScript check passes: `npx tsc --noEmit`
11. Frontend build passes: `npm run build`

## Verification commands
- Backend syntax: `cd modules/ghosthome-monitor && node -c api-server.js`
- Frontend types: `cd modules/ghosthome-frontend && npx tsc --noEmit`
- Frontend build: `cd modules/ghosthome-frontend && npm run build`

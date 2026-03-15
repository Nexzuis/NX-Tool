# Phase 0.1 — Auth & Safety (Revised after Codex review)

## Goal
Fix auth middleware scope, CORS headers, frontend auth support, and WF-04 restart concurrency.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/api-server.js` | Apply `requireApiAuth` per-route on PATCH/POST only; add `X-Api-Key` to CORS allowedHeaders |
| `modules/ghosthome-monitor/wf04-server-health.js` | Add `restartInProgress` flag on `handleServerRestart` to serialize all restart attempts |
| `modules/ghosthome-frontend/src/lib/api.ts` | Add optional auth header support via `NEXT_PUBLIC_API_TOKEN` with clear documentation that this is visible to the browser (acceptable for local-network-only deployments) |
| `SPEC.md` | Document `NEXT_PUBLIC_API_TOKEN` in frontend env vars table |
| `modules/ghosthome-frontend/.env.example` | Add `NEXT_PUBLIC_API_TOKEN` (empty default) |

## Order of operations

### 1. api-server.js — Per-route auth (single router, no split)
- Remove `requireApiAuth` from the global `app.use('/api', ...)` mount
- Add `requireApiAuth` as middleware on each individual write route:
  - `router.patch('/analytics/:deviceId', requireApiAuth, ...)`
  - `router.post('/analytics/bulk', requireApiAuth, ...)`
  - `router.post('/actions/trigger-analytics', requireApiAuth, ...)`
  - `router.post('/actions/trigger-health-check', requireApiAuth, ...)`
  - `router.post('/actions/trigger-daily-report', requireApiAuth, ...)`
  - `router.post('/actions/test-telegram', requireApiAuth, ...)`
- All GET routes remain open (no auth)
- Add `'X-Api-Key'` to CORS `allowedHeaders` array

### 2. wf04-server-health.js — Restart serialization
- Add module-level `let restartInProgress = false`
- Guard `handleServerRestart`: if `restartInProgress` is true, log and skip
- Set `restartInProgress = true` at entry, `false` in finally block
- `handleServerFailure` already has `serverFailureInProgress` — keep it, but also check `restartInProgress` before calling `handleServerRestart`
- `runHealthCheck` keeps its own `checkInProgress` for metric collection — NOT blocked by restart mutex
- Net result: health checks run normally; only one restart can run at a time regardless of entry path

### 3. api.ts — Frontend auth headers
- Add helper: `function getWriteHeaders(): HeadersInit`
- Reads `NEXT_PUBLIC_API_TOKEN` env var. If set, returns `{ 'Authorization': 'Bearer <token>', 'Content-Type': 'application/json' }`. If empty, returns just `{ 'Content-Type': 'application/json' }`.
- Apply to `triggerAction`, `toggleAnalytics`, `bulkToggleAnalytics`
- Note: `NEXT_PUBLIC_*` vars are intentionally browser-visible. This is acceptable for a local-network monitoring tool. For internet-facing deployments, a server-side API proxy should be used instead.

### 4. Doc updates
- Add `NEXT_PUBLIC_API_TOKEN` to SPEC.md frontend env vars table
- Add to `modules/ghosthome-frontend/.env.example`

## Risks and edge cases
- `handleServerRestart` called from inside `runHealthCheck` (line 49): the restart flag must be checked inside `handleServerRestart` itself, not at the `runHealthCheck` level, so health checks still run but can't start a second restart
- If `handleServerFailure` is sleeping (5 min wait) and then calls `handleServerRestart`, the restart flag correctly blocks if another restart is already running

## Acceptance criteria
1. `GET /api/cameras` does NOT return 401 when `API_AUTH_TOKEN` is set (auth not applied to reads)
2. `POST /api/actions/trigger-analytics` returns 401 without auth header when `API_AUTH_TOKEN` is set
3. `POST /api/actions/trigger-analytics` succeeds with correct `Authorization: Bearer <token>`
4. `PATCH /api/analytics/:deviceId` succeeds with `X-Api-Key: <token>` header
5. CORS preflight for `X-Api-Key` header succeeds
6. WF-04: concurrent calls to `handleServerRestart` are serialized (second call skips)
7. WF-04: `runHealthCheck` still collects metrics while `handleServerFailure` is sleeping
8. Frontend: `triggerAction` includes auth header when `NEXT_PUBLIC_API_TOKEN` is set
9. Frontend: `toggleAnalytics` includes auth header when `NEXT_PUBLIC_API_TOKEN` is set
10. Frontend: `bulkToggleAnalytics` includes auth header when `NEXT_PUBLIC_API_TOKEN` is set
11. Frontend: all write functions work without error when `NEXT_PUBLIC_API_TOKEN` is not set

## Verification commands
- Frontend build: `cd modules/ghosthome-frontend && npm run build`
- Frontend lint: `cd modules/ghosthome-frontend && npm run lint`
- Backend syntax: `node -c modules/ghosthome-monitor/api-server.js && node -c modules/ghosthome-monitor/wf04-server-health.js`

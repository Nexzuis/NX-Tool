# Phase 3 — Productize

## Goal
Expose runtime configuration, analytics suppression controls, and Telegram health through the API and frontend settings page, and fix remaining critical/important tech debt items to prepare for unattended production operation.

---

## 3.1 — Expand Settings and Control Surfaces

### Backend: New API endpoints

| Method | Path | Rate Limit | Auth | Description |
|--------|------|-----------|------|-------------|
| GET | `/api/config` | readExpensiveLimiter (30/min) | No | Return runtime config (intervals, thresholds, report hours, Telegram status) — no secrets |
| GET | `/api/analytics/suppressed` | readExpensiveLimiter (30/min) | No | List all suppressed cameras |
| POST | `/api/analytics/unsuppress/:deviceId` | writeLimiter (10/min) | requireApiAuth | Clear suppression for one camera |
| POST | `/api/analytics/unsuppress-all` | writeLimiter (10/min) | requireApiAuth | Clear all suppressions |

**Auth model for new write routes**: Uses `requireApiAuth` middleware — same as all other write endpoints. When `API_AUTH_TOKEN` is set, requires Bearer/X-API-Key. When not set, open (matching SPEC.md contract).

**`GET /api/config` response shape:**
```json
{
  "intervals": {
    "analyticsMs": 1800000,
    "serverMs": 300000,
    "alarmsMs": 60000
  },
  "thresholds": {
    "staleDaytimeMs": 3600000,
    "staleEveningMs": 7200000,
    "quietTimeStart": 23,
    "quietTimeEnd": 6,
    "massOffline": 20
  },
  "reporting": {
    "morningHour": 6,
    "eveningHour": 18
  },
  "telegram": {
    "configured": true,
    "polling": true
  }
}
```

**Data sources for config response:**
- `intervals` — from `deps.config.intervals` (already in deps)
- `thresholds.staleDaytimeMs/staleEveningMs/quietTimeStart/quietTimeEnd` — these are currently hardcoded constants in WF-03. For the config endpoint, define them as constants in `config.js` and reference from both WF-03 and the API. This way they're centralized and queryable.
- `thresholds.massOffline` — from `deps.config.massOfflineThreshold`
- `reporting` — from `deps.config.dailyReportHour` and `deps.config.dailyReportHourEvening`
- `telegram.configured` — from `!!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID` (computed in config.js)
- `telegram.polling` — export a `isPolling()` function from `telegram.js`, add `telegram` to deps passed to API server

**Suppression endpoint edge cases:**
- `POST /api/analytics/unsuppress/:deviceId` with unknown/non-suppressed deviceId → 200 with `{ cleared: false }` (idempotent, no error)
- `POST /api/analytics/unsuppress-all` when nothing is suppressed → 200 with `{ cleared: 0 }`
- Unsuppress also resets WF-03 `failureCounts` for that deviceId — export `resetFailureCount(deviceId)` and `resetAllFailureCounts()` from WF-03. Without this, a single failure post-unsuppress would re-suppress immediately.
- If WF-03 is mid-cycle and re-suppresses after manual unsuppress → acceptable, next cycle will see fresh state
- Suppressed IDs that no longer exist in NX → still cleared from state (stale data cleanup)

**`GET /api/analytics/suppressed` response item shape:**
```json
{ "deviceId": "uuid", "count": 3, "since": "2026-03-15T07:00:00Z" }
```
- `count` = consecutive restart failures, `since` = when suppression started
- Empty array when nothing is suppressed

**Security: No secrets in `/api/config`:**
- Test: assert exact allowlisted top-level keys (`intervals`, `thresholds`, `reporting`, `telegram`) and their nested key names/types — no additional unknown fields allowed

### Backend: Fix tech debt items

**WF-04 mutex** (TECH-DEBT Critical): Replace separate `checkInProgress`/`restartInProgress` with a single shared `operationInProgress` flag. Both `runHealthCheck` and `handleServerFailure` check and set this flag at entry, clear it on exit. If flag is already set, log skip and return. This prevents concurrent execution of either path.

**Telegram sendMessage return** (TECH-DEBT Critical): Return the Promise from `callTelegramApi` in `sendMessage`. Existing callers don't await it, so this is backwards-compatible.

### Frontend: Settings page overhaul

Replace hardcoded `POLLING_INTERVALS` array and static "6:00 & 18:00" with live data from `GET /api/config`. Add:
- **Polling intervals section**: Fetched from config, formatted as human-readable
- **Thresholds section**: Stale detection thresholds, quiet time window, mass offline threshold
- **Telegram section**: Show configured/not configured + polling status
- **Suppression management**: List suppressed cameras with "Unsuppress" button per camera and "Unsuppress All" button

### Files to create/modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/config.js` | Add `telegramConfigured`, stale threshold constants, quiet time constants |
| `modules/ghosthome-monitor/api-server.js` | Add GET `/api/config`, GET `/api/analytics/suppressed`, POST unsuppress routes |
| `modules/ghosthome-monitor/wf03-analytics.js` | Import threshold constants from config.js instead of hardcoding |
| `modules/ghosthome-monitor/wf04-server-health.js` | Add `checkInProgress` guard to `handleServerFailure` |
| `modules/ghosthome-monitor/telegram.js` | Return Promise from `sendMessage`, export `isPolling()` |
| `modules/ghosthome-monitor/index.js` | Pass `telegram` in API server deps |
| `modules/ghosthome-frontend/src/lib/api.ts` | Add `fetchConfig()`, `fetchSuppressed()`, `unsuppressCamera()`, `unsuppressAll()` |
| `modules/ghosthome-frontend/src/app/settings/page.tsx` | Replace hardcoded values with live config, add Telegram + suppression sections |
| `modules/ghosthome-monitor/tests/api-routes.test.js` | Add tests for new endpoints (config no-secrets, suppression CRUD, auth enforcement) |
| `SPEC.md` | Add new endpoints to API tables |
| `CLAUDE.md` | Phase 3 completion notes |
| `TECH-DEBT.md` | Remove resolved items |
| `PLAN.md` | Mark Phase 3 complete |

---

## Order of Operations

1. Backend: Add threshold/telegram constants to `config.js`
2. Backend: Update WF-03 to use config constants
3. Backend: Export `isPolling()` from telegram.js, return Promise from `sendMessage`
4. Backend: Fix WF-04 mutex
5. Backend: Pass telegram to API server deps in index.js
6. Backend: Add all new API endpoints
7. Backend: Add tests for new endpoints
8. Frontend: Add API client functions
9. Frontend: Overhaul settings page
10. Docs: Update SPEC.md, CLAUDE.md, TECH-DEBT.md, PLAN.md

## Risks and Edge Cases

- **Config endpoint exposing secrets**: Explicit allowlist of fields — never tokens/passwords/chatIds. Test verifies no secret fields.
- **Unsuppress race condition**: Idempotent — if WF-03 re-suppresses, next cycle sees fresh state
- **Unknown deviceId on unsuppress**: Returns 200 with `cleared: false` (idempotent no-op)
- **WF-04 mutex**: Simple boolean flag, no deadlock risk
- **Telegram polling state**: `isPolling()` returns the module-level `polling` boolean, safe to read from API thread

## Acceptance Criteria

1. `GET /api/config` returns intervals, thresholds, reporting hours, and Telegram status
2. `GET /api/config` response contains zero fields with tokens, passwords, secrets, or chat IDs (test-verified)
3. `GET /api/analytics/suppressed` returns `{ ok: true, data: [...] }` array of suppressed cameras
4. `POST /api/analytics/unsuppress/:deviceId` with auth → 200, clears that camera's suppression
5. `POST /api/analytics/unsuppress/:deviceId` without auth (when token set) → 401
6. `POST /api/analytics/unsuppress/:deviceId` with unknown ID → 200 with `{ cleared: false }`
7. `POST /api/analytics/unsuppress-all` with auth → 200, clears all suppressions
8. Settings page shows live polling intervals from `/api/config` (not hardcoded)
9. Settings page shows Telegram configuration status
10. Settings page shows suppressed cameras list with unsuppress buttons
11. `POST /api/analytics/unsuppress-all` without auth (when token set) → 401
12. WF-04 `handleServerFailure` skips when `operationInProgress` is true (shared lock with `runHealthCheck`)
13. `telegram.sendMessage` returns a Promise (typeof check)
14. `/api/config` response has exactly the allowlisted keys — no extra fields (schema test)
13. `cd modules/ghosthome-monitor && npm test` — all tests pass
14. `cd modules/ghosthome-frontend && npm run build` — passes
15. `cd modules/ghosthome-frontend && npm test` — passes

## Verification Commands
```bash
cd modules/ghosthome-monitor && npm test
cd modules/ghosthome-frontend && npm run build
cd modules/ghosthome-frontend && npm test
for f in modules/ghosthome-monitor/*.js; do node -c "$f"; done
```

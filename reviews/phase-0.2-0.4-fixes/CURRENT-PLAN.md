# Phase 0.2-0.4 — Data Correctness + Robustness + Frontend Quality

## Goal
Fix all remaining Phase 0 review findings: event naming bugs, missing event emissions, error handling gaps, Telegram retry logic, NX client error objects, frontend error boundaries, WebSocket auth validation, graceful shutdown, dashboard memo deps, WS fallback URL, timezone bugs, and settings page dynamic config.

## Files to modify

| File | Phase | Changes |
|------|-------|---------|
| `modules/ghosthome-monitor/wf05-daily-report.js` | 0.2, 0.4 | Fix `ANALYTICS_HEALED` → `ANALYTICS_REENABLED` on line 251; fix `getYesterdayDate()`/`getTodayDate()` to use SAST instead of UTC |
| `modules/ghosthome-monitor/wf02-camera-offline.js` | 0.2 | Emit `MASS_OFFLINE_CLEARED` via eventBus (line 157); fix catch block at line 89-91 to clear incident + pending wait |
| `modules/ghosthome-monitor/wf03-analytics.js` | 0.2 | Guard Condition C recovery confirmation: only emit `ANALYTICS_RECOVERED` if detection was actually verified (not quiet time) |
| `modules/ghosthome-monitor/telegram.js` | 0.3 | Add retry with exponential backoff (3 attempts) for `CRITICAL_SERVER` and `MASS_OFFLINE` sends |
| `modules/ghosthome-monitor/nx-client.js` | 0.3 | Return `{ error, status }` objects instead of `null` on failures in `_request()` |
| `modules/ghosthome-monitor/wf01-websocket.js` | 0.3 | Check auth response for success (msg.id === 1), reconnect on auth failure |
| `modules/ghosthome-monitor/index.js` | 0.3 | Store `startApiServer()` return value; close HTTP + WS servers in shutdown |
| `modules/ghosthome-monitor/api-server.js` | 0.3 | Return `{ httpServer, wss }` from `startApiServer()` for graceful shutdown |
| `modules/ghosthome-frontend/src/app/error.tsx` | 0.3 | Create root error boundary |
| `modules/ghosthome-frontend/src/app/dashboard/page.tsx` | 0.4 | Fix useMemo deps for parsedEvents |
| `modules/ghosthome-frontend/src/hooks/use-websocket.ts` | 0.4 | Fix fallback URL: derive from `NEXT_PUBLIC_API_URL` if `NEXT_PUBLIC_WS_URL` not set |
| `modules/ghosthome-frontend/src/app/workflows/page.tsx` | 0.4 | Fix WF-05 next-run calculation to use SAST timezone |
| `modules/ghosthome-frontend/src/app/settings/page.tsx` | 0.4 | Read NX host from health API instead of hardcoded; read polling intervals from backend config |
| `modules/ghosthome-frontend/.env.example` | 0.4 | Already has correct vars — no change needed |
| `modules/ghosthome-monitor/.env.example` | 0.4 | Already has `ALLOW_INSECURE_TLS=true` — no change needed |

## Order of operations

### 1. WF-05 event name fix (0.2)
- Line 251: change `countEvents(wf03TodayLogs, 'ANALYTICS_HEALED')` → `countEvents(wf03TodayLogs, 'ANALYTICS_REENABLED')`

### 2. WF-05 SAST date bucketing (0.4)
- Replace `getYesterdayDate()` and `getTodayDate()` to use `toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' })` which gives YYYY-MM-DD in SAST

### 3. WF-02 MASS_OFFLINE_CLEARED emit (0.2)
- Line 157: after the `log()` call, add `if (eventBus) eventBus.emit('MASS_OFFLINE_CLEARED', { offlineCount: offlineDevices.length, threshold });`

### 4. WF-02 catch block cleanup (0.2)
- Lines 89-92: in the catch block, clear `pendingWaits` entry for this device and clear the active incident before returning

### 5. WF-03 analytics recovery guard (0.2)
- Lines 307-322 (Condition C): only emit `ANALYTICS_RECOVERED` when `!isQuietTime` (i.e., detection was actually checked). During quiet time, leave the camera in `pending_recovery` status until next non-quiet cycle verifies detections.

### 6. Telegram retry for critical sends (0.3)
- Add a `sendMessageWithRetry(text, parseMode, maxRetries=3)` function with exponential backoff (1s, 2s, 4s)
- Apply to `onCriticalServer` and `onMassOffline` handlers only — other messages are non-critical

### 7. NX client error objects (0.3)
- In `_request()`, instead of returning `null` on error, return `{ error: true, message: '...', status: statusCode }` for HTTP errors and `{ error: true, message: '...' }` for network errors
- All callers already check `if (!result)` — need to also handle `result.error === true`. But this is a wide-reaching change. Safer approach: keep returning `null` for non-401 errors but add a `lastError` property callers can optionally check. Actually simplest: keep null returns but log better. The plan says "error objects" but changing every caller is risky for 0.3. **Revised approach**: Add `this.lastError` to track the last error, and change `_request` to set it before returning null. This gives callers opt-in error context without breaking existing null checks.

### 8. WF-01 WebSocket auth check (0.3)
- Line 115: when `msg.id === 1`, check `msg.result` or `msg.error`. If auth failed (`msg.error` present), log the failure and trigger reconnect.

### 9. API server return value + graceful shutdown (0.3)
- `api-server.js`: modify `startApiServer()` to return `{ httpServer, wss }`
- `index.js`: store the return value. In `shutdown()`, call `wss.close()` and `httpServer.close()` before `process.exit()`

### 10. Frontend error boundary (0.3)
- Create `src/app/error.tsx` — a `'use client'` component that catches errors and shows a styled error screen with retry button

### 11. Dashboard useMemo fix (0.4)
- Line 231-233: `recentMessages` is derived from `messages` and `displayCount`, but `useMemo` only has `[recentMessages]` as dep — this creates a new array reference each render. Fix: memoize `parsedEvents` with `[messages, displayCount]` as deps and compute `recentMessages` inside the memo.

### 12. WebSocket fallback URL fix (0.4)
- `use-websocket.ts` line 5-10: when `NEXT_PUBLIC_WS_URL` is not set, derive WS URL from `NEXT_PUBLIC_API_URL` (replace `http` with `ws`, append `/ws`). Only fall back to `window.location` as last resort.

### 13. WF-05 next-run SAST calculation (0.4)
- `workflows/page.tsx` lines 886-895: replace browser-local-time calculation with SAST-aware calculation using `toLocaleString` with Africa/Johannesburg timezone

### 14. Settings page dynamic config (0.4)
- Replace hardcoded "192.168.1.110:7001" with value from `health?.serverName` or derive from `NEXT_PUBLIC_API_URL`
- Replace hardcoded polling intervals with a new `/api/config` endpoint... **Actually simpler**: display the API URL from env var (already done on line 153) and show NX host info from the health endpoint response. Add an `nxHost` field to the health API response.
- **Revised approach**: Add `nxHost` to the health endpoint in `api-server.js`. Settings page reads it from the health response. Polling intervals stay as documentation (they come from env vars the operator sets).

## Risks and edge cases
- **NX client lastError**: callers that currently check `if (!result)` still work. Only new code needs to read `lastError`.
- **WF-03 quiet-time guard**: cameras in `pending_recovery` during quiet hours stay pending until the next daytime cycle. This is correct behavior — we shouldn't confirm recovery without verification.
- **WF-02 catch block**: clearing incident on error means the camera could be re-detected as offline on the next verification loop. This is correct — better to retry than leave it in limbo.
- **Telegram retry**: only applied to CRITICAL_SERVER and MASS_OFFLINE. Other messages are intentionally fire-and-forget to avoid backpressure.
- **Error boundary**: only catches rendering errors, not data fetching. Fetch errors are already handled per-page with try/catch.

## Acceptance criteria
1. WF-05 today's analytics count uses `ANALYTICS_REENABLED` (not `ANALYTICS_HEALED`)
2. WF-05 date bucketing uses SAST dates (e.g., event at 01:00 UTC = 03:00 SAST still counts as "today" in SAST)
3. WF-02 emits `MASS_OFFLINE_CLEARED` to eventBus (not just log)
4. WF-02 catch block clears pending wait + incident on verification error
5. WF-03 does NOT emit `ANALYTICS_RECOVERED` during quiet time
6. Telegram retries CRITICAL_SERVER message up to 3 times on failure
7. NX client sets `lastError` property on failure
8. WF-01 detects and logs WebSocket auth failure, triggers reconnect
9. Shutdown closes HTTP server and WebSocket server before exit
10. Frontend has a root error boundary at `src/app/error.tsx`
11. Dashboard `parsedEvents` useMemo has correct deps `[messages, displayCount]`
12. WebSocket hook derives fallback URL from `NEXT_PUBLIC_API_URL` when WS URL not set
13. WF-05 next-run on workflows page uses SAST timezone
14. Settings page shows NX host from health API, not hardcoded
15. Backend syntax check passes: `node -c` on all modified .js files
16. Frontend build passes: `npm run build` with 0 errors

## Verification commands
- Backend syntax: `node -c modules/ghosthome-monitor/wf05-daily-report.js && node -c modules/ghosthome-monitor/wf02-camera-offline.js && node -c modules/ghosthome-monitor/wf03-analytics.js && node -c modules/ghosthome-monitor/telegram.js && node -c modules/ghosthome-monitor/nx-client.js && node -c modules/ghosthome-monitor/wf01-websocket.js && node -c modules/ghosthome-monitor/index.js && node -c modules/ghosthome-monitor/api-server.js`
- Frontend build: `cd modules/ghosthome-frontend && npm run build`

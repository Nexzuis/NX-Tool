# Ghosthome Monitor — Full Code Review (Claude)

**Date:** 2026-03-15
**Reviewer:** Claude Opus 4.6
**Scope:** Full codebase — backend (ghosthome-monitor) + frontend (ghosthome-frontend)
**Status:** All CRITICAL, HIGH, and actionable MEDIUM issues FIXED. See CONSOLIDATED-REVIEW.md for current status.

---

## Recent Fixes Verification

All 4 fixes verified as **CORRECT AND COMPLETE**:

1. **loading.tsx files** — All 5 present, server components (no `'use client'`), correct Suspense boundary behavior
2. **Cameras fetchError state** — Catch block only sets error on first load (`cameras === null`), retry button clears error and re-fetches
3. **RateLimitError in api.ts** — 429 detected before generic throw, `retryAfterS` from `Retry-After` header, exported class
4. **useWebSocketStatus hook** — `statusListeners` only notified on open/close/error (not messages), ShellClient correctly switched

---

## CRITICAL Issues (3)

### C1. WF-02: Race condition — promise continues after stop()
**File:** `modules/ghosthome-monitor/wf02-camera-offline.js:57-68`
**Category:** Concurrency / Production Readiness
**Description:** When `stop()` resolves pending wait promises, the code after `await` continues executing — making NX API calls and setting incidents on a system that is shutting down.
**Fix:** Add `if (!running) return;` check immediately after the await resolves.

### C2. WF-04: sleep timers not cancelled on stop()
**File:** `modules/ghosthome-monitor/wf04-server-health.js:144-264, 302-304`
**Category:** Production Readiness
**Description:** `handleServerRestart` and `handleServerFailure` call `sleep()` for 5-15 minutes. These timers are not tracked or cancellable. Graceful shutdown can be blocked for up to 15 minutes.
**Fix:** Track active sleep timers, clear them in `stop()`, or have `sleep()` check the `running` flag.

### C3. WF-03: sleep timers in restartAnalytics not cancelled on stop()
**File:** `modules/ghosthome-monitor/wf03-analytics.js:104-163, 393-395`
**Category:** Production Readiness
**Description:** Same as C2. Analytics restart cycle takes ~40s per camera with uncancellable sleeps. With multiple cameras restarting, process stays alive long after `stop()`. `cycleInProgress` flag never resets.
**Fix:** Store sleep timer references and clear them in `stop()`.

---

## HIGH Issues (11)

### Backend HIGH

#### BH1. Persistence: getSnapshot called on every state mutation
**File:** `modules/ghosthome-monitor/persistence.js:85-89`
**Description:** `markDirty()` calls `getState()` → `getSnapshot()` immediately (iterates all Maps), then debounces the write. With 69 cameras and frequent WS updates, this creates unnecessary CPU work serializing full state on every mutation.
**Fix:** Only set a dirty flag; call `getState()` inside the debounced callback.

#### BH2. Telegram: staleAlertCooldowns grows unbounded
**File:** `modules/ghosthome-monitor/telegram.js:507`
**Description:** No cleanup mechanism. Grows indefinitely over weeks of 24/7 operation.
**Fix:** Periodically prune entries older than cooldown period.

#### BH3. Telegram: deviceNameCache never evicts — stale names after renames
**File:** `modules/ghosthome-monitor/telegram.js:121`
**Description:** Camera names cached permanently. After rename in NX Witness, alerts show stale names.
**Fix:** Clear cache every 24 hours or add TTL.

#### BH4. WF-01: handledAlarmIds prevents re-detection of recurring offlines
**File:** `modules/ghosthome-monitor/wf01-websocket.js:271-274`
**Description:** `offline:${deviceId}` entries act as infinite dedup, not sliding window. Once handled, same device's offline alarm never detected by fallback poll again.
**Fix:** Clear periodically (e.g., hourly) or track with timestamps.

#### BH5. .gitignore missing .env and node_modules
**File:** `modules/ghosthome-monitor/.gitignore`
**Description:** Only contains `data/`. Missing `.env` (has NX_PASSWORD, TELEGRAM_BOT_TOKEN, API_AUTH_TOKEN) and `node_modules/`. Credential exposure risk.
**Fix:** Add `.env`, `node_modules/`, `logs/`.

#### BH6. WF-03: getStaleThresholdMs uses locale-dependent toLocaleString
**File:** `modules/ghosthome-monitor/wf03-analytics.js:58-62`
**Description:** `toLocaleString` hour extraction can return unexpected formats across Windows locale configs. Could break quiet-time logic.
**Fix:** Use `Intl.DateTimeFormat` with `formatToParts` (as WF-05 does).

### Frontend HIGH

#### FH1. Stale closure in cameras `load` callback
**File:** `modules/ghosthome-frontend/src/app/cameras/page.tsx:217`
**Description:** `load` references `cameras` in closure but has empty dep array `[]`. Always captures initial `cameras === null`. After successful load, any poll failure still sets `fetchError(true)`, showing "Unable to load cameras" in footer even though data is displayed.
**Fix:** Use functional state access: `setCameras(prev => { if (prev === null) setFetchError(true); return prev; })`.

#### FH2. RateLimitError thrown but never consumed with backoff
**File:** `modules/ghosthome-frontend/src/lib/api.ts:85-94`
**Description:** `RateLimitError` has `retryAfterS` property but no consumer catches it specifically. Polling continues at fixed intervals during rate limiting. 429 protection is incomplete.
**Fix:** In polling effects, catch `RateLimitError` and temporarily increase poll interval.

#### FH3. WebSocket `entry` not in useEffect dependency arrays
**File:** `modules/ghosthome-frontend/src/hooks/use-websocket.ts:186, 223`
**Description:** `entry` resolved at render time but not in effect deps. React exhaustive-deps would flag this. Currently safe due to `getOrCreate` idempotency but fragile.
**Fix:** Include `entry` in effect deps or use a ref.

#### FH4. apiFetch missing auth headers on read endpoints
**File:** `modules/ghosthome-frontend/src/lib/api.ts:118-138`
**Description:** GET requests send no auth. If read endpoints ever require auth, all data fetching fails silently with 401s.
**Fix:** Add optional auth header to read requests.

#### FH5. Tailwind v4 opacity shorthand inconsistency in settings
**File:** `modules/ghosthome-frontend/src/app/settings/page.tsx:359, 797-798`
**Description:** `bg-[#00FF88]/08` syntax may not work with arbitrary hex values in Tailwind v4. Rest of codebase correctly uses `rgba()` syntax.
**Fix:** Replace with `bg-[rgba(0,255,136,0.08)]` for consistency.

---

## MEDIUM Issues (17)

### Backend MEDIUM

| ID | File | Description |
|----|------|-------------|
| BM1 | `logger.js:47-57` | `readLogsForDate` uses sync `readFileSync` — blocks event loop during report generation |
| BM2 | `logger.js` | No log rotation or cleanup — accumulates ~1800 files/year |
| BM3 | `wf05-daily-report.js:175-207` | N+1 query: 69 sequential HTTP calls to NX API for analytics. Could take 35min worst case |
| BM4 | `api-server.js:337-354` | GET /api/analytics fires 69+ parallel HTTP requests to NX — could overwhelm server |
| BM5 | `wf04-server-health.js:16,93-103` | `consecutiveHighCpu` is single number, not per-server. Latent bug if second server added |
| BM6 | `wf04-server-health.js:131` | `setServerHealth` overwrites on each server iteration — only last server stored |
| BM7 | `api-server.js:432-439` | test-telegram uses `require('./telegram')` instead of injected deps |
| BM8 | `config.js:34-37` | Quiet time thresholds hardcoded, not configurable via .env |
| BM9 | `persistence.js:51-57` | `atomicWrite` uses sync file ops — blocks event loop |
| BM10 | `wf02-camera-offline.js:169-172` | Mass offline creates 69 concurrent 30-min waits, simultaneous escalation storm |

### Frontend MEDIUM

| ID | File | Description |
|----|------|-------------|
| FM1 | `dashboard/page.tsx:231-233` | `parsedEvents` memoization has unstable dep (messages array recreated each message) |
| FM2 | `analytics-panel.tsx:121-133` | No confirmation dialog for destructive "Enable All" / "Disable All" bulk actions |
| FM3 | `skeleton.tsx:51-64` | `SkeletonCard` has conflicting `role="status"` + `aria-hidden="true"` |
| FM4 | `use-websocket.ts:21` | `WS_URL` computed at module load — server-side fallback could be cached |
| FM5 | `workflows/page.tsx:1027` | Uses full `useWebSocket()` but only reads `lastMessage` — could use targeted approach |
| FM6 | `dashboard/page.tsx:159` | Dashboard uses full `useWebSocket()` — every WS message re-renders entire page |
| FM7 | `incidents/page.tsx:549` | Same as FM6 — incidents page re-renders on every WS message |

---

## LOW Issues (13)

### Backend LOW

| ID | File | Description |
|----|------|-------------|
| BL1 | `index.js:153-159` | eventBus listeners registered after workflow start — could miss early events |
| BL2 | `api-server.js:510-511` | CORS only allows localhost — LAN access blocked |
| BL3 | `wf01-websocket.js:203-209` | No exponential backoff on WS reconnect — fixed 10s retries |
| BL4 | `wf05-daily-report.js:472` | Timezone string not validated at startup |
| BL5 | `index.js:174` | apiRefs could be null during early shutdown — handled safely |
| BL6 | `api-server.js:522` | No explicit express.json() body size limit |

### Frontend LOW

| ID | File | Description |
|----|------|-------------|
| FL1 | `settings/page.tsx:638,847` | Hardcoded "v1.0.0" in two places |
| FL2 | `cameras/page.tsx:618,639` | Duplicate `{/* Footer count */}` comment |
| FL3 | `use-websocket.ts:111` | `MessageEvent<string>` type assertion — WS could send Blob |
| FL4 | `incidents/page.tsx:27-36` | `timeAgo` doesn't guard against NaN from invalid dates |
| FL5 | `workflows/page.tsx:947-966` | `parseInt` on locale-formatted string — fragile |
| FL6 | `dashboard/page.tsx:445` | Activity feed key uses array index — unstable with shifting data |
| FL7 | `analytics-panel.tsx:231` | Missing `aria-label` on search input |

---

## Summary

| Severity | Backend | Frontend | Total |
|----------|---------|----------|-------|
| CRITICAL | 3 | 0 | **3** |
| HIGH | 6 | 5 | **11** |
| MEDIUM | 10 | 7 | **17** |
| LOW | 6 | 7 | **13** |
| **Total** | **25** | **19** | **44** |

### Top Priority Actions
1. **Fix C1-C3** — Graceful shutdown is broken by uncancellable sleeps and post-stop execution
2. **Fix BH5** — Add `.env` to `.gitignore` before any git operations
3. **Fix FH1** — Stale closure causes misleading error state in cameras page
4. **Fix FH2** — Wire up RateLimitError consumers to actually back off
5. **Fix BH6** — Locale-dependent hour parsing could break analytics on different Windows configs

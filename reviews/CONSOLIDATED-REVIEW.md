# Consolidated Codebase Review — Ghosthome Monitor

**Reviews merged:** Claude Backend Agent, Claude Frontend Agent, Codex (gpt-5.3-codex)
**Date:** 2026-03-15
**Original verdict:** NEEDS FIXES
**Current status:** ALL CRITICAL, HIGH, and actionable MEDIUM issues FIXED (Codex APPROVED all 3 phases)

---

## Scoring Summary

| Source | Critical | High/Important | Medium/Minor | Total |
|--------|----------|----------------|--------------|-------|
| Claude Backend (2026-03-15) | 3 | 6 | 16 | 25 |
| Claude Frontend (2026-03-15) | 0 | 5 | 14 | 19 |
| Codex gpt-5.3-codex (2026-03-15) | 2 | 5 | 2 | 9 |
| Previous review (2026-03-14) | 7 | 14 | 12 | 33 |
| **Deduplicated Total** | **3** | **8** | **17+** | **44+** |

---

## Fix Status

### Phase A — Graceful Shutdown (CRITICAL) — COMPLETE, Codex APPROVED (3 rounds)

| ID | Issue | Status | Fix |
|----|-------|--------|-----|
| C1 | WF-02 continues after stop() | **FIXED** | `if (!running) return;` guard + incident cleanup in stop() |
| C2 | WF-04 uncancellable sleeps | **FIXED** | ShutdownError class, cancellable sleep Map, cancelAllSleeps() in stop() |
| C3 | WF-03 uncancellable sleeps | **FIXED** | Same pattern + cycleInProgress reset, ShutdownError propagation |

### Phase B — Correctness (HIGH) — COMPLETE, Codex APPROVED (1 round)

| ID | Issue | Status | Fix |
|----|-------|--------|-----|
| H1 | Cameras fetchError stale closure | **FIXED** | Functional setCameras(prev => ...) |
| H2 | RateLimitError no backoff | **FIXED** | All 4 pages: recursive setTimeout + pollDelayRef |
| H3 | .gitignore missing .env | **FIXED** | Added .env, node_modules/, logs/ |
| H4 | WF-03 locale-fragile parsing | **FIXED** | Intl.DateTimeFormat.formatToParts |
| H5 | WF-01 infinite alarm dedup | **FIXED** | Hourly alarmClearTimer |
| H6 | Persistence CPU waste | **FIXED** | markDirty defers getSnapshot to debounce callback |
| H7 | Telegram unbounded caches | **FIXED** | 24h eviction timer |
| H8 | Tailwind opacity syntax | **FIXED** | bg-[#hex]/08 → bg-[rgba()] |

### Phase C — Medium + CR-3 — COMPLETE, Codex APPROVED (1 round)

| ID | Issue | Status | Fix |
|----|-------|--------|-----|
| CR-3 | NX Client null on all errors | **FIXED** | 404 differentiation, lastError.status available |
| BM1 | Logger sync readFile | **FIXED** | async fs.promises.readFile |
| BM2 | No log cleanup | **FIXED** | cleanOldLogs(30) at startup |
| BL6 | No express.json limit | **FIXED** | 10kb limit |
| FM3 | SkeletonCard aria conflict | **FIXED** | Removed aria-hidden |
| FL4 | timeAgo NaN crash | **FIXED** | isNaN guard |
| FL2 | Duplicate comment | **FIXED** | Removed |

### Prior Review (2026-03-14) — Verification Results

| ID | Issue | Status |
|----|-------|--------|
| CR-1 | WF-04 restart/failure mutex | **ALREADY FIXED** (operationInProgress guard) |
| CR-2 | Telegram fire-and-forget | **ALREADY FIXED** (sendMessageWithRetry exists) |
| CR-3 | NX Client null on all errors | **FIXED in Phase C** |
| CR-4 | Auth blocks read endpoints | **ALREADY FIXED** (auth on POST/PATCH only) |
| CR-5 | Frontend no auth headers | **ALREADY FIXED** (getWriteHeaders) |
| CR-6 | No error boundaries | **ALREADY FIXED** (global error.tsx) |
| CR-7 | Dashboard useMemo broken | **ALREADY FIXED** (stable deps) |
| IM-1 | MASS_OFFLINE not forwarded | **ALREADY FIXED** (in BUS_EVENTS array) |
| IM-2 | WF-05 wrong event name | **ALREADY FIXED** (ANALYTICS_REENABLED) |
| IM-3 | Field name mismatch | **ALREADY FIXED** (eventCount aligned) |
| IM-4 | CORS missing X-Api-Key | **ALREADY FIXED** (in allowedHeaders) |
| IM-5 | WS auth response unchecked | **ALREADY FIXED** (msg.error checked) |
| IM-6 | WF-02 stuck incidents | **ALREADY FIXED** (catch clears incident) |
| IM-7 | WF-03 quiet time recovery | **ALREADY FIXED** (skips during quiet) |

---

## Remaining Unfixed Items (LOW priority — deferred)

These are minor polish items or would require architectural changes. Documented for future reference.

### Backend LOW (not fixed)
| ID | Description | Reason deferred |
|----|-------------|-----------------|
| BL1 | eventBus listeners after workflow start | Timing is safe due to startup delays |
| BL2 | CORS localhost only | Intentional for security |
| BL3 | WS reconnect no backoff | Fixed 10s is acceptable for LAN |
| BL4 | Timezone string not validated | Hardcoded correct value |
| BL5 | apiRefs null during early shutdown | Handled safely with null check |

### Backend MEDIUM (not fixed)
| ID | Description | Reason deferred |
|----|-------------|-----------------|
| BM3 | WF-05 N+1 analytics queries | Complex batching, low frequency (2x/day) |
| BM4 | API analytics 69 parallel requests | Would need API redesign |
| BM5 | consecutiveHighCpu single-server | Only 1 server, premature optimization |
| BM6 | setServerHealth overwrites | Same — single server |
| BM7 | test-telegram require vs deps | Works correctly |
| BM8 | Quiet time thresholds hardcoded | Env vars exist, just not wired |
| BM9 | atomicWrite sync I/O | State file is tiny (<10KB) |
| BM10 | Mass offline 69 concurrent waits | Complex concurrency change |

### Frontend LOW/MEDIUM (not fixed)
| ID | Description | Reason deferred |
|----|-------------|-----------------|
| FL1 | Hardcoded v1.0.0 | Cosmetic |
| FL3 | MessageEvent string type | Backend only sends strings |
| FL5 | parseInt locale string | en-ZA returns ASCII digits |
| FL6 | Activity feed index key | Lightweight list, no animations |
| FL7 | Missing aria-label on search | Cosmetic accessibility |
| FM1 | parsedEvents unstable memo | Lightweight computation |
| FM2 | No bulk action confirmation | Needs design decision |
| FM4 | WS_URL module-scope | Works for documented deployment |
| FM5-FM7 | Full useWebSocket on pages | Pages need messages for features |

---

## Review Artifacts

```
reviews/
  phase-graceful-shutdown/   — Phase A plan + build reviews (3 Codex rounds)
  phase-high-fixes/          — Phase B build review (1 Codex round)
  phase-medium-fixes/        — Phase C build review (1 Codex round)
  CLAUDE-REVIEW.md           — Original 44-issue Claude audit
  CONSOLIDATED-REVIEW.md     — This file (cross-model merged + status tracking)
```

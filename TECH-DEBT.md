# Ghosthome Monitor - Tech Debt

> Updated 2026-03-15 after full codebase review (Claude + Codex) and 3 fix phases.
> Items from 2026-03-14 review that were fixed have been removed.

## Important

### Dead CAMERA_RECOVERED event in WebSocket broadcast
`BUS_EVENTS` array in `api-server.js` includes `CAMERA_RECOVERED`, but no workflow ever emits `eventBus.emit('CAMERA_RECOVERED', ...)`. WF-02 clears incident state on recovery but does not emit this named event. The frontend WebSocket listener will never receive it.
- **Fix:** Either add `eventBus.emit('CAMERA_RECOVERED', { deviceId })` in WF-02 at recovery points (lines 38, 87), or remove from `BUS_EVENTS`.
- Files: `modules/ghosthome-monitor/api-server.js:30`, `modules/ghosthome-monitor/wf02-camera-offline.js`

### Write API auth is opt-in, not safe by default
When `API_AUTH_TOKEN` is empty, write endpoints are open to any caller that can reach the API host. Backend logs a WARNING at startup but does not block.
- Files: `modules/ghosthome-monitor/api-server.js`, `.env.example`

### Production secrets in plaintext .env
NX Witness and Telegram credentials stored in backend `.env` file. Mitigated by `.gitignore` (added 2026-03-15) but still a local secret-handling consideration.
- Files: `modules/ghosthome-monitor/.env`

## Minor

### No automated tests
Backend `package.json` defines a test script but no test files exist. Frontend has vitest configured with @testing-library but only 6 smoke tests. Unit tests for state.js, persistence.js, and staleness threshold logic would be high value.
- Files: `modules/ghosthome-monitor/package.json`, `modules/ghosthome-frontend/vitest.config.ts`

### Duplicated ShutdownError/cancellable-sleep pattern
WF-03 and WF-04 have identical `ShutdownError`, `sleep()`, `cancelAllSleeps()` implementations. Could be extracted to a shared `utils/cancellable-sleep.js` module.
- Files: `modules/ghosthome-monitor/wf03-analytics.js`, `modules/ghosthome-monitor/wf04-server-health.js`

### Duplicated utility functions
`formatUptime` defined identically in `telegram.js`, `wf05-daily-report.js`, `workflows/page.tsx`, and `api.ts`. `timeAgo`/`relativeTime` duplicated across 3 frontend pages. Could be extracted to shared utilities.
- Files: Multiple

### Dead save() function in persistence.js
`save()` is exported but never called. Only `markDirty()` and `flush()` are used.
- Files: `modules/ghosthome-monitor/persistence.js:59-70`

### DM Sans loaded via CSS @import
Render-blocking CSS import and request to Google Fonts. Could use `next/font` for better performance.
- Files: `modules/ghosthome-frontend/src/app/globals.css:1`

### Single-server assumption
WF-04 `consecutiveHighCpu` is a single number (not per-server). `setServerHealth` overwrites on each server iteration. WF-05 uses `servers[0]`. Works for current single-NX-server deployment but would need refactoring for multi-server.
- Files: `modules/ghosthome-monitor/wf04-server-health.js`, `modules/ghosthome-monitor/wf05-daily-report.js`

### Camera-config and site-config are empty stubs
Pole notification and site-aware reporting features are fully implemented but dormant until these config files are populated with real data.
- Files: `modules/ghosthome-monitor/camera-config.js`, `modules/ghosthome-monitor/site-config.js`

### AnalyticsCamera TypeScript interface incomplete
Backend returns `analyticsStatus` and `analyticsStatusUpdatedAt` fields that are not in the frontend `AnalyticsCamera` interface. No runtime error (extra fields ignored) but TypeScript type checking is incomplete.
- Files: `modules/ghosthome-frontend/src/lib/api.ts:179-185`

### WorkflowSummary loosely typed
Frontend defines generic `WorkflowSummary` with `[key: string]: unknown` catch-all. Specific workflow shapes (`Wf01Data` through `Wf05Data`) are defined locally in the workflows page but not exported from `api.ts`.
- Files: `modules/ghosthome-frontend/src/lib/api.ts:46-49`, `modules/ghosthome-frontend/src/app/workflows/page.tsx:28-75`

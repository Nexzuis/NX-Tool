# Phase C — Remaining Fixes (MEDIUM + CR-3)

## Goal
Fix the remaining actionable issues: NX Client error differentiation (CR-3), logger async I/O + log cleanup, SkeletonCard aria fix, timeAgo NaN guard, express body limit, and minor cleanup.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/nx-client.js` | CR-3: Return error objects instead of null on non-auth failures |
| `modules/ghosthome-monitor/logger.js` | BM1: Convert readLogsForDate to async. BM2: Add log file cleanup |
| `modules/ghosthome-monitor/wf05-daily-report.js` | Update callers of readLogsForDate to await |
| `modules/ghosthome-monitor/api-server.js` | BL6: Add express.json body size limit |
| `modules/ghosthome-frontend/src/components/ui/skeleton.tsx` | FM3: Fix SkeletonCard aria conflict |
| `modules/ghosthome-frontend/src/app/incidents/page.tsx` | FL4: Add NaN guard to timeAgo |
| `modules/ghosthome-frontend/src/app/cameras/page.tsx` | FL2: Remove duplicate comment |

## Verification Commands
```bash
node -c modules/ghosthome-monitor/nx-client.js
node -c modules/ghosthome-monitor/logger.js
node -c modules/ghosthome-monitor/wf05-daily-report.js
node -c modules/ghosthome-monitor/api-server.js
cd modules/ghosthome-frontend && npm run build && npm test
```

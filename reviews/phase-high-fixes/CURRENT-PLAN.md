# Phase B — HIGH Issue Fixes

## Goal
Fix all 8 HIGH-severity issues from the consolidated review: cameras stale closure, RateLimitError backoff, .gitignore, WF-03 locale parsing, WF-01 alarm dedup, persistence optimization, Telegram cache eviction, Tailwind syntax.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-frontend/src/app/cameras/page.tsx` | H1: Fix stale closure in load callback |
| `modules/ghosthome-frontend/src/app/dashboard/page.tsx` | H2: Add RateLimitError backoff |
| `modules/ghosthome-frontend/src/app/workflows/page.tsx` | H2: Add RateLimitError backoff |
| `modules/ghosthome-frontend/src/app/incidents/page.tsx` | H2: Add RateLimitError backoff |
| `modules/ghosthome-frontend/src/app/settings/page.tsx` | H8: Fix Tailwind opacity syntax |
| `modules/ghosthome-monitor/.gitignore` | H3: Add .env, node_modules/, logs/ |
| `modules/ghosthome-monitor/wf03-analytics.js` | H4: Replace toLocaleString with formatToParts |
| `modules/ghosthome-monitor/wf01-websocket.js` | H5: Add periodic handledAlarmIds clearing |
| `modules/ghosthome-monitor/persistence.js` | H6: Defer getSnapshot to debounce callback |
| `modules/ghosthome-monitor/telegram.js` | H7: Add periodic cache eviction |

## Verification Commands
```bash
node -c modules/ghosthome-monitor/wf01-websocket.js
node -c modules/ghosthome-monitor/wf03-analytics.js
node -c modules/ghosthome-monitor/persistence.js
node -c modules/ghosthome-monitor/telegram.js
cd modules/ghosthome-frontend && npm run build
cd modules/ghosthome-frontend && npm test
```

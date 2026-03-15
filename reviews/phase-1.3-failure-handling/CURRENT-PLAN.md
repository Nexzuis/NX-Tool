# Phase 1.3 — Improve Operator-Facing Failure Handling

## Goal
Make the incidents page show camera names instead of truncated device IDs, and make trigger buttons show clear failure states when backend actions fail.

## Context
1. **Incidents page**: `formatDeviceId()` truncates UUIDs (e.g., `A1B2C3D4`), but operators need camera names (e.g., "Gate Camera 1"). The camera list is available from `/api/cameras`.
2. **TriggerButton**: The catch block is `catch { // silently handled }` — operators get no feedback when triggers fail (network error, 401, 429, timeout).

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-frontend/src/app/incidents/page.tsx` | Fetch camera list on mount, build name lookup map, show name instead of truncated ID |
| `modules/ghosthome-frontend/src/app/workflows/page.tsx` | Add error state to TriggerButton, show failure feedback |

## Order of operations

### 1. Incidents page — resolve camera names
- Import `fetchCameras` from `@/lib/api`
- On mount, fetch cameras and build `Map<string, string>` (id → name)
- Replace `formatDeviceId(deviceId)` with camera name lookup, falling back to `formatDeviceId()` if name not found
- Camera fetch is best-effort — if it fails, fall back to truncated IDs (no error shown, since incident data is still valid)

### 2. TriggerButton — show failure state
- Add `error` state alongside existing `loading` and `success` states
- In the catch block, set error state with a message
- Show error state visually: red border, XCircle icon, "Failed" text
- Auto-clear error after 5 seconds (same as success)
- Error messages: show the error message from the thrown error (which now includes timeout info from fetchWithTimeout)

## Risks and edge cases
- **Camera list staleness**: The camera list is fetched once on mount. If cameras are added/removed during the session, new incidents may show truncated IDs. Acceptable — the page polls incidents every 10s and STATE_SNAPSHOT updates from WS, but a full page reload will re-fetch cameras.
- **Large camera list**: ~69 cameras — no performance concern.
- **Rate limited camera fetch**: The `/api/cameras` endpoint has a 30/min limit, but the incidents page only fetches once on mount.

## Acceptance criteria
1. Incidents page shows camera names (e.g., "Gate Camera 1") instead of truncated UUIDs
2. If camera name lookup fails, falls back to truncated device ID without showing an error
3. TriggerButton shows red error state when action fails (network error, 401, 429, timeout)
4. TriggerButton error state shows the error message
5. TriggerButton error state auto-clears after 5 seconds
6. Frontend TypeScript check passes: `npx tsc --noEmit`
7. Frontend build passes: `npm run build`

## Verification commands
- Frontend types: `cd modules/ghosthome-frontend && npx tsc --noEmit`
- Frontend build: `cd modules/ghosthome-frontend && npm run build`

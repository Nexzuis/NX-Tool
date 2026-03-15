# Phase 1.1 — Lock Down Write Access

## Goal
Make write endpoint authentication enforced-by-default when a token is configured, log a prominent warning when it's not, expose auth status to the frontend, and document the expected auth flow.

## Context
Current state: `requireApiAuth` middleware is applied per-route to write endpoints only. When `API_AUTH_TOKEN` is empty, write endpoints are open. TECH-DEBT.md flags this as Critical.

## Decision: Warning + status endpoint (no auto-generation)

Codex review rejected the auto-generate approach due to:
1. Spec contradiction — SPEC.md says "if empty, write endpoints are effectively unauthenticated"
2. Secret leaking — printing tokens to stdout is risky in deployed environments
3. Token rotation on restart breaks frontend silently

**Revised approach (simpler alternative per Codex feedback):**
- When `API_AUTH_TOKEN` is empty: log a prominent WARNING at startup, write endpoints remain open (matches current spec)
- When `API_AUTH_TOKEN` is set: auth enforced on all write endpoints (existing behavior, no change)
- Add `GET /api/auth/status` inside the router (uses ok/fail envelope) — returns whether auth is configured
- Settings page shows auth status with actionable guidance
- Update SPEC.md auth section to document the warning behavior
- Update .env.example files with clear documentation

This is the minimum-complexity path that resolves the tech debt visibility problem without breaking existing behavior or adding secret management complexity.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/config.js` | Add `apiAuthToken` and `apiAuthConfigured` fields |
| `modules/ghosthome-monitor/api-server.js` | Use `deps.config.apiAuthToken` in middleware; add `GET /api/auth/status` inside router |
| `modules/ghosthome-monitor/index.js` | Log auth warning/status at startup |
| `modules/ghosthome-frontend/src/lib/api.ts` | Add `AuthStatus` type and `fetchAuthStatus()` |
| `modules/ghosthome-frontend/src/app/settings/page.tsx` | Display auth status section |
| `modules/ghosthome-monitor/.env.example` | Add auth documentation comments |
| `modules/ghosthome-frontend/.env.example` | Add auth documentation comments |
| `SPEC.md` | Update auth model section to document warning behavior |

## Order of operations

### 1. Backend config — centralize auth token
- `config.js`: Add fields:
  - `apiAuthToken`: reads `process.env.API_AUTH_TOKEN || null`
  - `apiAuthConfigured`: `!!process.env.API_AUTH_TOKEN`

### 2. Backend auth middleware — use config instead of process.env
- `api-server.js`: Change `requireApiAuth` to accept deps and read `deps.config.apiAuthToken`
- When `deps.config.apiAuthToken` is null (not configured), pass through (existing behavior)
- When configured, validate Bearer or X-API-Key against `deps.config.apiAuthToken`
- Move `requireApiAuth` inside `buildRouter` so it has access to `deps`

### 3. Backend auth status endpoint
- `api-server.js`: Add `GET /api/auth/status` inside `buildRouter` (uses ok/fail envelope, no auth required)
- Returns `{ configured: bool, methods: ['Bearer', 'X-API-Key'] }`
- Never exposes the token value

### 4. Backend startup logging
- `index.js`: After config loads, before workflows start:
  - If `apiAuthConfigured`: log `"API auth: configured (write endpoints protected)"`
  - If not: log WARNING `"API auth: NOT configured — write endpoints are open. Set API_AUTH_TOKEN in .env to protect write access."`

### 5. Frontend API client — auth status
- `api.ts`: Add `AuthStatus` interface `{ configured: boolean, methods: string[] }`
- Add `fetchAuthStatus()` function

### 6. Frontend settings page — auth display
- Add "Authentication" section card with Shield icon
- If `configured`: green StatusDot + "Write endpoints protected"
- If not configured: warning StatusDot + "Write endpoints are open — set API_AUTH_TOKEN" with instructional text
- Show accepted methods (Bearer, X-API-Key)

### 7. Update .env.example files
- Backend: Add comment block explaining auth flow above `API_AUTH_TOKEN=`
- Frontend: Add comment explaining `NEXT_PUBLIC_API_TOKEN` must match backend token

### 8. Update SPEC.md
- Auth model section: add note about startup warning when token is not configured

## Risks and edge cases
- **No behavior change for existing users**: Token empty = open (same as before). Token set = protected (same as before). Only new: warning log + status endpoint + UI indicator.
- **`/api/auth/status` is unauthenticated by design**: It only exposes whether auth is configured (boolean), not the token. Safe to leave open.
- **CORS preflight**: No new headers or methods — existing CORS config covers Bearer and X-API-Key.

## Acceptance criteria
1. When `API_AUTH_TOKEN` is empty, startup logs a WARNING about unprotected write endpoints
2. When `API_AUTH_TOKEN` is set, startup logs confirmation that auth is configured
3. When `API_AUTH_TOKEN` is set, write endpoints reject requests without valid Bearer/X-API-Key — returns 401
4. When `API_AUTH_TOKEN` is set, write endpoints accept valid Bearer token
5. When `API_AUTH_TOKEN` is set, write endpoints accept valid X-API-Key
6. When `API_AUTH_TOKEN` is empty, write endpoints remain open (no auth required)
7. Read endpoints (GET) remain open regardless of auth configuration
8. `/healthz` remains unauthenticated
9. `GET /api/auth/status` returns `{ configured: bool }` using ok/fail envelope
10. Settings page shows auth status with appropriate indicator and guidance
11. Backend syntax check passes: `node -c` on all modified .js files
12. Frontend TypeScript check passes: `npx tsc --noEmit` with 0 errors

## Verification commands
- Backend syntax: `cd modules/ghosthome-monitor && node -c config.js && node -c api-server.js && node -c index.js`
- Frontend types: `cd modules/ghosthome-frontend && npx tsc --noEmit`

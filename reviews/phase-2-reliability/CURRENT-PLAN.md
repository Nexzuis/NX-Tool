# Phase 2 — Reliability and Observability

## Goal
Add a real test baseline, persist operational state across restarts, and tighten configuration hygiene so the system is robust enough for unattended operation.

---

## 2.1 — Add a Real Test Baseline

### Files to create/modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/package.json` | Update `test` script to `node --test tests/*.test.js` (built-in `node:test`, no deps) |
| `modules/ghosthome-monitor/tests/state.test.js` | Unit tests for state.js Map operations |
| `modules/ghosthome-monitor/tests/config.test.js` | Tests for config parsing, defaults, edge cases |
| `modules/ghosthome-monitor/tests/wf03-thresholds.test.js` | Tests for staleness time slots (1h/2h/quiet) |
| `modules/ghosthome-monitor/tests/api-routes.test.js` | Tests for API routes: auth enforcement on writes, unauthenticated reads, response envelopes, healthz, rate-limit headers |
| `modules/ghosthome-monitor/api-server.js` | Add `buildApp` to `module.exports` for test access |
| `modules/ghosthome-frontend/package.json` | Add vitest + @testing-library/react devDependencies, add `test` script |
| `modules/ghosthome-frontend/vitest.config.ts` | Vitest config for Next.js/React/TypeScript |
| `modules/ghosthome-frontend/tests/smoke.test.tsx` | Smoke tests: api.ts helper shape, type checks |

### Design decisions
- Backend uses `node:test` (built-in) — zero new dependencies
- Frontend uses vitest — needed for JSX/TypeScript transforms and jsdom
- API route tests call `buildApp(mockDeps)` directly, create an `http.createServer(app)` for requests — no port binding needed
- All external calls (NX, Telegram) are mocked — tests never hit real APIs

### Order of operations
1. Export `buildApp` from `api-server.js`
2. Write state + config tests
3. Write WF-03 threshold tests
4. Write API route tests (including auth enforcement on writes, open reads, rate-limit 429 headers)
5. Update backend `package.json` test script
6. Install vitest + testing-library in frontend, write smoke tests
7. Verify all tests pass

---

## 2.2 — Persist Operational State

### Approach
Use a JSON file store (`data/state.json`) — no external DB dependency. State is written on change (debounced 2s) and read on startup. NX Witness remains source of truth for camera/device data; we only persist operational metadata.

### What to persist
- Active incidents (Map → object)
- Workflow summaries (object)
- Server health snapshot (object)
- Analytics statuses (Map → object)
- Analytics suppression data (Map → object)
- Analytics stale alert times (Map → object)
- Analytics restarted-at times (Map → object)
- Camera statuses (Map → object)

### What NOT to persist
- Device/camera lists (fetched from NX)
- Discovered engine ID (re-discovered on startup)
- WebSocket connection state (ephemeral)
- Daily report history (no existing consumer or API — avoid scope creep)

### Startup reconciliation
On startup after loading persisted state:
1. Fetch current device list from NX (`getDevices()`)
2. **If NX fetch fails**: log `RECONCILIATION_SKIPPED` warning, keep persisted state as-is, continue startup — reconciliation will happen implicitly when WF-02 runs its periodic scan
3. **If NX fetch succeeds**, for each persisted incident (ALL statuses — `waiting`, `error`, `escalated`, `server`):
   - If the device is now Online → clear the incident, emit `deviceConnected`
   - If the device is still Offline → clear the incident so WF-02 can re-detect and re-enter the pipeline with fresh timers
   - If the device no longer exists in NX → clear the incident
   - For `server`-keyed incidents: check server status, clear if server is Online
4. For each persisted camera status: compare against NX device status and update if different
5. Log reconciliation summary: `PERSISTENCE_RECONCILED { cleared: N, updated: N }`

### Schema versioning
- State file includes `_version: 1` at top level
- On load, if `_version` is missing or doesn't match, discard and start fresh (log `PERSISTENCE_VERSION_MISMATCH`)
- Future schema changes bump the version

### Shutdown flush
- On SIGINT/SIGTERM, call `persistence.flush()` (immediate write, bypass debounce) before process exit
- Best-effort: if flush fails, log warning and exit anyway

### Files to create/modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/persistence.js` | New — `init(filePath)`, `load()`, `save()` (debounced 2s), `flush()` (immediate), `markDirty()`, atomic write (write tmp then rename), schema version check |
| `modules/ghosthome-monitor/state.js` | Wire persistence: call `persistence.markDirty()` on mutations, `persistence.load()` populates initial state |
| `modules/ghosthome-monitor/index.js` | Initialize persistence before workflows, call `persistence.flush()` in shutdown, run startup reconciliation after NX auth |
| `modules/ghosthome-monitor/.gitignore` | Create with `data/` entry |
| `modules/ghosthome-monitor/tests/persistence.test.js` | Tests for load/save/flush/corruption/version mismatch |

### Order of operations
1. Create `persistence.js`
2. Modify `state.js` to wire persistence
3. Modify `index.js` to init persistence, run reconciliation, flush on shutdown
4. Create `.gitignore`
5. Write persistence tests
6. Test: restart backend and verify state survives

---

## 2.3 — Tighten Configuration Hygiene

### Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/.env.example` | Verify all `process.env` reads across ALL files (config.js, nx-client.js, telegram.js, api-server.js) are documented. Add comments for any undocumented vars |
| `modules/ghosthome-frontend/package.json` | Change dev script to `next dev -p 4300` |
| `SPEC.md` | Update: Telegram bot commands (add `/analytics`), WebSocket forwarded events (add `ANALYTICS_STALE`, `ANALYTICS_RESTART_SUCCESS`, `ANALYTICS_RESTART_FAILED`, `ANALYTICS_RECOVERED`), WF-03 thresholds (1h/2h), notification behavior (add restart success/failed), State Model section (update for persistence), Current Constraints (remove resolved items) |
| `CLAUDE.md` | Update: Telegram commands list (add `/analytics`), stale thresholds (1h/2h), add new events, update key decisions |
| `TECH-DEBT.md` | Mark resolved items |

### What we will NOT do
- Will NOT edit the real `.env` file — operator-local with production secrets
- Will NOT commit `.env` — already in root `.gitignore`

### Order of operations
1. Audit all `process.env` reads across the entire backend and verify `.env.example` coverage
2. Bake frontend port into package.json
3. Update SPEC.md
4. Update CLAUDE.md
5. Clean up TECH-DEBT.md

---

## Risks and Edge Cases

- **Persistence write failures**: Log warning, continue in-memory — never crash
- **Corrupted state file**: Log `PERSISTENCE_CORRUPT`, start fresh — never crash
- **Version mismatch**: Log `PERSISTENCE_VERSION_MISMATCH`, discard and start fresh
- **Stuck incidents after restart**: ALL incident statuses reconciled on startup (not just `waiting`)
- **NX unavailable during reconciliation**: Skip reconciliation, log warning, let WF-02 periodic scan handle it
- **Test mocking**: All external calls mocked — tests never hit real APIs
- **State file size**: ~75 cameras → <100KB — no concern
- **Debounced save race**: 2s debounce batches rapid mutations — acceptable

## Acceptance Criteria

1. `cd modules/ghosthome-monitor && npm test` runs `node --test tests/*.test.js` — all tests pass, exit code 0
2. `cd modules/ghosthome-frontend && npm test` runs vitest — smoke tests pass, exit code 0
3. API route tests verify: GET `/api/health` returns 200 without auth, POST `/api/actions/trigger-analytics` returns 401 when `API_AUTH_TOKEN` is set and no token provided, `/healthz` returns 200 always
4. State file `modules/ghosthome-monitor/data/state.json` is valid JSON with `_version: 1` after backend runs
5. Delete `data/state.json`, restart backend → starts without errors, creates new state file
6. Write invalid JSON to `data/state.json`, restart → logs `PERSISTENCE_CORRUPT`, starts fresh
7. Write `{"_version": 99}` to state file, restart → logs `PERSISTENCE_VERSION_MISMATCH`, starts fresh
8. Backend restart with persisted incidents → logs `PERSISTENCE_RECONCILED` with counts
9. `.env.example` documents every `process.env.*` read in the entire backend (grep-verified)
10. Frontend `npm run dev` starts on port 4300 without extra flags
11. SPEC.md Telegram Bot Commands table includes `/analytics`
12. SPEC.md WebSocket Contract forwarded events includes analytics events
13. `cd modules/ghosthome-frontend && npm run build` passes with exit code 0
14. All backend `.js` files pass syntax check

## Verification Commands
```bash
# Backend syntax check (all .js files)
for f in modules/ghosthome-monitor/*.js; do node -c "$f"; done
# Backend tests
cd modules/ghosthome-monitor && npm test
# Frontend build
cd modules/ghosthome-frontend && npm run build
# Frontend tests
cd modules/ghosthome-frontend && npm test
# Env coverage audit
grep -roh 'process\.env\.\w\+' modules/ghosthome-monitor/*.js | sort -u
# Persistence manual test
# stop backend → verify data/state.json → restart → check PERSISTENCE_LOADED log
```

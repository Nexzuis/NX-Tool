# Ghosthome Monitor — Project Rules

## Overview
Infrastructure health monitor for ~69 TP-Link VIGI cameras on NX Witness VMS. Two modules: Node.js backend (`ghosthome-monitor`, port 4301) + Next.js frontend (`ghosthome-frontend`, port 4300). Launcher: `start-ghosthome.bat`.

## Tech Stack
- **Backend**: Node.js, Express 5, WebSocket (ws), Axios, node-cron (WF-05), CommonJS
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion
- **External**: NX Witness REST API v4 (192.168.1.110:7001), Telegram Bot API, Claude API (Anthropic)

## Conventions

### Backend (ghosthome-monitor)
- CommonJS (`require`/`module.exports`) — NOT ES modules
- Each workflow is a separate file: `wf01-websocket.js` through `wf05-daily-report.js`
- All workflows export `init(deps)`, `start()`, `stop()`
- `deps` object: `{ nxClient, eventBus, config, state, wf02, wf03, wf04, wf05 }`
- EventEmitter for pub/sub — workflows emit events, telegram.js subscribes
- State is in-memory via `state.js` (Maps + plain objects)
- Logger: `log(WF_ID, EVENT_NAME, { detail: {...} })` — always structured
- API routes use `asyncHandler()` wrapper, respond with `ok(res, data)` or `fail(res, status, message)`
- Auth accepts both `Authorization: Bearer <token>` and `X-API-Key: <token>` headers
- `/healthz` is always unauthenticated (liveness probe)
- WebSocket is read-only — inbound client messages are ignored
- NX API client: `nx-client.js` — all methods are async, uses Axios with self-signed cert bypass
- Analytics suppression: cameras that fail restart 3+ times are suppressed from further attempts until manual intervention or recovery
- Analytics grace period: 1-hour window post-restart before checking for detections (prevents false stale alerts)
- Analytics status enum: `healthy`, `stale`, `disabled`, `disabled_offline`, `pending_recovery`, `no_agent`

### Frontend (ghosthome-frontend)
- TypeScript strict, `'use client'` directive on all interactive pages
- Tailwind utility classes — no CSS modules or styled-components
- All API calls go through `src/lib/api.ts` — `apiFetch<T>()` helper unwraps `{ ok, data }` envelope
- WebSocket hook: `src/hooks/use-websocket.ts` — singleton per URL (ref-counted, shared across all consumers) with auto-reconnect
- Components in `src/components/` — UI primitives in `ui/`, layout in `layout/`
- Pages in `src/app/[route]/page.tsx` (Next.js App Router)

### Design System
- Background: `#0A0A0F` (near-black OLED)
- Card background: `#13131A`
- Borders: `#1E1E2E`
- Primary accent: `#00FF88` (green)
- Text primary: `#E0E0E0`
- Text secondary: `#6B7280`, `#4B5563`
- Error: `#EF4444`, Warning: `#F97316`, Blue: `#3B82F6`, Success: `#22C55E`
- Font: DM Sans (via Google Fonts)
- All interactive elements have hover/focus states with green glow

## Port Assignments
| Port | Service |
|------|---------|
| 4300 | Frontend (Next.js dev) |
| 4301 | Backend API + WebSocket |
| 7001 | NX Witness (external) |

## File Structure
```
modules/ghosthome-monitor/
  index.js          — Entry point, wires deps, starts workflows
  api-server.js     — Express routes + WebSocket
  config.js         — Reads .env
  state.js          — In-memory state store
  nx-client.js      — NX Witness API client
  telegram.js       — Telegram notifications
  logger.js         — Structured logging
  camera-config.js  — Camera metadata
  site-config.js    — Pole/site mappings
  wf01-websocket.js — Event stream listener
  wf02-camera-offline.js — Offline recovery pipeline
  wf03-analytics.js — CVEDIA-RT health checks
  wf04-server-health.js — CPU/RAM/storage monitoring
  wf05-daily-report.js — Daily summary generation
  llm-agent.js      — AI agent core (tool loop, streaming, conversation, budget)
  llm-tools.js      — AI tool definitions (18 read-only tools for Phase 1)
  ai-config.js      — AI config persistence (data/ai-config.json)

modules/ghosthome-frontend/
  src/app/          — Next.js pages (dashboard, workflows, cameras, incidents, settings, assistant)
  src/components/   — UI components (layout/, ui/, chat/)
  src/hooks/        — use-websocket.ts
  src/lib/          — api.ts (API client + types + SSE streaming), event-parser.ts (event formatting)
```

## Key Decisions
- In-memory state (no DB) — NX Witness is source of truth
- node-cron for WF-05 daily report scheduling; WF-01/03/04 use setInterval for configurable ms-precision intervals
- Telegram as separate module subscribing to eventBus — immediate alerts for CRITICAL_SERVER, SERVER_RECOVERED, MASS_OFFLINE (20+ cameras), ANALYTICS_STALE (2h cooldown per camera), ANALYTICS_RESTART_SUCCESS, ANALYTICS_RESTART_FAILED, ANALYTICS_RECOVERED; all other events batched into twice-daily reports (06:00 + 18:00 SAST)
- Telegram bot supports command polling: `/status`, `/health`, `/cameras`, `/analytics`, `/incidents`, `/workflows`, `/report`, `/help`
- WF-02 waits 30 min before acting on offline cameras (reduces false positives)
- Pole host notifications rate-limited to once per 72 hours
- Disk space alerts intentionally removed (D: drive is loop recording)
- Backend converts CPU/RAM from 0-1 fractions to 0-100 percentages before sending

### AI Agent Architecture
- Claude API (Anthropic SDK) for reasoning — customer-owned API key stored in `data/ai-config.json`
- Agentic tool-use loop: max 15 tool calls per query, reads parallel, writes sequential
- SSE (Server-Sent Events) for web chat streaming — NOT the shared WebSocket
- Telegram: non-command text messages routed to AI (fire-and-forget, non-blocking)
- Conversation history stored in full Claude API format (tool_use + tool_result blocks preserved)
- Turn-aware trimming: oldest complete turns removed first (never orphans tool messages)
- Per-chatId sequential queue prevents conversation history race conditions
- Circuit breaker: 3 consecutive Claude API failures → disable for 5 minutes
- Monthly budget cap with estimated token spend tracking
- NX Witness protection: NxThrottle (5 concurrent, 20/5s burst), auth mutex, 5s read cache

### AI Route Auth — INTENTIONAL DESIGN DECISION (DO NOT CHANGE)
AI chat routes (`/api/chat`, `/api/chat/history/*`) use the **same auth pattern as existing write endpoints** (`requireApiAuth`):
- When `API_AUTH_TOKEN` is set → token is enforced
- When `API_AUTH_TOKEN` is not set → open dev mode (same as all other write routes)

This was reviewed by Codex who suggested strict "always require auth" for AI routes. We **intentionally rejected** this because:
1. This is a **LAN-only deployment** — the API is not internet-exposed
2. The existing system already runs all write endpoints (analytics toggles, workflow triggers) without auth in dev mode
3. Requiring `API_AUTH_TOKEN` specifically for AI routes creates a setup barrier on a system that has never needed it
4. The **Anthropic API key itself** is the cost protection — without it configured, AI routes return 503
5. AI config routes (`/api/ai-config`) use `requireApiAuth` to allow initial setup before AI key exists

**Do NOT add strict auth requirements to AI routes that differ from the existing write endpoint pattern.** If auth needs tightening, it should be done system-wide (by setting `API_AUTH_TOKEN`), not per-feature.

## Verified NX Witness v4 API — DO NOT CHANGE
The following endpoints and protocols have been **live-tested against the production NX Witness server** (192.168.1.110:7001). Do not suggest alternative methods, rename these calls, or replace them with undocumented/legacy approaches.

### WebSocket Protocol (WF-01 → NX Witness)
- **Auth**: `POST /rest/v4/login/tickets` → returns `{ token }` → connect to `wss://host/jsonrpc?_ticket=<token>`
- **Subscriptions**: `rest.v4.devices.subscribe` and `rest.v4.servers.subscribe` (JSON-RPC method names)
- **DO NOT** use `setSession`, `subscribeToEvents`, or any other JSON-RPC method — these are rejected by NX Witness with `-32601 Unsupported method`
- Tickets are single-use; each new WebSocket connection needs a fresh ticket
- `maxPayload` must be ≥200MB — `rest.v4.devices.subscribe` returns all ~75 device objects in one response

### Confirmed REST Endpoints
- `POST /rest/v4/login/sessions` — session auth (returns Bearer token)
- `POST /rest/v4/login/tickets` — one-time WebSocket ticket
- `GET /rest/v4/devices` — all devices
- `GET /rest/v4/servers` — all servers
- `GET /rest/v4/servers/{id}/runtimeInfo` — CPU/RAM metrics (0-1 fractions)
- `GET /rest/v4/servers/{id}/storages` — storage info
- `GET /rest/v4/metrics/alarms` — alarm metrics (fallback polling)
- `GET /rest/v4/metrics/values` — metric values
- `GET /rest/v4/analytics/engines` — analytics engines
- `GET /rest/v4/analytics/engines/{id}/deviceAgents` — per-engine device agents
- `GET /rest/v4/analytics/objectTracks` — object detection tracks
- `GET /rest/v4/events/log` — event log

### AI Agent Tier 1+2 Endpoints — Verified 2026-03-16 (NX Witness 6.1.0.42176)
- `GET /rest/v4/site/info` — site metadata, NX version
- `GET /rest/v4/licenses` — licensing info (0 items on this server)
- `GET /rest/v4/users` — user accounts (163 items including system users)
- `GET /rest/v4/userGroups` — permission groups (6 items)
- `GET /rest/v4/layouts` — client layouts (9 items)
- `GET /rest/v4/events/rules` — event/action rules (304 rules)
- `GET /rest/v4/events/rules/{id}` — single rule by ID
- `GET /rest/v4/events/triggers` — software triggers (0 configured)
- `GET /rest/v4/devices/*/bookmarks` — all bookmarks across devices (60,575 items — MUST cap results)
- `GET /rest/v4/devices/{deviceId}/bookmarks` — bookmarks for specific device
- `GET /rest/v4/site/settings` — site-level settings object
- `GET /rest/v4/servers/{id}/dbBackups` — database backups (6 items)
- `GET /rest/v4/servers/{id}/storageForecast` — storage forecast (70 items)
- `GET /rest/v4/devices/{deviceId}/ptz/presets` — PTZ presets (0 on non-PTZ cameras, endpoint works)
- `GET /rest/v4/devices/{deviceId}/io` — device I/O state
- `GET /rest/v4/analytics/engines/{id}/settings` — analytics engine settings

### Write Endpoints — NOT YET LIVE-TESTED (paths verified against API reference doc)
- `POST/PATCH/DELETE /rest/v4/events/rules/{id}` — event rule CRUD
- `POST /rest/v4/events/triggers` — fire software trigger (body: `{triggerId, deviceId, state}`)
- `POST /rest/v4/events/acknowledges` — acknowledge event
- `PATCH /rest/v4/devices/{id}` — update device settings
- `POST /rest/v4/devices/{deviceId}/bookmarks` — create bookmark
- `POST/PATCH/DELETE /rest/v4/users/{id}` — user CRUD
- `POST/PATCH/DELETE /rest/v4/userGroups/{id}` — user group CRUD
- `POST/PATCH/DELETE /rest/v4/layouts/{id}` — layout CRUD
- `PUT /rest/v4/site/settings/{name}` — update site setting (body is raw JSON value)
- `PUT /rest/v4/analytics/engines/{id}/settings` — update analytics engine settings
- `POST /rest/v4/servers/{id}/dbBackups` — create database backup
- `PATCH /rest/v4/servers/{id}/storages/{storageId}` — update storage config

## Timezone
All times displayed in Africa/Johannesburg (SAST, UTC+2).

## Code Review & Fixes (2026-03-15)

Full codebase audit by Claude (2 parallel agents) + Codex (gpt-5.3-codex). Found 44 issues. Fixed 26 across 3 phases, all Codex APPROVED. See `reviews/CONSOLIDATED-REVIEW.md` for complete status.

### Phase A — CRITICAL: Graceful Shutdown ✓
- C1: WF-02 post-stop guard + incident cleanup ✓
- C2: WF-04 cancellable sleep (ShutdownError) ✓
- C3: WF-03 cancellable sleep + cycleInProgress reset ✓

### Phase B — HIGH: Correctness & Security ✓
- H1-H8: Cameras stale closure, RateLimitError backoff (4 pages), .gitignore, locale-safe parsing, alarm dedup, persistence optimization, Telegram cache eviction, Tailwind syntax ✓

### Phase C — MEDIUM: Quality ✓
- CR-3, BM1-BM2, BL6, FM3, FL4, FL2 ✓

### Prior review (2026-03-14): 14/14 items FIXED
All verified by code exploration — see CONSOLIDATED-REVIEW.md.

### Remaining: ~18 LOW items deferred (see CONSOLIDATED-REVIEW.md)

## Codex CLI Usage
```bash
cat <<'PROMPT' | codex exec --model gpt-5.3-codex --skip-git-repo-check --ephemeral -o reviews/BUILD-REVIEW.md -
[review prompt here]
PROMPT
```
- Model: `gpt-5.3-codex` (confirmed working)
- Flag: `--skip-git-repo-check` required (not a git repo)
- Auth: Works with current OpenAI auth. If errors about "ChatGPT account", set `OPENAI_API_KEY` env var.

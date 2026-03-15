# Ghosthome Monitor - Specification

## Overview
Ghosthome Monitor is a two-process monitoring stack for a single NX Witness deployment. It combines a Next.js dashboard with a Node.js backend that monitors camera connectivity, analytics health, server health, and scheduled reporting.

The project is built around one backend service and one frontend service:
- `modules/ghosthome-monitor` - Express API, WebSocket server, NX Witness client, Telegram integration, and workflow runners
- `modules/ghosthome-frontend` - Next.js dashboard for operators

## Runtime Topology

```text
+------------------------+        HTTP + WebSocket        +------------------------+
| ghosthome-frontend     | <----------------------------> | ghosthome-monitor      |
| Next.js 16             |                                | Express 5 + ws         |
| Port 4300              |                                | Port 4301              |
+------------------------+                                +-----------+------------+
                                                                      |
                                                         +------------+-----------+
                                                         |                        |
                                                         v                        v
                                                NX Witness REST API         Telegram Bot API
                                                HTTPS, usually 7001         HTTPS, public
```

### Startup Model
- The backend is started with `node index.js` from `modules/ghosthome-monitor`
- The frontend is started with `npm run dev` from `modules/ghosthome-frontend` (port 4300 is baked into the dev script)
- `start-ghosthome.bat` launches both services in separate terminals

## Technology Stack

### Backend
| Package | Version | Role |
|---------|---------|------|
| express | 5.2.1 | HTTP API server |
| ws | 8.19.0 | WebSocket broadcast server |
| axios | 1.13.6 | NX Witness and Telegram HTTP client |
| node-cron | 4.2.1 | Scheduled daily reporting |
| dotenv | 17.3.1 | Local environment loading |
| cors | 2.8.6 | Cross-origin access for the dashboard |

Runtime: Node.js with CommonJS modules.

### Frontend
| Package | Version | Role |
|---------|---------|------|
| next | 16.1.6 | React framework |
| react | 19.2.3 | UI runtime |
| react-dom | 19.2.3 | Client and server rendering |
| tailwindcss | 4 | Styling |
| framer-motion | 12.35.1 | Motion and transitions |
| lucide-react | 0.577.0 | Icons |
| clsx | 2.1.1 | Conditional class names |
| typescript | 5 | Type checking |

## Core Workflows

| ID | Name | Trigger Model | Current Behavior |
|----|------|---------------|------------------|
| WF-01 | WebSocket Monitor | Always on | Connects to the NX Witness event stream, tracks connection state, and forwards relevant camera events into the rest of the system |
| WF-02 | Camera Offline Recovery | Event driven plus periodic scan | Detects offline cameras, waits before recovery, escalates unresolved cases, and emits mass-offline and pole-unreachable events |
| WF-03 | Analytics Health | Interval driven | Checks analytics state per device, attempts recovery, and writes summary state for the dashboard |
| WF-04 | Server Health | Interval driven | Monitors server CPU, RAM, storage, and recovery state, then emits warning and recovery events |
| WF-05 | Daily Report | Cron driven | Aggregates recent activity into scheduled reports and stores the last summary for API consumers |

Notes:
- All five workflows now publish summary state into the shared in-memory store.
- Camera counts and incident volumes are deployment-dependent and should not be treated as fixed constants in docs.

## Backend API

Base URL: `http://localhost:4301/api` in local development.

### Read endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Current backend server health snapshot |
| GET | `/cameras` | Camera inventory from NX Witness |
| GET | `/cameras/:id` | Single camera details |
| GET | `/incidents` | Active incidents from in-memory state |
| GET | `/workflows` | Last known summaries for all workflows |
| GET | `/summary` | Aggregated dashboard summary |
| GET | `/metrics` | Raw NX Witness metrics payload |
| GET | `/storages` | Storage details from NX Witness |
| GET | `/analytics` | Analytics status across devices |
| GET | `/analytics/suppressed` | List suppressed cameras with failure counts |
| GET | `/config` | Runtime configuration (intervals, thresholds, Telegram status) |
| GET | `/healthz` | Unauthenticated liveness probe |

### Write endpoints
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/analytics/:deviceId` | Toggle analytics for one camera |
| POST | `/analytics/bulk` | Bulk analytics toggle |
| POST | `/actions/trigger-analytics` | Run WF-03 on demand |
| POST | `/actions/trigger-health-check` | Run WF-04 on demand |
| POST | `/actions/trigger-daily-report` | Run WF-05 on demand |
| POST | `/actions/test-telegram` | Send a Telegram test message |
| POST | `/analytics/unsuppress/:deviceId` | Clear suppression for one camera |
| POST | `/analytics/unsuppress-all` | Clear all camera suppressions |

### Auth model
- Read endpoints are open by default in local development.
- Write endpoints require `Authorization: Bearer <token>` or `X-API-Key: <token>` when `API_AUTH_TOKEN` is configured.
- If `API_AUTH_TOKEN` is empty, write endpoints are effectively unauthenticated and the backend logs a prominent WARNING at startup.
- `GET /api/auth/status` returns `{ configured: boolean, methods: string[] }` — unauthenticated by design (never exposes the token).
- `/healthz` is always unauthenticated (liveness probe).

### Rate limiting
- Write endpoints (POST, PATCH): 10 requests per minute per IP
- High-cost read endpoints (`/cameras`, `/cameras/:id`, `/metrics`, `/storages`, `/analytics`, `/analytics/suppressed`, `/config`, `/summary`): 30 requests per minute per IP
- Low-cost read endpoints (`/health`, `/incidents`, `/workflows`, `/auth/status`) and `/healthz`: not rate-limited
- Rate limit runs before auth — unauthenticated spam is 429'd before reaching auth checks
- 429 responses use the standard `{ ok: false, error: { message } }` envelope
- Rate limit state is in-memory and resets on backend restart

## NX Witness Upstream WebSocket

WF-01 connects to the NX Witness JSON-RPC WebSocket to receive real-time device and server state changes.

### Authentication
- Obtain a one-time login ticket: `POST /rest/v4/login/tickets` → `{ token: "..." }`
- Connect to `wss://<host>/jsonrpc?_ticket=<token>`
- Tickets are single-use; each reconnect requires a fresh ticket

### Subscriptions
After connecting, subscribe to change feeds:
- `rest.v4.devices.subscribe` (id=1) — returns full device list, then pushes device changes
- `rest.v4.servers.subscribe` (id=2) — returns full server list, then pushes server changes

### Message types
- **Response (has `id`)**: Initial subscription response with `result` array (all devices/servers)
- **Notification (no `id`)**: Push update when a device or server changes — `{ method: "rest.v4.devices.subscribe", params: <changed_object> }`

### Notes
- `maxPayload` set to 200MB to handle full device list (~75 devices)
- Fallback polling via `/rest/v4/metrics/alarms` every 60s remains as safety net

## WebSocket Contract

WebSocket URL: `ws://localhost:4301/ws` in local development.

Behavior:
- Sends `CONNECTED` when a client connects
- Sends `STATE_SNAPSHOT` every 30 seconds
- Forwards selected workflow and system events from the backend event bus

Current forwarded event families include:
- `ESCALATION`
- `CAMERA_RECOVERED` (listed but currently not emitted by any workflow — see TECH-DEBT.md)
- `POLE_UNREACHABLE`
- `MASS_OFFLINE`
- `MASS_OFFLINE_CLEARED`
- `STORAGE_ALERT`
- `WARN_CPU`
- `WARN_RAM`
- `CRITICAL_SERVER`
- `SERVER_RECOVERED`
- `POST_RECOVERY_ISSUES`
- `WF03_CYCLE_COMPLETE`
- `ANALYTICS_STALE`
- `ANALYTICS_RESTART_SUCCESS`
- `ANALYTICS_RESTART_FAILED`
- `ANALYTICS_RECOVERED`
- `DAILY_REPORT`

## Frontend Surface

### Routes
| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Main health overview |
| `/workflows` | Workflow status and manual triggers |
| `/cameras` | Camera list and analytics controls |
| `/incidents` | Incident feed and filters |
| `/settings` | Backend connection, runtime configuration, thresholds, Telegram status, and suppression management |

### Client integration
- REST calls go through `src/lib/api.ts` — `apiFetch<T>()` unwraps `{ ok, data }` envelope
- `RateLimitError` class detects 429 responses with `retryAfterS` from `Retry-After` header
- All polling pages use recursive `setTimeout` with `pollDelayRef` for rate-limit-aware backoff (caps at 120s)
- Live events consumed through `src/hooks/use-websocket.ts` — singleton per URL, ref-counted
- `useWebSocketStatus()` hook for layout components (only re-renders on connection changes, not messages)
- Loading states via `loading.tsx` per route (Suspense boundaries with skeleton UIs)
- Global error boundary via `src/app/error.tsx`
- The frontend depends on `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`
- All fetch calls use `AbortController` timeouts: 15 seconds for reads, 30 seconds for writes

## Notification Behavior

Telegram integration is configured in the backend and currently behaves in two tiers:
- Immediate Telegram messages for `CRITICAL_SERVER`, `SERVER_RECOVERED`, `MASS_OFFLINE`, `DAILY_REPORT`, `ANALYTICS_STALE` (rate-limited 2h per camera), `ANALYTICS_RESTART_SUCCESS`, `ANALYTICS_RESTART_FAILED`, and `ANALYTICS_RECOVERED`
- Individual camera and warning-style events are gathered into reports rather than sent instantly

If Telegram credentials are not configured, the backend logs that Telegram is disabled and continues running.

### Telegram Bot Commands

The backend polls for Telegram commands when credentials are configured:

| Command | Description |
|---------|-------------|
| `/status` | Camera count, CPU, RAM, incident count |
| `/health` | Detailed CPU, RAM, uptime, storage, status |
| `/cameras` | Camera counts, list offline (first 30) |
| `/incidents` | Active incident list (first 20) with durations |
| `/workflows` | Last update time for WF-01 through WF-05 |
| `/report` | Trigger WF-05 report generation immediately |
| `/analytics` | Trigger WF-03 cycle, report analytics status breakdown |
| `/help` | Display command list |

Command polling uses long-poll with 30s timeout and exponential backoff (1s to 30s) on errors.

## State Model

The backend persists operational state to `data/state.json` (debounced writes). On startup, state is loaded and reconciled against live NX Witness data:
- workflow summaries
- active incidents
- latest server-health snapshot

Implications:
- state survives restarts via JSON persistence
- there is no built-in historical incident database
- NX Witness remains the external system of record for camera and analytics data

## Environment Variables

### Backend
| Variable | Default | Purpose |
|----------|---------|---------|
| `NX_HOST` | `https://192.168.1.110:7001` | NX Witness base URL |
| `NX_USERNAME` | `admin` | NX Witness username |
| `NX_PASSWORD` | empty | NX Witness password |
| `NX_ENGINE_ID` | empty | Optional analytics engine override |
| `POLL_INTERVAL_ANALYTICS_MS` | `600000` | WF-03 interval |
| `POLL_INTERVAL_SERVER_MS` | `300000` | WF-04 interval |
| `POLL_INTERVAL_ALARMS_MS` | `60000` | Alarm or fallback polling interval |
| `LOG_DIR` | `./logs` | Log output directory |
| `DAILY_REPORT_HOUR` | `6` | Morning report hour |
| `DAILY_REPORT_HOUR_EVENING` | `18` | Evening report hour |
| `MASS_OFFLINE_THRESHOLD` | `20` | Offline count that triggers a mass-offline event |
| `API_PORT` | `4301` | Backend listen port |
| `API_HOST` | `127.0.0.1` | Backend bind host |
| `API_AUTH_TOKEN` | empty | Optional bearer token for write routes |
| `ALLOW_INSECURE_TLS` | `false` | Allow self-signed NX Witness TLS certificates |
| `TELEGRAM_BOT_TOKEN` | empty | Telegram bot token |
| `TELEGRAM_CHAT_ID` | empty | Telegram chat target |

### Frontend
| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | empty | Backend HTTP base URL |
| `NEXT_PUBLIC_WS_URL` | empty | Backend WebSocket URL |
| `NEXT_PUBLIC_API_TOKEN` | empty | Optional bearer token for write endpoints (visible to browser — local network only) |

## Current Constraints
- Global error boundary exists (`src/app/error.tsx`); no per-route error boundaries
- Single NX Witness server assumption in WF-04 and WF-05
- In-memory rate limiting resets on backend restart
- Frontend RateLimitError backoff uses recursive setTimeout with pollDelayRef (caps at 120s)
- Log retention: 30 days, cleaned at startup
- Request body limit: 10KB (express.json)

## Graceful Shutdown
Backend workflows use a cancellable sleep pattern (ShutdownError class with code WF_SHUTDOWN) to ensure shutdown completes within 5 seconds even during long-running operations (WF-03 analytics restart cycles, WF-04 server recovery waits). WF-02 clears active incidents for pending cameras on shutdown to prevent stuck state after restart.

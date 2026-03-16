# Ghosthome Monitor - Development Plan

> This roadmap tracks work that is still open. Completed items should be removed instead of kept as historical notes.
> Updated 2026-03-14 from consolidated Claude + Codex codebase review.

## Phase 0 - Fix Critical Review Findings

### 0.1 Auth & Safety (Phase A) — COMPLETE
> Completed: auth middleware split, X-Api-Key CORS, frontend auth headers, WF-04 restart mutex

### 0.2–0.4 Data Correctness + Robustness + Frontend Quality — COMPLETE
> Completed via adversarial build workflow (Codex-reviewed, 2 review rounds).
> Key fixes: SAST date bucketing (Intl.DateTimeFormat), WS auth validation, graceful shutdown,
> nxHost end-to-end, dynamic report scheduling label, eventCount field alignment,
> WF-05 event name fix, WF-02 MASS_OFFLINE_CLEARED emit, WF-03 quiet-time guard,
> Telegram retry, NX client lastError, error boundary, dashboard memo deps, WS fallback URL.
> Review artifacts: `reviews/phase-0.2-0.4-fixes/`

## Phase 1 - Stabilize Operations

### 1.1 Lock down write access — COMPLETE
> Completed: auth centralized in config.js, requireApiAuth uses deps.config, GET /api/auth/status endpoint,
> startup auth warning logging, settings page auth section, .env.example auth docs, SPEC.md updated.
> Review artifacts: `reviews/phase-1.1-auth-lockdown/`

### 1.2 Add rate limiting and request safety — COMPLETE
> Completed: express-rate-limit (10/min write, 30/min expensive reads), trust proxy disabled,
> fetchWithTimeout helper (15s reads, 30s writes), SPEC.md updated.
> Codex caught: /api/summary misclassified as cheap, /api/cameras/:id missing, write calls missing timeout, trust proxy spoofing risk.
> Review artifacts: `reviews/phase-1.2-rate-limiting/`

### 1.3 Improve operator-facing failure handling — COMPLETE
> Completed: incidents page resolves camera names via fetchCameras lookup (case-normalized, fallback to truncated ID),
> TriggerButton shows sanitized error state (red banner, 5xx regex, timer cleanup with mountedRef guard).
> Codex caught: overly broad includes('5') match, unmount-during-request race condition.
> Review artifacts: `reviews/phase-1.3-failure-handling/`

## Phase 2 - Reliability and Observability — COMPLETE

### 2.1 Add a real test baseline — COMPLETE
> Backend: 39 tests via node:test (state, config, persistence, API routes with auth/rate-limit, WF-03 thresholds).
> Frontend: 6 smoke tests via vitest (api.ts exports, utilities, env config).
> Review artifacts: `reviews/phase-2-reliability/`

### 2.2 Persist operational state — COMPLETE
> JSON file persistence (`data/state.json`) with schema versioning (_version: 1), debounced saves (2s),
> atomic writes, startup reconciliation against live NX device status, shutdown flush.
> Codex caught: stuck incidents after restart (reconcile all statuses), server incident unconditional clear.

### 2.3 Tighten configuration hygiene — COMPLETE
> Frontend port baked into package.json dev script. All process.env reads verified against .env.example.
> SPEC.md, CLAUDE.md, TECH-DEBT.md updated for Phase 2 + WF-01 WebSocket fix + analytics notifications.

## Phase 3 - Productize — COMPLETE

### 3.1 Expand settings and control surfaces — COMPLETE
> GET /api/config (runtime intervals, thresholds, Telegram status — no secrets).
> Suppression management: GET /api/analytics/suppressed, POST unsuppress/:deviceId, POST unsuppress-all.
> Settings page overhauled: live config, thresholds, Telegram status, suppression management with error handling.
> WF-04 mutex fixed (shared operationInProgress flag, handleServerRestart is internal-only).
> Telegram sendMessage returns Promise. WF-03 thresholds centralized in config.js.
> Codex caught: WF-04 restart unreachable from locked context, unhandled rejection in handleServerFailure, frontend silently swallowing suppression errors.
> Review artifacts: `reviews/phase-3-productize/`

### 3.2 Prepare for broader deployment — COMPLETE
> SPEC.md updated with new endpoints and rate limiting. TECH-DEBT.md cleaned (5 items resolved).
> Hardcoded camera counts removed from UI. .env.example verified complete.

## Phase 4 - Codebase Hardening (2026-03-15) — COMPLETE

Full codebase audit by Claude (2 parallel agents) + Codex (gpt-5.3-codex). Found 44 issues. Fixed 26 across 3 adversarial-build phases, all Codex APPROVED.

### 4.0 Frontend loading & navigation fixes — COMPLETE
> loading.tsx for all 5 routes, cameras fetchError state, RateLimitError class in api.ts,
> useWebSocketStatus() hook for ShellClient (stops re-rendering on every WS message).

### 4.1 Phase A — Graceful shutdown (CRITICAL) — COMPLETE
> WF-02 post-stop guard + incident cleanup, WF-03/WF-04 cancellable sleep via ShutdownError
> class with Map-tracked timers, cancelAllSleeps() in stop(), cycleInProgress/operationInProgress reset.
> Codex caught: false failure counting during shutdown, missing restart guard, stale incidents on stop.
> Review artifacts: `reviews/phase-graceful-shutdown/` (3 Codex build review rounds)

### 4.2 Phase B — Correctness & security (HIGH) — COMPLETE
> Cameras stale closure (functional setCameras), RateLimitError backoff (4 pages, recursive setTimeout),
> .gitignore (.env, node_modules, logs), WF-03 locale-safe hour parsing (Intl.DateTimeFormat.formatToParts),
> WF-01 hourly alarm dedup clearing, persistence deferred getSnapshot, Telegram 24h cache eviction,
> Tailwind opacity syntax fix in settings.
> Review artifacts: `reviews/phase-high-fixes/` (1 Codex round, APPROVED)

### 4.3 Phase C — Quality (MEDIUM) — COMPLETE
> NX Client 404 differentiation, logger async readFile + 30-day log cleanup at startup,
> express.json 10kb body limit, SkeletonCard aria conflict fixed, timeAgo NaN guard, duplicate comment cleanup.
> Review artifacts: `reviews/phase-medium-fixes/` (1 Codex round, APPROVED)

### 4.4 Final verification — COMPLETE
> 3-agent parallel final review (backend, frontend, integration). All APPROVED for production.
> Prior review (2026-03-14): 14/14 items verified fixed or already fixed.
> SPEC.md, TECH-DEBT.md, PLAN.md updated. CONSOLIDATED-REVIEW.md finalized.

## Phase 5 - AI Agent (2026-03-15)

### 5.1 Core Agent MVP — COMPLETE
> AI-powered remote operations assistant via Telegram and web chat.
> Backend: llm-agent.js (agentic tool-use loop, SSE streaming, conversation management, budget tracking, circuit breaker),
> llm-tools.js (18 read-only tools with null-safety, result capping, severity sorting, camera name ambiguity handling),
> ai-config.js (data/ai-config.json persistence with key redaction).
> NX protection: NxThrottle (5 concurrent, 20/5s burst), auth mutex, 5s read cache.
> Telegram: non-blocking AI routing, long message splitting (4000 char chunks).
> API: SSE /api/chat endpoint, AI config CRUD, key validation.
> Frontend: /assistant page with SSE streaming, message bubbles, typing indicators, starter questions,
> settings page AI section (key, model, budget, enable/disable).
> Codex review: Round 1 found 2 CRITICAL + 3 IMPORTANT + 3 MINOR. Fixed auth bootstrap deadlock,
> chat auth bypass, GET auth headers, conversation format persistence, key clearing.
> Round 2 found 1 IMPORTANT (trim orphaning tool messages). Fixed with turn-aware trimming.
> Review artifacts: `reviews/phase-ai-agent-v1/`

### 5.2 Write Tools + Permissions UI — COMPLETE
> 20 write tools added (13 device management + 7 server admin) with NX protection patterns:
> backup-before-modify [NX-04], WF-03 conflict checks [NX-02], incident awareness [NX-08],
> AI audit JSONL logging [NX-07], server restart delay warnings [NX-09].
> Tools: restart_analytics, toggle_analytics, unsuppress_camera, modify_camera_settings,
> create/modify/delete_event_rule, create_bookmark, fire_trigger, acknowledge_event,
> trigger_analytics_cycle/health_check/daily_report, restart_server, create/modify/delete_user,
> create_db_backup, modify_site_settings, modify_analytics_engine_settings.
> NX client: 25+ new CRUD methods (events, users, groups, layouts, storage, PTZ, triggers, backups).
> Frontend: AI Capabilities toggle grid with 3 categories (Read/Device/Server) + preset buttons
> (Read Only / Standard / Full Admin). Safe null-optional chaining on capabilities arrays.
> AI events (AI_QUERY, AI_RESPONSE, AI_TOOL_CALL, AI_ERROR) forwarded to WebSocket for dashboard.
> Codex review: Round 1 found 2 CRITICAL + 5 IMPORTANT + 2 MINOR. Fixed restart_server result check,
> restart_analytics disable/enable result checks, modify_camera_settings previousState capture,
> toggle_analytics incident awareness, trigger_* availability checks, capabilities UI null safety.
> Rejected: WS auth for AI events (matches existing unauthenticated WS pattern, LAN-only).
> Review artifacts: `reviews/phase-ai-agent-v2/`

### 5.3 UX Polish + Advanced Features — COMPLETE
> Enhanced markdown rendering: headers (h1-h3), tables, bullet/numbered lists, italic, code blocks with language labels, horizontal rules.
> Contextual starter questions: fetches system summary to suggest relevant questions (e.g. "Why are 4 cameras offline?" when cameras are down).
> Conversation export: Download button exports chat as timestamped .txt file.
> get_infrastructure_summary tool [FIX-23]: single-call overview of cameras, server, incidents, analytics, workflows.
> System prompt override: additive (appended as "ADDITIONAL OPERATOR INSTRUCTIONS"), core safety rules cannot be removed.
> NX version detection [NX-10]: detectVersion() at startup, logged to console.
> systemPromptOverride field in ai-config.json with settings UI.
> Codex review: 0 CRITICAL, 4 IMPORTANT, 3 MINOR. Fixed: new-chat abort leak, streamChat EOF fallback,
> system prompt override changed from replace to additive (safety invariant preserved).
> Deferred: NX version in tool error messages (minor UX), span-wrapping block elements (cosmetic).
> Review artifacts: `reviews/phase-ai-agent-v3/`

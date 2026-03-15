'use strict';

/**
 * api-server.js
 * Express HTTP + WebSocket API layer for Ghosthome Monitor.
 *
 * Exports: startApiServer(deps)
 * deps = { nxClient, eventBus, config, state, wf03, wf04, wf05 }
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_VERSION = '1';
const WS_STATE_POLL_INTERVAL_MS = 30000;

// Events forwarded from the internal eventBus to all connected WS clients.
const BUS_EVENTS = [
  'ESCALATION',
  'DAILY_REPORT',
  'CAMERA_RECOVERED',
  'POLE_UNREACHABLE',
  'STORAGE_ALERT',
  'WARN_CPU',
  'WARN_RAM',
  'CRITICAL_SERVER',
  'POST_RECOVERY_ISSUES',
  'SERVER_RECOVERED',
  'MASS_OFFLINE',
  'MASS_OFFLINE_CLEARED',
  'WF03_CYCLE_COMPLETE',
  'ANALYTICS_STALE',
  'ANALYTICS_RESTART_SUCCESS',
  'ANALYTICS_RESTART_FAILED',
  'ANALYTICS_RECOVERED',
];

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

// Auth middleware — created per-request inside buildRouter with access to deps

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a route handler so async errors are forwarded to express next().
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Build a standardised JSON success response.
 */
function ok(res, data, meta = {}) {
  return res.json({ ok: true, data, ...meta });
}

/**
 * Build a standardised JSON error response.
 */
function fail(res, status, message, detail = null) {
  const body = { ok: false, error: { message } };
  if (detail !== null) body.error.detail = detail;
  return res.status(status).json(body);
}

/**
 * Build the WS message envelope.
 */
function wsMessage(type, data) {
  return JSON.stringify({ type, data, timestamp: new Date().toISOString() });
}

/**
 * Broadcast a message string to all connected, open WS clients.
 */
function broadcast(wss, message) {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

// ---------------------------------------------------------------------------
// State snapshot — used for welcome message and 30-second poll
// ---------------------------------------------------------------------------

function buildStateSnapshot(state) {
  return {
    serverHealth: state.getServerHealth(),
    activeIncidents: state.getActiveIncidents(),
    workflows: {
      'WF-01': state.getLastSummary('WF-01'),
      'WF-02': state.getLastSummary('WF-02'),
      'WF-03': state.getLastSummary('WF-03'),
      'WF-04': state.getLastSummary('WF-04'),
      'WF-05': state.getLastSummary('WF-05'),
    },
  };
}

// ---------------------------------------------------------------------------
// Route builders
// ---------------------------------------------------------------------------

function buildRouter(deps) {
  const { nxClient, state, wf03, wf04, wf05 } = deps;
  const router = express.Router();

  // Rate limiters — per-IP, in-memory store (resets on restart)
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'Too many requests — try again later'),
  });

  const readExpensiveLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'Too many requests — try again later'),
  });

  // Auth middleware — uses config from deps
  function requireApiAuth(req, res, next) {
    const token = deps.config.apiAuthToken;
    if (!token) return next();               // no token configured = open (dev mode)
    const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const apiKey  = req.get('x-api-key');
    if (bearer === token || apiKey === token) return next();
    return fail(res, 401, 'Unauthorized');
  }

  // GET /api/auth/status — unauthenticated, returns auth configuration state
  router.get('/auth/status', (_req, res) => {
    return ok(res, {
      configured: deps.config.apiAuthConfigured,
      methods: ['Bearer', 'X-API-Key'],
    });
  });

  // GET /api/health
  router.get('/health', asyncHandler(async (_req, res) => {
    const health = state.getServerHealth();
    if (!health) return fail(res, 503, 'Health data not yet available — workflows still initialising');
    return ok(res, { ...health, nxHost: deps.config.nx.host });
  }));

  // GET /api/cameras
  router.get('/cameras', readExpensiveLimiter, asyncHandler(async (_req, res) => {
    const cameras = await nxClient.getDevices();
    if (!cameras) return fail(res, 502, 'Could not retrieve cameras from NX Witness');
    return ok(res, cameras, { count: Array.isArray(cameras) ? cameras.length : null });
  }));

  // GET /api/cameras/:id
  router.get('/cameras/:id', readExpensiveLimiter, asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return fail(res, 400, 'Camera id is required');
    }
    const camera = await nxClient.getDevice(id.trim());
    if (!camera) return fail(res, 404, `Camera not found: ${id}`);
    return ok(res, camera);
  }));

  // GET /api/incidents
  router.get('/incidents', asyncHandler(async (_req, res) => {
    const incidents = state.getActiveIncidents();
    const entries = Object.entries(incidents).map(([deviceId, data]) => ({ deviceId, ...data }));
    return ok(res, entries, { count: entries.length });
  }));

  // GET /api/workflows
  router.get('/workflows', asyncHandler(async (_req, res) => {
    return ok(res, {
      'WF-01': state.getLastSummary('WF-01'),
      'WF-02': state.getLastSummary('WF-02'),
      'WF-03': state.getLastSummary('WF-03'),
      'WF-04': state.getLastSummary('WF-04'),
      'WF-05': state.getLastSummary('WF-05'),
    });
  }));

  // GET /api/summary
  router.get('/summary', readExpensiveLimiter, asyncHandler(async (_req, res) => {
    const serverHealth = state.getServerHealth();
    const incidents = state.getActiveIncidents();
    const incidentCount = Object.keys(incidents).length;

    // Camera counts derived from a fresh device list
    let cameraCounts = { total: null, online: null, offline: null };
    try {
      const devices = await nxClient.getDevices();
      if (Array.isArray(devices)) {
        const online = devices.filter(d => d.status === 'Online' || d.status === 'Recording').length;
        const offline = devices.filter(d => d.status === 'Offline').length;
        cameraCounts = { total: devices.length, online, offline };
      }
    } catch (_err) {
      // Non-fatal — summary still returns partial data
    }

    return ok(res, {
      serverHealth,
      cameras: cameraCounts,
      incidentCount,
      workflows: {
        'WF-01': state.getLastSummary('WF-01'),
        'WF-02': state.getLastSummary('WF-02'),
        'WF-03': state.getLastSummary('WF-03'),
        'WF-04': state.getLastSummary('WF-04'),
        'WF-05': state.getLastSummary('WF-05'),
      },
      lastDailyReport: state.getLastSummary('WF-05'),
    });
  }));

  // GET /api/metrics
  router.get('/metrics', readExpensiveLimiter, asyncHandler(async (_req, res) => {
    const metrics = await nxClient.getMetricsValues();
    if (!metrics) return fail(res, 502, 'Could not retrieve metrics from NX Witness');
    return ok(res, metrics);
  }));

  // GET /api/storages
  router.get('/storages', readExpensiveLimiter, asyncHandler(async (_req, res) => {
    const servers = await nxClient.getServers();
    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return fail(res, 502, 'Could not retrieve server list from NX Witness');
    }
    const serverId = servers[0].id;
    const storages = await nxClient.getServerStorages(serverId);
    if (!storages) return fail(res, 502, `Could not retrieve storages for server ${serverId}`);
    return ok(res, storages, { serverId });
  }));

  // GET /api/config — public system configuration (no secrets)
  router.get('/config', readExpensiveLimiter, (_req, res) => {
    const cfg = deps.config;
    return ok(res, {
      intervals: {
        analyticsMs: cfg.intervals.analyticsMs,
        serverMs: cfg.intervals.serverMs,
        alarmsMs: cfg.intervals.alarmsMs,
      },
      thresholds: {
        staleDaytimeMs: cfg.staleDaytimeMs,
        staleEveningMs: cfg.staleEveningMs,
        quietTimeStart: cfg.quietTimeStart,
        quietTimeEnd: cfg.quietTimeEnd,
        massOffline: cfg.massOfflineThreshold,
      },
      reporting: {
        morningHour: cfg.dailyReportHour,
        eveningHour: cfg.dailyReportHourEvening,
      },
      telegram: {
        configured: cfg.telegramConfigured,
        polling: deps.telegram ? deps.telegram.isPolling() : false,
      },
    });
  });

  // GET /api/analytics/suppressed — list suppressed cameras
  router.get('/analytics/suppressed', readExpensiveLimiter, (_req, res) => {
    const all = state.getAllSuppressed();
    const list = Object.entries(all).map(([deviceId, info]) => ({
      deviceId,
      count: info.count,
      since: info.since,
    }));
    return ok(res, list);
  });

  // POST /api/analytics/unsuppress/:deviceId — clear suppression for one camera
  router.post('/analytics/unsuppress/:deviceId', writeLimiter, requireApiAuth, (_req, res) => {
    const { deviceId } = _req.params;
    const was = state.getSuppressed(deviceId);
    if (was) {
      state.clearSuppressed(deviceId);
      if (deps.wf03 && deps.wf03.resetFailureCount) deps.wf03.resetFailureCount(deviceId);
      return ok(res, { cleared: true, deviceId });
    }
    return ok(res, { cleared: false, deviceId });
  });

  // POST /api/analytics/unsuppress-all — clear all suppressions
  router.post('/analytics/unsuppress-all', writeLimiter, requireApiAuth, (_req, res) => {
    const all = state.getAllSuppressed();
    const count = Object.keys(all).length;
    for (const deviceId of Object.keys(all)) {
      state.clearSuppressed(deviceId);
    }
    if (deps.wf03 && deps.wf03.resetAllFailureCounts) deps.wf03.resetAllFailureCounts();
    return ok(res, { cleared: count });
  });

  // ── Analytics management ────────────────────────────────────────────────

  /**
   * Helper: resolve CVEDIA engine ID from config (auto-discovered at startup).
   */
  function getEngineId() {
    return deps.config.nx.engineId || deps.state.getEngineId() || null;
  }

  // GET /api/analytics — list all cameras with their analytics agent status
  router.get('/analytics', readExpensiveLimiter, asyncHandler(async (_req, res) => {
    const engineId = getEngineId();
    if (!engineId) return fail(res, 503, 'CVEDIA engine not discovered yet — try again shortly');

    const devices = await nxClient.getDevices();
    if (!Array.isArray(devices)) return fail(res, 502, 'Could not retrieve cameras');

    // Query each device's agent individually — the bulk deviceAgents list
    // returns agent-specific IDs that don't match device IDs.
    const analyticsStatuses = state.getAllAnalyticsStatuses();

    const results = await Promise.all(devices.map(async (d) => {
      let agent = null;
      try {
        agent = await nxClient.getDeviceAgent(engineId, d.id);
      } catch { /* individual device failure — continue with null agent */ }
      const statusEntry = analyticsStatuses[d.id];
      return {
        id: d.id,
        name: d.name,
        status: d.status,
        analyticsEnabled: agent ? agent.isEnabled === true : false,
        analyticsStatus: statusEntry ? statusEntry.status : (agent ? 'unknown' : 'no_agent'),
        analyticsStatusUpdatedAt: statusEntry ? statusEntry.updatedAt : null,
        hasAgent: !!agent,
      };
    }));

    return ok(res, results, { count: results.length, engineId });
  }));

  // PATCH /api/analytics/:deviceId — toggle analytics for a single camera
  router.patch('/analytics/:deviceId', writeLimiter, requireApiAuth, asyncHandler(async (req, res) => {
    const engineId = getEngineId();
    if (!engineId) return fail(res, 503, 'CVEDIA engine not discovered yet');

    const { deviceId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return fail(res, 400, 'Body must include { enabled: true|false }');

    const result = await nxClient.patchDeviceAgent(engineId, deviceId, { isEnabled: enabled });
    if (result === null) return fail(res, 502, `NX Witness rejected analytics patch for device ${deviceId}`);

    return ok(res, { deviceId, enabled, engineId });
  }));

  // POST /api/analytics/bulk — toggle analytics for all cameras
  router.post('/analytics/bulk', writeLimiter, requireApiAuth, asyncHandler(async (req, res) => {
    const engineId = getEngineId();
    if (!engineId) return fail(res, 503, 'CVEDIA engine not discovered yet');

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return fail(res, 400, 'Body must include { enabled: true|false }');

    const devices = await nxClient.getDevices();
    if (!Array.isArray(devices)) return fail(res, 502, 'Could not retrieve cameras');

    let success = 0;
    let failed = 0;
    const CONCURRENCY = 5;
    for (let i = 0; i < devices.length; i += CONCURRENCY) {
      const batch = devices.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(d => nxClient.patchDeviceAgent(engineId, d.id, { isEnabled: enabled }))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null) success++;
        else failed++;
      }
    }

    return ok(res, { enabled, success, failed, total: devices.length });
  }));

  // POST /api/actions/trigger-analytics
  router.post('/actions/trigger-analytics', writeLimiter, requireApiAuth, asyncHandler(async (_req, res) => {
    // Run asynchronously — do not await so the HTTP response is immediate
    setImmediate(() => {
      wf03.runCycle().catch(err => {
        console.error('[API] trigger-analytics error:', err.message);
      });
    });
    return ok(res, { triggered: true, action: 'trigger-analytics' });
  }));

  // POST /api/actions/trigger-health-check
  router.post('/actions/trigger-health-check', writeLimiter, requireApiAuth, asyncHandler(async (_req, res) => {
    setImmediate(() => {
      wf04.runHealthCheck().catch(err => {
        console.error('[API] trigger-health-check error:', err.message);
      });
    });
    return ok(res, { triggered: true, action: 'trigger-health-check' });
  }));

  // POST /api/actions/trigger-daily-report
  router.post('/actions/trigger-daily-report', writeLimiter, requireApiAuth, asyncHandler(async (_req, res) => {
    setImmediate(() => {
      wf05.generateReport().catch(err => {
        console.error('[API] trigger-daily-report error:', err.message);
      });
    });
    return ok(res, { triggered: true, action: 'trigger-daily-report' });
  }));

  // POST /api/actions/test-telegram
  router.post('/actions/test-telegram', writeLimiter, requireApiAuth, asyncHandler(async (_req, res) => {
    const telegram = require('./telegram');
    const result = await telegram.sendTestMessage();
    if (result.ok) {
      return ok(res, { sent: true });
    }
    return fail(res, 502, 'Telegram test failed', result);
  }));

  return router;
}

// ---------------------------------------------------------------------------
// WebSocket setup
// ---------------------------------------------------------------------------

function attachWebSocket(httpServer, deps) {
  const { eventBus, state } = deps;
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Forward all named bus events to connected clients
  for (const eventName of BUS_EVENTS) {
    eventBus.on(eventName, (data) => {
      broadcast(wss, wsMessage(eventName, data));
    });
  }

  // Poll state every 30 s and broadcast the snapshot
  const pollTimer = setInterval(() => {
    if (wss.clients.size === 0) return;
    broadcast(wss, wsMessage('STATE_SNAPSHOT', buildStateSnapshot(state)));
  }, WS_STATE_POLL_INTERVAL_MS);

  // Do not keep the process alive for the poll timer alone
  pollTimer.unref();

  wss.on('connection', (socket, req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    console.log(`[WS] Client connected from ${ip}. Active clients: ${wss.clients.size}`);

    // Send a welcome snapshot immediately
    const welcome = wsMessage('CONNECTED', {
      message: 'Connected to Ghosthome Monitor API',
      snapshot: buildStateSnapshot(state),
    });
    socket.send(welcome);

    socket.on('close', () => {
      console.log(`[WS] Client disconnected (${ip}). Active clients: ${wss.clients.size}`);
    });

    socket.on('error', (err) => {
      console.error(`[WS] Socket error (${ip}):`, err.message);
    });

    // Ignore inbound messages from clients for now — read-only API
    socket.on('message', () => {});
  });

  wss.on('error', (err) => {
    console.error('[WS] WebSocketServer error:', err.message);
  });

  return wss;
}

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

function buildApp(deps) {
  const app = express();

  // Do not trust proxy headers — this service runs directly on the LAN.
  // If deployed behind a reverse proxy later, set 'trust proxy' accordingly.
  app.set('trust proxy', false);

  // CORS — allow Next.js dev server and same-origin in production
  const allowedOrigins = ['http://localhost:4300', 'http://localhost:4301'];
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, same-origin) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
    credentials: false,
  }));

  app.use(express.json({ limit: '10kb' }));

  // Mount API router — auth is applied per-route on write endpoints only
  app.use('/api', buildRouter(deps));

  // Health probe for load balancer / Docker HEALTHCHECK
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'ghosthome-monitor-api' }));

  // 404 for any unmatched route
  app.use((_req, res) => {
    fail(res, 404, 'Route not found');
  });

  // Centralised error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[API] Unhandled error:', err.message);
    fail(res, 500, 'Internal server error');
  });

  return app;
}

// ---------------------------------------------------------------------------
// Exported entry point
// ---------------------------------------------------------------------------

/**
 * Start the Express HTTP server with an attached WebSocket server.
 *
 * @param {object} deps
 * @param {import('./nx-client')} deps.nxClient
 * @param {import('events').EventEmitter} deps.eventBus
 * @param {object}               deps.config
 * @param {object}               deps.state
 * @param {object}               deps.wf03
 * @param {object}               deps.wf04
 * @param {object}               deps.wf05
 * @returns {{ httpServer: http.Server, wss: WebSocketServer }}
 */
function startApiServer(deps) {
  const port = parseInt(process.env.API_PORT, 10) || 4301;

  const app = buildApp(deps);
  const httpServer = http.createServer(app);
  const wss = attachWebSocket(httpServer, deps);

  const host = process.env.API_HOST || '127.0.0.1';
  httpServer.listen(port, host, () => {
    console.log(`[API] HTTP server listening on http://${host}:${port}`);
    console.log(`[API] WebSocket endpoint: ws://${host}:${port}/ws`);
  });

  httpServer.on('error', (err) => {
    console.error('[API] HTTP server error:', err.message);
  });

  return { httpServer, wss };
}

module.exports = { startApiServer, buildApp };

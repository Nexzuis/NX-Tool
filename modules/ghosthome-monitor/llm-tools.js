'use strict';

/**
 * llm-tools.js
 * Tool definitions and implementations for the Ghosthome AI agent.
 * Phase 1: Read-only tools. Phase 2: Write tools with NX protection.
 *
 * Each tool has: name, category, definition (Claude API schema), execute(input, deps)
 * [FIX-15] All NX client returns are null-checked.
 * [FIX-06] All list results are capped and sorted by severity.
 * [FIX-09] Camera name matching returns ALL matches.
 * [NX-04] Write tools capture previous state before modifying.
 * [NX-05] Sensitive fields stripped from results.
 * [NX-07] All write operations logged to AI audit trail.
 */

const fs = require('fs');
const path = require('path');
const { log } = require('./logger');

const WF = 'AI-TOOLS';

// ── Result size limits [FIX-06] ──────────────────────────────────────────────

const MAX_ITEMS = 100;
const MAX_LOG_ENTRIES = 50;
const MAX_LOG_CHARS = 8000;

// ── Camera name matching [FIX-09] ────────────────────────────────────────────

function matchCameras(devices, cameraName) {
  if (!cameraName) return devices;
  const lower = cameraName.toLowerCase();
  return devices.filter(d => d.name && d.name.toLowerCase().includes(lower));
}

// ── Severity sorting [CODEX-12] ──────────────────────────────────────────────

function sortBySeverity(items, statusKey = 'status') {
  const priority = { Offline: 0, Error: 1, stale: 2, disabled: 3, pending_recovery: 4, Online: 5, Recording: 5, healthy: 6 };
  return items.sort((a, b) => {
    const pa = priority[a[statusKey]] ?? 3;
    const pb = priority[b[statusKey]] ?? 3;
    if (pa !== pb) return pa - pb;
    const na = (a.name || '').toLowerCase();
    const nb = (b.name || '').toLowerCase();
    return na.localeCompare(nb);
  });
}

// ── AI Audit Log [NX-07] ─────────────────────────────────────────────────────
// Dedicated JSONL log for all AI write operations — never auto-deleted.

function writeAuditLog(entry) {
  try {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(logDir, `ai-audit-${date}.jsonl`);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    }) + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (err) {
    log(WF, 'AUDIT_WRITE_ERROR', { detail: { error: err.message } });
  }
}

// ── Resolve single camera helper ─────────────────────────────────────────────

async function resolveSingleCamera(input, deps) {
  if (input.device_id) {
    const device = await deps.nxClient.getDevice(input.device_id);
    if (!device) return { error: `Device not found: ${input.device_id}` };
    return { device };
  }
  if (!input.camera_name) return { error: 'Provide camera_name or device_id.' };

  const devices = await deps.nxClient.getDevices();
  if (!devices) return { error: 'Could not reach NX Witness server.' };
  const matches = matchCameras(devices, input.camera_name);
  if (matches.length === 0) return { error: `No camera found matching "${input.camera_name}".` };
  if (matches.length > 1) {
    return {
      ambiguous: true,
      matches: matches.map(d => ({ name: d.name, id: d.id, status: d.status })),
      message: `Multiple cameras match "${input.camera_name}". Please specify which one.`,
    };
  }
  return { device: matches[0] };
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const tools = [

  // ── list_cameras ─────────────────────────────────────────────────────────
  {
    name: 'list_cameras',
    category: 'read',
    definition: {
      name: 'list_cameras',
      description: 'List cameras/devices on the NX Witness server. Returns name, ID, status. Capped at 100 items, sorted by severity (offline first).',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Optional partial name to search for.' },
          status_filter: { type: 'string', enum: ['online', 'offline', 'all'], description: 'Filter by status. Default: all.' },
        },
      },
    },
    execute: async (input, deps) => {
      const devices = await deps.nxClient.getDevices();
      if (!devices) return { error: 'Could not reach NX Witness server.' };

      let results = Array.isArray(devices) ? devices : [];

      // Name filter
      if (input.camera_name) {
        results = matchCameras(results, input.camera_name);
        if (results.length === 0) {
          return { error: `No camera found matching "${input.camera_name}". Use list_cameras without a name to see all devices.` };
        }
      }

      // Status filter
      if (input.status_filter === 'online') {
        results = results.filter(d => d.status === 'Online' || d.status === 'Recording');
      } else if (input.status_filter === 'offline') {
        results = results.filter(d => d.status === 'Offline');
      }

      // Count by status before mapping
      const onlineCount = results.filter(d => d.status === 'Online' || d.status === 'Recording').length;
      const offlineCount = results.filter(d => d.status === 'Offline').length;

      const sorted = sortBySeverity(results.map(d => ({
        name: d.name,
        id: d.id,
        status: d.status,
        model: d.model || null,
        vendor: d.vendor || null,
      })));

      const limited = sorted.slice(0, MAX_ITEMS);
      if (sorted.length > MAX_ITEMS) {
        limited.push({ note: `Showing first ${MAX_ITEMS} of ${sorted.length} cameras. Use camera_name to narrow results.` });
      }
      // Prepend a summary so Claude reports exact counts
      return { totalCameras: results.length, online: onlineCount, offline: offlineCount, cameras: limited };
    },
  },

  // ── get_camera_details ───────────────────────────────────────────────────
  {
    name: 'get_camera_details',
    category: 'read',
    definition: {
      name: 'get_camera_details',
      description: 'Get detailed info for a specific camera by name or ID.',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Camera name or partial name.' },
          device_id: { type: 'string', description: 'Camera device ID (exact match).' },
        },
      },
    },
    execute: async (input, deps) => {
      if (input.device_id) {
        const device = await deps.nxClient.getDevice(input.device_id);
        if (!device) return { error: `Device not found: ${input.device_id}` };
        return stripSensitiveDevice(device);
      }

      if (!input.camera_name) return { error: 'Provide camera_name or device_id.' };

      const devices = await deps.nxClient.getDevices();
      if (!devices) return { error: 'Could not reach NX Witness server.' };

      const matches = matchCameras(devices, input.camera_name);
      if (matches.length === 0) return { error: `No camera found matching "${input.camera_name}".` };
      return matches.map(stripSensitiveDevice);
    },
  },

  // ── get_server_health ────────────────────────────────────────────────────
  {
    name: 'get_server_health',
    category: 'read',
    definition: {
      name: 'get_server_health',
      description: 'Get current server health: CPU, RAM, uptime, storage count, status.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const health = deps.state.getServerHealth();
      if (!health) return { error: 'Server health data not yet available — workflows still initialising.' };
      return {
        serverId: health.serverId,
        serverName: health.serverName,
        status: health.status,
        cpuPercent: health.cpuPercent != null ? Math.round(health.cpuPercent) : null,
        ramPercent: health.ramPercent != null ? Math.round(health.ramPercent) : null,
        storageCount: health.storageCount,
        uptimeSeconds: health.uptimeS,
        updatedAt: health.updatedAt,
      };
    },
  },

  // ── get_server_info ──────────────────────────────────────────────────────
  {
    name: 'get_server_info',
    category: 'read',
    definition: {
      name: 'get_server_info',
      description: 'Get NX Witness server list with IDs, names, and status.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const servers = await deps.nxClient.getServers();
      if (!servers) return { error: 'Could not reach NX Witness server.' };
      return (Array.isArray(servers) ? servers : []).map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        version: s.version || null,
        systemInfo: s.systemInfo || null,
      }));
    },
  },

  // ── get_analytics_status ─────────────────────────────────────────────────
  {
    name: 'get_analytics_status',
    category: 'read',
    definition: {
      name: 'get_analytics_status',
      description: 'Get analytics (CVEDIA-RT) health status per camera. Shows healthy, stale, disabled, pending_recovery, etc.',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Optional camera name filter.' },
        },
      },
    },
    execute: async (input, deps) => {
      const devices = await deps.nxClient.getDevices();
      if (!devices) return { error: 'Could not reach NX Witness server.' };

      const allStatuses = deps.state.getAllAnalyticsStatuses();
      let deviceList = Array.isArray(devices) ? devices : [];

      if (input.camera_name) {
        deviceList = matchCameras(deviceList, input.camera_name);
        if (deviceList.length === 0) {
          return { error: `No camera found matching "${input.camera_name}".` };
        }
      }

      const results = deviceList.map(d => ({
        name: d.name,
        id: d.id,
        status: d.status,
        analytics: allStatuses[d.id] || { status: 'unknown' },
      }));

      // Count analytics statuses for summary
      const analyticsCounts = {};
      for (const r of results) {
        const s = r.analytics?.status || 'unknown';
        analyticsCounts[s] = (analyticsCounts[s] || 0) + 1;
      }

      const sorted = sortBySeverity(results, 'status');
      const limited = sorted.slice(0, MAX_ITEMS);
      if (sorted.length > MAX_ITEMS) {
        limited.push({ note: `Showing first ${MAX_ITEMS} of ${sorted.length}. Use camera_name to filter.` });
      }
      return { totalCameras: results.length, analyticsSummary: analyticsCounts, cameras: limited };
    },
  },

  // ── get_analytics_engines ────────────────────────────────────────────────
  {
    name: 'get_analytics_engines',
    category: 'read',
    definition: {
      name: 'get_analytics_engines',
      description: 'List analytics engines configured on the NX Witness server.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const engines = await deps.nxClient.getAnalyticsEngines();
      if (!engines) return { error: 'Could not retrieve analytics engines.' };
      return Array.isArray(engines) ? engines.map(e => ({
        id: e.id,
        name: e.name,
        isEnabled: e.isEnabled,
      })) : [];
    },
  },

  // ── get_active_incidents ─────────────────────────────────────────────────
  {
    name: 'get_active_incidents',
    category: 'read',
    definition: {
      name: 'get_active_incidents',
      description: 'Get currently active incidents tracked by Ghosthome Monitor.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const incidents = deps.state.getActiveIncidents();
      const entries = Object.entries(incidents || {});
      if (entries.length === 0) return { message: 'No active incidents.' };

      return entries.slice(0, MAX_ITEMS).map(([deviceId, data]) => ({
        deviceId,
        status: data.status,
        reason: data.reason,
        startedAt: data.startedAt,
        poleId: data.poleId || null,
      }));
    },
  },

  // ── get_workflow_status ──────────────────────────────────────────────────
  {
    name: 'get_workflow_status',
    category: 'read',
    definition: {
      name: 'get_workflow_status',
      description: 'Get last known status for all 5 Ghosthome workflows (WF-01 through WF-05).',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const wfIds = ['WF-01', 'WF-02', 'WF-03', 'WF-04', 'WF-05'];
      const wfNames = {
        'WF-01': 'WebSocket Events',
        'WF-02': 'Camera Offline Recovery',
        'WF-03': 'Analytics Health',
        'WF-04': 'Server Health',
        'WF-05': 'Daily Report',
      };
      return wfIds.map(id => ({
        id,
        name: wfNames[id],
        summary: deps.state.getLastSummary(id) || null,
      }));
    },
  },

  // ── search_event_log ─────────────────────────────────────────────────────
  {
    name: 'search_event_log',
    category: 'read',
    definition: {
      name: 'search_event_log',
      description: 'Search the NX Witness event log. Returns recent events, capped at 50.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'Optional device ID to filter events.' },
          event_type: { type: 'string', description: 'Optional event type filter.' },
        },
      },
    },
    execute: async (input, deps) => {
      const params = {};
      if (input.device_id) params.deviceId = input.device_id;
      if (input.event_type) params.eventType = input.event_type;

      const events = await deps.nxClient.getEventsLog(params);
      if (!events) return { error: 'Could not retrieve event log from NX Witness.' };

      const list = Array.isArray(events) ? events : [];
      const limited = list.slice(0, MAX_LOG_ENTRIES);
      if (list.length > MAX_LOG_ENTRIES) {
        limited.push({ note: `Showing first ${MAX_LOG_ENTRIES} of ${list.length} events.` });
      }
      return limited;
    },
  },

  // ── search_workflow_logs ─────────────────────────────────────────────────
  {
    name: 'search_workflow_logs',
    category: 'read',
    definition: {
      name: 'search_workflow_logs',
      description: 'Search Ghosthome JSONL workflow logs. Returns matching lines from today\'s log.',
      input_schema: {
        type: 'object',
        properties: {
          workflow: { type: 'string', description: 'Workflow ID (e.g. WF-01, WF-03, TELEGRAM, AI).' },
          event: { type: 'string', description: 'Event name substring to filter.' },
          limit: { type: 'number', description: 'Max entries to return. Default 30.' },
        },
      },
    },
    execute: async (input, deps) => {
      const fs = require('fs');
      const path = require('path');
      const logDir = deps.config.logDir || './logs';
      const today = new Date().toISOString().slice(0, 10);
      const logFile = path.join(logDir, `${today}.jsonl`);

      if (!fs.existsSync(logFile)) return { message: `No log file for today (${today}).` };

      // [B14] Check file size — refuse to read files over 10MB to prevent OOM
      const stat = fs.statSync(logFile);
      if (stat.size > 10 * 1024 * 1024) {
        return { error: `Log file too large (${Math.round(stat.size / 1024 / 1024)}MB). Use workflow and event filters to narrow results.` };
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      let entries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (input.workflow && entry.wf !== input.workflow) continue;
          if (input.event && !(entry.event || '').includes(input.event)) continue;
          entries.push(entry);
        } catch { /* skip malformed lines */ }
      }

      const maxEntries = input.limit || 30;
      // Return latest entries
      const recent = entries.slice(-maxEntries);

      let totalChars = 0;
      const capped = [];
      for (const e of recent) {
        const str = JSON.stringify(e);
        if (totalChars + str.length > MAX_LOG_CHARS) {
          capped.push({ note: `Output truncated at ${MAX_LOG_CHARS} characters. Use workflow/event filters to narrow results.` });
          break;
        }
        totalChars += str.length;
        capped.push(e);
      }

      return capped.length > 0 ? capped : { message: 'No matching log entries found.' };
    },
  },

  // ── get_storage_info ─────────────────────────────────────────────────────
  {
    name: 'get_storage_info',
    category: 'read',
    definition: {
      name: 'get_storage_info',
      description: 'Get storage drive information from the NX Witness server.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const servers = await deps.nxClient.getServers();
      if (!servers || !Array.isArray(servers) || servers.length === 0) {
        return { error: 'Could not retrieve server list.' };
      }
      const serverId = servers[0].id;
      const storages = await deps.nxClient.getServerStorages(serverId);
      if (!storages) return { error: 'Could not retrieve storage information.' };
      return Array.isArray(storages) ? storages : [];
    },
  },

  // ── get_recording_status ─────────────────────────────────────────────────
  {
    name: 'get_recording_status',
    category: 'read',
    definition: {
      name: 'get_recording_status',
      description: 'Check recording status for cameras. Shows which cameras are recording or not.',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Optional camera name filter.' },
        },
      },
    },
    execute: async (input, deps) => {
      const devices = await deps.nxClient.getDevices();
      if (!devices) return { error: 'Could not reach NX Witness server.' };

      let list = Array.isArray(devices) ? devices : [];
      if (input.camera_name) {
        list = matchCameras(list, input.camera_name);
        if (list.length === 0) return { error: `No camera found matching "${input.camera_name}".` };
      }

      const results = list.map(d => ({
        name: d.name,
        id: d.id,
        status: d.status,
        isRecording: d.status === 'Recording',
      }));

      return sortBySeverity(results).slice(0, MAX_ITEMS);
    },
  },

  // ── get_suppressed_cameras ───────────────────────────────────────────────
  {
    name: 'get_suppressed_cameras',
    category: 'read',
    definition: {
      name: 'get_suppressed_cameras',
      description: 'List cameras suppressed from analytics restart attempts (3+ consecutive failures).',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const all = deps.state.getAllSuppressed();
      const entries = Object.entries(all);
      if (entries.length === 0) return { message: 'No suppressed cameras.' };
      return entries.map(([deviceId, info]) => ({
        deviceId,
        failureCount: info.count,
        suppressedSince: info.since,
      }));
    },
  },

  // ── get_users ────────────────────────────────────────────────────────────
  {
    name: 'get_users',
    category: 'read',
    definition: {
      name: 'get_users',
      description: 'List NX Witness user accounts. Sensitive fields (email, permissions) are stripped.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const users = await deps.nxClient.getUsers();
      if (!users) return { error: 'Could not retrieve users from NX Witness.' };
      // [NX-05] Strip sensitive fields
      return (Array.isArray(users) ? users : []).map(u => ({
        id: u.id,
        name: u.name,
        isEnabled: u.isEnabled,
        type: u.type || null,
      }));
    },
  },

  // ── get_bookmarks ────────────────────────────────────────────────────────
  {
    name: 'get_bookmarks',
    category: 'read',
    definition: {
      name: 'get_bookmarks',
      description: 'List bookmarks from NX Witness. Returns name, time, and description.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'Optional device ID to filter bookmarks.' },
        },
      },
    },
    execute: async (input, deps) => {
      const bookmarks = await deps.nxClient.getBookmarks(input.device_id);
      if (!bookmarks) return { error: 'Could not retrieve bookmarks.' };
      const list = Array.isArray(bookmarks) ? bookmarks : [];
      return list.slice(0, MAX_LOG_ENTRIES).map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        startTimeMs: b.startTimeMs,
        durationMs: b.durationMs,
        deviceId: b.deviceId,
      }));
    },
  },

  // ── get_layouts ──────────────────────────────────────────────────────────
  {
    name: 'get_layouts',
    category: 'read',
    definition: {
      name: 'get_layouts',
      description: 'List NX Witness client layouts.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const layouts = await deps.nxClient.getLayouts();
      if (!layouts) return { error: 'Could not retrieve layouts.' };
      return (Array.isArray(layouts) ? layouts : []).map(l => ({
        id: l.id,
        name: l.name,
      }));
    },
  },

  // ── get_site_info ────────────────────────────────────────────────────────
  {
    name: 'get_site_info',
    category: 'read',
    definition: {
      name: 'get_site_info',
      description: 'Get NX Witness site/system information.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const info = await deps.nxClient.getSiteInfo();
      if (!info) return { error: 'Could not retrieve site info.' };
      return info;
    },
  },

  // ── get_licenses ─────────────────────────────────────────────────────────
  {
    name: 'get_licenses',
    category: 'read',
    definition: {
      name: 'get_licenses',
      description: 'Get NX Witness licensing information.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const licenses = await deps.nxClient.getLicenses();
      if (!licenses) return { error: 'Could not retrieve license info.' };
      return licenses;
    },
  },

  // ── get_event_rules ──────────────────────────────────────────────────────
  {
    name: 'get_event_rules',
    category: 'read',
    definition: {
      name: 'get_event_rules',
      description: 'List event/action rules configured on NX Witness.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const rules = await deps.nxClient.getEventRules();
      if (!rules) return { error: 'Could not retrieve event rules.' };
      return (Array.isArray(rules) ? rules : []).slice(0, MAX_ITEMS);
    },
  },

  // ── get_infrastructure_summary [FIX-23] ───────────────────────────────────
  {
    name: 'get_infrastructure_summary',
    category: 'read',
    definition: {
      name: 'get_infrastructure_summary',
      description: 'Get a high-level infrastructure summary: camera counts, server health, incident count, analytics overview, workflow status. Useful as a first query to understand the system state.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const summary = {};

      // Camera counts
      const devices = await deps.nxClient.getDevices();
      if (devices && Array.isArray(devices)) {
        const online = devices.filter(d => d.status === 'Online' || d.status === 'Recording').length;
        const offline = devices.filter(d => d.status === 'Offline').length;
        summary.cameras = { total: devices.length, online, offline };
        if (offline > 0) {
          summary.offlineCameras = devices
            .filter(d => d.status === 'Offline')
            .slice(0, 10)
            .map(d => ({ name: d.name, id: d.id }));
        }
      } else {
        summary.cameras = { error: 'Could not reach NX Witness' };
      }

      // Server health
      const health = deps.state.getServerHealth();
      if (health) {
        summary.server = {
          status: health.status,
          cpuPercent: health.cpuPercent != null ? Math.round(health.cpuPercent) : null,
          ramPercent: health.ramPercent != null ? Math.round(health.ramPercent) : null,
          uptimeSeconds: health.uptimeS,
        };
      }

      // Incidents
      const incidents = deps.state.getActiveIncidents();
      const incidentCount = Object.keys(incidents || {}).length;
      summary.incidents = { count: incidentCount };

      // Analytics overview
      const statuses = deps.state.getAllAnalyticsStatuses();
      const statusEntries = Object.values(statuses);
      const analyticsHealthy = statusEntries.filter(s => s.status === 'healthy').length;
      const analyticsStale = statusEntries.filter(s => s.status === 'stale').length;
      const analyticsDisabled = statusEntries.filter(s => s.status === 'disabled').length;
      const suppressed = Object.keys(deps.state.getAllSuppressed() || {}).length;
      summary.analytics = { healthy: analyticsHealthy, stale: analyticsStale, disabled: analyticsDisabled, suppressed };

      // Workflow status
      const wfIds = ['WF-01', 'WF-02', 'WF-03', 'WF-04', 'WF-05'];
      summary.workflows = {};
      for (const id of wfIds) {
        const s = deps.state.getLastSummary(id);
        summary.workflows[id] = s ? { updatedAt: s.updatedAt, status: 'running' } : { status: 'no data' };
      }

      return summary;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ══ PHASE 2: DEVICE MANAGEMENT TOOLS (write) ══════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  // ── restart_analytics ────────────────────────────────────────────────────
  {
    name: 'restart_analytics',
    category: 'device_management',
    definition: {
      name: 'restart_analytics',
      description: 'Restart analytics (disable/enable cycle) on a camera. Takes ~40 seconds. Checks for WF-03 conflicts and active incidents.',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Camera name.' },
          device_id: { type: 'string', description: 'Camera device ID.' },
        },
      },
    },
    execute: async (input, deps) => {
      // [NX-02] Check WF-03 conflict
      if (deps.wf03?.isCycleInProgress?.()) {
        return { error: 'An analytics cycle (WF-03) is currently running. Wait for it to complete (5-15 minutes).' };
      }
      const resolved = await resolveSingleCamera(input, deps);
      if (resolved.error || resolved.ambiguous) return resolved;
      const { device } = resolved;

      // [NX-08] Check active incidents
      const incidents = deps.state.getActiveIncidents();
      if (incidents[device.id]) {
        return { warning: `This camera has an active incident (${incidents[device.id].status}). Restarting analytics may reset WF-02's offline escalation timer. Proceed with caution.`, requiresConfirmation: true, deviceId: device.id, deviceName: device.name };
      }

      const engineId = deps.config.nx.engineId || deps.state.getEngineId();
      if (!engineId) return { error: 'No CVEDIA analytics engine found.' };

      // [NX-04] Capture previous state
      const prevAgent = await deps.nxClient.getDeviceAgent(engineId, device.id);
      const previousState = prevAgent ? { isEnabled: prevAgent.isEnabled } : null;

      // Disable
      const disableResult = await deps.nxClient.patchDeviceAgent(engineId, device.id, { isEnabled: false });
      if (disableResult === null) {
        writeAuditLog({ action: 'restart_analytics', target: { deviceId: device.id, deviceName: device.name }, previousState, result: 'failed_disable' });
        return { error: `Failed to disable analytics on ${device.name}. NX may have rejected the request.` };
      }
      await new Promise(r => setTimeout(r, 5000));
      // Re-enable
      const enableResult = await deps.nxClient.patchDeviceAgent(engineId, device.id, { isEnabled: true });
      if (enableResult === null) {
        writeAuditLog({ action: 'restart_analytics', target: { deviceId: device.id, deviceName: device.name }, previousState, result: 'failed_enable' });
        return { error: `Disabled analytics on ${device.name} but failed to re-enable. Manual re-enable may be needed.` };
      }

      // Verify
      const afterAgent = await deps.nxClient.getDeviceAgent(engineId, device.id);

      writeAuditLog({ action: 'restart_analytics', target: { deviceId: device.id, deviceName: device.name }, previousState, newState: { isEnabled: afterAgent?.isEnabled }, result: afterAgent?.isEnabled === true ? 'success' : 'unverified' });

      return { success: afterAgent?.isEnabled === true, deviceName: device.name, previousState, note: 'Analytics restarted. Detections may take up to 60 minutes to resume (grace period).' };
    },
  },

  // ── toggle_analytics ─────────────────────────────────────────────────────
  {
    name: 'toggle_analytics',
    category: 'device_management',
    definition: {
      name: 'toggle_analytics',
      description: 'Enable or disable analytics on a specific camera.',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Camera name.' },
          device_id: { type: 'string', description: 'Camera device ID.' },
          enabled: { type: 'boolean', description: 'true to enable, false to disable.' },
        },
        required: ['enabled'],
      },
    },
    execute: async (input, deps) => {
      if (deps.wf03?.isCycleInProgress?.()) {
        return { error: 'WF-03 analytics cycle is running. Wait for it to complete.' };
      }
      const resolved = await resolveSingleCamera(input, deps);
      if (resolved.error || resolved.ambiguous) return resolved;
      const { device } = resolved;

      // [NX-08] Check active incidents
      const incidents = deps.state.getActiveIncidents();
      if (incidents[device.id]) {
        return { warning: `This camera has an active incident (${incidents[device.id].status}). Toggling analytics may interfere with WF-02 recovery. Proceed with caution.`, requiresConfirmation: true, deviceId: device.id, deviceName: device.name };
      }

      const engineId = deps.config.nx.engineId || deps.state.getEngineId();
      if (!engineId) return { error: 'No CVEDIA analytics engine found.' };

      const prevAgent = await deps.nxClient.getDeviceAgent(engineId, device.id);
      const previousState = prevAgent ? { isEnabled: prevAgent.isEnabled } : null;

      const result = await deps.nxClient.patchDeviceAgent(engineId, device.id, { isEnabled: input.enabled });
      if (result === null) return { error: 'NX Witness rejected the analytics toggle.' };

      writeAuditLog({ action: 'toggle_analytics', target: { deviceId: device.id, deviceName: device.name }, previousState, newState: { isEnabled: input.enabled }, result: 'success' });

      return { success: true, deviceName: device.name, enabled: input.enabled, previousState };
    },
  },

  // ── unsuppress_camera ────────────────────────────────────────────────────
  {
    name: 'unsuppress_camera',
    category: 'device_management',
    definition: {
      name: 'unsuppress_camera',
      description: 'Clear analytics restart suppression for a camera (suppressed after 3+ consecutive failures).',
      input_schema: {
        type: 'object',
        properties: {
          camera_name: { type: 'string', description: 'Camera name.' },
          device_id: { type: 'string', description: 'Camera device ID.' },
        },
      },
    },
    execute: async (input, deps) => {
      const resolved = await resolveSingleCamera(input, deps);
      if (resolved.error || resolved.ambiguous) return resolved;
      const { device } = resolved;

      const was = deps.state.getSuppressed(device.id);
      if (!was) return { message: `${device.name} is not suppressed.` };

      deps.state.clearSuppressed(device.id);
      if (deps.wf03?.resetFailureCount) deps.wf03.resetFailureCount(device.id);

      writeAuditLog({ action: 'unsuppress_camera', target: { deviceId: device.id, deviceName: device.name }, previousState: { suppressed: true, count: was.count }, result: 'success' });

      return { success: true, deviceName: device.name, previousFailureCount: was.count };
    },
  },

  // ── modify_camera_settings ───────────────────────────────────────────────
  {
    name: 'modify_camera_settings',
    category: 'device_management',
    definition: {
      name: 'modify_camera_settings',
      description: 'Modify camera settings (name, credentials, etc). Returns previous state for rollback.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'Camera device ID (required for modifications).' },
          settings: { type: 'object', description: 'Settings object to merge (e.g. {name: "New Name"}).' },
        },
        required: ['device_id', 'settings'],
      },
    },
    execute: async (input, deps) => {
      const currentDevice = await deps.nxClient.getDevice(input.device_id);
      if (!currentDevice) return { error: 'Device not found or NX unreachable.' };

      // [NX-04] Capture actual previous state for the fields being modified
      const previousState = {};
      for (const key of Object.keys(input.settings)) {
        previousState[key] = currentDevice[key];
      }
      const result = await deps.nxClient.updateDevice(input.device_id, input.settings);
      if (result === null) return { error: 'NX Witness rejected the settings update.' };

      writeAuditLog({ action: 'modify_camera_settings', target: { deviceId: input.device_id, deviceName: currentDevice.name }, previousState, newState: input.settings, result: 'success' });

      return { success: true, deviceName: currentDevice.name, previousState, newState: input.settings, rollbackInstruction: `To revert, modify settings back to: ${JSON.stringify(previousState)}` };
    },
  },

  // ── create_event_rule ────────────────────────────────────────────────────
  {
    name: 'create_event_rule',
    category: 'device_management',
    definition: {
      name: 'create_event_rule',
      description: 'Create a new event/action rule on NX Witness.',
      input_schema: {
        type: 'object',
        properties: {
          rule: { type: 'object', description: 'Rule configuration object.' },
        },
        required: ['rule'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.createEventRule(input.rule);
      if (!result) return { error: 'Failed to create event rule.' };

      writeAuditLog({ action: 'create_event_rule', target: { ruleId: result.id }, newState: input.rule, result: 'success' });

      return { success: true, ruleId: result.id, rule: result };
    },
  },

  // ── modify_event_rule ────────────────────────────────────────────────────
  {
    name: 'modify_event_rule',
    category: 'device_management',
    definition: {
      name: 'modify_event_rule',
      description: 'Modify an existing event/action rule. Captures previous state for rollback.',
      input_schema: {
        type: 'object',
        properties: {
          rule_id: { type: 'string', description: 'Rule ID to modify.' },
          updates: { type: 'object', description: 'Fields to update.' },
        },
        required: ['rule_id', 'updates'],
      },
    },
    execute: async (input, deps) => {
      const previousRule = await deps.nxClient.getEventRule(input.rule_id);
      if (!previousRule) return { error: `Event rule not found: ${input.rule_id}` };

      const result = await deps.nxClient.updateEventRule(input.rule_id, input.updates);
      if (result === null) return { error: 'Failed to update event rule.' };

      writeAuditLog({ action: 'modify_event_rule', target: { ruleId: input.rule_id }, previousState: previousRule, newState: input.updates, result: 'success' });

      return { success: true, ruleId: input.rule_id, previousState: previousRule, rollbackInstruction: `To revert, update rule ${input.rule_id} back to previous settings.` };
    },
  },

  // ── delete_event_rule ────────────────────────────────────────────────────
  {
    name: 'delete_event_rule',
    category: 'device_management',
    definition: {
      name: 'delete_event_rule',
      description: 'DELETE an event rule. This is destructive and cannot be undone.',
      input_schema: {
        type: 'object',
        properties: { rule_id: { type: 'string', description: 'Rule ID to delete.' } },
        required: ['rule_id'],
      },
    },
    execute: async (input, deps) => {
      const previousRule = await deps.nxClient.getEventRule(input.rule_id);
      if (!previousRule) return { error: `Event rule not found: ${input.rule_id}` };

      const result = await deps.nxClient.deleteEventRule(input.rule_id);

      writeAuditLog({ action: 'delete_event_rule', target: { ruleId: input.rule_id }, previousState: previousRule, result: result !== null ? 'success' : 'failed' });

      return { success: result !== null, deletedRule: previousRule, note: 'Rule deleted. To recreate, use create_event_rule with the previous configuration.' };
    },
  },

  // ── create_bookmark ──────────────────────────────────────────────────────
  {
    name: 'create_bookmark',
    category: 'device_management',
    definition: {
      name: 'create_bookmark',
      description: 'Create a video bookmark on a camera to mark evidence.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'Camera device ID.' },
          name: { type: 'string', description: 'Bookmark name/title.' },
          description: { type: 'string', description: 'Optional description.' },
          start_time_ms: { type: 'number', description: 'Start time in milliseconds since epoch.' },
          duration_ms: { type: 'number', description: 'Duration in milliseconds. Default 60000 (1 minute).' },
        },
        required: ['device_id', 'name'],
      },
    },
    execute: async (input, deps) => {
      const bookmarkData = {
        name: input.name,
        description: input.description || '',
        startTimeMs: input.start_time_ms || Date.now(),
        durationMs: input.duration_ms || 60000,
      };
      const result = await deps.nxClient.createBookmark(input.device_id, bookmarkData);
      if (!result) return { error: 'Failed to create bookmark.' };

      writeAuditLog({ action: 'create_bookmark', target: { deviceId: input.device_id }, newState: bookmarkData, result: 'success' });

      return { success: true, bookmark: result };
    },
  },

  // ── fire_trigger ─────────────────────────────────────────────────────────
  {
    name: 'fire_trigger',
    category: 'device_management',
    definition: {
      name: 'fire_trigger',
      description: 'Activate a software trigger on NX Witness. Requires both trigger ID and target device ID.',
      input_schema: {
        type: 'object',
        properties: {
          trigger_id: { type: 'string', description: 'Trigger ID to activate.' },
          device_id: { type: 'string', description: 'Target device ID for the trigger.' },
          state: { type: 'string', enum: ['started', 'stopped'], description: 'Trigger state. Default: started.' },
        },
        required: ['trigger_id', 'device_id'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.activateTrigger(input.trigger_id, input.device_id, input.state || 'started');
      if (result === null) return { error: 'Failed to activate trigger.' };

      writeAuditLog({ action: 'fire_trigger', target: { triggerId: input.trigger_id, deviceId: input.device_id }, newState: { state: input.state || 'started' }, result: 'success' });

      return { success: true, triggerId: input.trigger_id, deviceId: input.device_id, state: input.state || 'started' };
    },
  },

  // ── acknowledge_event ────────────────────────────────────────────────────
  {
    name: 'acknowledge_event',
    category: 'device_management',
    definition: {
      name: 'acknowledge_event',
      description: 'Acknowledge/handle an event in NX Witness.',
      input_schema: {
        type: 'object',
        properties: {
          event_data: { type: 'object', description: 'Event acknowledgement data.' },
        },
        required: ['event_data'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.acknowledgeEvent(input.event_data);
      if (result === null) return { error: 'Failed to acknowledge event.' };

      writeAuditLog({ action: 'acknowledge_event', newState: input.event_data, result: 'success' });

      return { success: true };
    },
  },

  // ── trigger_analytics_cycle ──────────────────────────────────────────────
  {
    name: 'trigger_analytics_cycle',
    category: 'device_management',
    definition: {
      name: 'trigger_analytics_cycle',
      description: 'Trigger an on-demand WF-03 analytics health check cycle.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      if (!deps.wf03?.runCycle) return { error: 'Analytics workflow (WF-03) not available.' };
      // [NX-12] Report if cycle already running
      if (deps.wf03.isCycleInProgress?.()) {
        return { warning: 'An analytics cycle is already in progress. Request was skipped.' };
      }
      setImmediate(() => deps.wf03.runCycle().catch(err => log(WF, 'TRIGGER_ANALYTICS_ERROR', { detail: { error: err.message } })));

      writeAuditLog({ action: 'trigger_analytics_cycle', result: 'triggered' });

      return { success: true, note: 'Analytics cycle started. It typically takes 5-15 minutes.' };
    },
  },

  // ── trigger_health_check ─────────────────────────────────────────────────
  {
    name: 'trigger_health_check',
    category: 'device_management',
    definition: {
      name: 'trigger_health_check',
      description: 'Trigger an on-demand WF-04 server health check.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      if (!deps.wf04?.runHealthCheck) return { error: 'Server health workflow (WF-04) not available.' };
      setImmediate(() => deps.wf04.runHealthCheck().catch(err => log(WF, 'TRIGGER_HEALTH_ERROR', { detail: { error: err.message } })));

      writeAuditLog({ action: 'trigger_health_check', result: 'triggered' });

      return { success: true, note: 'Server health check started.' };
    },
  },

  // ── trigger_daily_report ─────────────────────────────────────────────────
  {
    name: 'trigger_daily_report',
    category: 'device_management',
    definition: {
      name: 'trigger_daily_report',
      description: 'Trigger an on-demand WF-05 daily report generation.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      if (!deps.wf05?.generateReport) return { error: 'Daily report workflow (WF-05) not available.' };
      setImmediate(() => deps.wf05.generateReport().catch(err => log(WF, 'TRIGGER_REPORT_ERROR', { detail: { error: err.message } })));

      writeAuditLog({ action: 'trigger_daily_report', result: 'triggered' });

      return { success: true, note: 'Daily report generation started.' };
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ══ PHASE 2: SERVER ADMINISTRATION TOOLS (write) ══════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  // ── restart_server ───────────────────────────────────────────────────────
  {
    name: 'restart_server',
    category: 'server_admin',
    definition: {
      name: 'restart_server',
      description: 'Restart the NX Witness server. WARNING: Server will be unreachable for 2-5 minutes. All cameras will briefly disconnect.',
      input_schema: {
        type: 'object',
        properties: {
          server_id: { type: 'string', description: 'Server ID to restart.' },
        },
        required: ['server_id'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.restartServer(input.server_id);
      if (result === null) {
        writeAuditLog({ action: 'restart_server', target: { serverId: input.server_id }, result: 'failed' });
        return { error: 'Failed to initiate server restart. NX Witness may be unreachable.' };
      }

      writeAuditLog({ action: 'restart_server', target: { serverId: input.server_id }, result: 'initiated' });

      // [NX-09] Include expected delay info
      return { success: true, note: 'Server restart initiated. The server will be unreachable for 2-5 minutes. Do NOT attempt to query the server during this time. Ask me to check server health in 5 minutes to verify recovery.' };
    },
  },

  // ── create_user ──────────────────────────────────────────────────────────
  {
    name: 'create_user',
    category: 'server_admin',
    definition: {
      name: 'create_user',
      description: 'Create a LOCAL NX Witness user account. IMPORTANT: This creates LOCAL accounts only — NOT cloud/NX Cloud accounts. Cloud users must be invited via the NX Cloud portal and then synced with sync_cloud_users. Use assign_user_cameras to grant camera access after creation.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Username.' },
          password: { type: 'string', description: 'Password.' },
          email: { type: 'string', description: 'Optional email address.' },
          fullName: { type: 'string', description: 'Optional display name.' },
          isEnabled: { type: 'boolean', description: 'Whether user is enabled. Default: true.' },
          groupIds: { type: 'array', items: { type: 'string' }, description: 'Optional group IDs to assign. Use get_user_groups to find available groups.' },
        },
        required: ['name', 'password'],
      },
    },
    execute: async (input, deps) => {
      const userData = {
        name: input.name,
        password: input.password,
        type: 'local',
        isEnabled: input.isEnabled !== false,
      };
      if (input.email) userData.email = input.email;
      if (input.fullName) userData.fullName = input.fullName;
      if (input.groupIds) userData.groupIds = input.groupIds;

      const result = await deps.nxClient.createUser(userData);
      if (!result) return { error: 'Failed to create user. Note: this only creates LOCAL accounts. Cloud users must be invited via NX Cloud portal.' };

      writeAuditLog({ action: 'create_user', target: { userName: input.name, userId: result.id }, result: 'success' });

      return { success: true, userId: result.id, name: result.name, type: 'local', note: 'Local account created. Use assign_user_cameras to grant camera access.' };
    },
  },

  // ── assign_user_cameras ────────────────────────────────────────────────
  {
    name: 'assign_user_cameras',
    category: 'server_admin',
    definition: {
      name: 'assign_user_cameras',
      description: 'Assign camera view access to a user (local or cloud). Sets which cameras the user can see in NX Witness. Works for both local and cloud accounts.',
      input_schema: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Username or email to find the user.' },
          user_id: { type: 'string', description: 'User ID (if known).' },
          camera_names: { type: 'array', items: { type: 'string' }, description: 'Camera name patterns to grant view access to.' },
          permissions: { type: 'string', description: 'Permission string. Default: "view|audio". Options: view, audio, viewArchive, exportArchive, viewBookmarks, manageBookmarks, userInput, edit' },
          mode: { type: 'string', enum: ['set', 'add', 'remove'], description: 'set = replace all access, add = add to existing, remove = remove specific cameras. Default: add.' },
        },
        required: ['camera_names'],
      },
    },
    execute: async (input, deps) => {
      // Resolve user
      let userId = input.user_id;
      let userName = input.user_name;
      if (!userId && !userName) return { error: 'Provide user_name or user_id.' };

      if (!userId) {
        const users = await deps.nxClient.getUsers();
        if (!users) return { error: 'Could not reach NX Witness server.' };
        const lower = userName.toLowerCase();
        const matches = users.filter(u => u.name?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower));
        if (matches.length === 0) return { error: `No user found matching "${userName}".` };
        if (matches.length > 1) return { ambiguous: true, matches: matches.map(u => ({ id: u.id, name: u.name, email: u.email, type: u.type })), message: `Multiple users match "${userName}". Specify which one.` };
        userId = matches[0].id;
        userName = matches[0].name;
      }

      // Resolve cameras
      const devices = await deps.nxClient.getDevices();
      if (!devices) return { error: 'Could not reach NX Witness server.' };

      const matchedDevices = [];
      for (const pattern of input.camera_names) {
        const lower = pattern.toLowerCase();
        const found = devices.filter(d => d.name?.toLowerCase().includes(lower));
        if (found.length === 0) return { error: `No camera found matching "${pattern}".` };
        matchedDevices.push(...found);
      }

      // Deduplicate
      const uniqueDevices = [...new Map(matchedDevices.map(d => [d.id, d])).values()];
      const permString = input.permissions || 'view|audio';
      const mode = input.mode || 'add';

      // Get current access
      const currentUser = await deps.nxClient._request('GET', '/rest/v4/users/' + userId);
      if (!currentUser) return { error: 'Could not fetch user details.' };
      const prevRights = { ...currentUser.resourceAccessRights };

      let newRights;
      if (mode === 'set') {
        newRights = {};
        for (const d of uniqueDevices) newRights[d.id] = permString;
      } else if (mode === 'remove') {
        newRights = { ...prevRights };
        for (const d of uniqueDevices) delete newRights[d.id];
      } else {
        newRights = { ...prevRights };
        for (const d of uniqueDevices) newRights[d.id] = permString;
      }

      const result = await deps.nxClient.updateUser(userId, { resourceAccessRights: newRights });
      if (result === null) return { error: 'Failed to update user camera access.' };

      writeAuditLog({ action: 'assign_user_cameras', target: { userId, userName }, previousState: { resourceAccessRights: prevRights }, newState: { resourceAccessRights: newRights }, result: 'success' });

      return {
        success: true,
        userName,
        mode,
        camerasAssigned: uniqueDevices.map(d => d.name),
        permissions: permString,
        totalCamerasWithAccess: Object.keys(newRights).length,
      };
    },
  },

  // ── get_user_cameras ─────────────────────────────────────────────────────
  {
    name: 'get_user_cameras',
    category: 'read',
    definition: {
      name: 'get_user_cameras',
      description: 'Show which cameras a user (local or cloud) has access to, and what permissions they have.',
      input_schema: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Username or email to search for.' },
          user_id: { type: 'string', description: 'User ID (if known).' },
        },
      },
    },
    execute: async (input, deps) => {
      let userId = input.user_id;
      if (!userId && !input.user_name) return { error: 'Provide user_name or user_id.' };

      const users = await deps.nxClient.getUsers();
      if (!users) return { error: 'Could not reach NX Witness server.' };

      let user;
      if (userId) {
        user = users.find(u => u.id === userId);
      } else {
        const lower = input.user_name.toLowerCase();
        const matches = users.filter(u => u.name?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower));
        if (matches.length === 0) return { error: `No user found matching "${input.user_name}".` };
        if (matches.length > 1) return { ambiguous: true, matches: matches.map(u => ({ id: u.id, name: u.name, email: u.email, type: u.type })) };
        user = matches[0];
      }
      if (!user) return { error: 'User not found.' };

      // Resolve device IDs to names
      const devices = await deps.nxClient.getDevices();
      const deviceMap = new Map((devices || []).map(d => [d.id, d.name]));

      const rights = user.resourceAccessRights || {};
      const cameras = Object.entries(rights).map(([id, perms]) => ({
        deviceId: id,
        cameraName: deviceMap.get(id) || id,
        permissions: perms,
      }));

      // Get resolved permissions (includes group inheritance)
      const resolved = await deps.nxClient._request('GET', '/rest/v4/users/' + user.id + '/permissions');

      return {
        user: { id: user.id, name: user.name, email: user.email, type: user.type, isEnabled: user.isEnabled },
        groups: user.groupIds || [],
        directCameraAccess: cameras,
        totalCameras: cameras.length,
        resolvedPermissions: resolved?.permissions || user.permissions,
      };
    },
  },

  // ── sync_cloud_users ─────────────────────────────────────────────────────
  {
    name: 'sync_cloud_users',
    category: 'server_admin',
    definition: {
      name: 'sync_cloud_users',
      description: 'Trigger a sync from NX Cloud to pull newly invited cloud users into the local server. Use this after inviting users via the NX Cloud portal.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async (_input, deps) => {
      const result = await deps.nxClient.syncCloud();
      if (result === null) return { error: 'Cloud sync failed. Is this server connected to NX Cloud?' };

      writeAuditLog({ action: 'sync_cloud_users', result: 'triggered' });

      return { success: true, syncStatus: result, note: 'Cloud sync initiated. New cloud users should appear in the user list shortly.' };
    },
  },

  // ── modify_user ──────────────────────────────────────────────────────────
  {
    name: 'modify_user',
    category: 'server_admin',
    definition: {
      name: 'modify_user',
      description: 'Modify an existing NX Witness user (local or cloud). Can change name, email, enabled status, group membership, and camera access (resourceAccessRights). For camera access changes, prefer assign_user_cameras tool instead.',
      input_schema: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID.' },
          updates: { type: 'object', description: 'Fields to update.' },
        },
        required: ['user_id', 'updates'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.updateUser(input.user_id, input.updates);
      if (result === null) return { error: 'Failed to modify user.' };

      writeAuditLog({ action: 'modify_user', target: { userId: input.user_id }, newState: input.updates, result: 'success' });

      return { success: true, userId: input.user_id };
    },
  },

  // ── delete_user ──────────────────────────────────────────────────────────
  {
    name: 'delete_user',
    category: 'server_admin',
    definition: {
      name: 'delete_user',
      description: 'DELETE a user account. This is destructive. Note: deleting cloud users locally may not remove them from NX Cloud — they could reappear on next sync.',
      input_schema: {
        type: 'object',
        properties: { user_id: { type: 'string', description: 'User ID to delete.' } },
        required: ['user_id'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.deleteUser(input.user_id);

      writeAuditLog({ action: 'delete_user', target: { userId: input.user_id }, result: result !== null ? 'success' : 'failed' });

      return { success: result !== null, userId: input.user_id };
    },
  },

  // ── create_db_backup ─────────────────────────────────────────────────────
  {
    name: 'create_db_backup',
    category: 'server_admin',
    definition: {
      name: 'create_db_backup',
      description: 'Create a database backup of the NX Witness server.',
      input_schema: {
        type: 'object',
        properties: { server_id: { type: 'string', description: 'Server ID.' } },
        required: ['server_id'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.createDbBackup(input.server_id);
      if (!result) return { error: 'Failed to create database backup.' };

      writeAuditLog({ action: 'create_db_backup', target: { serverId: input.server_id }, result: 'success' });

      return { success: true, note: 'Database backup initiated.' };
    },
  },

  // ── modify_site_settings ─────────────────────────────────────────────────
  {
    name: 'modify_site_settings',
    category: 'server_admin',
    definition: {
      name: 'modify_site_settings',
      description: 'Modify NX Witness site-level settings.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Setting name.' },
          value: { type: 'string', description: 'New value.' },
        },
        required: ['name', 'value'],
      },
    },
    execute: async (input, deps) => {
      const result = await deps.nxClient.updateSiteSetting(input.name, input.value);
      if (result === null) return { error: 'Failed to update site setting.' };

      writeAuditLog({ action: 'modify_site_settings', target: { setting: input.name }, newState: { value: input.value }, result: 'success' });

      return { success: true, setting: input.name, value: input.value };
    },
  },

  // ── modify_analytics_engine_settings ─────────────────────────────────────
  {
    name: 'modify_analytics_engine_settings',
    category: 'server_admin',
    definition: {
      name: 'modify_analytics_engine_settings',
      description: 'Modify CVEDIA analytics engine configuration.',
      input_schema: {
        type: 'object',
        properties: {
          engine_id: { type: 'string', description: 'Analytics engine ID.' },
          settings: { type: 'object', description: 'Settings to update.' },
        },
        required: ['engine_id', 'settings'],
      },
    },
    execute: async (input, deps) => {
      const previousSettings = await deps.nxClient.getAnalyticsEngineSettings(input.engine_id);
      const result = await deps.nxClient.updateAnalyticsEngineSettings(input.engine_id, input.settings);
      if (result === null) return { error: 'Failed to update analytics engine settings.' };

      writeAuditLog({ action: 'modify_analytics_engine_settings', target: { engineId: input.engine_id }, previousState: previousSettings, newState: input.settings, result: 'success' });

      return { success: true, engineId: input.engine_id, previousSettings };
    },
  },

];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip sensitive fields from a device object [NX-05] */
function stripSensitiveDevice(device) {
  const d = { ...device };
  // Remove credential fields if present
  delete d.credentials;
  delete d.password;
  return d;
}

// ── Build tool map ──────────────────────────────────────────────────────────

const toolMap = new Map();
for (const tool of tools) {
  toolMap.set(tool.name, tool);
}

/**
 * Execute a tool by name with null-safe wrapper [FIX-15].
 */
async function executeTool(toolName, input, deps) {
  const tool = toolMap.get(toolName);
  if (!tool) return { error: `Unknown tool: ${toolName}` };

  try {
    const result = await tool.execute(input || {}, deps);
    return result;
  } catch (err) {
    log(WF, 'TOOL_ERROR', { detail: { tool: toolName, error: err.message } });
    return { error: `Failed to execute ${toolName}: ${err.message}` };
  }
}

/**
 * Get tool definitions filtered by enabled capabilities.
 */
function getEnabledToolDefinitions(capabilities) {
  return tools
    .filter(t => {
      const catList = capabilities[t.category];
      return Array.isArray(catList) && catList.includes(t.name);
    })
    .map(t => t.definition);
}

/**
 * Get the category of a tool by name.
 */
function getToolCategory(toolName) {
  const tool = toolMap.get(toolName);
  return tool ? tool.category : 'unknown';
}

module.exports = {
  tools,
  executeTool,
  getEnabledToolDefinitions,
  getToolCategory,
};

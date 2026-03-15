'use strict';

/**
 * telegram.js
 * Sends notifications to a Telegram chat via the Bot API.
 * Receives commands via getUpdates long-polling.
 * Subscribes to eventBus events from the monitor workflows.
 */

const https = require('https');
const { log } = require('./logger');

const WF = 'TELEGRAM';

let botToken = null;
let chatId = null;
let eventBus = null;
let nxClient = null;
let state = null;
let wf03 = null;
let wf05 = null;

// Polling state
let polling = false;
let pollOffset = 0;
let sleepTimer = null;

// ── Telegram API ─────────────────────────────────────────────────────────────

function callTelegramApi(method, body = {}) {
  if (!botToken) return Promise.resolve(null);

  const payload = JSON.stringify(body);
  const timeoutMs = ((body.timeout || 0) + 10) * 1000;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: timeoutMs,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          reject(new Error(`Invalid JSON from Telegram: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

function sendMessage(text, parseMode = 'HTML') {
  if (!botToken || !chatId) return Promise.resolve();

  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  }).catch((err) => {
    log(WF, 'SEND_ERROR', { detail: { error: err.message } });
  });
}

/** Send with retry (exponential backoff). Only for critical alerts. */
async function sendMessageWithRetry(text, parseMode = 'HTML', maxRetries = 3) {
  if (!botToken || !chatId) return;

  let lastErr = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      });
      if (result && result.ok) return; // success
      // 4xx errors (bad request, unauthorized) — don't retry
      if (result && result.error_code && result.error_code >= 400 && result.error_code < 500) {
        log(WF, 'SEND_PERMANENT_ERROR', { detail: { error_code: result.error_code, description: result.description } });
        return;
      }
      lastErr = new Error(result?.description || 'Unknown Telegram error');
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxRetries - 1) {
      const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  log(WF, 'SEND_RETRY_EXHAUSTED', { detail: { error: lastErr?.message, attempts: maxRetries } });
}

// ── Device name resolver ─────────────────────────────────────────────────────

const deviceNameCache = new Map();

async function resolveDeviceName(deviceId) {
  if (deviceNameCache.has(deviceId)) return deviceNameCache.get(deviceId);
  try {
    if (nxClient) {
      const device = await nxClient.getDevice(deviceId);
      if (device && device.name) {
        deviceNameCache.set(deviceId, device.name);
        return device.name;
      }
    }
  } catch { /* ignore */ }
  return deviceId.slice(0, 8);
}

// ── Utilities ────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return 'unknown';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function sleep(ms) {
  return new Promise((resolve) => {
    sleepTimer = setTimeout(resolve, ms);
  });
}

// ── Command Handlers ─────────────────────────────────────────────────────────

async function cmdStatus() {
  const [devices, health, incidents] = await Promise.all([
    nxClient.getDevices(),
    Promise.resolve(state.getServerHealth()),
    Promise.resolve(state.getActiveIncidents()),
  ]);

  const total = devices ? devices.length : 0;
  const online = devices ? devices.filter(d => d.status === 'Online' || d.status === 'Recording').length : 0;
  const cpu = health ? Math.round(health.cpuPercent) : '?';
  const ram = health ? Math.round(health.ramPercent) : '?';
  const incidentCount = Object.keys(incidents || {}).length;
  const emoji = incidentCount === 0 ? '\u2705' : '\ud83d\udfe0';

  sendMessage(`${emoji} <b>${online}/${total}</b> cameras online, CPU <b>${cpu}%</b>, RAM <b>${ram}%</b>, <b>${incidentCount}</b> active incidents`);
}

async function cmdHealth() {
  const health = state.getServerHealth();
  if (!health) {
    sendMessage('\u26a0\ufe0f Server health data not yet available.');
    return;
  }

  const lines = [
    '\ud83d\udcbb <b>Server Health</b>',
    '',
    `CPU: <b>${Math.round(health.cpuPercent)}%</b>`,
    `RAM: <b>${Math.round(health.ramPercent)}%</b>`,
    `Uptime: <b>${formatUptime(health.uptimeS)}</b>`,
    `Storage drives: <b>${health.storageCount || '?'}</b>`,
    `Status: <b>${health.status || 'UNKNOWN'}</b>`,
    '',
    `<i>Updated: ${health.updatedAt || 'never'}</i>`,
  ];
  sendMessage(lines.join('\n'));
}

async function cmdCameras() {
  const devices = await nxClient.getDevices();
  if (!devices || devices.length === 0) {
    sendMessage('\u26a0\ufe0f No camera data available.');
    return;
  }

  const total = devices.length;
  const online = devices.filter(d => d.status === 'Online' || d.status === 'Recording').length;
  const offline = devices.filter(d => d.status !== 'Online' && d.status !== 'Recording');

  const lines = [
    `\ud83d\udcf7 <b>Cameras: ${online}/${total} online</b>`,
  ];

  if (offline.length > 0) {
    lines.push('');
    lines.push(`<b>Offline (${offline.length}):</b>`);
    const shown = offline.slice(0, 30);
    for (const cam of shown) {
      lines.push(`  \u2022 ${cam.name || cam.id.slice(0, 8)} — ${cam.status || 'Unknown'}`);
    }
    if (offline.length > 30) {
      lines.push(`  <i>...and ${offline.length - 30} more</i>`);
    }
  } else {
    lines.push('\nAll cameras online.');
  }

  sendMessage(lines.join('\n'));
}

async function cmdIncidents() {
  const incidents = state.getActiveIncidents();
  const entries = Object.entries(incidents || {});

  if (entries.length === 0) {
    sendMessage('\u2705 No active incidents.');
    return;
  }

  const lines = [`\ud83d\udea8 <b>Active Incidents (${entries.length})</b>`, ''];
  const shown = entries.slice(0, 20);

  for (const [deviceId, data] of shown) {
    const name = await resolveDeviceName(deviceId);
    const since = data.startedAt ? new Date(data.startedAt).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '?';
    lines.push(`  \u2022 <b>${name}</b> — ${data.reason || data.status || 'Unknown'} (since ${since})`);
  }

  if (entries.length > 20) {
    lines.push(`  <i>...and ${entries.length - 20} more</i>`);
  }

  sendMessage(lines.join('\n'));
}

async function cmdWorkflows() {
  const wfIds = ['WF-01', 'WF-02', 'WF-03', 'WF-04', 'WF-05'];
  const wfNames = {
    'WF-01': 'WebSocket Events',
    'WF-02': 'Camera Offline',
    'WF-03': 'Analytics Health',
    'WF-04': 'Server Health',
    'WF-05': 'Daily Report',
  };

  const lines = ['\ud83d\udd27 <b>Workflow Status</b>', ''];

  for (const id of wfIds) {
    const summary = state.getLastSummary(id);
    if (summary) {
      const updated = summary.updatedAt
        ? new Date(summary.updatedAt).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg' })
        : 'never';
      lines.push(`  \u2022 <b>${id}</b> ${wfNames[id]} — last updated ${updated}`);
    } else {
      lines.push(`  \u2022 <b>${id}</b> ${wfNames[id]} — no data yet`);
    }
  }

  sendMessage(lines.join('\n'));
}

async function cmdAnalytics() {
  if (!wf03 || typeof wf03.runCycle !== 'function') {
    sendMessage('\u26a0\ufe0f Analytics workflow not available.');
    return;
  }

  sendMessage('\ud83d\udd0d Running analytics check now...');

  // Run a fresh cycle — this will detect stale/disabled cameras and restart them
  try {
    await wf03.runCycle();
  } catch (err) {
    sendMessage(`\u26a0\ufe0f Analytics cycle failed: ${err.message}`);
    return;
  }

  // Now report the results
  const statuses = state.getAllAnalyticsStatuses();
  const entries = Object.entries(statuses);

  if (entries.length === 0) {
    sendMessage('\u2705 Analytics cycle complete — no camera data available.');
    return;
  }

  const byStatus = {};
  for (const [deviceId, info] of entries) {
    const s = info.status || 'unknown';
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push({ deviceId, ...info });
  }

  const healthy = (byStatus.healthy || []).length;
  const stale = byStatus.stale || [];
  const disabled = byStatus.disabled || [];
  const disabledOffline = byStatus.disabled_offline || [];
  const pending = byStatus.pending_recovery || [];

  const total = entries.length;
  const wf03Summary = state.getLastSummary('WF-03') || {};

  const lines = [
    `\ud83e\udde0 <b>Analytics Check Complete</b>`,
    '',
    `\u2705 Healthy: <b>${healthy}</b>/${total}`,
  ];

  if (wf03Summary.restarted > 0) {
    lines.push(`\ud83d\udd04 Restarted this cycle: <b>${wf03Summary.restarted}</b>`);
  }

  if (stale.length > 0) {
    lines.push('');
    lines.push(`\u26a0\ufe0f <b>Stale (${stale.length}):</b>`);
    for (const cam of stale.slice(0, 15)) {
      const name = cam.name || await resolveDeviceName(cam.deviceId);
      lines.push(`  \u2022 ${name}`);
    }
    if (stale.length > 15) lines.push(`  <i>...and ${stale.length - 15} more</i>`);
  }

  if (disabled.length > 0) {
    lines.push('');
    lines.push(`\ud83d\udeab <b>Disabled (${disabled.length}):</b>`);
    for (const cam of disabled.slice(0, 15)) {
      const name = cam.name || await resolveDeviceName(cam.deviceId);
      lines.push(`  \u2022 ${name}`);
    }
    if (disabled.length > 15) lines.push(`  <i>...and ${disabled.length - 15} more</i>`);
  }

  if (pending.length > 0) {
    lines.push('');
    lines.push(`\ud83d\udd04 <b>Pending recovery (${pending.length}):</b>`);
    for (const cam of pending.slice(0, 15)) {
      const name = cam.name || await resolveDeviceName(cam.deviceId);
      lines.push(`  \u2022 ${name}`);
    }
    if (pending.length > 15) lines.push(`  <i>...and ${pending.length - 15} more</i>`);
  }

  if (disabledOffline.length > 0) {
    lines.push(`\u23f8 Offline (analytics N/A): <b>${disabledOffline.length}</b>`);
  }

  // Suppressed cameras
  const suppressed = state.getAllSuppressed();
  const suppressedCount = Object.keys(suppressed).length;
  if (suppressedCount > 0) {
    lines.push('');
    lines.push(`\ud83d\udeab <b>Suppressed — 3+ failures (${suppressedCount}):</b>`);
    for (const [deviceId, info] of Object.entries(suppressed).slice(0, 5)) {
      const name = await resolveDeviceName(deviceId);
      lines.push(`  \u2022 ${name} (${info.count}x since ${new Date(info.since).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })})`);
    }
  }

  if (healthy === total) {
    lines.push('');
    lines.push(`\u2705 All analytics healthy.`);
  }

  const durationMs = wf03Summary.durationMs != null ? wf03Summary.durationMs : '?';
  lines.push('');
  lines.push(`<i>Cycle took ${durationMs}ms</i>`);

  sendMessage(lines.join('\n'));
}

async function cmdReport() {
  if (!wf05 || typeof wf05.generateReport !== 'function') {
    sendMessage('\u26a0\ufe0f Daily report generator not available.');
    return;
  }
  sendMessage('\u23f3 Generating daily report...');
  await wf05.generateReport();
}

function cmdHelp() {
  const lines = [
    '\ud83d\udc7b <b>Ghosthome Monitor Commands</b>',
    '',
    '/status — Quick overview (cameras, CPU, RAM, incidents)',
    '/health — Detailed server health',
    '/cameras — Camera counts + offline list',
    '/analytics — Analytics status breakdown (healthy, stale, disabled, suppressed)',
    '/incidents — Active incident list',
    '/workflows — Workflow statuses',
    '/report — Trigger daily report',
    '/help — Show this message',
  ];
  sendMessage(lines.join('\n'));
}

// ── Command Dispatch ─────────────────────────────────────────────────────────

const COMMANDS = {
  '/status': cmdStatus,
  '/health': cmdHealth,
  '/cameras': cmdCameras,
  '/analytics': cmdAnalytics,
  '/incidents': cmdIncidents,
  '/workflows': cmdWorkflows,
  '/report': cmdReport,
  '/help': cmdHelp,
};

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text || !msg.chat) return;

  const msgChatId = String(msg.chat.id);
  if (msgChatId !== String(chatId)) {
    log(WF, 'IGNORED_CHAT', { detail: { chatId: msgChatId } });
    return;
  }

  const text = msg.text.trim();
  if (!text.startsWith('/')) return;

  // Strip @botname suffix (for group chats)
  const command = text.split(/\s/)[0].replace(/@\S+$/, '').toLowerCase();

  const handler = COMMANDS[command];
  if (!handler) return;

  log(WF, 'COMMAND_RECEIVED', { detail: { command, from: msg.from?.username || msg.from?.id } });

  try {
    await handler();
  } catch (err) {
    log(WF, 'COMMAND_ERROR', { detail: { command, error: err.message } });
    sendMessage(`\u26a0\ufe0f Error processing <code>${command}</code>: ${err.message}`);
  }
}

// ── Polling Loop ─────────────────────────────────────────────────────────────

async function pollLoop() {
  let backoff = 1000;

  log(WF, 'POLLING_STARTED', { detail: { chatId } });

  while (polling) {
    try {
      const result = await callTelegramApi('getUpdates', {
        offset: pollOffset,
        timeout: 30,
        allowed_updates: ['message'],
      });

      if (!polling) break;

      if (result && result.ok && Array.isArray(result.result)) {
        backoff = 1000; // reset on success
        for (const update of result.result) {
          pollOffset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (err) {
            log(WF, 'UPDATE_HANDLE_ERROR', { detail: { error: err.message } });
          }
        }
      } else if (result && !result.ok) {
        log(WF, 'POLL_API_ERROR', { detail: { description: result.description, error_code: result.error_code } });
        if (!polling) break;
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    } catch (err) {
      log(WF, 'POLL_ERROR', { detail: { error: err.message } });
      if (!polling) break;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 30000);
    }
  }

  log(WF, 'POLLING_STOPPED', {});
}

// ── Event handlers ───────────────────────────────────────────────────────────
// Only critical/immediate events get Telegram messages.
// Individual camera events (ESCALATION, CAMERA_RECOVERED, POLE_UNREACHABLE,
// WARN_CPU, WARN_RAM) are batched into the twice-daily reports.

// Analytics stale alert rate-limiting (2 hours per camera)
const staleAlertCooldowns = new Map();
const STALE_ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function onCriticalServer(data) {
  const cpu = data.cpuPercent != null ? `CPU: ${Math.round(data.cpuPercent)}%` : '';
  const ram = data.ramPercent != null ? `RAM: ${Math.round(data.ramPercent)}%` : '';
  const msg = data.message ? `\n${data.message}` : '';
  sendMessageWithRetry(
    `\ud83d\udd34 <b>CRITICAL SERVER</b>\n` +
    `${[cpu, ram].filter(Boolean).join(' | ')}${msg}\n` +
    `Server resources critically high.`,
  );
}

function onServerRecovered(data) {
  const cams = data.camerasOffline > 0
    ? `\n${data.camerasOnline}/${data.camerasOnline + data.camerasOffline} cameras back online (${data.camerasOffline} still offline)`
    : '';
  sendMessage(
    `\ud83d\udfe2 <b>SERVER RECOVERED</b>\n` +
    `Server resources back to normal.${cams}`,
  );
}

function onMassOffline(data) {
  sendMessageWithRetry(
    `\ud83d\udea8 <b>MASS CAMERA OFFLINE</b>\n` +
    `<b>${data.offlineCount}</b> cameras offline (threshold: ${data.threshold})\n` +
    `Suspected major infrastructure issue — check power, switches, or server.`,
  );
}

async function onAnalyticsStale(data) {
  const { deviceId, thresholdHours } = data;

  // Rate-limit: skip if same camera alerted within 2 hours
  const lastAlert = staleAlertCooldowns.get(deviceId);
  if (lastAlert && (Date.now() - lastAlert) < STALE_ALERT_COOLDOWN_MS) {
    return;
  }

  staleAlertCooldowns.set(deviceId, Date.now());

  const name = data.name || await resolveDeviceName(deviceId);
  sendMessage(
    `\u26a0\ufe0f <b>ANALYTICS STALE</b>\n` +
    `Camera: <b>${name}</b>\n` +
    `No detections in the last ${thresholdHours}h.\n` +
    `Attempting automatic restart.`,
  );
}

async function onAnalyticsRestartSuccess(data) {
  const { deviceId, condition, thresholdHours } = data;
  const name = data.name || await resolveDeviceName(deviceId);

  const reason = condition === 'stale'
    ? `No detections in ${thresholdHours}h`
    : 'Analytics was disabled';

  sendMessage(
    `\ud83d\udd04 <b>ANALYTICS RESTARTED</b>\n` +
    `Camera: <b>${name}</b>\n` +
    `Reason: ${reason}\n` +
    `Analytics disabled \u2192 confirmed off \u2192 re-enabled \u2192 confirmed on.\n` +
    `Verifying detections next cycle.`,
  );
}

async function onAnalyticsRestartFailed(data) {
  const { deviceId, condition, stage, thresholdHours } = data;
  const name = data.name || await resolveDeviceName(deviceId);

  const reason = condition === 'stale'
    ? `No detections in ${thresholdHours}h`
    : 'Analytics was disabled';

  sendMessageWithRetry(
    `\u274c <b>ANALYTICS RESTART FAILED</b>\n` +
    `Camera: <b>${name}</b>\n` +
    `Reason: ${reason}\n` +
    `Failed at stage: <code>${stage || 'unknown'}</code>\n` +
    `Manual intervention may be required.`,
  );
}

async function onAnalyticsRecovered(data) {
  const { deviceId, condition, thresholdHours, verified } = data;
  const name = data.name || await resolveDeviceName(deviceId);

  const reason = condition === 'stale'
    ? `Was stale (no detections in ${thresholdHours}h)`
    : 'Was disabled';

  const verifiedStr = verified
    ? 'Detections confirmed after restart.'
    : 'Restart successful, analytics re-enabled.';

  sendMessage(
    `\u2705 <b>ANALYTICS RECOVERED</b>\n` +
    `Camera: <b>${name}</b>\n` +
    `${reason} — ${verifiedStr}`,
  );
}

function onDailyReport(data) {
  // Primary: WF-05 emits { message, summary } — send the pre-formatted message
  if (data.message) {
    sendMessage(data.message);
    return;
  }

  // Fallback: build from summary object
  const s = data.summary || {};
  const cam = s.cameras || {};
  const cameras = cam.online != null && cam.total != null
    ? `\nCameras: ${cam.online}/${cam.total} online`
    : '';
  const incidents = s.incidentCount != null
    ? `\nActive incidents: ${s.incidentCount}`
    : '';
  const status = s.status || 'UNKNOWN';
  const emoji = status === 'ALL_OK' ? '\u2705' : status === 'WARNINGS' ? '\u26a0\ufe0f' : '\ud83d\udd34';
  sendMessage(
    `\ud83d\udccb <b>DAILY REPORT</b> ${emoji}\n` +
    `Status: <b>${status}</b>${cameras}${incidents}`,
  );
}

// ── Init + Lifecycle ─────────────────────────────────────────────────────────

function init(deps) {
  botToken = process.env.TELEGRAM_BOT_TOKEN || null;
  chatId = process.env.TELEGRAM_CHAT_ID || null;
  eventBus = deps.eventBus;
  nxClient = deps.nxClient || null;
  state = deps.state || null;
  wf03 = deps.wf03 || null;
  wf05 = deps.wf05 || null;

  if (!botToken || !chatId) {
    log(WF, 'DISABLED', { detail: { reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' } });
    return;
  }

  log(WF, 'INIT', { detail: { chatId } });

  // Subscribe to immediate-alert events only.
  // Individual camera events (ESCALATION, CAMERA_RECOVERED, POLE_UNREACHABLE,
  // WARN_CPU, WARN_RAM) are batched into twice-daily reports — no instant Telegram.
  eventBus.on('CRITICAL_SERVER', onCriticalServer);
  eventBus.on('SERVER_RECOVERED', onServerRecovered);
  eventBus.on('MASS_OFFLINE', onMassOffline);
  eventBus.on('DAILY_REPORT', onDailyReport);
  eventBus.on('ANALYTICS_STALE', onAnalyticsStale);
  eventBus.on('ANALYTICS_RESTART_SUCCESS', onAnalyticsRestartSuccess);
  eventBus.on('ANALYTICS_RESTART_FAILED', onAnalyticsRestartFailed);
  eventBus.on('ANALYTICS_RECOVERED', onAnalyticsRecovered);

  log(WF, 'STARTED', { detail: { events: ['CRITICAL_SERVER', 'SERVER_RECOVERED', 'MASS_OFFLINE', 'DAILY_REPORT', 'ANALYTICS_STALE', 'ANALYTICS_RESTART_SUCCESS', 'ANALYTICS_RESTART_FAILED', 'ANALYTICS_RECOVERED'] } });
}

let cacheEvictionTimer = null;

function start() {
  if (!botToken || !chatId) return;
  polling = true;
  pollLoop(); // fire-and-forget

  // Evict stale caches every 24 hours
  cacheEvictionTimer = setInterval(() => {
    deviceNameCache.clear();
    // Prune expired stale alert cooldowns
    const now = Date.now();
    for (const [deviceId, ts] of staleAlertCooldowns) {
      if (now - ts > STALE_ALERT_COOLDOWN_MS) {
        staleAlertCooldowns.delete(deviceId);
      }
    }
  }, 24 * 60 * 60 * 1000);
}

function stop() {
  polling = false;
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
  if (cacheEvictionTimer) {
    clearInterval(cacheEvictionTimer);
    cacheEvictionTimer = null;
  }
}

/**
 * Send a test message to verify the bot is working.
 */
function sendTestMessage() {
  if (!botToken || !chatId) {
    return Promise.resolve({ ok: false, reason: 'Not configured' });
  }

  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: '\u2705 <b>Ghosthome Monitor</b>\nTelegram notifications connected successfully.',
    parse_mode: 'HTML',
  }).then((result) => ({
    ok: result && result.ok === true,
    body: result,
  })).catch((err) => ({
    ok: false,
    error: err.message,
  }));
}

function isPolling() {
  return polling;
}

module.exports = { init, start, stop, sendMessage, sendTestMessage, isPolling };

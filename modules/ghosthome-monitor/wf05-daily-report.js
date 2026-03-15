const cron = require('node-cron');
const { log, readLogsForDate } = require('./logger');
const state = require('./state');
const config = require('./config');
const { getSiteByDeviceId } = require('./site-config');

const WF = 'WF-05';

let nxClient = null;
let eventBus = null;
let cronJobMorning = null;
let cronJobEvening = null;
let engineId = null;
let running = false;

function init(deps) {
  nxClient = deps.nxClient;
  eventBus = deps.eventBus;
  engineId = deps.config.nx.engineId || null;
}

function sastDateString(date = new Date()) {
  // Returns YYYY-MM-DD in Africa/Johannesburg timezone using explicit part extraction
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Read logs for a SAST date. Since log files are UTC-named but we want SAST-day
 * boundaries (00:00–23:59 SAST = 22:00 UTC prev-day to 21:59 UTC same-day),
 * we read both possible UTC-dated files and filter entries by SAST date.
 */
async function readLogsForSastDate(wfName, sastDate) {
  // SAST is UTC+2, so SAST midnight = 22:00 UTC previous day
  // Read the UTC date matching the SAST date AND the day before
  const d = new Date(sastDate + 'T00:00:00Z');
  const utcSameDay = sastDate;
  const prev = new Date(d.getTime() - 86400000);
  const utcPrevDay = prev.toISOString().slice(0, 10);

  const logsA = await readLogsForDate(wfName, utcPrevDay); // covers 22:00–23:59 UTC prev day
  const logsB = await readLogsForDate(wfName, utcSameDay);  // covers 00:00–21:59 UTC same day
  const combined = [...logsA, ...logsB];

  // Filter: keep only entries whose timestamp falls within the SAST date
  // SAST day start = sastDate 00:00 SAST = (sastDate - 1) 22:00 UTC
  const sastDayStartUtc = new Date(d.getTime() - 2 * 3600000); // subtract 2h for UTC+2
  const sastDayEndUtc = new Date(sastDayStartUtc.getTime() + 86400000);

  return combined.filter(entry => {
    if (!entry.ts) return false;
    const t = new Date(entry.ts).getTime();
    return t >= sastDayStartUtc.getTime() && t < sastDayEndUtc.getTime();
  });
}

function countEvents(logs, eventName) {
  return logs.filter(entry => entry.event === eventName).length;
}

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

function formatDuration(ms) {
  if (!ms || ms < 0) return '?';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function nowSAST() {
  return new Date().toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Build a map of deviceId → offline count from yesterday's WF-02 logs
function findRepeatOffenders(wf02Logs) {
  const counts = {};
  for (const entry of wf02Logs) {
    if (entry.event === 'CAMERA_OFFLINE_DETECTED' && entry.cameraId) {
      counts[entry.cameraId] = (counts[entry.cameraId] || 0) + 1;
    }
  }
  // Only return cameras that went offline 2+ times
  const repeats = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);
  return repeats;
}

async function generateReport() {
  log(WF, 'REPORT_GENERATING', {});

  try {
    // ── Camera snapshot ─────────────────────────────────────────────────
    const devices = await nxClient.getDevices();
    let camerasTotal = 0, camerasOnline = 0, camerasOffline = 0;
    const offlineCameras = [];

    if (devices && Array.isArray(devices)) {
      camerasTotal = devices.length;
      for (const d of devices) {
        if (d.status === 'Offline') {
          camerasOffline++;
          offlineCameras.push({ id: d.id, name: d.name || d.id.slice(0, 8), status: d.status });
        } else {
          camerasOnline++;
        }
      }
    }

    // Enrich offline cameras with duration from active incidents
    const activeIncidents = state.getActiveIncidents();
    const now = Date.now();
    for (const cam of offlineCameras) {
      const incident = activeIncidents[cam.id];
      if (incident && incident.startedAt) {
        cam.downSince = incident.startedAt;
        cam.downDuration = formatDuration(now - new Date(incident.startedAt).getTime());
      } else {
        cam.downDuration = '?';
      }
      // Pole lookup (returns null if site-config not populated)
      const site = getSiteByDeviceId(cam.id);
      cam.pole = site ? site.label : null;
    }

    // ── Analytics snapshot ───────────────────────────────────────────────
    let analyticsTotal = 0, analyticsEnabled = 0;
    let disabledGenuine = 0, disabledOffline = 0;
    let staleCount = 0, pendingRecoveryCount = 0;
    const disabledGenuineList = [];
    const disabledOfflineList = [];
    const staleList = [];
    const pendingRecoveryList = [];

    // Build offline ID set for O(1) lookup
    const offlineIds = new Set(offlineCameras.map(c => c.id));

    // Get WF-03's per-camera analytics statuses (source of truth for stale/pending)
    const analyticsStatuses = state.getAllAnalyticsStatuses();

    if (!engineId) {
      const engines = await nxClient.getAnalyticsEngines();
      if (engines && Array.isArray(engines)) {
        const cvedia = engines.find(e => e.name && e.name.includes('CVEDIA'));
        if (cvedia) engineId = cvedia.id;
      }
    }

    if (engineId && devices && Array.isArray(devices)) {
      for (const device of devices) {
        // Skip ANPR cameras from analytics counting
        if (device.name && /anpr/i.test(device.name)) continue;

        const agent = await nxClient.getDeviceAgent(engineId, device.id);
        if (agent) {
          analyticsTotal++;
          const camName = device.name || device.id.slice(0, 8);
          const camStatus = analyticsStatuses[device.id];

          if (agent.isEnabled) {
            // Agent is enabled, but check if WF-03 detected staleness
            if (camStatus && camStatus.status === 'stale') {
              staleCount++;
              staleList.push(camName);
            } else if (camStatus && camStatus.status === 'pending_recovery') {
              pendingRecoveryCount++;
              pendingRecoveryList.push(camName);
              analyticsEnabled++; // agent is enabled, just unverified
            } else {
              analyticsEnabled++;
            }
          } else if (offlineIds.has(device.id)) {
            disabledOffline++;
            disabledOfflineList.push(camName);
          } else {
            disabledGenuine++;
            disabledGenuineList.push(camName);
          }
        }
      }
    }

    // Suppressed cameras (failed restart 3+ times)
    const suppressedCameras = state.getAllSuppressed();
    const suppressedCount = Object.keys(suppressedCameras).length;
    const suppressedNames = [];
    if (suppressedCount > 0 && devices && Array.isArray(devices)) {
      const deviceMap = new Map(devices.map(d => [d.id, d.name || d.id.slice(0, 8)]));
      for (const deviceId of Object.keys(suppressedCameras)) {
        suppressedNames.push(deviceMap.get(deviceId) || deviceId.slice(0, 8));
      }
    }

    // ── Server health ───────────────────────────────────────────────────
    const servers = await nxClient.getServers();
    let serverName = 'Unknown';
    let serverUptime = null;
    let cpuAvg = null;
    let ramAvg = null;
    let storageInfo = [];

    if (servers && Array.isArray(servers) && servers.length > 0) {
      const server = servers[0];
      serverName = server.name || 'Unknown';
      const serverId = server.id;

      // Storage details
      const storages = await nxClient.getServerStorages(serverId);
      if (storages && Array.isArray(storages)) {
        for (const s of storages) {
          storageInfo.push({
            path: s.path || '?',
            writing: s.isUsedForWriting === true,
            status: s.status || 'Unknown',
          });
        }
      }

      // CPU, RAM, uptime from WF-04 cached health data (source of truth)
      const healthData = state.getServerHealth();
      if (healthData) {
        serverUptime = healthData.uptimeS;
        cpuAvg = healthData.cpuPercent;
        ramAvg = healthData.ramPercent;
      }
    }

    // ── Yesterday's log analysis (SAST-aware) ──────────────────────────
    const yesterdaySast = sastDateString(new Date(Date.now() - 86400000));
    const wf02Logs = await readLogsForSastDate('wf-02', yesterdaySast);
    const wf03Logs = await readLogsForSastDate('wf-03', yesterdaySast);
    const wf04Logs = await readLogsForSastDate('wf-04', yesterdaySast);

    const incidentsCameraOffline = countEvents(wf02Logs, 'CAMERA_OFFLINE_DETECTED');
    const selfRecovered = countEvents(wf02Logs, 'CAMERA_SELF_RECOVERED') + countEvents(wf02Logs, 'CAMERA_SELF_RECOVERED_DURING_WAIT');
    const analyticsRestarted = countEvents(wf03Logs, 'ANALYTICS_REENABLED');
    const escalated = countEvents(wf02Logs, 'ESCALATION_CAMERA_OFFLINE') +
                      countEvents(wf03Logs, 'CONFIRM_OFF_FAILED') +
                      countEvents(wf03Logs, 'CONFIRM_ON_FAILED');
    const serverRestarts = countEvents(wf04Logs, 'SERVER_RESTART_TRIGGERED');

    // Repeat offenders (cameras offline 2+ times yesterday)
    const repeatOffenders = findRepeatOffenders(wf02Logs);
    // Resolve names for repeat offenders
    const repeatOffendersNamed = [];
    if (devices && Array.isArray(devices)) {
      const deviceMap = new Map(devices.map(d => [d.id, d.name || d.id.slice(0, 8)]));
      for (const [deviceId, count] of repeatOffenders.slice(0, 5)) {
        repeatOffendersNamed.push({ name: deviceMap.get(deviceId) || deviceId.slice(0, 8), count });
      }
    }

    // ── Today's log analysis (for evening reports, SAST-aware) ──────────
    const todaySast = sastDateString();
    const wf02TodayLogs = await readLogsForSastDate('wf-02', todaySast);
    const wf03TodayLogs = await readLogsForSastDate('wf-03', todaySast);
    const todayIncidents = countEvents(wf02TodayLogs, 'CAMERA_OFFLINE_DETECTED');
    const todayRecovered = countEvents(wf02TodayLogs, 'CAMERA_SELF_RECOVERED') + countEvents(wf02TodayLogs, 'CAMERA_SELF_RECOVERED_DURING_WAIT');
    const todayAnalyticsRestarts = countEvents(wf03TodayLogs, 'ANALYTICS_REENABLED');

    // ── Determine overall status ────────────────────────────────────────
    let status = 'ALL_OK';
    if (camerasOffline > 0 || disabledGenuine > 0 || staleCount > 0 || escalated > 0) status = 'WARNINGS';
    if (camerasOffline > 5 || escalated > 2 || serverRestarts > 0) status = 'CRITICAL';

    const summary = {
      date: sastDateString(),
      reportTime: nowSAST(),
      cameras: { total: camerasTotal, online: camerasOnline, offline: camerasOffline, offlineList: offlineCameras },
      analytics: { total: analyticsTotal, enabled: analyticsEnabled, disabledGenuine, disabledOffline, disabledGenuineList, disabledOfflineList, stale: staleCount, staleList, pendingRecovery: pendingRecoveryCount, pendingRecoveryList, suppressed: suppressedCount, suppressedNames, restartsYesterday: analyticsRestarted },
      server: { name: serverName, uptime: serverUptime, cpuAvg, ramAvg, storages: storageInfo },
      incidents: {
        cameraOffline: incidentsCameraOffline,
        analyticsRestarted,
        escalated,
        selfRecovered,
        serverRestarts,
        repeatOffenders: repeatOffendersNamed,
      },
      today: {
        cameraIncidents: todayIncidents,
        selfRecovered: todayRecovered,
        analyticsRestarts: todayAnalyticsRestarts,
      },
      status,
    };

    // Format human-readable Telegram message
    const message = formatReportMessage(summary);

    log(WF, 'DAILY_REPORT', { detail: { summary, message } });
    state.setLastSummary('WF-05', { ...summary, message });

    if (eventBus) eventBus.emit('DAILY_REPORT', { summary, message });

    return summary;

  } catch (err) {
    log(WF, 'REPORT_ERROR', { detail: { error: err.message } });
    return null;
  }
}

function formatReportMessage(summary) {
  const s = summary;
  const statusEmoji = s.status === 'ALL_OK' ? '\u2705' : s.status === 'WARNINGS' ? '\u26a0\ufe0f' : '\ud83d\udd34';
  const statusLabel = s.status === 'ALL_OK' ? 'ALL OK' : s.status === 'WARNINGS' ? 'WARNINGS' : 'CRITICAL';

  const lines = [];

  // ── Header ──────────────────────────────────────────────────────────
  lines.push(`\ud83d\udccb <b>GHOSTHOME DAILY REPORT</b> \u2014 ${s.date}`);
  lines.push(`Status: ${statusEmoji} <b>${statusLabel}</b>`);
  lines.push('');

  // ── Cameras ─────────────────────────────────────────────────────────
  lines.push(`\ud83c\udfa5 <b>Cameras: ${s.cameras.online}/${s.cameras.total} online</b>`);
  if (s.cameras.offlineList && s.cameras.offlineList.length > 0) {
    lines.push(`  <b>Offline (${s.cameras.offline}):</b>`);

    // Group by pole if available
    const withPole = s.cameras.offlineList.filter(c => c.pole);
    const withoutPole = s.cameras.offlineList.filter(c => !c.pole);

    if (withPole.length > 0) {
      const byPole = {};
      for (const c of withPole) {
        if (!byPole[c.pole]) byPole[c.pole] = [];
        byPole[c.pole].push(c);
      }
      for (const [pole, cams] of Object.entries(byPole)) {
        for (const c of cams) {
          lines.push(`    \u2022 ${c.name} (${c.downDuration}) \u2190 ${pole}`);
        }
      }
    }

    for (const c of withoutPole) {
      lines.push(`    \u2022 ${c.name} (${c.downDuration})`);
    }
  }
  lines.push('');

  // ── Analytics ───────────────────────────────────────────────────────
  lines.push(`\ud83e\udde0 <b>Analytics: ${s.analytics.enabled}/${s.analytics.total} active</b>`);
  if (s.analytics.disabledGenuineList && s.analytics.disabledGenuineList.length > 0) {
    lines.push(`  <b>Disabled (genuine): ${s.analytics.disabledGenuine}</b>`);
    for (const name of s.analytics.disabledGenuineList.slice(0, 10)) {
      lines.push(`    \u2022 ${name}`);
    }
    if (s.analytics.disabledGenuineList.length > 10) {
      lines.push(`    <i>...and ${s.analytics.disabledGenuineList.length - 10} more</i>`);
    }
  }
  if (s.analytics.staleList && s.analytics.staleList.length > 0) {
    lines.push(`  <b>Stale (enabled but no detections): ${s.analytics.stale}</b>`);
    for (const name of s.analytics.staleList.slice(0, 10)) {
      lines.push(`    \u2022 ${name}`);
    }
    if (s.analytics.staleList.length > 10) {
      lines.push(`    <i>...and ${s.analytics.staleList.length - 10} more</i>`);
    }
  }
  if (s.analytics.pendingRecoveryList && s.analytics.pendingRecoveryList.length > 0) {
    lines.push(`  <i>Pending recovery verification: ${s.analytics.pendingRecovery}</i>`);
  }
  if (s.analytics.disabledOffline > 0) {
    lines.push(`  <i>Disabled (camera offline): ${s.analytics.disabledOffline}</i>`);
  }
  if (s.analytics.suppressed > 0 && s.analytics.suppressedNames && s.analytics.suppressedNames.length > 0) {
    lines.push(`  <b>Suppressed (restart failed 3x): ${s.analytics.suppressed}</b>`);
    for (const name of s.analytics.suppressedNames.slice(0, 10)) {
      lines.push(`    \u2022 ${name}`);
    }
  }
  lines.push('');

  // ── Server ──────────────────────────────────────────────────────────
  lines.push(`\ud83d\udda5\ufe0f <b>Server: ${s.server.name}</b>`);
  const cpuStr = s.server.cpuAvg != null ? `${s.server.cpuAvg}%` : 'N/A';
  const ramStr = s.server.ramAvg != null ? `${s.server.ramAvg}%` : 'N/A';
  const uptimeStr = s.server.uptime != null ? formatUptime(s.server.uptime) : 'N/A';
  lines.push(`  CPU: <b>${cpuStr}</b> | RAM: <b>${ramStr}</b> | Uptime: <b>${uptimeStr}</b>`);

  if (s.server.storages && s.server.storages.length > 0) {
    const writingCount = s.server.storages.filter(st => st.writing).length;
    const totalDrives = s.server.storages.length;
    const allOk = s.server.storages.every(st => st.status === 'Online');
    lines.push(`  Storage: ${totalDrives} drive${totalDrives > 1 ? 's' : ''}, ${writingCount} recording${allOk ? '' : ' \u26a0\ufe0f check storage status'}`);
  }
  lines.push('');

  // ── Last 24h Activity ─────────────────────────────────────────────
  lines.push(`\ud83d\udcca <b>Last 24h Activity:</b>`);
  lines.push(`  Camera incidents: <b>${s.incidents.cameraOffline}</b> (${s.incidents.selfRecovered} self-recovered)`);
  lines.push(`  Analytics restarts: <b>${s.incidents.analyticsRestarted}</b>`);
  lines.push(`  Escalations: <b>${s.incidents.escalated}</b>`);
  if (s.incidents.serverRestarts > 0) {
    lines.push(`  Server restarts: <b>${s.incidents.serverRestarts}</b>`);
  }

  // Repeat offenders
  if (s.incidents.repeatOffenders && s.incidents.repeatOffenders.length > 0) {
    lines.push('');
    lines.push(`\ud83d\udd01 <b>Repeat Offenders:</b>`);
    for (const { name, count } of s.incidents.repeatOffenders) {
      lines.push(`    \u2022 ${name} (${count}x)`);
    }
  }

  // Today's activity (useful for evening reports)
  if (s.today && (s.today.cameraIncidents > 0 || s.today.analyticsRestarts > 0)) {
    lines.push('');
    lines.push(`\ud83d\udcc5 <b>Today so far:</b>`);
    if (s.today.cameraIncidents > 0) {
      lines.push(`  Camera incidents: <b>${s.today.cameraIncidents}</b> (${s.today.selfRecovered} recovered)`);
    }
    if (s.today.analyticsRestarts > 0) {
      lines.push(`  Analytics restarts: <b>${s.today.analyticsRestarts}</b>`);
    }
  }

  lines.push('');

  // ── Footer ──────────────────────────────────────────────────────────
  const morningHour = config.dailyReportHour;
  const eveningHour = config.dailyReportHourEvening;
  lines.push(`\u23f0 Report: ${s.reportTime} SAST | Next: ${morningHour}:00 / ${eveningHour}:00`);

  return lines.join('\n');
}

function start() {
  running = true;
  log(WF, 'STARTING', {});

  const morningHour = config.dailyReportHour;
  const eveningHour = config.dailyReportHourEvening;

  const reportHandler = () => {
    generateReport().catch(err => {
      log(WF, 'REPORT_UNHANDLED_ERROR', { detail: { error: err.message } });
    });
  };

  cronJobMorning = cron.schedule(`0 ${morningHour} * * *`, reportHandler, { timezone: 'Africa/Johannesburg' });
  cronJobEvening = cron.schedule(`0 ${eveningHour} * * *`, reportHandler, { timezone: 'Africa/Johannesburg' });

  log(WF, 'STARTED', { detail: { scheduledAt: `${morningHour}:00 and ${eveningHour}:00 daily` } });
}

function stop() {
  running = false;
  log(WF, 'STOPPING', {});

  if (cronJobMorning) {
    cronJobMorning.stop();
    cronJobMorning = null;
  }
  if (cronJobEvening) {
    cronJobEvening.stop();
    cronJobEvening = null;
  }

  log(WF, 'STOPPED', {});
}

module.exports = { init, generateReport, start, stop };

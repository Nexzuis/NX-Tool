const { log } = require('./logger');
const state = require('./state');

const WF = 'WF-04';
const SERVER_FAILURE_WAIT_MS = 5 * 60 * 1000; // 5 minutes before checking after failure event
const POST_RECOVERY_WAIT_MS = 10 * 60 * 1000; // 10 minutes after server back online to verify cameras + analytics

let nxClient = null;
let eventBus = null;
let wf03 = null;
let config = null;
let pollTimer = null;
let startupTimer = null;
let running = false;
let operationInProgress = false;
let consecutiveHighCpu = 0;

// ── Cancellable sleep infrastructure ─────────────────────────────────────────

class ShutdownError extends Error {
  constructor() {
    super('Workflow shutdown');
    this.code = 'WF_SHUTDOWN';
  }
}

const activeSleeps = new Map(); // id -> { timer, reject }
let sleepIdCounter = 0;

function init(deps) {
  nxClient = deps.nxClient;
  eventBus = deps.eventBus;
  wf03 = deps.wf03 || null;
  config = deps.config;
}

async function runHealthCheck() {
  if (operationInProgress) {
    log(WF, 'HEALTH_CHECK_SKIPPED', { detail: { reason: 'Previous operation still running' } });
    return;
  }
  operationInProgress = true;

  log(WF, 'HEALTH_CHECK_START', {});

  try {
    // Get server list
    const servers = await nxClient.getServers();
    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      log(WF, 'NO_SERVERS_FOUND', {});
      return;
    }

    for (const server of servers) {
      const serverId = server.id;
      const serverName = server.name || 'Unknown';

      // Check server status
      if (server.status && server.status !== 'Online') {
        log(WF, 'SERVER_NOT_ONLINE', { detail: { serverId, serverName, status: server.status } });
        await handleServerRestart(serverId, serverName);
        continue;
      }

      // Get runtime info
      const runtime = await nxClient.getServerRuntimeInfo(serverId);

      // Get storages
      const storages = await nxClient.getServerStorages(serverId);

      // Get metrics (CPU, RAM, etc.)
      const metrics = await nxClient.getMetricsValues();

      // Evaluate storage health — only alert on storages that should be recording
      if (storages && Array.isArray(storages)) {
        for (const storage of storages) {
          if (storage.isUsedForWriting === true && storage.status !== 'Online') {
            log(WF, 'STORAGE_FAILURE', {
              detail: { path: storage.path, status: storage.status },
            });
            if (eventBus) eventBus.emit('STORAGE_ALERT', { serverId, storage });
          }
        }
      }

      // Disk space alerts removed — D: drive is loop recording and will always be near full.
      // Storage write failure (above) is the meaningful alert for disk issues.

      // Extract CPU and RAM from metrics — values are 0-1 fractions
      let cpuPercent = null;
      let ramPercent = null;

      if (metrics && metrics.servers && metrics.servers[serverId]) {
        const serverMetrics = metrics.servers[serverId];
        if (serverMetrics.load) {
          if (typeof serverMetrics.load.cpuUsageP === 'number') {
            cpuPercent = Math.round(serverMetrics.load.cpuUsageP * 100 * 10) / 10;
          }
          if (typeof serverMetrics.load.ramUsageP === 'number') {
            ramPercent = Math.round(serverMetrics.load.ramUsageP * 100 * 10) / 10;
          }
        }
      }

      // CPU threshold check
      if (typeof cpuPercent === 'number') {
        if (cpuPercent > 85) {
          consecutiveHighCpu++;
          if (consecutiveHighCpu >= 2) {
            log(WF, 'WARN_CPU', { detail: { cpuPercent, consecutiveChecks: consecutiveHighCpu } });
            if (eventBus) eventBus.emit('WARN_CPU', { serverId, cpuPercent, consecutiveChecks: consecutiveHighCpu });
          }
        } else {
          consecutiveHighCpu = 0;
        }
      }

      // RAM threshold check
      if (typeof ramPercent === 'number' && ramPercent > 90) {
        log(WF, 'WARN_RAM', { detail: { ramPercent } });
        if (eventBus) eventBus.emit('WARN_RAM', { serverId, ramPercent });
      }

      // Extract uptime from metrics
      let uptimeS = null;
      if (metrics && metrics.servers && metrics.servers[serverId] && metrics.servers[serverId].availability) {
        uptimeS = metrics.servers[serverId].availability.uptimeS;
      }

      // Build health summary
      const healthData = {
        serverId,
        serverName,
        status: server.status || 'Unknown',
        cpuPercent,
        ramPercent,
        storageCount: storages ? storages.length : 0,
        uptimeS,
        osInfo: runtime ? runtime.osInfo : null,
      };

      log(WF, 'SERVER_HEALTH_OK', { detail: healthData });
      state.setServerHealth(healthData);
      state.setLastSummary('WF-04', healthData);
    }

  } catch (err) {
    if (err instanceof ShutdownError) return; // expected during stop()
    log(WF, 'HEALTH_CHECK_ERROR', { detail: { error: err.message } });
  } finally {
    operationInProgress = false;
  }
}

// Internal function — always called from within runHealthCheck or handleServerFailure
// which already hold the operationInProgress lock.
async function handleServerRestart(serverId, serverName) {
  if (!running) return; // shutdown guard — don't restart during stop
  log(WF, 'SERVER_RESTART_TRIGGERED', { detail: { serverId, serverName } });
  state.setActiveIncident('server', { status: 'restarting', serverId });

  try {
    await nxClient.restartServer(serverId);

    // Wait 5 minutes for server to come back
    log(WF, 'WAITING_FOR_SERVER_RECOVERY', { detail: { waitMs: SERVER_FAILURE_WAIT_MS } });
    await sleep(SERVER_FAILURE_WAIT_MS);
    if (!running) return;

    // Check if server is back
    const runtime = await nxClient.getServerRuntimeInfo(serverId);
    if (!runtime) {
      log(WF, 'SERVER_UNRECOVERED', { detail: { serverId, serverName } });
      state.setActiveIncident('server', { status: 'critical', serverId });
      if (eventBus) eventBus.emit('CRITICAL_SERVER', { serverId, serverName, message: 'Server did not recover after restart' });
      return;
    }

    log(WF, 'SERVER_BACK_ONLINE', { detail: { serverId, serverName } });

    // Server is back — now wait 10 minutes for cameras and analytics to reconnect
    log(WF, 'WAITING_FOR_CAMERAS_AND_ANALYTICS', { detail: { waitMs: POST_RECOVERY_WAIT_MS } });
    await sleep(POST_RECOVERY_WAIT_MS);
    if (!running) return;

    // Verify all cameras are back
    const devices = await nxClient.getDevices();
    let camerasOnline = 0;
    let camerasOffline = 0;
    const offlineNames = [];

    if (devices && Array.isArray(devices)) {
      for (const d of devices) {
        if (d.status === 'Offline') {
          camerasOffline++;
          offlineNames.push(d.name);
        } else {
          camerasOnline++;
        }
      }
    }

    // Run an analytics check
    let analyticsHealthy = true;
    if (wf03 && running) {
      log(WF, 'POST_RECOVERY_ANALYTICS_CHECK', {});
      try {
        await wf03.runCycle();
      } catch (err) {
        if (err && err.code === 'WF_SHUTDOWN') return; // shutdown — exit silently
        analyticsHealthy = false;
        log(WF, 'POST_RECOVERY_ANALYTICS_ERROR', { detail: { error: err.message } });
      }
    }

    const recoveryReport = {
      serverId,
      serverName,
      camerasOnline,
      camerasOffline,
      offlineCameras: offlineNames,
      analyticsChecked: !!wf03,
      analyticsHealthy,
    };

    log(WF, 'SERVER_RECOVERY_COMPLETE', { detail: recoveryReport });
    state.clearActiveIncident('server');

    if (camerasOffline > 0) {
      log(WF, 'POST_RECOVERY_CAMERAS_STILL_OFFLINE', { detail: { count: camerasOffline, cameras: offlineNames } });
      if (eventBus) eventBus.emit('POST_RECOVERY_ISSUES', recoveryReport);
    }

    if (eventBus) eventBus.emit('SERVER_RECOVERED', recoveryReport);

  } catch (err) {
    if (err instanceof ShutdownError) throw err; // let shutdown propagate
    log(WF, 'SERVER_RESTART_ERROR', { detail: { serverId, error: err.message } });
    state.setActiveIncident('server', { status: 'critical', reason: 'restart_failed', serverId });
    if (eventBus) eventBus.emit('CRITICAL_SERVER', { serverId, serverName, message: `Restart failed: ${err.message}` });
  }
}

async function handleServerFailure() {
  if (operationInProgress) {
    log(WF, 'HANDLE_FAILURE_SKIPPED', { detail: { reason: 'Another operation already in progress' } });
    return;
  }
  operationInProgress = true;

  try {
    log(WF, 'SERVER_FAILURE_EVENT', {});

    // Wait 5 minutes before even checking — give the server time
    log(WF, 'WAITING_BEFORE_FAILURE_CHECK', { detail: { waitMs: SERVER_FAILURE_WAIT_MS } });
    await sleep(SERVER_FAILURE_WAIT_MS);
    if (!running) return;

    // Now check if it recovered on its own
    const servers = await nxClient.getServers();
    if (servers && Array.isArray(servers) && servers.length > 0) {
      const server = servers[0];
      if (server.status === 'Online') {
        log(WF, 'SERVER_SELF_RECOVERED', { detail: { serverId: server.id, serverName: server.name } });
        // Still do the post-recovery camera + analytics check
        log(WF, 'WAITING_FOR_CAMERAS_AND_ANALYTICS', { detail: { waitMs: POST_RECOVERY_WAIT_MS } });
        await sleep(POST_RECOVERY_WAIT_MS);
        if (!running) return;
        await postRecoveryCheck(server.id, server.name);
        return;
      }
      // Server still down — restart it (we already hold the operationInProgress lock)
      await handleServerRestart(server.id, server.name);
    } else {
      log(WF, 'CANNOT_REACH_SERVER', {});
      if (eventBus) eventBus.emit('CRITICAL_SERVER', { message: 'Server failure event — cannot reach server after 5 min wait' });
    }
  } catch (err) {
    if (err instanceof ShutdownError) return; // expected during stop()
    log(WF, 'HANDLE_FAILURE_ERROR', { detail: { error: err.message } });
    if (eventBus) eventBus.emit('CRITICAL_SERVER', { message: `Server failure handling error: ${err.message}` });
  } finally {
    operationInProgress = false;
  }
}

async function postRecoveryCheck(serverId, serverName) {
  const devices = await nxClient.getDevices();
  let camerasOnline = 0;
  let camerasOffline = 0;
  const offlineNames = [];

  if (devices && Array.isArray(devices)) {
    for (const d of devices) {
      if (d.status === 'Offline') {
        camerasOffline++;
        offlineNames.push(d.name);
      } else {
        camerasOnline++;
      }
    }
  }

  if (wf03 && running) {
    log(WF, 'POST_RECOVERY_ANALYTICS_CHECK', {});
    try {
      await wf03.runCycle();
    } catch (err) {
      if (err && err.code === 'WF_SHUTDOWN') return; // shutdown — exit silently
      log(WF, 'POST_RECOVERY_ANALYTICS_ERROR', { detail: { error: err.message } });
    }
  }

  const report = { serverId, serverName, camerasOnline, camerasOffline, offlineCameras: offlineNames };
  log(WF, 'POST_RECOVERY_CHECK_COMPLETE', { detail: report });

  if (camerasOffline > 0) {
    if (eventBus) eventBus.emit('POST_RECOVERY_ISSUES', report);
  }

  if (eventBus) eventBus.emit('SERVER_RECOVERED', report);
}

function sleep(ms) {
  if (!running) return Promise.reject(new ShutdownError());
  return new Promise((resolve, reject) => {
    const id = ++sleepIdCounter;
    const timer = setTimeout(() => {
      activeSleeps.delete(id);
      resolve();
    }, ms);
    activeSleeps.set(id, { timer, reject });
  });
}

function cancelAllSleeps() {
  for (const [id, { timer, reject }] of activeSleeps) {
    clearTimeout(timer);
    reject(new ShutdownError());
  }
  activeSleeps.clear();
}

function start() {
  running = true;
  const intervalMs = (config && config.intervals && config.intervals.serverMs) || 300000;
  log(WF, 'STARTING', { detail: { intervalMs } });

  // Use setInterval instead of cron to support arbitrary ms intervals
  pollTimer = setInterval(() => {
    runHealthCheck().catch(err => {
      if (err instanceof ShutdownError) return; // expected during stop()
      log(WF, 'HEALTH_CHECK_UNHANDLED_ERROR', { detail: { error: err.message } });
    });
  }, intervalMs);

  // Run first check after 10 seconds
  startupTimer = setTimeout(() => {
    startupTimer = null;
    runHealthCheck().catch(err => {
      if (err instanceof ShutdownError) return; // expected during stop()
      log(WF, 'INITIAL_CHECK_ERROR', { detail: { error: err.message } });
    });
  }, 10000);

  log(WF, 'STARTED', {});
}

function stop() {
  running = false;
  log(WF, 'STOPPING', {});

  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  cancelAllSleeps();
  operationInProgress = false;

  log(WF, 'STOPPED', {});
}

module.exports = { init, runHealthCheck, handleServerFailure, start, stop };

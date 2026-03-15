const { log } = require('./logger');
const state = require('./state');

const WF = 'WF-03';
const MAX_CYCLE_MS = 15 * 60 * 1000; // 15 minutes (40s per restart, need headroom)
const GRACE_PERIOD_MS = 60 * 60 * 1000; // 60 min grace after restart

let nxClient = null;
let eventBus = null;
let config = null;
let pollTimer = null;
let startupTimer = null;
let engineId = null;
let running = false;
let cycleInProgress = false;

// ── Cancellable sleep infrastructure ─────────────────────────────────────────

class ShutdownError extends Error {
  constructor() {
    super('Workflow shutdown');
    this.code = 'WF_SHUTDOWN';
  }
}

const activeSleeps = new Map(); // id -> { timer, reject }
let sleepIdCounter = 0;

// Track consecutive restart failures per camera (resets on success)
const failureCounts = new Map();

function init(deps) {
  nxClient = deps.nxClient;
  eventBus = deps.eventBus;
  config = deps.config;
  engineId = deps.config.nx.engineId || null;
  if (engineId) state.setEngineId(engineId);
}

async function discoverEngine() {
  if (engineId) return engineId;

  const engines = await nxClient.getAnalyticsEngines();
  if (!engines || !Array.isArray(engines)) {
    log(WF, 'ENGINE_DISCOVERY_FAILED', { detail: { message: 'Could not fetch analytics engines' } });
    return null;
  }

  // Find CVEDIA-RT engine
  const cvedia = engines.find(e =>
    e.name && (e.name.includes('CVEDIA') || e.name.includes('cvedia'))
  );

  if (cvedia) {
    engineId = cvedia.id;
    state.setEngineId(engineId);
    log(WF, 'ENGINE_DISCOVERED', { detail: { name: cvedia.name, id: cvedia.id } });
    return engineId;
  }

  log(WF, 'CVEDIA_ENGINE_NOT_FOUND', { detail: { availableEngines: engines.map(e => e.name) } });
  return null;
}

/**
 * Get staleness threshold based on time of day (SAST).
 * Returns ms threshold, or null during quiet hours (no check).
 */
function getStaleThresholdMs() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  const sastHour = hourPart ? parseInt(hourPart.value, 10) : 12;

  const quietStart = config ? config.quietTimeStart : 23;
  const quietEnd = config ? config.quietTimeEnd : 6;

  // Quiet time check (handles wraparound, e.g. 23:00–05:59)
  if (quietStart > quietEnd) {
    // Wraps midnight: e.g. 23–6 means 23,0,1,2,3,4,5 are quiet
    if (sastHour >= quietStart || sastHour < quietEnd) return null;
  } else {
    if (sastHour >= quietStart && sastHour < quietEnd) return null;
  }

  if (sastHour >= 6 && sastHour <= 17) {
    return config ? config.staleDaytimeMs : 3600000;
  } else if (sastHour >= 18 && sastHour < quietStart) {
    return config ? config.staleEveningMs : 7200000;
  }
  return config ? config.staleDaytimeMs : 3600000;
}

async function getLastDetectionTime(deviceId, thresholdMs) {
  const startTimeMs = Date.now() - thresholdMs;
  const tracks = await nxClient.getObjectTracks(deviceId, startTimeMs);

  if (tracks === null) return undefined;  // API error — do NOT treat as "no detections"

  if (Array.isArray(tracks) && tracks.length > 0) {
    return tracks[0].startTimeMs || tracks[0].endTimeMs || Date.now();
  }

  return null;  // Genuine zero detections
}

async function restartAnalytics(eId, deviceId) {
  if (!running) throw new ShutdownError(); // don't start restart during shutdown
  const result = { success: false, stage: null, disabledAt: null, enabledAt: null, confirmedAt: null };

  // Step 1: Disable
  log(WF, 'ANALYTICS_DISABLE_SENT', { cameraId: deviceId });
  await nxClient.patchDeviceAgent(eId, deviceId, { isEnabled: false });
  result.disabledAt = new Date().toISOString();

  // Step 2: Wait 20 seconds
  await sleep(20000);

  // Step 3: Confirm off (2 retries)
  let confirmed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const agent = await nxClient.getDeviceAgent(eId, deviceId);
    if (agent && agent.isEnabled === false) {
      confirmed = true;
      log(WF, 'ANALYTICS_CONFIRMED_OFF', { cameraId: deviceId });
      break;
    }
    if (attempt === 0) {
      log(WF, 'CONFIRM_OFF_RETRY', { cameraId: deviceId });
      await nxClient.patchDeviceAgent(eId, deviceId, { isEnabled: false });
      await sleep(10000);
    }
  }

  if (!confirmed) {
    log(WF, 'CONFIRM_OFF_FAILED', { cameraId: deviceId });
    if (eventBus) eventBus.emit('ESCALATION', { deviceId, reason: 'analytics_confirm_off_failed' });
    result.stage = 'confirm_off';
    return result;
  }

  // Step 4: Enable
  log(WF, 'ANALYTICS_ENABLE_SENT', { cameraId: deviceId });
  await nxClient.patchDeviceAgent(eId, deviceId, { isEnabled: true });
  result.enabledAt = new Date().toISOString();

  // Step 5: Wait 20 seconds
  await sleep(20000);

  // Step 6: Confirm on (2 retries)
  confirmed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const agent = await nxClient.getDeviceAgent(eId, deviceId);
    if (agent && agent.isEnabled === true) {
      confirmed = true;
      log(WF, 'ANALYTICS_REENABLED', { cameraId: deviceId });
      result.confirmedAt = new Date().toISOString();
      break;
    }
    if (attempt === 0) {
      log(WF, 'CONFIRM_ON_RETRY', { cameraId: deviceId });
      await nxClient.patchDeviceAgent(eId, deviceId, { isEnabled: true });
      await sleep(10000);
    }
  }

  if (!confirmed) {
    log(WF, 'CONFIRM_ON_FAILED', { cameraId: deviceId });
    if (eventBus) eventBus.emit('ESCALATION', { deviceId, reason: 'analytics_confirm_on_failed' });
    result.stage = 'confirm_on';
    return result;
  }

  result.success = true;
  return result;
}

async function runCycle() {
  if (cycleInProgress) {
    log(WF, 'CYCLE_SKIPPED', { detail: { reason: 'Previous cycle still running' } });
    return;
  }
  cycleInProgress = true;

  try {
    const cycleStart = Date.now();
    const thresholdMs = getStaleThresholdMs();
    const isQuietTime = thresholdMs === null;

    log(WF, 'CYCLE_START', { detail: { quietTime: isQuietTime, thresholdMs } });

    // Discover engine
    const eId = await discoverEngine();
    if (!eId) {
      log(WF, 'CYCLE_ABORTED', { detail: { reason: 'No CVEDIA engine found' } });
      return;
    }

    // Get all devices
    const devices = await nxClient.getDevices();
    if (!devices || !Array.isArray(devices)) {
      log(WF, 'CYCLE_ABORTED', { detail: { reason: 'Could not fetch devices' } });
      return;
    }

    let total = 0;
    let healthy = 0;
    let restarted = 0;
    let escalated = 0;
    let staleDetected = 0;
    let suppressed = 0;

    for (const device of devices) {
      if (!running) break;

      // Skip offline cameras — mark status so API/report can see them
      if (device.status === 'Offline') {
        state.setAnalyticsStatus(device.id, 'disabled_offline');
        continue;
      }

      // Skip ANPR cameras — they don't use CVEDIA analytics
      if (device.name && /anpr/i.test(device.name)) continue;

      total++;

      // Check cycle time limit
      if (Date.now() - cycleStart > MAX_CYCLE_MS) {
        log(WF, 'WARNING_CYCLE_SLOW', { detail: { processedSoFar: total, elapsed: Date.now() - cycleStart } });
        break;
      }

      try {
        // Get device agent state for this camera
        const agent = await nxClient.getDeviceAgent(eId, device.id);

        if (!agent) {
          // No analytics agent for this camera — skip
          continue;
        }

        // Condition A: Hard signal — analytics disabled
        if (agent.isEnabled === false) {
          // Check if suppressed (failed restart 3+ times)
          const suppressionData = state.getSuppressed(device.id);
          if (suppressionData) {
            log(WF, 'CONDITION_A_SUPPRESSED', { cameraId: device.id, detail: { name: device.name, failCount: suppressionData.count, since: suppressionData.since } });
            state.setAnalyticsStatus(device.id, 'disabled');
            suppressed++;
            continue;
          }

          log(WF, 'CONDITION_A_HARD', { cameraId: device.id, detail: { name: device.name } });
          state.setAnalyticsStatus(device.id, 'disabled');
          const result = await restartAnalytics(eId, device.id);
          if (result.success) {
            restarted++;
            failureCounts.delete(device.id);
            state.clearSuppressed(device.id);
            state.setAnalyticsStatus(device.id, 'pending_recovery', { condition: 'disabled' });
            state.setAnalyticsRestartedAt(device.id);
            if (eventBus) {
              eventBus.emit('ANALYTICS_RESTART_SUCCESS', { deviceId: device.id, name: device.name, condition: 'disabled' });
            }
          } else {
            escalated++;
            const count = (failureCounts.get(device.id) || 0) + 1;
            failureCounts.set(device.id, count);
            if (count >= 3) {
              state.setSuppressed(device.id, count);
              log(WF, 'CAMERA_SUPPRESSED', { cameraId: device.id, detail: { name: device.name, failCount: count } });
            }
            if (eventBus) {
              eventBus.emit('ANALYTICS_RESTART_FAILED', { deviceId: device.id, name: device.name, condition: 'disabled', stage: result.stage });
            }
          }
          continue;
        }

        // Condition B: Soft signal — enabled but no recent detections
        if (agent.isEnabled === true && !isQuietTime) {
          // Grace period: skip if recently restarted (pending recovery verification)
          const restartedAt = state.getAnalyticsRestartedAt(device.id);
          if (restartedAt && (Date.now() - restartedAt) < GRACE_PERIOD_MS) {
            // Camera was recently restarted, give it time — keep current status
            continue;
          }

          const lastDetection = await getLastDetectionTime(device.id, thresholdMs);

          if (lastDetection === undefined) {
            // API error — skip this camera, don't restart
            log(WF, 'CONDITION_B_API_ERROR', { cameraId: device.id, detail: { name: device.name } });
            continue;
          }

          if (lastDetection === null) {
            staleDetected++;
            const thresholdHours = thresholdMs / 3600000;
            log(WF, 'CONDITION_B_STALE', { cameraId: device.id, detail: { name: device.name, thresholdHours } });
            state.setAnalyticsStatus(device.id, 'stale', { thresholdHours });

            // Check suppression before attempting restart or alerting
            const suppressionData = state.getSuppressed(device.id);
            if (suppressionData) {
              log(WF, 'CONDITION_B_SUPPRESSED', { cameraId: device.id, detail: { name: device.name, failCount: suppressionData.count } });
              suppressed++;
              continue;
            }

            // Emit ANALYTICS_STALE event for Telegram (after suppression check)
            if (eventBus) {
              eventBus.emit('ANALYTICS_STALE', { deviceId: device.id, name: device.name, thresholdHours });
            }

            const result = await restartAnalytics(eId, device.id);
            if (result.success) {
              restarted++;
              failureCounts.delete(device.id);
              state.clearSuppressed(device.id);
              state.setAnalyticsStatus(device.id, 'pending_recovery', { condition: 'stale', thresholdHours });
              state.setAnalyticsRestartedAt(device.id);
              if (eventBus) {
                eventBus.emit('ANALYTICS_RESTART_SUCCESS', { deviceId: device.id, name: device.name, condition: 'stale', thresholdHours });
              }
            } else {
              escalated++;
              const count = (failureCounts.get(device.id) || 0) + 1;
              failureCounts.set(device.id, count);
              if (count >= 3) {
                state.setSuppressed(device.id, count);
                log(WF, 'CAMERA_SUPPRESSED', { cameraId: device.id, detail: { name: device.name, failCount: count } });
              }
              if (eventBus) {
                eventBus.emit('ANALYTICS_RESTART_FAILED', { deviceId: device.id, name: device.name, condition: 'stale', thresholdHours, stage: result.stage });
              }
            }
            continue;
          }
        }

        // Condition C: Healthy — detections found (or quiet time with agent enabled)
        // Check if this camera was pending recovery — if so, only confirm when detections were actually verified (not quiet time)
        const prevStatus = state.getAnalyticsStatus(device.id);
        if (prevStatus && prevStatus.status === 'pending_recovery') {
          if (isQuietTime) {
            // During quiet time we can't verify detections — leave pending until next daytime cycle
            continue;
          }
          log(WF, 'ANALYTICS_RECOVERY_VERIFIED', { cameraId: device.id, detail: { name: device.name, condition: prevStatus.condition } });
          if (eventBus) {
            eventBus.emit('ANALYTICS_RECOVERED', {
              deviceId: device.id,
              name: device.name,
              condition: prevStatus.condition || 'unknown',
              thresholdHours: prevStatus.thresholdHours,
              verified: true,
            });
          }
          state.clearAnalyticsRestartedAt(device.id);
        }

        // During quiet time, we can't verify detections — don't clear suppression or mark healthy
        if (isQuietTime) {
          // Keep current status; only count as healthy if not suppressed/stale
          const currentStatus = state.getAnalyticsStatus(device.id);
          if (!currentStatus || currentStatus.status === 'healthy') {
            healthy++;
          }
          continue;
        }

        // Clear any stale suppression/alert state on verified healthy
        state.clearSuppressed(device.id);
        state.clearStaleAlertTime(device.id);
        failureCounts.delete(device.id);
        state.setAnalyticsStatus(device.id, 'healthy');
        healthy++;

      } catch (err) {
        if (err instanceof ShutdownError) throw err; // propagate — don't count as failure
        log(WF, 'CAMERA_CHECK_ERROR', { cameraId: device.id, detail: { error: err.message } });
      }
    }

    const durationMs = Date.now() - cycleStart;
    const summary = {
      total,
      healthy,
      restarted,
      escalated,
      staleDetected,
      suppressed,
      quietTime: isQuietTime,
      uptimePct: total > 0 ? Math.round((healthy / total) * 100 * 10) / 10 : 0,
      durationMs,
    };

    log(WF, 'POLL_COMPLETE', { detail: summary });
    state.setLastSummary('WF-03', summary);

    if (eventBus) eventBus.emit('WF03_CYCLE_COMPLETE', summary);
  } finally {
    cycleInProgress = false;
  }
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
  const intervalMs = (config && config.intervals && config.intervals.analyticsMs) || 1800000;
  log(WF, 'STARTING', { detail: { intervalMs } });

  // Use setInterval instead of cron to support arbitrary ms intervals
  pollTimer = setInterval(() => {
    runCycle().catch(err => {
      if (err instanceof ShutdownError) return; // expected during stop()
      log(WF, 'CYCLE_UNHANDLED_ERROR', { detail: { error: err.message } });
    });
  }, intervalMs);

  // Run first cycle after 30 seconds (let other workflows initialize)
  startupTimer = setTimeout(() => {
    startupTimer = null;
    runCycle().catch(err => {
      if (err instanceof ShutdownError) return; // expected during stop()
      log(WF, 'INITIAL_CYCLE_ERROR', { detail: { error: err.message } });
    });
  }, 30000);

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
  cycleInProgress = false;

  log(WF, 'STOPPED', {});
}

function resetFailureCount(deviceId) {
  failureCounts.delete(deviceId);
}

function resetAllFailureCounts() {
  failureCounts.clear();
}

module.exports = { init, runCycle, start, stop, getStaleThresholdMs, resetFailureCount, resetAllFailureCounts };

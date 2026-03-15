const { log } = require('./logger');
const state = require('./state');
const siteConfig = require('./site-config');
const config = require('./config');

const WF = 'WF-02';
const WAIT_BEFORE_ACTION_MS = 30 * 60 * 1000; // 30 minutes
const VERIFICATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const POLE_RENOTIFY_MS = 72 * 60 * 60 * 1000; // 72 hours before messaging pole host again

let nxClient = null;
let eventBus = null;
let verificationTimer = null;
let running = false;
let massOfflineAlerted = false; // true while mass-offline alert is active (reset when below threshold)
const pendingWaits = new Map(); // deviceId -> timeout handle
const poleNotifiedAt = new Map(); // poleId -> timestamp of last notification to host

function publishSummary() {
  state.setLastSummary('WF-02', {
    activeIncidents: Object.keys(state.getActiveIncidents()).length,
    pendingWaits: pendingWaits.size,
  });
}

function init(deps) {
  nxClient = deps.nxClient;
  eventBus = deps.eventBus;

  // Listen for camera reconnect events to cancel pending waits
  if (eventBus) {
    eventBus.on('deviceConnected', (deviceId) => {
      const pending = pendingWaits.get(deviceId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        pendingWaits.delete(deviceId);
        state.clearActiveIncident(deviceId);
        log(WF, 'CAMERA_SELF_RECOVERED_DURING_WAIT', { cameraId: deviceId });
        publishSummary();
      }
    });
  }
}

async function handleCameraOffline(deviceId) {
  // Don't handle if already processing this camera
  if (state.hasActiveIncident(deviceId) || pendingWaits.has(deviceId)) {
    return;
  }

  log(WF, 'CAMERA_OFFLINE_DETECTED', { cameraId: deviceId });
  state.setActiveIncident(deviceId, { status: 'waiting', reason: 'offline_detected' });
  publishSummary();

  // Step 1: Wait 30 minutes (cancellable via deviceConnected event)
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, WAIT_BEFORE_ACTION_MS);
    pendingWaits.set(deviceId, { timeout, resolve });
    publishSummary();
  });

  // If stop() was called, exit immediately — don't make NX API calls during shutdown
  if (!running) return;

  // If the wait was cancelled (camera reconnected), the timeout was cleared
  if (!pendingWaits.has(deviceId)) {
    return; // Camera self-recovered
  }
  pendingWaits.delete(deviceId);
  publishSummary();

  // Step 2: Verify camera is still offline
  try {
    const device = await nxClient.getDevice(deviceId);
    if (!device) {
      log(WF, 'DEVICE_LOOKUP_FAILED', { cameraId: deviceId });
      state.setActiveIncident(deviceId, { status: 'error', reason: 'device_lookup_failed' });
      publishSummary();
      return;
    }

    const status = device.status || 'Unknown';
    if (status === 'Online' || status === 'Recording') {
      log(WF, 'CAMERA_SELF_RECOVERED', { cameraId: deviceId, detail: { status } });
      state.clearActiveIncident(deviceId);
      publishSummary();
      return;
    }

    log(WF, 'CAMERA_CONFIRMED_OFFLINE', { cameraId: deviceId, detail: { status } });
  } catch (err) {
    log(WF, 'VERIFY_ERROR', { cameraId: deviceId, detail: { error: err.message } });
    // Clean up pending state so the camera can be re-detected on next verification loop
    pendingWaits.delete(deviceId);
    state.clearActiveIncident(deviceId);
    publishSummary();
    return;
  }

  // Step 3: Check pole mapping for notification
  const site = siteConfig.getSiteByDeviceId(deviceId);
  if (!site) {
    log(WF, 'NO_SITE_CONFIG', { cameraId: deviceId, detail: { message: 'No pole mapping found for this camera' } });
    state.setActiveIncident(deviceId, { status: 'escalated', reason: 'no_site_config' });
    if (eventBus) eventBus.emit('ESCALATION', { deviceId, reason: 'no_site_config' });
    publishSummary();
    return;
  }

  // Camera confirmed offline after 30 min — escalate and notify pole host
  log(WF, 'ESCALATION_CAMERA_OFFLINE', { cameraId: deviceId, poleId: site.poleId });
  state.setActiveIncident(deviceId, { status: 'escalated', reason: 'confirmed_offline', poleId: site.poleId });
  if (eventBus) eventBus.emit('ESCALATION', { deviceId, poleId: site.poleId, reason: 'confirmed_offline' });

  // Notify pole host (rate-limited to once per 72 hours)
  handlePoleNotification(deviceId, site);
  publishSummary();
}

function handlePoleNotification(deviceId, site) {
  const lastNotified = poleNotifiedAt.get(site.poleId);
  const now = Date.now();
  const shouldNotify = !lastNotified || (now - lastNotified) >= POLE_RENOTIFY_MS;

  if (shouldNotify) {
    poleNotifiedAt.set(site.poleId, now);
    log(WF, 'POLE_HOST_NOTIFIED', {
      poleId: site.poleId,
      detail: { hostName: site.hostName, nextNotifyAfterHours: 72 },
    });
    if (eventBus) {
      eventBus.emit('POLE_UNREACHABLE', {
        deviceId,
        poleId: site.poleId,
        hostName: site.hostName,
        hostWhatsapp: site.hostWhatsapp,
      });
    }
  } else {
    const hoursUntilNext = Math.round((POLE_RENOTIFY_MS - (now - lastNotified)) / 3600000);
    log(WF, 'POLE_HOST_NOTIFICATION_SUPPRESSED', {
      poleId: site.poleId,
      detail: { reason: 'Already notified recently', hoursUntilNextNotify: hoursUntilNext },
    });
  }
}

async function verificationLoop() {
  try {
    const devices = await nxClient.getDevices();
    if (!devices || !Array.isArray(devices)) return;

    // Count offline cameras and check mass-offline threshold
    const offlineDevices = devices.filter(d => (d.status || 'Unknown') === 'Offline');
    const threshold = config.massOfflineThreshold;

    if (offlineDevices.length >= threshold && !massOfflineAlerted) {
      massOfflineAlerted = true;
      log(WF, 'MASS_OFFLINE_DETECTED', { detail: { offlineCount: offlineDevices.length, threshold } });
      if (eventBus) eventBus.emit('MASS_OFFLINE', { offlineCount: offlineDevices.length, threshold });
    } else if (offlineDevices.length < threshold && massOfflineAlerted) {
      massOfflineAlerted = false;
      log(WF, 'MASS_OFFLINE_CLEARED', { detail: { offlineCount: offlineDevices.length, threshold } });
      if (eventBus) eventBus.emit('MASS_OFFLINE_CLEARED', { offlineCount: offlineDevices.length, threshold });
    }

    for (const device of devices) {
      const status = device.status || 'Unknown';
      if (status === 'Offline' && !state.hasActiveIncident(device.id) && !pendingWaits.has(device.id)) {
        log(WF, 'VERIFICATION_FOUND_OFFLINE', { cameraId: device.id, detail: { name: device.name } });
        handleCameraOffline(device.id).catch(err => {
          log(WF, 'VERIFICATION_HANDLER_ERROR', { cameraId: device.id, detail: { error: err.message } });
        });
      }
    }
  } catch (err) {
    log(WF, 'VERIFICATION_LOOP_ERROR', { detail: { error: err.message } });
  }
}

function start() {
  running = true;
  log(WF, 'STARTING', {});

  verificationTimer = setInterval(() => {
    verificationLoop().catch(err => {
      log(WF, 'VERIFICATION_UNHANDLED_ERROR', { detail: { error: err.message } });
    });
  }, VERIFICATION_INTERVAL_MS);

  log(WF, 'STARTED', {});
}

function stop() {
  running = false;
  log(WF, 'STOPPING', {});

  if (verificationTimer) {
    clearInterval(verificationTimer);
    verificationTimer = null;
  }

  // Cancel all pending waits and resolve their promises
  for (const [deviceId, pending] of pendingWaits) {
    clearTimeout(pending.timeout);
    pending.resolve();
    // Clear the incident that was set when the wait started, so it doesn't
    // block re-detection after restart
    state.clearActiveIncident(deviceId);
  }
  pendingWaits.clear();

  log(WF, 'STOPPED', {});
}

module.exports = { init, handleCameraOffline, start, stop };

const { log } = require('./logger');
const state = require('./state');

const WF = 'WF-01';
const RECONNECT_DELAY_MS = 10000;

const WebSocket = require('ws');

let ws = null;
let fallbackTimer = null;
let running = false;
let nxClient = null;
let eventBus = null;
let wf02 = null;
let wf04 = null;
let config = null;
let handledAlarmIds = new Set();
let alarmClearTimer = null; // periodic alarm dedup clearing
let eventCount = 0;
let lastEventType = null;
let lastEventAt = null;

function publishSummary() {
  state.setLastSummary('WF-01', {
    connected: !!ws && ws.readyState === WebSocket.OPEN,
    eventCount,
    lastEventType,
    lastEventAt,
  });
}

function init(deps) {
  nxClient = deps.nxClient;
  eventBus = deps.eventBus;
  wf02 = deps.wf02;
  wf04 = deps.wf04;
  config = deps.config;
}

function routeEvent(eventType, params) {
  log(WF, 'EVENT_RECEIVED', { detail: { eventType, params } });

  switch (eventType) {
    case 'deviceDisconnected':
      if (params.deviceId && wf02) {
        wf02.handleCameraOffline(params.deviceId);
      }
      break;

    case 'deviceConnected':
      // Notify WF-02 that the camera is back (for cancelling pending waits)
      if (params.deviceId && eventBus) {
        eventBus.emit('deviceConnected', params.deviceId);
      }
      break;

    case 'serverFailure':
      if (wf04) wf04.handleServerFailure().catch(err => log(WF, 'SERVER_FAILURE_HANDLER_ERROR', { detail: { error: err.message } }));
      break;

    case 'serverStarted':
      state.clearActiveIncident('server');
      log(WF, 'SERVER_RECOVERED', { detail: { eventType } });
      break;

    case 'storageIssue':
      log(WF, 'STORAGE_ALERT', { detail: params });
      if (eventBus) eventBus.emit('STORAGE_ALERT', params);
      break;

    case 'networkIssue':
      log(WF, 'NETWORK_ISSUE', { cameraId: params.deviceId, detail: params });
      break;

    case 'licenseIssue':
      log(WF, 'LICENSE_ALERT', { detail: params });
      if (eventBus) eventBus.emit('LICENSE_ALERT', params);
      break;

    case 'deviceIpConflict':
      log(WF, 'IP_CONFLICT_ALERT', { cameraId: params.deviceId, detail: params });
      if (eventBus) eventBus.emit('IP_CONFLICT_ALERT', params);
      break;

    default:
      log(WF, 'UNHANDLED_EVENT', { detail: { eventType, params } });
      break;
  }
}

function handleDeviceNotification(params) {
  // params may be a single device object or an array
  const devices = Array.isArray(params) ? params : [params];
  for (const device of devices) {
    if (!device || !device.id) continue;

    const deviceId = device.id;
    const status = device.status;

    // Compare to known state
    const knownStatus = state.getCameraStatus(deviceId);

    if (status === 'Offline' && knownStatus !== 'Offline') {
      log(WF, 'DEVICE_STATUS_CHANGE', { cameraId: deviceId, detail: { from: knownStatus, to: status } });
      state.setCameraStatus(deviceId, status);
      routeEvent('deviceDisconnected', { deviceId });
    } else if (status === 'Online' && knownStatus === 'Offline') {
      log(WF, 'DEVICE_STATUS_CHANGE', { cameraId: deviceId, detail: { from: knownStatus, to: status } });
      state.setCameraStatus(deviceId, status);
      routeEvent('deviceConnected', { deviceId });
    } else if (status && status !== knownStatus) {
      // Track any other status change without routing events
      state.setCameraStatus(deviceId, status);
    }

    eventCount++;
    lastEventType = 'deviceNotification';
    lastEventAt = new Date().toISOString();
    publishSummary();
  }
}

function handleServerNotification(params) {
  const servers = Array.isArray(params) ? params : [params];
  for (const server of servers) {
    if (!server || !server.id) continue;

    log(WF, 'SERVER_NOTIFICATION', { detail: { serverId: server.id, status: server.status } });

    if (server.status === 'Offline' || server.status === 'Incompatible') {
      routeEvent('serverFailure', { serverId: server.id });
    }

    eventCount++;
    lastEventType = 'serverNotification';
    lastEventAt = new Date().toISOString();
    publishSummary();
  }
}

async function connectWebSocket() {
  if (!running) return;

  try {
    // Ensure we have a valid token for the ticket request
    if (!nxClient.token) {
      await nxClient.authenticate();
    }

    log(WF, 'WEBSOCKET_CONNECTING', {});

    // openWebSocket is now async — gets a ticket and connects
    ws = await nxClient.openWebSocket();

    ws.on('open', () => {
      log(WF, 'WEBSOCKET_CONNECTED', {});
      // Auth is on the URL via ticket — just subscribe
      nxClient.sendWsSubscribe(ws);
      publishSummary();
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // id=1: Initial response from rest.v4.devices.subscribe (full device list)
        if (msg.id === 1) {
          if (msg.error) {
            log(WF, 'DEVICE_SUBSCRIBE_ERROR', { detail: { error: msg.error } });
            return;
          }
          const deviceCount = Array.isArray(msg.result) ? msg.result.length : 0;
          log(WF, 'WEBSOCKET_SUBSCRIBED', { detail: { subscription: 'devices', count: deviceCount } });
          return;
        }

        // id=2: Initial response from rest.v4.servers.subscribe (full server list)
        if (msg.id === 2) {
          if (msg.error) {
            log(WF, 'SERVER_SUBSCRIBE_ERROR', { detail: { error: msg.error } });
            return;
          }
          const serverCount = Array.isArray(msg.result) ? msg.result.length : 0;
          log(WF, 'WEBSOCKET_SUBSCRIBED', { detail: { subscription: 'servers', count: serverCount } });
          return;
        }

        // Notifications (no id field) — push updates when devices/servers change
        if (!('id' in msg) && msg.method && msg.params !== undefined) {
          if (msg.method.includes('devices')) {
            handleDeviceNotification(msg.params);
          } else if (msg.method.includes('servers')) {
            handleServerNotification(msg.params);
          } else {
            log(WF, 'UNKNOWN_NOTIFICATION', { detail: { method: msg.method } });
          }
          return;
        }
      } catch (err) {
        // Non-JSON message, ignore
      }
    });

    ws.on('close', (code, reason) => {
      log(WF, 'WEBSOCKET_CLOSED', { detail: { code, reason: reason.toString() } });
      ws = null;
      publishSummary();
      if (running) {
        setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
      }
    });

    ws.on('error', (err) => {
      log(WF, 'WEBSOCKET_ERROR', { detail: { error: err.message } });
      // Close will fire after error, triggering reconnect
    });

  } catch (err) {
    log(WF, 'WEBSOCKET_CONNECT_FAILED', { detail: { error: err.message } });
    if (running) {
      // Re-authenticate and try again
      try {
        await nxClient.authenticate();
      } catch (authErr) {
        log(WF, 'REAUTH_FAILED', { detail: { error: authErr.message } });
      }
      setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
    }
  }
}

async function fallbackPoll() {
  try {
    const alarms = await nxClient.getMetricsAlarms();
    if (!alarms) return;

    // alarms is an object with device IDs as keys under 'devices'
    const devices = alarms.devices || {};
    let alarmCount = 0;

    for (const [deviceId, deviceAlarms] of Object.entries(devices)) {
      const availability = deviceAlarms.availability || {};

      // Check for offline status
      if (availability.status) {
        const statusAlarms = Array.isArray(availability.status) ? availability.status : [availability.status];
        for (const alarm of statusAlarms) {
          if (alarm.level === 'error' && alarm.text && alarm.text.includes('offline')) {
            const alarmKey = `offline:${deviceId}`;
            if (!handledAlarmIds.has(alarmKey)) {
              handledAlarmIds.add(alarmKey);
              log(WF, 'FALLBACK_ALARM_OFFLINE', { cameraId: deviceId, detail: alarm });
              if (wf02) wf02.handleCameraOffline(deviceId);
              alarmCount++;
            }
          }
        }
      }

      // Check for stream issues
      if (availability.streamIssues1h) {
        const issues = Array.isArray(availability.streamIssues1h) ? availability.streamIssues1h : [availability.streamIssues1h];
        for (const issue of issues) {
          if (issue.level === 'error') {
            log(WF, 'FALLBACK_ALARM_STREAM_ISSUE', { cameraId: deviceId, detail: issue });
          }
        }
      }
    }

    // Alarm dedup is cleared hourly via alarmClearTimer — no size-based cleanup needed
  } catch (err) {
    log(WF, 'FALLBACK_POLL_ERROR', { detail: { error: err.message } });
  }
}

function start() {
  running = true;
  log(WF, 'STARTING', {});

  publishSummary();
  connectWebSocket();

  // Clear alarm dedup set every hour to allow re-detection of recurring offlines
  alarmClearTimer = setInterval(() => {
    handledAlarmIds.clear();
  }, 60 * 60 * 1000);

  // Fallback poll interval from config (default 60s)
  const alarmsInterval = (config && config.intervals && config.intervals.alarmsMs) || 60000;
  fallbackTimer = setInterval(() => {
    fallbackPoll().catch(err => {
      log(WF, 'FALLBACK_POLL_UNHANDLED_ERROR', { detail: { error: err.message } });
    });
  }, alarmsInterval);

  log(WF, 'STARTED', {});
}

function stop() {
  running = false;
  log(WF, 'STOPPING', {});

  if (ws) {
    ws.close();
    ws = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  if (alarmClearTimer) {
    clearInterval(alarmClearTimer);
    alarmClearTimer = null;
  }
  handledAlarmIds.clear();

  log(WF, 'STOPPED', {});
}

module.exports = { init, start, stop };

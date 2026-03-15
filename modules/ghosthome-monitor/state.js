const persistence = require('./persistence');

const lastSummaries = {};
const activeIncidents = new Map();
let serverHealth = null;
let discoveredEngineId = null;

// Analytics staleness tracking
const analyticsStaleAlerts = new Map();   // deviceId → ISO timestamp (last Telegram alert sent)
const analyticsSuppressed = new Map();    // deviceId → { count, since }
const analyticsRestartedAt = new Map();   // deviceId → timestamp (grace period after restart)

function setLastSummary(wf, data) {
  lastSummaries[wf] = { ...data, updatedAt: new Date().toISOString() };
  persistence.markDirty();
}

function getLastSummary(wf) {
  return lastSummaries[wf] || null;
}

function setActiveIncident(deviceId, data) {
  activeIncidents.set(deviceId, { ...data, startedAt: data.startedAt || new Date().toISOString() });
  persistence.markDirty();
}

function clearActiveIncident(deviceId) {
  activeIncidents.delete(deviceId);
  persistence.markDirty();
}

function getActiveIncidents() {
  const result = {};
  for (const [id, data] of activeIncidents) {
    result[id] = data;
  }
  return result;
}

function hasActiveIncident(deviceId) {
  return activeIncidents.has(deviceId);
}

function setServerHealth(data) {
  serverHealth = { ...data, updatedAt: new Date().toISOString() };
  persistence.markDirty();
}

function getServerHealth() {
  return serverHealth;
}

function setEngineId(id) {
  discoveredEngineId = id;
}

function getEngineId() {
  return discoveredEngineId;
}

// Stale alert tracking (when last Telegram alert was sent per camera)
function setStaleAlertTime(deviceId) {
  analyticsStaleAlerts.set(deviceId, new Date().toISOString());
  persistence.markDirty();
}
function getStaleAlertTime(deviceId) {
  return analyticsStaleAlerts.get(deviceId) || null;
}
function clearStaleAlertTime(deviceId) {
  analyticsStaleAlerts.delete(deviceId);
  persistence.markDirty();
}

// Suppression tracking (cameras that failed restart 3+ times)
function setSuppressed(deviceId, count) {
  analyticsSuppressed.set(deviceId, { count, since: new Date().toISOString() });
  persistence.markDirty();
}
function getSuppressed(deviceId) {
  return analyticsSuppressed.get(deviceId) || null;
}
function clearSuppressed(deviceId) {
  analyticsSuppressed.delete(deviceId);
  persistence.markDirty();
}
function getAllSuppressed() {
  const result = {};
  for (const [id, data] of analyticsSuppressed) {
    result[id] = data;
  }
  return result;
}

// Grace period tracking after analytics restart
function setAnalyticsRestartedAt(deviceId) {
  analyticsRestartedAt.set(deviceId, Date.now());
  persistence.markDirty();
}
function getAnalyticsRestartedAt(deviceId) {
  return analyticsRestartedAt.get(deviceId) || null;
}
function clearAnalyticsRestartedAt(deviceId) {
  analyticsRestartedAt.delete(deviceId);
  persistence.markDirty();
}

// Per-camera connection status (Online/Offline as reported by NX device subscriptions)
const cameraStatuses = new Map();

function setCameraStatus(deviceId, status) {
  cameraStatuses.set(deviceId, status);
  persistence.markDirty();
}
function getCameraStatus(deviceId) {
  return cameraStatuses.get(deviceId) || null;
}

// Per-camera analytics status classifier
// status: 'healthy' | 'stale' | 'disabled' | 'disabled_offline' | 'pending_recovery' | 'no_agent'
const analyticsStatuses = new Map();

function setAnalyticsStatus(deviceId, status, extra = {}) {
  analyticsStatuses.set(deviceId, { status, updatedAt: new Date().toISOString(), ...extra });
  persistence.markDirty();
}
function getAnalyticsStatus(deviceId) {
  return analyticsStatuses.get(deviceId) || null;
}
function getAllAnalyticsStatuses() {
  const result = {};
  for (const [id, data] of analyticsStatuses) {
    result[id] = data;
  }
  return result;
}
function clearAnalyticsStatus(deviceId) {
  analyticsStatuses.delete(deviceId);
  persistence.markDirty();
}

function initFromPersisted(data) {
  if (data.activeIncidents) {
    for (const [id, val] of Object.entries(data.activeIncidents)) {
      activeIncidents.set(id, val);
    }
  }
  if (data.lastSummaries) {
    Object.assign(lastSummaries, data.lastSummaries);
  }
  if (data.serverHealth) {
    serverHealth = data.serverHealth;
  }
  if (data.analyticsStatuses) {
    for (const [id, val] of Object.entries(data.analyticsStatuses)) {
      analyticsStatuses.set(id, val);
    }
  }
  if (data.analyticsSuppressed) {
    for (const [id, val] of Object.entries(data.analyticsSuppressed)) {
      analyticsSuppressed.set(id, val);
    }
  }
  if (data.analyticsStaleAlerts) {
    for (const [id, val] of Object.entries(data.analyticsStaleAlerts)) {
      analyticsStaleAlerts.set(id, val);
    }
  }
  if (data.analyticsRestartedAt) {
    for (const [id, val] of Object.entries(data.analyticsRestartedAt)) {
      analyticsRestartedAt.set(id, val);
    }
  }
  if (data.cameraStatuses) {
    for (const [id, val] of Object.entries(data.cameraStatuses)) {
      cameraStatuses.set(id, val);
    }
  }
}

function getSnapshot() {
  const mapToObj = (map) => {
    const obj = {};
    for (const [id, val] of map) {
      obj[id] = val;
    }
    return obj;
  };

  return {
    activeIncidents: mapToObj(activeIncidents),
    lastSummaries: { ...lastSummaries },
    serverHealth: serverHealth ? { ...serverHealth } : null,
    analyticsStatuses: mapToObj(analyticsStatuses),
    analyticsSuppressed: mapToObj(analyticsSuppressed),
    analyticsStaleAlerts: mapToObj(analyticsStaleAlerts),
    analyticsRestartedAt: mapToObj(analyticsRestartedAt),
    cameraStatuses: mapToObj(cameraStatuses),
  };
}

module.exports = {
  setLastSummary,
  getLastSummary,
  setActiveIncident,
  clearActiveIncident,
  getActiveIncidents,
  hasActiveIncident,
  setServerHealth,
  getServerHealth,
  setEngineId,
  getEngineId,
  setStaleAlertTime,
  getStaleAlertTime,
  clearStaleAlertTime,
  setSuppressed,
  getSuppressed,
  clearSuppressed,
  getAllSuppressed,
  setAnalyticsRestartedAt,
  getAnalyticsRestartedAt,
  clearAnalyticsRestartedAt,
  setAnalyticsStatus,
  getAnalyticsStatus,
  getAllAnalyticsStatuses,
  clearAnalyticsStatus,
  setCameraStatus,
  getCameraStatus,
  initFromPersisted,
  getSnapshot,
};

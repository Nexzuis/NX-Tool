const { EventEmitter } = require('events');
const config = require('./config');
const { log, cleanOldLogs } = require('./logger');
const state = require('./state');
const persistence = require('./persistence');
const NxClient = require('./nx-client');
const wf01 = require('./wf01-websocket');
const wf02 = require('./wf02-camera-offline');
const wf03 = require('./wf03-analytics');
const wf04 = require('./wf04-server-health');
const wf05 = require('./wf05-daily-report');
const { startApiServer } = require('./api-server');
const telegram = require('./telegram');
const aiAgent = require('./llm-agent');
const aiConfig = require('./ai-config');

const WF = 'SYSTEM';
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Initialize API clients
const nxClient = new NxClient(config.nx);

// Shared dependencies for all workflows
const deps = {
  nxClient,
  eventBus,
  config,
  state,
  wf02,
  wf03,
  wf04,
  wf05,
  telegram,
  aiAgent,
  aiConfig,
};

async function startup() {
  log(WF, 'STARTING', { detail: { version: '1.0.0' } });

  // Clean log files older than 30 days
  cleanOldLogs(30).catch(() => { /* best effort */ });

  // Log auth status
  if (config.apiAuthConfigured) {
    log(WF, 'API_AUTH_CONFIGURED', { detail: { method: 'Bearer / X-API-Key' } });
  } else {
    log(WF, 'API_AUTH_WARNING', { detail: { message: 'API_AUTH_TOKEN not set — write endpoints are unprotected' } });
    console.warn('');
    console.warn('⚠  WARNING: API_AUTH_TOKEN is not set.');
    console.warn('   Write endpoints (triggers, analytics toggles) are open to any caller.');
    console.warn('   Set API_AUTH_TOKEN in .env and NEXT_PUBLIC_API_TOKEN in frontend .env to protect write access.');
    console.warn('');
  }

  // Authenticate to NX Witness
  try {
    await nxClient.authenticate();
    log(WF, 'NX_AUTH_OK', { detail: { host: config.nx.host } });
  } catch (err) {
    log(WF, 'NX_AUTH_FAILED', { detail: { error: err.message } });
    console.error('FATAL: Cannot authenticate to NX Witness. Exiting.');
    process.exit(1);
  }

  // Initialize persistence layer
  persistence.init();
  persistence.getState = () => state.getSnapshot();

  // Load persisted state
  const persisted = persistence.load();
  if (persisted) {
    state.initFromPersisted(persisted);
    log(WF, 'PERSISTENCE_RESTORED', { detail: { keys: Object.keys(persisted).filter(k => !k.startsWith('_')) } });
  }

  // Startup reconciliation — sync persisted state with live NX status
  try {
    const devices = await nxClient.getDevices();
    if (devices && Array.isArray(devices)) {
      const onlineIds = new Set(devices.filter(d => d.status === 'Online' || d.status === 'Recording').map(d => d.id));
      const incidents = state.getActiveIncidents();
      let cleared = 0, updated = 0;
      for (const [deviceId, incident] of Object.entries(incidents)) {
        if (deviceId === 'server') {
          // Check if server is online before clearing
          const servers = await nxClient.getServers();
          const serverOnline = servers && Array.isArray(servers) && servers.some(s => s.status === 'Online');
          if (serverOnline) {
            state.clearActiveIncident(deviceId);
            cleared++;
          }
          continue;
        } else if (onlineIds.has(deviceId)) {
          state.clearActiveIncident(deviceId);
          eventBus.emit('deviceConnected', deviceId);
          cleared++;
        } else {
          // Device still offline — clear so WF-02 can re-detect with fresh timers
          state.clearActiveIncident(deviceId);
          cleared++;
        }
      }
      // Update camera statuses from NX
      for (const device of devices) {
        const known = state.getCameraStatus(device.id);
        if (device.status !== known) {
          state.setCameraStatus(device.id, device.status);
          updated++;
        }
      }
      log(WF, 'PERSISTENCE_RECONCILED', { detail: { cleared, updated } });
    } else {
      log(WF, 'RECONCILIATION_SKIPPED', { detail: { reason: 'Could not fetch devices from NX' } });
    }
  } catch (err) {
    log(WF, 'RECONCILIATION_SKIPPED', { detail: { reason: err.message } });
  }

  // [NX-10] Detect NX Witness version
  try {
    const nxVersion = await nxClient.detectVersion();
    if (nxVersion) {
      log(WF, 'NX_VERSION_DETECTED', { detail: { version: nxVersion } });
    } else {
      log(WF, 'NX_VERSION_UNKNOWN', { detail: { message: 'Could not detect NX Witness version' } });
    }
  } catch (err) {
    log(WF, 'NX_VERSION_ERROR', { detail: { error: err.message } });
  }

  // Auto-discover CVEDIA engine ID
  try {
    const engines = await nxClient.getAnalyticsEngines();
    if (engines && Array.isArray(engines)) {
      const cvedia = engines.find(e => e.name && e.name.includes('CVEDIA'));
      if (cvedia) {
        config.nx.engineId = cvedia.id;
        log(WF, 'CVEDIA_ENGINE_FOUND', { detail: { name: cvedia.name, id: cvedia.id } });
      }
    }
  } catch (err) {
    log(WF, 'ENGINE_DISCOVERY_WARN', { detail: { error: err.message } });
  }

  // Initialize all workflows
  wf01.init(deps);
  wf02.init(deps);
  wf03.init(deps);
  wf04.init(deps);
  wf05.init(deps);

  // Start all workflows
  wf01.start();
  wf02.start();
  wf03.start();
  wf04.start();
  wf05.start();

  log(WF, 'ALL_WORKFLOWS_STARTED', {});

  // Initialize AI agent
  aiAgent.init(deps);
  aiAgent.start();
  const loadedAiConfig = aiConfig.load();
  if (loadedAiConfig.apiKey && loadedAiConfig.enabled) {
    log(WF, 'AI_AGENT_CONFIGURED', { detail: { model: loadedAiConfig.model, enabled: true } });
  } else {
    log(WF, 'AI_AGENT_STATUS', { detail: { enabled: false, hasKey: !!loadedAiConfig.apiKey } });
  }

  // Initialize Telegram notifications + command polling
  telegram.init(deps);
  telegram.start();

  // Start the HTTP + WebSocket API server
  apiRefs = startApiServer(deps);
  log(WF, 'API_SERVER_STARTED', { detail: { port: process.env.API_PORT || 4301 } });

  // Log event bus activity for debugging
  eventBus.on('ESCALATION', (data) => {
    log(WF, 'ESCALATION_EVENT', { detail: data });
  });

  eventBus.on('DAILY_REPORT', (data) => {
    log(WF, 'DAILY_REPORT_EMITTED', { detail: { status: data.summary.status } });
    console.log('\n' + data.message + '\n');
  });

  console.log('');
  console.log('=== Ghosthome Infrastructure Health Monitor ===');
  console.log(`NX Witness: ${config.nx.host}`);
  console.log(`NX Witness: ${nxClient.nxVersion || 'version unknown'}`);
  console.log(`CVEDIA Engine: ${config.nx.engineId || 'not found'}`);
  console.log(`Log directory: ${config.logDir}`);
  console.log(`Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured'}`);
  console.log(`AI Agent: ${loadedAiConfig.apiKey && loadedAiConfig.enabled ? 'enabled (' + loadedAiConfig.model + ')' : 'not configured'}`);
  console.log('All 5 workflows running.');
  console.log('Press Ctrl+C to stop.');
  console.log('');
}

// Graceful shutdown
let apiRefs = null;

function shutdown(signal) {
  log(WF, 'SYSTEM_SHUTDOWN', { detail: { signal } });
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  wf01.stop();
  wf02.stop();
  wf03.stop();
  wf04.stop();
  wf05.stop();
  aiAgent.stop();
  telegram.stop();

  // Flush state to disk before closing servers
  persistence.flush(state.getSnapshot());

  const closePromises = [];

  if (apiRefs) {
    if (apiRefs.wss) {
      closePromises.push(new Promise((resolve) => apiRefs.wss.close(resolve)));
    }
    if (apiRefs.httpServer) {
      closePromises.push(new Promise((resolve) => apiRefs.httpServer.close(resolve)));
    }
  }

  Promise.allSettled(closePromises).then(() => {
    log(WF, 'SHUTDOWN_COMPLETE', {});
    process.exit(0);
  });

  // Force exit after 5s if close callbacks stall
  setTimeout(() => {
    console.error('Shutdown timed out after 5s, forcing exit.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Prevent unhandled errors from crashing the process
process.on('uncaughtException', (err) => {
  log(WF, 'UNCAUGHT_EXCEPTION', { detail: { error: err.message, stack: err.stack } });
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  log(WF, 'UNHANDLED_REJECTION', { detail: { reason: String(reason) } });
  console.error('Unhandled rejection:', reason);
});

// Start the system
startup().catch(err => {
  console.error('FATAL startup error:', err.message);
  process.exit(1);
});

// Exports for Telegram module and Claude CLI
module.exports = {
  eventBus,
  getLastSummary: state.getLastSummary,
  getActiveIncidents: state.getActiveIncidents,
  getServerHealth: state.getServerHealth,
  triggerAnalyticsCycle: () => wf03.runCycle(),
  triggerServerCheck: () => wf04.runHealthCheck(),
  triggerDailyReport: () => wf05.generateReport(),
  nxClient,
};

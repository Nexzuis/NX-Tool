const fs = require('fs');
const path = require('path');
const config = require('./config');

const logDir = path.resolve(__dirname, config.logDir);

let logDirReady = false;
function ensureLogDir() {
  if (logDirReady) return;
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  logDirReady = true;
}

function getLogFile(wf) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `${wf.toLowerCase()}-${date}.jsonl`);
}

function log(wf, event, data = {}) {
  ensureLogDir();
  const entry = {
    ts: new Date().toISOString(),
    wf,
    event,
    cameraId: data.cameraId || null,
    poleId: data.poleId || null,
    detail: data.detail || data,
  };
  // Remove cameraId/poleId from detail if they were passed at top level
  if (entry.detail.cameraId) delete entry.detail.cameraId;
  if (entry.detail.poleId) delete entry.detail.poleId;

  const line = JSON.stringify(entry) + '\n';
  const filePath = getLogFile(wf);

  fs.appendFile(filePath, line, 'utf8', (err) => {
    if (err) console.error(`[LOGGER] Failed to write to ${filePath}:`, err.message);
  });

  // Also print to console for visibility
  const level = event.includes('ERROR') || event.includes('FAIL') || event.includes('CRITICAL')
    ? 'error'
    : event.includes('WARN') ? 'warn' : 'log';
  console[level](`[${wf}] ${event}`, data.cameraId ? `camera=${data.cameraId}` : '', data.poleId ? `pole=${data.poleId}` : '');
}

async function readLogsForDate(wf, date) {
  const filePath = path.join(logDir, `${wf.toLowerCase()}-${date}.jsonl`);
  try {
    await fs.promises.access(filePath);
  } catch {
    return [];
  }
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const lines = raw.trim().split('\n');
    return lines.filter(Boolean).map(line => JSON.parse(line));
  } catch (err) {
    console.error(`[LOGGER] Failed to read ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Delete log files older than `days` days. Call periodically or at startup.
 */
async function cleanOldLogs(days = 30) {
  try {
    const entries = await fs.promises.readdir(logDir);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue;
      const fp = path.join(logDir, entry);
      const stat = await fs.promises.stat(fp);
      if (stat.mtimeMs < cutoff) {
        await fs.promises.unlink(fp);
      }
    }
  } catch (err) {
    console.error('[LOGGER] Log cleanup error:', err.message);
  }
}

module.exports = { log, readLogsForDate, cleanOldLogs };

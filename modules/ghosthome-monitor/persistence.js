const fs = require('fs');
const path = require('path');
const { log } = require('./logger');

const WF = 'PERSIST';

let filePath = null;
let debounceTimer = null;
let getState = null; // callback set by index.js to get current state snapshot

function init(fp) {
  filePath = fp || path.resolve(__dirname, 'data', 'state.json');
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  log(WF, 'INIT', { detail: { filePath } });
}

function load() {
  if (!filePath) return null;

  if (!fs.existsSync(filePath)) {
    log(WF, 'PERSISTENCE_NO_FILE', { detail: { filePath } });
    return null;
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    log(WF, 'PERSISTENCE_CORRUPT', { detail: { error: err.message } });
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log(WF, 'PERSISTENCE_CORRUPT', { detail: { error: err.message } });
    return null;
  }

  if (parsed._version !== 1) {
    log(WF, 'PERSISTENCE_VERSION_MISMATCH', { detail: { found: parsed._version, expected: 1 } });
    return null;
  }

  log(WF, 'PERSISTENCE_LOADED', { detail: { filePath } });
  return parsed;
}

function atomicWrite(snapshot) {
  if (!filePath) return;
  const tmpPath = filePath + '.tmp';
  const data = { _version: 1, ...snapshot, _savedAt: new Date().toISOString() };
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function save(stateSnapshot) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      atomicWrite(stateSnapshot);
      log(WF, 'PERSISTENCE_SAVED', { detail: { filePath } });
    } catch (err) {
      log(WF, 'PERSISTENCE_SAVE_ERROR', { detail: { error: err.message } });
    }
    debounceTimer = null;
  }, 2000);
}

function flush(stateSnapshot) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  try {
    atomicWrite(stateSnapshot);
    log(WF, 'PERSISTENCE_FLUSHED', { detail: { filePath } });
  } catch (err) {
    log(WF, 'PERSISTENCE_FLUSH_ERROR', { detail: { error: err.message } });
  }
}

function markDirty() {
  if (!getState) return;
  // Defer snapshot to the debounced callback — don't serialize on every state mutation
  if (debounceTimer) return; // already scheduled
  debounceTimer = setTimeout(() => {
    try {
      const snapshot = getState();
      atomicWrite(snapshot);
      log(WF, 'PERSISTENCE_SAVED', { detail: { filePath } });
    } catch (err) {
      log(WF, 'PERSISTENCE_SAVE_ERROR', { detail: { error: err.message } });
    }
    debounceTimer = null;
  }, 2000);
}

module.exports = { init, load, save, flush, markDirty, getState };

// Allow index.js to set the getState callback
Object.defineProperty(module.exports, 'getState', {
  set(fn) { getState = fn; },
  get() { return getState; },
  enumerable: true,
  configurable: true,
});

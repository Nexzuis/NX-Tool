const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

// Intercept require('./logger') so persistence.js can load without the real logger
const originalResolve = Module._resolveFilename;
const fakeLoggerPath = path.join(__dirname, '_fake_logger.js');

// Create a fake logger module
fs.writeFileSync(fakeLoggerPath, 'module.exports = { log() {} };');

describe('persistence', () => {
  let tmpDir;
  let stateFile;
  let persistence;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-persist-test-'));
    stateFile = path.join(tmpDir, 'data', 'state.json');

    // Clear require cache so persistence.js gets a fresh instance
    const persistPath = path.resolve(__dirname, '..', 'persistence.js');
    delete require.cache[persistPath];

    // Patch Module._resolveFilename to redirect './logger' to our fake
    Module._resolveFilename = function (request, parent, ...rest) {
      if (request === './logger' && parent && parent.filename && parent.filename.includes('persistence.js')) {
        return fakeLoggerPath;
      }
      return originalResolve.call(this, request, parent, ...rest);
    };

    persistence = require('../persistence');
  });

  afterEach(() => {
    Module._resolveFilename = originalResolve;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('save and load round-trip', () => {
    persistence.init(stateFile);

    const snapshot = {
      activeIncidents: { cam1: { type: 'offline', startedAt: '2026-01-01T00:00:00Z' } },
      lastSummaries: { wf02: { total: 5 } },
      serverHealth: { cpu: 45, ram: 60 },
      analyticsStatuses: { cam2: { status: 'healthy' } },
      analyticsSuppressed: {},
      analyticsStaleAlerts: {},
      analyticsRestartedAt: {},
      cameraStatuses: { cam1: 'Offline', cam2: 'Online' },
    };

    // Use flush for immediate write (no debounce)
    persistence.flush(snapshot);

    const loaded = persistence.load();
    assert.ok(loaded, 'load should return an object');
    assert.strictEqual(loaded._version, 1);
    assert.deepStrictEqual(loaded.activeIncidents, snapshot.activeIncidents);
    assert.deepStrictEqual(loaded.lastSummaries, snapshot.lastSummaries);
    assert.deepStrictEqual(loaded.serverHealth, snapshot.serverHealth);
    assert.deepStrictEqual(loaded.cameraStatuses, snapshot.cameraStatuses);
  });

  it('load returns null for missing file', () => {
    persistence.init(path.join(tmpDir, 'nonexistent', 'state.json'));
    const result = persistence.load();
    assert.strictEqual(result, null);
  });

  it('load returns null for corrupt JSON', () => {
    persistence.init(stateFile);
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, '{not valid json!!!', 'utf8');
    const result = persistence.load();
    assert.strictEqual(result, null);
  });

  it('load returns null for wrong version', () => {
    persistence.init(stateFile);
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ _version: 99, data: 'test' }), 'utf8');
    const result = persistence.load();
    assert.strictEqual(result, null);
  });

  it('flush writes immediately', () => {
    persistence.init(stateFile);

    const snapshot = { testKey: 'testValue' };
    persistence.flush(snapshot);

    // File should exist immediately (no debounce)
    assert.ok(fs.existsSync(stateFile), 'state file should exist after flush');
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.strictEqual(raw._version, 1);
    assert.strictEqual(raw.testKey, 'testValue');
    assert.ok(raw._savedAt, 'should have _savedAt timestamp');
  });
});

// Clean up fake logger on exit
process.on('exit', () => {
  try { fs.unlinkSync(fakeLoggerPath); } catch { /* ignore */ }
});

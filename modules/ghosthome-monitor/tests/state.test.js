'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// state.js uses module-level Maps, so we need to clear between tests.
// We can't easily reset module state, but we can test the public API.
const state = require('../state');

describe('state.js — lastSummary', () => {
  it('setLastSummary / getLastSummary round-trips', () => {
    const data = { total: 5, healthy: 4 };
    state.setLastSummary('WF-TEST', data);
    const result = state.getLastSummary('WF-TEST');
    assert.equal(result.total, 5);
    assert.equal(result.healthy, 4);
    assert.ok(result.updatedAt, 'should have updatedAt timestamp');
  });

  it('getLastSummary returns null for unknown workflow', () => {
    assert.equal(state.getLastSummary('WF-NONEXISTENT'), null);
  });
});

describe('state.js — activeIncidents', () => {
  const TEST_DEVICE = 'test-device-001';

  beforeEach(() => {
    state.clearActiveIncident(TEST_DEVICE);
  });

  it('setActiveIncident / getActiveIncidents round-trips', () => {
    state.setActiveIncident(TEST_DEVICE, { reason: 'offline' });
    const incidents = state.getActiveIncidents();
    assert.ok(incidents[TEST_DEVICE], 'incident should exist');
    assert.equal(incidents[TEST_DEVICE].reason, 'offline');
    assert.ok(incidents[TEST_DEVICE].startedAt, 'should have startedAt');
  });

  it('hasActiveIncident returns true when incident exists', () => {
    state.setActiveIncident(TEST_DEVICE, { reason: 'test' });
    assert.equal(state.hasActiveIncident(TEST_DEVICE), true);
  });

  it('hasActiveIncident returns false when no incident', () => {
    assert.equal(state.hasActiveIncident('nonexistent-device'), false);
  });

  it('clearActiveIncident removes the incident', () => {
    state.setActiveIncident(TEST_DEVICE, { reason: 'test' });
    state.clearActiveIncident(TEST_DEVICE);
    assert.equal(state.hasActiveIncident(TEST_DEVICE), false);
  });
});

describe('state.js — analytics status', () => {
  const DEV = 'analytics-test-001';

  beforeEach(() => {
    state.clearAnalyticsStatus(DEV);
  });

  it('setAnalyticsStatus / getAnalyticsStatus round-trips', () => {
    state.setAnalyticsStatus(DEV, 'healthy');
    const result = state.getAnalyticsStatus(DEV);
    assert.equal(result.status, 'healthy');
    assert.ok(result.updatedAt);
  });

  it('getAnalyticsStatus returns null for unknown device', () => {
    assert.equal(state.getAnalyticsStatus('nonexistent'), null);
  });

  it('clearAnalyticsStatus removes the entry', () => {
    state.setAnalyticsStatus(DEV, 'stale');
    state.clearAnalyticsStatus(DEV);
    assert.equal(state.getAnalyticsStatus(DEV), null);
  });
});

describe('state.js — camera status', () => {
  it('setCameraStatus / getCameraStatus round-trips', () => {
    state.setCameraStatus('cam-001', 'Online');
    assert.equal(state.getCameraStatus('cam-001'), 'Online');
  });

  it('getCameraStatus returns null for unknown device', () => {
    assert.equal(state.getCameraStatus('cam-nonexistent'), null);
  });
});

describe('state.js — suppression', () => {
  const DEV = 'suppress-test-001';

  beforeEach(() => {
    state.clearSuppressed(DEV);
  });

  it('setSuppressed / getSuppressed round-trips', () => {
    state.setSuppressed(DEV, 3);
    const result = state.getSuppressed(DEV);
    assert.equal(result.count, 3);
    assert.ok(result.since);
  });

  it('getSuppressed returns null for unknown device', () => {
    assert.equal(state.getSuppressed('nonexistent'), null);
  });

  it('clearSuppressed removes the entry', () => {
    state.setSuppressed(DEV, 4);
    state.clearSuppressed(DEV);
    assert.equal(state.getSuppressed(DEV), null);
  });

  it('getAllSuppressed returns all suppressed devices', () => {
    state.setSuppressed('sup-a', 3);
    state.setSuppressed('sup-b', 5);
    const all = state.getAllSuppressed();
    assert.equal(all['sup-a'].count, 3);
    assert.equal(all['sup-b'].count, 5);
    // cleanup
    state.clearSuppressed('sup-a');
    state.clearSuppressed('sup-b');
  });
});

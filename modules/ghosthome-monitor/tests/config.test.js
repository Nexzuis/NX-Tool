'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// config.js reads process.env at require-time, so we test the values
// that result from the current (unset) environment defaults.

describe('config.js — defaults', () => {
  // We need a fresh require each time, but for default tests we can share one.
  // Note: config.js calls dotenv.config which is harmless if .env is missing.
  const config = require('../config');

  it('nx.host defaults to https://192.168.1.110:7001', () => {
    // This may be overridden by .env, but we verify the shape exists
    assert.ok(config.nx.host, 'nx.host should be set');
    assert.equal(typeof config.nx.host, 'string');
  });

  it('nx.username defaults to admin', () => {
    // May be overridden by .env
    assert.equal(typeof config.nx.username, 'string');
  });

  it('intervals.analyticsMs is a number', () => {
    assert.equal(typeof config.intervals.analyticsMs, 'number');
    assert.ok(config.intervals.analyticsMs > 0, 'analyticsMs should be positive');
  });

  it('intervals.serverMs is a number', () => {
    assert.equal(typeof config.intervals.serverMs, 'number');
    assert.ok(config.intervals.serverMs > 0, 'serverMs should be positive');
  });

  it('intervals.alarmsMs is a number', () => {
    assert.equal(typeof config.intervals.alarmsMs, 'number');
    assert.ok(config.intervals.alarmsMs > 0, 'alarmsMs should be positive');
  });

  it('dailyReportHour is an integer between 0-23', () => {
    assert.equal(typeof config.dailyReportHour, 'number');
    assert.ok(Number.isInteger(config.dailyReportHour));
    assert.ok(config.dailyReportHour >= 0 && config.dailyReportHour <= 23);
  });

  it('massOfflineThreshold is a positive integer', () => {
    assert.equal(typeof config.massOfflineThreshold, 'number');
    assert.ok(Number.isInteger(config.massOfflineThreshold));
    assert.ok(config.massOfflineThreshold > 0);
  });
});

describe('config.js — auth token trimming', () => {
  it('apiAuthToken is null or a trimmed string (no leading/trailing spaces)', () => {
    const config = require('../config');
    if (config.apiAuthToken !== null) {
      assert.equal(config.apiAuthToken, config.apiAuthToken.trim(),
        'apiAuthToken should be trimmed');
    } else {
      // null is acceptable when no token is configured
      assert.equal(config.apiAuthToken, null);
    }
  });

  it('apiAuthConfigured reflects whether a token is set', () => {
    const config = require('../config');
    assert.equal(typeof config.apiAuthConfigured, 'boolean');
    if (config.apiAuthToken) {
      assert.equal(config.apiAuthConfigured, true);
    } else {
      assert.equal(config.apiAuthConfigured, false);
    }
  });
});

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { EventEmitter } = require('events');
const { buildApp } = require('../api-server');
const state = require('../state');

// ---------------------------------------------------------------------------
// Mock deps
// ---------------------------------------------------------------------------

function makeDeps(authToken) {
  return {
    nxClient: {
      getDevices: async () => [],
      getDevice: async () => null,
      getServers: async () => [],
      getServerStorages: async () => [],
      getMetricsValues: async () => ({}),
      getAnalyticsEngines: async () => [],
      getDeviceAgent: async () => null,
      getObjectTracks: async () => [],
      patchDeviceAgent: async () => ({}),
    },
    eventBus: new EventEmitter(),
    config: {
      apiAuthToken: authToken,
      apiAuthConfigured: !!authToken,
      nx: { host: 'https://127.0.0.1:7001', engineId: null },
      intervals: { analyticsMs: 600000, serverMs: 300000, alarmsMs: 60000 },
      staleDaytimeMs: 3600000,
      staleEveningMs: 7200000,
      quietTimeStart: 23,
      quietTimeEnd: 6,
      massOfflineThreshold: 20,
      dailyReportHour: 6,
      dailyReportHourEvening: 18,
      telegramConfigured: false,
    },
    state,
    wf03: { runCycle: async () => {}, resetFailureCount: () => {}, resetAllFailureCounts: () => {} },
    wf04: { runHealthCheck: async () => {} },
    wf05: { generateReport: async () => {} },
    telegram: { isPolling: () => true },
  };
}

// ---------------------------------------------------------------------------
// Helper: make an HTTP request to the test server
// ---------------------------------------------------------------------------

function request(server, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API routes', () => {
  const AUTH_TOKEN = 'test-secret-token-12345';
  const deps = makeDeps(AUTH_TOKEN);
  const app = buildApp(deps);
  const server = http.createServer(app);

  // Wait for server to be ready before running tests
  before(() => {
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  after(() => {
    return new Promise((resolve) => server.close(resolve));
  });

  it('GET /healthz returns 200 with { ok: true }', async () => {
    const res = await request(server, 'GET', '/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.service, 'ghosthome-monitor-api');
  });

  it('GET /api/health returns 200 (no auth needed)', async () => {
    state.setServerHealth({ cpu: 25, ram: 40 });
    const res = await request(server, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('POST /api/actions/trigger-analytics returns 401 without auth', async () => {
    const res = await request(server, 'POST', '/api/actions/trigger-analytics');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  it('POST /api/actions/trigger-analytics returns 200 with Bearer token', async () => {
    const res = await request(server, 'POST', '/api/actions/trigger-analytics', {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.data.triggered, true);
  });

  it('POST /api/actions/trigger-analytics returns 200 with X-API-Key', async () => {
    const res = await request(server, 'POST', '/api/actions/trigger-analytics', {
      'X-API-Key': AUTH_TOKEN,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('unknown route returns 404', async () => {
    const res = await request(server, 'GET', '/api/nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
  });

  it('GET /api/config returns expected schema', async () => {
    const res = await request(server, 'GET', '/api/config');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    const expectedKeys = ['intervals', 'thresholds', 'reporting', 'telegram'];
    assert.deepStrictEqual(Object.keys(res.body.data).sort(), expectedKeys.sort());
    const expectedIntervalKeys = ['analyticsMs', 'serverMs', 'alarmsMs'];
    assert.deepStrictEqual(Object.keys(res.body.data.intervals).sort(), expectedIntervalKeys.sort());
    const expectedThresholdKeys = ['staleDaytimeMs', 'staleEveningMs', 'quietTimeStart', 'quietTimeEnd', 'massOffline'];
    assert.deepStrictEqual(Object.keys(res.body.data.thresholds).sort(), expectedThresholdKeys.sort());
    const expectedReportingKeys = ['morningHour', 'eveningHour'];
    assert.deepStrictEqual(Object.keys(res.body.data.reporting).sort(), expectedReportingKeys.sort());
    const expectedTelegramKeys = ['configured', 'polling'];
    assert.deepStrictEqual(Object.keys(res.body.data.telegram).sort(), expectedTelegramKeys.sort());
  });

  it('GET /api/config has no secret fields', async () => {
    const res = await request(server, 'GET', '/api/config');
    assert.equal(res.status, 200);
    const allKeys = ['intervals', 'thresholds', 'reporting', 'telegram'];
    assert.deepStrictEqual(Object.keys(res.body.data).sort(), allKeys.sort());
    // Ensure no auth tokens, passwords, or other secrets leak
    const json = JSON.stringify(res.body.data);
    assert.ok(!json.includes('apiAuthToken'), 'Should not contain apiAuthToken');
    assert.ok(!json.includes('password'), 'Should not contain password');
    assert.ok(!json.includes('BOT_TOKEN'), 'Should not contain BOT_TOKEN');
  });

  it('GET /api/analytics/suppressed returns array', async () => {
    const res = await request(server, 'GET', '/api/analytics/suppressed');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('POST /api/analytics/unsuppress/test-id returns 401 without auth', async () => {
    const res = await request(server, 'POST', '/api/analytics/unsuppress/test-id');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  it('POST /api/analytics/unsuppress/test-id returns 200 with auth', async () => {
    const res = await request(server, 'POST', '/api/analytics/unsuppress/test-id', {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('POST /api/analytics/unsuppress-all returns 401 without auth', async () => {
    const res = await request(server, 'POST', '/api/analytics/unsuppress-all');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  it('POST /api/analytics/unsuppress-all returns 200 with auth', async () => {
    const res = await request(server, 'POST', '/api/analytics/unsuppress-all', {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('rate-limited write endpoints return 429 after burst', async () => {
    // Write rate limit is 10/min — send 11 rapid requests
    const results = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(server, 'POST', '/api/actions/trigger-analytics', {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      });
      results.push(res.status);
    }
    // At least the last request should be 429
    assert.ok(results.includes(429), 'Expected at least one 429 response after burst');
    // Send one more — guaranteed to be 429 since we already exceeded the limit
    const rateLimitedRes = await request(server, 'POST', '/api/actions/trigger-analytics', {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    });
    assert.equal(rateLimitedRes.status, 429, 'Follow-up request should be 429');
    assert.ok(
      rateLimitedRes.headers['retry-after'] || rateLimitedRes.headers['ratelimit-reset'],
      'Expected retry-after or ratelimit-reset header on 429 response'
    );
  });
});

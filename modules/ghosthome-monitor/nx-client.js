const axios = require('axios');
const https = require('https');
const WebSocket = require('ws');

// ── NX API Request Throttle [NX-01] ──────────────────────────────────────────
// Limits all NX API requests regardless of source (workflows + AI tools).
// Max 5 concurrent, max 20 per 5-second window, min 100ms between requests.

const MAX_CONCURRENT = 5;
const BURST_LIMIT = 20;
const BURST_WINDOW_MS = 5000;
const MIN_INTERVAL_MS = 100;

class NxThrottle {
  constructor() {
    this.active = 0;
    this.queue = [];
    this.recentTimestamps = [];
    this.lastRequestTime = 0;
  }

  _isBurstLimited() {
    const cutoff = Date.now() - BURST_WINDOW_MS;
    this.recentTimestamps = this.recentTimestamps.filter(t => t > cutoff);
    return this.recentTimestamps.length >= BURST_LIMIT;
  }

  async acquire() {
    while (this.active >= MAX_CONCURRENT || this._isBurstLimited()) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS));
    }
    // Enforce minimum interval between requests
    const sinceLastRequest = Date.now() - this.lastRequestTime;
    if (sinceLastRequest < MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - sinceLastRequest));
    }
    this.active++;
    this.lastRequestTime = Date.now();
    this.recentTimestamps.push(Date.now());
  }

  release() {
    this.active = Math.max(0, this.active - 1);
  }
}

// ── Short-lived read cache [NX-13] ──────────────────────────────────────────
const CACHE_TTL_MS = 5000;
const readCache = new Map(); // url → { data, expiry }

class NxClient {
  constructor(config) {
    this.host = config.host;
    this.username = config.username;
    this.password = config.password;
    this.token = null;
    const allowInsecureTls = process.env.ALLOW_INSECURE_TLS === 'true';
    this.httpsAgent = new https.Agent({ rejectUnauthorized: !allowInsecureTls });
    this.lastError = null;
    this.throttle = new NxThrottle();
    this.authPromise = null; // [NX-03] Auth mutex
    this.http = axios.create({
      baseURL: this.host,
      httpsAgent: this.httpsAgent,
      timeout: 30000,
    });
  }

  async authenticate() {
    // [NX-03] Auth mutex — only one auth request at a time
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      try {
        const res = await this.http.post('/rest/v4/login/sessions', {
          username: this.username,
          password: this.password,
        });
        if (!res.data || !res.data.token) {
          throw new Error('Auth response missing token field');
        }
        this.token = res.data.token;
        return this.token;
      } catch (err) {
        console.error('[NxClient] Authentication failed:', err.message);
        throw err;
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  _headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async _request(method, url, data = null) {
    // [NX-01] Throttle all requests
    await this.throttle.acquire();

    const doRequest = async () => {
      const opts = {
        method,
        url,
        headers: this._headers(),
      };
      if (data) opts.data = data;
      return this.http(opts);
    };

    try {
      const res = await doRequest();
      this.lastError = null;
      return res.data;
    } catch (err) {
      // 401 → re-authenticate once and retry [NX-03] via mutex
      if (err.response && err.response.status === 401) {
        try {
          await this.authenticate();
          const res = await doRequest();
          this.lastError = null;
          return res.data;
        } catch (retryErr) {
          this.lastError = { message: retryErr.message, status: retryErr.response?.status ?? null };
          console.error(`[NxClient] Retry failed for ${method} ${url}:`, retryErr.message);
          return null;
        }
      }

      const status = err.response?.status ?? null;
      this.lastError = { message: err.message, status };

      // 404 → resource genuinely doesn't exist (e.g. no device agent)
      if (status === 404) {
        return null;
      }

      // 4xx/5xx server errors and network failures → log and return null
      // Callers that need to distinguish should check nxClient.lastError
      console.error(`[NxClient] ${method} ${url} failed:`, err.message);
      return null;
    } finally {
      this.throttle.release();
    }
  }

  /**
   * Cached GET request [NX-13] — 5s TTL for frequently-called read endpoints.
   * Reduces duplicate requests when AI tools and workflows overlap.
   */
  async _cachedGet(url) {
    const cached = readCache.get(url);
    if (cached && cached.expiry > Date.now()) return cached.data;
    const data = await this._request('GET', url);
    if (data) {
      readCache.set(url, { data, expiry: Date.now() + CACHE_TTL_MS });
    }
    return data;
  }

  async getServers() {
    return this._cachedGet('/rest/v4/servers');
  }

  async getServerRuntimeInfo(serverId) {
    return this._request('GET', `/rest/v4/servers/${serverId}/runtimeInfo`);
  }

  async getServerStorages(serverId) {
    return this._request('GET', `/rest/v4/servers/${serverId}/storages`);
  }

  async restartServer(serverId) {
    // Restart requires a fresh auth session
    await this.authenticate();
    return this._request('POST', `/rest/v4/servers/${serverId}/restart`);
  }

  async getDevices() {
    return this._cachedGet('/rest/v4/devices');
  }

  async getDevice(deviceId) {
    return this._request('GET', `/rest/v4/devices/${deviceId}`);
  }

  async getMetricsAlarms() {
    return this._request('GET', '/rest/v4/metrics/alarms');
  }

  async getMetricsValues() {
    return this._request('GET', '/rest/v4/metrics/values');
  }

  async getAnalyticsEngines() {
    return this._cachedGet('/rest/v4/analytics/engines');
  }

  async getDeviceAgents(engineId) {
    return this._request('GET', `/rest/v4/analytics/engines/${engineId}/deviceAgents`);
  }

  async getDeviceAgent(engineId, agentId) {
    return this._request('GET', `/rest/v4/analytics/engines/${engineId}/deviceAgents/${agentId}`);
  }

  async patchDeviceAgent(engineId, agentId, body) {
    return this._request('PATCH', `/rest/v4/analytics/engines/${engineId}/deviceAgents/${agentId}`, body);
  }

  async getObjectTracks(deviceId, startTimeMs) {
    const params = new URLSearchParams();
    if (deviceId) params.set('deviceId', deviceId);
    if (startTimeMs) params.set('startTimeMs', String(startTimeMs));
    params.set('sortOrder', 'desc');
    params.set('limit', '1');
    return this._request('GET', `/rest/v4/analytics/objectTracks?${params.toString()}`);
  }

  async getEventsLog(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `/rest/v4/events/log?${qs}` : '/rest/v4/events/log';
    return this._request('GET', url);
  }

  // ── Tier 1 read methods for AI tools [UNVERIFIED — must live-test] ─────────

  async getEventRules() {
    return this._request('GET', '/rest/v4/events/rules');
  }

  async getUsers() {
    return this._request('GET', '/rest/v4/users');
  }

  async getUserGroups() {
    return this._request('GET', '/rest/v4/userGroups');
  }

  async getLayouts() {
    return this._request('GET', '/rest/v4/layouts');
  }

  async getSiteInfo() {
    return this._request('GET', '/rest/v4/site/info');
  }

  async getLicenses() {
    return this._request('GET', '/rest/v4/licenses');
  }

  async getBookmarks(deviceId) {
    if (deviceId) {
      return this._request('GET', `/rest/v4/devices/${deviceId}/bookmarks`);
    }
    // No /bookmarks root — use wildcard to get all bookmarks across devices
    return this._request('GET', '/rest/v4/devices/*/bookmarks');
  }

  async getStorageForecast(serverId) {
    return this._request('GET', `/rest/v4/servers/${serverId}/storageForecast`);
  }

  // ── Tier 2 write methods for AI tools (Phase 2) [UNVERIFIED — must live-test] ─

  // Event Rules CRUD
  async getEventRule(ruleId) {
    return this._request('GET', `/rest/v4/events/rules/${ruleId}`);
  }

  async createEventRule(ruleData) {
    return this._request('POST', '/rest/v4/events/rules', ruleData);
  }

  async updateEventRule(ruleId, ruleData) {
    return this._request('PATCH', `/rest/v4/events/rules/${ruleId}`, ruleData);
  }

  async deleteEventRule(ruleId) {
    return this._request('DELETE', `/rest/v4/events/rules/${ruleId}`);
  }

  // Software Triggers
  async getTriggers() {
    return this._request('GET', '/rest/v4/events/triggers');
  }

  async activateTrigger(triggerId, deviceId, state) {
    // POST /rest/v4/events/triggers creates a trigger event (not /activate)
    return this._request('POST', '/rest/v4/events/triggers', {
      triggerId,
      deviceId,
      state: state || 'started',
    });
  }

  // Event Acknowledgement
  async acknowledgeEvent(eventData) {
    return this._request('POST', '/rest/v4/events/acknowledges', eventData);
  }

  // Device Settings
  async updateDevice(deviceId, settings) {
    return this._request('PATCH', `/rest/v4/devices/${deviceId}`, settings);
  }

  // Bookmark CRUD
  async createBookmark(deviceId, bookmarkData) {
    return this._request('POST', `/rest/v4/devices/${deviceId}/bookmarks`, bookmarkData);
  }

  // User CRUD
  async createUser(userData) {
    return this._request('POST', '/rest/v4/users', userData);
  }

  async updateUser(userId, userData) {
    return this._request('PATCH', `/rest/v4/users/${userId}`, userData);
  }

  async deleteUser(userId) {
    return this._request('DELETE', `/rest/v4/users/${userId}`);
  }

  // User Group CRUD
  async createUserGroup(groupData) {
    return this._request('POST', '/rest/v4/userGroups', groupData);
  }

  async updateUserGroup(groupId, groupData) {
    return this._request('PATCH', `/rest/v4/userGroups/${groupId}`, groupData);
  }

  async deleteUserGroup(groupId) {
    return this._request('DELETE', `/rest/v4/userGroups/${groupId}`);
  }

  // Layout CRUD
  async createLayout(layoutData) {
    return this._request('POST', '/rest/v4/layouts', layoutData);
  }

  async updateLayout(layoutId, layoutData) {
    return this._request('PATCH', `/rest/v4/layouts/${layoutId}`, layoutData);
  }

  async deleteLayout(layoutId) {
    return this._request('DELETE', `/rest/v4/layouts/${layoutId}`);
  }

  // Storage update
  async updateStorage(serverId, storageId, data) {
    return this._request('PATCH', `/rest/v4/servers/${serverId}/storages/${storageId}`, data);
  }

  // PTZ
  async getPtzPresets(deviceId) {
    return this._request('GET', `/rest/v4/devices/${deviceId}/ptz/presets`);
  }

  async activatePtzPreset(deviceId, presetId) {
    return this._request('POST', `/rest/v4/devices/${deviceId}/ptz/presets/${presetId}/activate`);
  }

  async ptzMove(deviceId, moveData) {
    return this._request('POST', `/rest/v4/devices/${deviceId}/ptz/move`, moveData);
  }

  async ptzStop(deviceId) {
    return this._request('DELETE', `/rest/v4/devices/${deviceId}/ptz/move`);
  }

  // Database Backup
  async createDbBackup(serverId) {
    return this._request('POST', `/rest/v4/servers/${serverId}/dbBackups`);
  }

  async getDbBackups(serverId) {
    return this._request('GET', `/rest/v4/servers/${serverId}/dbBackups`);
  }

  // Site Settings
  async getSiteSettings() {
    return this._request('GET', '/rest/v4/site/settings');
  }

  async updateSiteSetting(name, value) {
    // PUT body is the raw JSON value, not wrapped in an object
    return this._request('PUT', `/rest/v4/site/settings/${name}`, value);
  }

  // Analytics Engine Settings
  async getAnalyticsEngineSettings(engineId) {
    return this._request('GET', `/rest/v4/analytics/engines/${engineId}/settings`);
  }

  async updateAnalyticsEngineSettings(engineId, settings) {
    return this._request('PUT', `/rest/v4/analytics/engines/${engineId}/settings`, settings);
  }

  // Cloud sync
  async syncCloud(waitForDone = false) {
    return this._request('POST', '/rest/v4/cloud/sync', { waitForDone });
  }

  async getCloudSyncStatus() {
    return this._request('GET', '/rest/v4/cloud/sync');
  }

  // Device I/O
  async getDeviceIo(deviceId) {
    return this._request('GET', `/rest/v4/devices/${deviceId}/io`);
  }

  // [NX-10] NX Witness version detection
  async detectVersion() {
    const info = await this._request('GET', '/rest/v4/site/info');
    if (info && info.version) {
      this.nxVersion = info.version;
      return info.version;
    }
    // Fallback: try servers endpoint
    const servers = await this.getServers();
    if (servers && Array.isArray(servers) && servers[0]?.version) {
      this.nxVersion = servers[0].version;
      return servers[0].version;
    }
    return null;
  }

  async openWebSocket() {
    // Get a one-time ticket for WebSocket auth (ticket-based URL auth)
    const ticketRes = await this._request('POST', '/rest/v4/login/tickets');
    if (!ticketRes || !ticketRes.token) {
      throw new Error('Failed to get login ticket for WebSocket');
    }

    const allowInsecureTls = process.env.ALLOW_INSECURE_TLS === 'true';
    const wsUrl = this.host.replace(/^https?/, 'wss') + '/jsonrpc?_ticket=' + ticketRes.token;
    const ws = new WebSocket(wsUrl, {
      rejectUnauthorized: !allowInsecureTls,
      maxPayload: 200 * 1024 * 1024, // 200MB — device subscribe returns large payloads
    });
    return ws;
  }

  sendWsSubscribe(ws) {
    // Subscribe to device changes (offline/online/status)
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'rest.v4.devices.subscribe',
      params: {},
    }));
    // Subscribe to server changes (health/status)
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'rest.v4.servers.subscribe',
      params: {},
    }));
  }
}

module.exports = NxClient;

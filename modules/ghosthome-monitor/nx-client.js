const axios = require('axios');
const https = require('https');
const WebSocket = require('ws');

class NxClient {
  constructor(config) {
    this.host = config.host;
    this.username = config.username;
    this.password = config.password;
    this.token = null;
    const allowInsecureTls = process.env.ALLOW_INSECURE_TLS === 'true';
    this.httpsAgent = new https.Agent({ rejectUnauthorized: !allowInsecureTls });
    this.lastError = null;
    this.http = axios.create({
      baseURL: this.host,
      httpsAgent: this.httpsAgent,
      timeout: 30000,
    });
  }

  async authenticate() {
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
    }
  }

  _headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async _request(method, url, data = null) {
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
      // 401 → re-authenticate once and retry
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
    }
  }

  async getServers() {
    return this._request('GET', '/rest/v4/servers');
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
    return this._request('GET', '/rest/v4/devices');
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
    return this._request('GET', '/rest/v4/analytics/engines');
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

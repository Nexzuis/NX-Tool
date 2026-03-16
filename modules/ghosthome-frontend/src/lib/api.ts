const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? '';

/** Build headers for write endpoints, including auth token if configured. */
function getWriteHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }
  return headers;
}

// ── Type definitions ─────────────────────────────────────────────────────────

export interface ServerHealth {
  serverId: string;
  serverName: string;
  nxHost?: string;
  status: string;
  cpuPercent: number | null;
  ramPercent: number | null;
  storageCount: number;
  uptimeS: number | null;
  osInfo: unknown;
  updatedAt: string;
}

export interface Camera {
  id: string;
  name: string;
  status: string;
  url: string;
  physicalId: string;
  model: string;
  vendor: string;
  mac: string;
}

export interface Incident {
  status: string;
  reason: string;
  startedAt: string;
  poleId?: string;
}

export interface WorkflowSummary {
  updatedAt: string;
  [key: string]: unknown;
}

export interface StorageInfo {
  id: string;
  url: string;
  isUsedForWriting: boolean;
  mediaSpaceP: number | null;
  totalSpaceGb: number | null;
  usedSpaceGb: number | null;
}

export interface MetricsSnapshot {
  servers: Record<string, unknown>;
  storages: Record<string, unknown>;
  capturedAt: string;
}

export interface DashboardSummary {
  serverHealth: ServerHealth;
  cameras: {
    total: number;
    online: number;
    offline: number;
  };
  incidentCount: number;
  workflows: Record<string, WorkflowSummary>;
  lastDailyReport: unknown;
}

// ── Timeout constants ────────────────────────────────────────────────────────

const READ_TIMEOUT_MS = 15_000;
const WRITE_TIMEOUT_MS = 30_000;

// ── Rate limit error ─────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  /** Seconds to wait before retrying (from Retry-After header, or default 60) */
  retryAfterS: number;

  constructor(retryAfterS: number = 60) {
    super(`Rate limited — retry after ${retryAfterS}s`);
    this.name = 'RateLimitError';
    this.retryAfterS = retryAfterS;
  }
}

// ── Core fetch helpers ───────────────────────────────────────────────────────

/** Fetch with an AbortController timeout. Throws on timeout or network error. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch<T>(path: string, authenticated = false): Promise<T> {
  const init: RequestInit = {
    // Disable Next.js caching so data is always fresh
    cache: 'no-store',
  };
  if (authenticated) {
    init.headers = getWriteHeaders();
  }
  const res = await fetchWithTimeout(`${API_BASE}${path}`, init, READ_TIMEOUT_MS);

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      throw new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : 60);
    }
    throw new Error(`API error ${res.status} on ${path}`);
  }

  const json = await res.json();
  // Backend wraps all responses in { ok, data, ...meta } — unwrap the envelope
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// ── Endpoint wrappers ────────────────────────────────────────────────────────

export const fetchSummary = (): Promise<DashboardSummary> =>
  apiFetch<DashboardSummary>('/api/summary');

export const fetchCameras = (): Promise<Camera[]> =>
  apiFetch<Camera[]>('/api/cameras');

export const fetchHealth = (): Promise<ServerHealth> =>
  apiFetch<ServerHealth>('/api/health');

export interface IncidentEntry extends Incident {
  deviceId: string;
}

export const fetchIncidents = (): Promise<IncidentEntry[]> =>
  apiFetch<IncidentEntry[]>('/api/incidents');

export const fetchWorkflows = (): Promise<Record<string, WorkflowSummary>> =>
  apiFetch<Record<string, WorkflowSummary>>('/api/workflows');

export const fetchMetrics = (): Promise<MetricsSnapshot> =>
  apiFetch<MetricsSnapshot>('/api/metrics');

export const fetchStorages = (): Promise<StorageInfo[]> =>
  apiFetch<StorageInfo[]>('/api/storages');

export async function triggerAction(action: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/api/actions/${action}`, {
    method: 'POST',
    headers: getWriteHeaders(),
  }, WRITE_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Action "${action}" failed: ${res.status}`);
  }
}

// ── Analytics management ─────────────────────────────────────────────────────

export interface AnalyticsCamera {
  id: string;
  name: string;
  status: string;
  analyticsEnabled: boolean;
  hasAgent: boolean;
}

export const fetchAnalytics = (): Promise<AnalyticsCamera[]> =>
  apiFetch<AnalyticsCamera[]>('/api/analytics');

export async function toggleAnalytics(
  deviceId: string,
  enabled: boolean,
): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/api/analytics/${deviceId}`, {
    method: 'PATCH',
    headers: getWriteHeaders(),
    body: JSON.stringify({ enabled }),
  }, WRITE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
}

export async function bulkToggleAnalytics(
  enabled: boolean,
): Promise<{ success: number; failed: number; total: number }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/analytics/bulk`, {
    method: 'POST',
    headers: getWriteHeaders(),
    body: JSON.stringify({ enabled }),
  }, WRITE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Bulk toggle failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ── Config & suppression ─────────────────────────────────────────────────

export interface RuntimeConfig {
  intervals: {
    analyticsMs: number;
    serverMs: number;
    alarmsMs: number;
  };
  thresholds: {
    staleDaytimeMs: number;
    staleEveningMs: number;
    quietTimeStart: number;
    quietTimeEnd: number;
    massOffline: number;
  };
  reporting: {
    morningHour: number;
    eveningHour: number;
  };
  telegram: {
    configured: boolean;
    polling: boolean;
  };
}

export interface SuppressedCamera {
  deviceId: string;
  count: number;
  since: string;
}

export const fetchConfig = (): Promise<RuntimeConfig> =>
  apiFetch<RuntimeConfig>('/api/config');

export const fetchSuppressed = (): Promise<SuppressedCamera[]> =>
  apiFetch<SuppressedCamera[]>('/api/analytics/suppressed');

export async function unsuppressCamera(
  deviceId: string,
): Promise<{ cleared: boolean; deviceId: string }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/analytics/unsuppress/${deviceId}`,
    { method: 'POST', headers: getWriteHeaders() },
    WRITE_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Unsuppress failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

export async function unsuppressAll(): Promise<{ cleared: number }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/analytics/unsuppress-all`,
    { method: 'POST', headers: getWriteHeaders() },
    WRITE_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Unsuppress-all failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

// ── AI Chat (SSE streaming) [FIX-02] ─────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIConfig {
  enabled: boolean;
  apiKeyRedacted: string;
  model: string;
  maxQueriesPerHour: number;
  monthlyBudgetCap: number;
  estimatedMonthlySpend: number;
  systemPromptOverride: string | null;
  capabilities: {
    read: string[];
    device_management: string[];
    server_admin: string[];
  };
  servers: Array<{ id: string; name: string; host: string; enabled: boolean }>;
  telegram: { enabled: boolean };
  web: { enabled: boolean };
}

/**
 * Stream a chat message via SSE. Returns an AbortController to cancel.
 */
export function streamChat(
  message: string,
  sessionId: string,
  callbacks: {
    onToken: (text: string) => void;
    onToolStart: (name: string) => void;
    onToolEnd: (name: string) => void;
    onDone: (fullMessage: string) => void;
    onError: (message: string) => void;
  },
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: getWriteHeaders(),
    body: JSON.stringify({ message, sessionId }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let errMsg = `API error ${response.status}`;
        try {
          const json = JSON.parse(text);
          errMsg = json.error?.message || errMsg;
        } catch { /* use default */ }
        callbacks.onError(errMsg);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Skip — we parse from data lines
            continue;
          }
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              switch (event.type) {
                case 'token':
                  callbacks.onToken(event.text);
                  break;
                case 'tool_start':
                  callbacks.onToolStart(event.label || event.name);
                  break;
                case 'tool_end':
                  callbacks.onToolEnd(event.name);
                  break;
                case 'done':
                  callbacks.onDone(event.fullMessage);
                  break;
                case 'error':
                  callbacks.onError(event.message);
                  break;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      // If we reach end of stream without a done event, ensure loading clears
      callbacks.onDone('');
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      callbacks.onError(err.message || 'Connection failed');
    });

  return controller;
}

export async function fetchChatHistory(sessionId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/api/chat/history/${sessionId}`, true);
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/api/chat/history/${sessionId}`, {
    method: 'DELETE',
    headers: getWriteHeaders(),
  }, WRITE_TIMEOUT_MS);
}

export const fetchAIConfig = (): Promise<AIConfig> =>
  apiFetch<AIConfig>('/api/ai-config', true);

export async function updateAIConfig(config: Partial<AIConfig> & { apiKey?: string; [key: string]: unknown }): Promise<AIConfig> {
  const res = await fetchWithTimeout(`${API_BASE}/api/ai-config`, {
    method: 'PATCH',
    headers: getWriteHeaders(),
    body: JSON.stringify(config),
  }, WRITE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`AI config update failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

export async function validateAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/ai-config/validate-key`, {
    method: 'POST',
    headers: getWriteHeaders(),
    body: JSON.stringify({ apiKey }),
  }, WRITE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Key validation failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

// ── Auth status ──────────────────────────────────────────────────────────────

export interface AuthStatus {
  configured: boolean;
  methods: string[];
}

export const fetchAuthStatus = (): Promise<AuthStatus> =>
  apiFetch<AuthStatus>('/api/auth/status');

// ── Utility helpers ──────────────────────────────────────────────────────────

/** Format uptime seconds to "Xd Xh Xm" */
export function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

/** Format a percentage (0–100) to a string "XX%" */
export function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value)}%`;
}

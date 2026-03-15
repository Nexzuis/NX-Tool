// ── Event Parser ─────────────────────────────────────────────────────────────
// Converts raw WebSocket messages into human-readable activity feed entries.

export interface ParsedEvent {
  time: string;
  icon: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

/** Format ISO timestamp to HH:MM in SAST */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Johannesburg',
    });
  } catch {
    return '--:--';
  }
}

/** Safe access into nested unknown data */
function get(data: unknown, key: string): unknown {
  if (data && typeof data === 'object' && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key];
  }
  return undefined;
}

function str(val: unknown): string {
  return val != null ? String(val) : '';
}

function num(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

type Parser = (data: unknown) => { message: string; level: ParsedEvent['level'] };

const EVENT_PARSERS: Record<string, Parser> = {
  CONNECTED: () => ({
    message: 'WebSocket connected',
    level: 'info',
  }),

  STATE_SNAPSHOT: (data) => {
    const sh = get(data, 'serverHealth') as Record<string, unknown> | undefined;
    if (sh) {
      const cpu = num(get(sh, 'cpuPercent'));
      const ram = num(get(sh, 'ramPercent'));
      if (cpu !== null && ram !== null) {
        return {
          message: `State snapshot: CPU ${Math.round(cpu)}%, RAM ${Math.round(ram)}%`,
          level: 'info',
        };
      }
    }
    return { message: 'State snapshot received', level: 'info' };
  },

  ESCALATION: (data) => {
    const camera = str(get(data, 'cameraName') ?? get(data, 'deviceName'));
    const reason = str(get(data, 'reason'));
    return {
      message: camera
        ? `Escalation: ${camera}${reason ? ` — ${reason}` : ''}`
        : `Escalation${reason ? `: ${reason}` : ''}`,
      level: 'error',
    };
  },

  CAMERA_OFFLINE: (data) => ({
    message: `Camera offline detected: ${str(get(data, 'cameraName') ?? get(data, 'deviceName') ?? 'unknown')}`,
    level: 'error',
  }),

  CAMERA_RECOVERED: (data) => ({
    message: `Camera recovered: ${str(get(data, 'cameraName') ?? get(data, 'deviceName') ?? 'unknown')}`,
    level: 'info',
  }),

  POLE_UNREACHABLE: (data) => ({
    message: `Pole unreachable: ${str(get(data, 'poleId') ?? get(data, 'host') ?? 'unknown')}`,
    level: 'error',
  }),

  STORAGE_ALERT: (data) => ({
    message: `Storage alert: ${str(get(data, 'message') ?? get(data, 'reason') ?? 'check storage')}`,
    level: 'warn',
  }),

  WARN_CPU: (data) => {
    const cpu = num(get(data, 'cpuPercent') ?? get(data, 'value'));
    return {
      message: cpu !== null ? `High CPU warning: ${Math.round(cpu)}%` : 'High CPU warning',
      level: 'warn',
    };
  },

  WARN_RAM: (data) => {
    const ram = num(get(data, 'ramPercent') ?? get(data, 'value'));
    return {
      message: ram !== null ? `High RAM warning: ${Math.round(ram)}%` : 'High RAM warning',
      level: 'warn',
    };
  },

  CRITICAL_SERVER: (data) => ({
    message: `Critical server alert: ${str(get(data, 'message') ?? get(data, 'reason') ?? 'check server')}`,
    level: 'error',
  }),

  WF03_CYCLE_COMPLETE: (data) => {
    const healthy = num(get(data, 'healthy') ?? get(data, 'healthyCameras'));
    const total = num(get(data, 'total') ?? get(data, 'totalCameras'));
    const restarted = num(get(data, 'restarted'));
    if (healthy !== null && total !== null) {
      return {
        message: `Analytics cycle complete: ${healthy}/${total} healthy${restarted ? `, ${restarted} restarted` : ''}`,
        level: restarted && restarted > 0 ? 'warn' : 'info',
      };
    }
    return { message: 'Analytics cycle complete', level: 'info' };
  },

  POST_RECOVERY_ISSUES: (data) => {
    const count = num(get(data, 'issueCount') ?? get(data, 'count'));
    return {
      message: count !== null
        ? `Post-recovery issues: ${count} problem${count !== 1 ? 's' : ''} found`
        : 'Post-recovery issues detected',
      level: 'warn',
    };
  },

  SERVER_RECOVERED: () => ({
    message: 'Server recovered — all systems nominal',
    level: 'info',
  }),

  DAILY_REPORT: (data) => ({
    message: `Daily report ${str(get(data, 'status') ?? 'sent')}`,
    level: 'info',
  }),

  HEALTH_CHECK_OK: (data) => {
    const cpu = num(get(data, 'cpuPercent'));
    const ram = num(get(data, 'ramPercent'));
    if (cpu !== null && ram !== null) {
      return {
        message: `Health check OK: CPU ${Math.round(cpu)}%, RAM ${Math.round(ram)}%`,
        level: 'info',
      };
    }
    return { message: 'Health check OK', level: 'info' };
  },

  WS_RECONNECTED: () => ({
    message: 'WebSocket reconnected',
    level: 'info',
  }),
};

/**
 * Parse a raw WebSocket message string into a human-readable event.
 * Returns null for messages that can't be parsed at all.
 */
export function parseWsEvent(raw: string, receivedAt?: string): ParsedEvent {
  const time = formatTime(receivedAt ?? new Date().toISOString());

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { time, icon: '●', message: raw.slice(0, 120), level: 'info' };
  }

  const type = str(parsed.type ?? parsed.event ?? 'EVENT').toUpperCase();
  const data = (parsed.data as unknown) ?? parsed;

  // Try exact match first
  const parser = EVENT_PARSERS[type];
  if (parser) {
    const result = parser(data);
    return { time, icon: levelIcon(result.level), ...result };
  }

  // Partial match fallback
  for (const [key, handler] of Object.entries(EVENT_PARSERS)) {
    if (type.includes(key)) {
      const result = handler(data);
      return { time, icon: levelIcon(result.level), ...result };
    }
  }

  // Unknown event — show type name + truncated data
  const summary = typeof data === 'object' && data !== null
    ? JSON.stringify(data).slice(0, 80)
    : str(data).slice(0, 80);
  return {
    time,
    icon: '●',
    message: `${type.toLowerCase().replace(/_/g, ' ')}${summary ? `: ${summary}` : ''}`,
    level: 'info',
  };
}

function levelIcon(level: ParsedEvent['level']): string {
  switch (level) {
    case 'error': return '✕';
    case 'warn': return '▲';
    default: return '●';
  }
}

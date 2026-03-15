'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Settings,
  Server,
  Clock,
  Wifi,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Info,
  Activity,
  Send,
  ShieldOff,
} from 'lucide-react';
import {
  fetchHealth,
  fetchAuthStatus,
  fetchConfig,
  fetchSuppressed,
  unsuppressCamera,
  unsuppressAll,
  formatUptime,
  type ServerHealth,
  type AuthStatus,
  type RuntimeConfig,
  type SuppressedCamera,
} from '@/lib/api';
import { StatusDot } from '@/components/ui/status-dot';
import { Skeleton } from '@/components/ui/skeleton';

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function SectionCard({ title, icon, children, className }: SectionCardProps) {
  return (
    <motion.div
      variants={sectionVariants}
      className={clsx(
        'rounded-xl border border-[#1E1E2E] bg-[#13131A] overflow-hidden',
        className,
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2.5 border-b border-[#1E1E2E] px-5 py-4">
        <span className="text-[#00FF88]">{icon}</span>
        <h2 className="text-sm font-semibold text-[#E0E0E0] tracking-wide uppercase">
          {title}
        </h2>
      </div>
      {/* Card body */}
      <div className="px-5 py-4">{children}</div>
    </motion.div>
  );
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}

function InfoRow({ label, value, mono = false, muted = false }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#1E1E2E] last:border-0">
      <span className="text-sm text-[#6B7280] shrink-0">{label}</span>
      <span
        className={clsx(
          'text-sm text-right break-all',
          mono ? 'font-mono text-[#A0A0B0]' : 'text-[#E0E0E0]',
          muted && 'text-[#6B7280]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert milliseconds to a human-readable string. */
function formatMs(ms: number): string {
  if (ms >= 86_400_000) {
    const d = Math.round(ms / 86_400_000);
    return `${d} day${d !== 1 ? 's' : ''}`;
  }
  if (ms >= 3_600_000) {
    const h = Math.round(ms / 3_600_000);
    return `${h} hour${h !== 1 ? 's' : ''}`;
  }
  if (ms >= 60_000) {
    const m = Math.round(ms / 60_000);
    return `${m} minute${m !== 1 ? 's' : ''}`;
  }
  const s = Math.round(ms / 1_000);
  return `${s} second${s !== 1 ? 's' : ''}`;
}

/** Format hour number to HH:00 */
function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Truncate a UUID-style string for display */
function truncateId(id: string | undefined): string {
  if (!id) return '—';
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Auth status state
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Runtime config state
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Suppressed cameras state
  const [suppressed, setSuppressed] = useState<SuppressedCamera[]>([]);
  const [suppressedLoading, setSuppressedLoading] = useState(true);
  const [unsuppressing, setUnsuppressing] = useState<string | null>(null);
  const [unsuppressingAll, setUnsuppressingAll] = useState(false);

  // Test-connection state
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [suppressedError, setSuppressedError] = useState(false);
  const [unsuppressError, setUnsuppressError] = useState<string | null>(null);

  const loadSuppressed = useCallback(() => {
    setSuppressedLoading(true);
    setSuppressedError(false);
    fetchSuppressed()
      .then(setSuppressed)
      .catch(() => {
        setSuppressed([]);
        setSuppressedError(true);
      })
      .finally(() => setSuppressedLoading(false));
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data);
        setFetchError(false);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));

    fetchAuthStatus()
      .then(setAuthStatus)
      .catch(() => setAuthStatus(null))
      .finally(() => setAuthLoading(false));

    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));

    loadSuppressed();
  }, [loadSuppressed]);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setFetchError(false);
      setTestResult({
        ok: true,
        message: `Connected to ${data?.serverName ?? 'server'}`,
      });
    } catch {
      setFetchError(true);
      setTestResult({ ok: false, message: 'Connection failed' });
    }
    setTesting(false);
  }

  async function handleUnsuppress(deviceId: string) {
    setUnsuppressing(deviceId);
    setUnsuppressError(null);
    try {
      await unsuppressCamera(deviceId);
      loadSuppressed();
    } catch {
      setUnsuppressError('Failed to unsuppress camera. Check auth token or backend connection.');
    }
    setUnsuppressing(null);
  }

  async function handleUnsuppressAll() {
    setUnsuppressingAll(true);
    setUnsuppressError(null);
    try {
      await unsuppressAll();
      loadSuppressed();
    } catch {
      setUnsuppressError('Failed to unsuppress cameras. Check auth token or backend connection.');
    }
    setUnsuppressingAll(false);
  }

  // Derive connection status for StatusDot
  const connectionStatus = loading
    ? 'unknown'
    : fetchError
    ? 'error'
    : 'online';

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4301';

  const wsBase = apiBase.replace(/^http/, 'ws');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <motion.div variants={sectionVariants} className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <Settings size={20} className="text-[#00FF88]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[#E0E0E0] tracking-tight">
            Settings
          </h1>
        </div>
        <p className="text-sm text-[#6B7280]">
          Monitor configuration, connection status, and system information.
        </p>
      </motion.div>

      {/* ── Two-column grid on large screens ────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* ── Section 1: Connection Status ──────────────────── */}
        <SectionCard
          title="NX Witness Server"
          icon={<Server size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            <InfoRow
              label="Host"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-32" />
                ) : (
                  health?.nxHost
                    ? health.nxHost.replace(/^https?:\/\//, '')
                    : health?.serverName
                    ? health.serverName
                    : apiBase.replace(/^https?:\/\//, '')
                )
              }
              mono
            />
            <InfoRow
              label="Status"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-20" />
                ) : (
                  <span className="flex items-center justify-end gap-2">
                    <StatusDot status={connectionStatus} size="sm" />
                    <span
                      className={clsx(
                        'text-sm',
                        fetchError ? 'text-[#EF4444]' : 'text-[#00FF88]',
                      )}
                    >
                      {fetchError ? 'Unreachable' : 'Connected'}
                    </span>
                  </span>
                )
              }
            />
            <InfoRow
              label="Server Name"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-28" />
                ) : (
                  health?.serverName ?? '—'
                )
              }
            />
            <InfoRow
              label="Server ID"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-36" />
                ) : (
                  <span
                    className="font-mono text-[#A0A0B0] text-xs"
                    title={health?.serverId}
                  >
                    {truncateId(health?.serverId)}
                  </span>
                )
              }
            />
          </div>

          {/* Test connection button + result */}
          <div className="mt-4 flex flex-col gap-3">
            <button
              onClick={testConnection}
              disabled={testing}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'border border-[#00FF88]/25 bg-[rgba(0,255,136,0.08)] text-[#00FF88]',
                'transition-all duration-200',
                'hover:bg-[#00FF88]/15 hover:border-[#00FF88]/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,255,136,0.6)] focus-visible:outline-offset-2',
              )}
              aria-label="Test server connection"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={testing ? 'animate-spin' : ''}
              />
              {testing ? 'Testing…' : 'Test Connection'}
            </button>

            {/* Result banner */}
            {testResult !== null && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  testResult.ok
                    ? 'bg-[#22C55E]/10 border border-[#22C55E]/25 text-[#22C55E]'
                    : 'bg-[#EF4444]/10 border border-[#EF4444]/25 text-[#EF4444]',
                )}
                role="status"
                aria-live="polite"
              >
                {testResult.ok ? (
                  <CheckCircle size={14} aria-hidden="true" className="shrink-0" />
                ) : (
                  <XCircle size={14} aria-hidden="true" className="shrink-0" />
                )}
                <span>{testResult.message}</span>
              </motion.div>
            )}
          </div>
        </SectionCard>

        {/* ── Section 2: Polling Intervals (live from config) ── */}
        <SectionCard
          title="Polling Intervals"
          icon={<Clock size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            {configLoading ? (
              <>
                <InfoRow label="Analytics Check" value={<Skeleton height="h-3" className="w-24" />} />
                <InfoRow label="Server Health" value={<Skeleton height="h-3" className="w-24" />} />
                <InfoRow label="Alarms Poll" value={<Skeleton height="h-3" className="w-24" />} />
                <InfoRow label="Daily Report" value={<Skeleton height="h-3" className="w-28" />} />
              </>
            ) : config ? (
              <>
                <InfoRow label="Analytics Check" value={`Every ${formatMs(config.intervals.analyticsMs)}`} />
                <InfoRow label="Server Health" value={`Every ${formatMs(config.intervals.serverMs)}`} />
                <InfoRow label="Alarms Poll" value={`Every ${formatMs(config.intervals.alarmsMs)}`} />
                <InfoRow
                  label="Daily Report"
                  value={`${formatHour(config.reporting.morningHour)} & ${formatHour(config.reporting.eveningHour)} SAST`}
                />
              </>
            ) : (
              <>
                <InfoRow label="Analytics Check" value="Every 30 minutes" />
                <InfoRow label="Server Health" value="Every 5 minutes" />
                <InfoRow label="Alarms Poll" value="Every 60 seconds" />
                <InfoRow label="Daily Report" value="6:00 & 18:00 SAST" />
              </>
            )}
          </div>

          {/* Note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#1E1E2E]/60 px-3 py-2.5">
            <Info
              size={13}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[#6B7280]"
            />
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Intervals are configured via environment variables and take
              effect on next process restart.
            </p>
          </div>
        </SectionCard>

        {/* ── Section 3: Thresholds ────────────────────────────── */}
        <SectionCard
          title="Thresholds"
          icon={<Activity size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            {configLoading ? (
              <>
                <InfoRow label="Stale (Daytime)" value={<Skeleton height="h-3" className="w-20" />} />
                <InfoRow label="Stale (Evening)" value={<Skeleton height="h-3" className="w-20" />} />
                <InfoRow label="Quiet Time" value={<Skeleton height="h-3" className="w-28" />} />
                <InfoRow label="Mass Offline" value={<Skeleton height="h-3" className="w-16" />} />
              </>
            ) : config ? (
              <>
                <InfoRow label="Stale (Daytime)" value={formatMs(config.thresholds.staleDaytimeMs)} />
                <InfoRow label="Stale (Evening)" value={formatMs(config.thresholds.staleEveningMs)} />
                <InfoRow
                  label="Quiet Time"
                  value={`${formatHour(config.thresholds.quietTimeStart)} – ${formatHour(config.thresholds.quietTimeEnd)} SAST`}
                />
                <InfoRow
                  label="Mass Offline"
                  value={`${config.thresholds.massOffline}+ cameras`}
                />
              </>
            ) : (
              <p className="text-sm text-[#6B7280]">Unable to load configuration</p>
            )}
          </div>
        </SectionCard>

        {/* ── Section 4: Telegram ──────────────────────────────── */}
        <SectionCard
          title="Telegram"
          icon={<Send size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            <InfoRow
              label="Configured"
              value={
                configLoading ? (
                  <Skeleton height="h-3" className="w-16" />
                ) : config ? (
                  <span className="flex items-center justify-end gap-2">
                    <StatusDot
                      status={config.telegram.configured ? 'online' : 'warning'}
                      size="sm"
                    />
                    <span
                      className={clsx(
                        'text-sm',
                        config.telegram.configured ? 'text-[#00FF88]' : 'text-[#F97316]',
                      )}
                    >
                      {config.telegram.configured ? 'Yes' : 'No'}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-[#6B7280]">Unknown</span>
                )
              }
            />
            <InfoRow
              label="Polling"
              value={
                configLoading ? (
                  <Skeleton height="h-3" className="w-16" />
                ) : config ? (
                  <span className="flex items-center justify-end gap-2">
                    <StatusDot
                      status={config.telegram.polling ? 'online' : 'unknown'}
                      size="sm"
                    />
                    <span
                      className={clsx(
                        'text-sm',
                        config.telegram.polling ? 'text-[#00FF88]' : 'text-[#6B7280]',
                      )}
                    >
                      {config.telegram.polling ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-[#6B7280]">Unknown</span>
                )
              }
            />
          </div>

          {/* Warning if not configured */}
          {!configLoading && config && !config.telegram.configured && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex items-start gap-2 rounded-lg bg-[#F97316]/10 border border-[#F97316]/20 px-3 py-2.5"
            >
              <Info
                size={13}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[#F97316]"
              />
              <p className="text-xs text-[#F97316]/80 leading-relaxed">
                Telegram notifications are not configured. Set{' '}
                <code className="font-mono text-[#F97316]">TELEGRAM_BOT_TOKEN</code>{' '}
                and{' '}
                <code className="font-mono text-[#F97316]">TELEGRAM_CHAT_ID</code>{' '}
                in the backend{' '}
                <code className="font-mono text-[#F97316]">.env</code>{' '}
                to enable alerts.
              </p>
            </motion.div>
          )}
        </SectionCard>

        {/* ── Section 5: Authentication ─────────────────────── */}
        <SectionCard
          title="Authentication"
          icon={<Shield size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            <InfoRow
              label="Write Protection"
              value={
                authLoading ? (
                  <Skeleton height="h-3" className="w-24" />
                ) : authStatus === null ? (
                  <span className="text-sm text-[#6B7280]">Unable to check</span>
                ) : (
                  <span className="flex items-center justify-end gap-2">
                    <StatusDot
                      status={authStatus.configured ? 'online' : 'warning'}
                      size="sm"
                    />
                    <span
                      className={clsx(
                        'text-sm',
                        authStatus.configured ? 'text-[#00FF88]' : 'text-[#F97316]',
                      )}
                    >
                      {authStatus.configured ? 'Protected' : 'Open'}
                    </span>
                  </span>
                )
              }
            />
            {authStatus && (
              <InfoRow
                label="Accepted Methods"
                value={
                  <span className="font-mono text-[#A0A0B0] text-xs">
                    {authStatus.methods.join(', ')}
                  </span>
                }
              />
            )}
          </div>

          {/* Guidance banner */}
          {!authLoading && authStatus !== null && !authStatus.configured && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex items-start gap-2 rounded-lg bg-[#F97316]/10 border border-[#F97316]/20 px-3 py-2.5"
            >
              <Info
                size={13}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[#F97316]"
              />
              <p className="text-xs text-[#F97316]/80 leading-relaxed">
                Write endpoints are currently unprotected. Set{' '}
                <code className="font-mono text-[#F97316]">API_AUTH_TOKEN</code>{' '}
                in the backend <code className="font-mono text-[#F97316]">.env</code>{' '}
                and match it with{' '}
                <code className="font-mono text-[#F97316]">NEXT_PUBLIC_API_TOKEN</code>{' '}
                in the frontend to enable authentication.
              </p>
            </motion.div>
          )}
        </SectionCard>

        {/* ── Section 6: System Information ─────────────────── */}
        <SectionCard
          title="System Information"
          icon={<Info size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            <InfoRow label="Monitor Version" value="1.0.0" />
            <InfoRow
              label="Uptime"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-20" />
                ) : (
                  formatUptime(health?.uptimeS ?? null)
                )
              }
            />
            <InfoRow
              label="Storage Count"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-12" />
                ) : health?.storageCount != null ? (
                  `${health.storageCount} volume${health.storageCount !== 1 ? 's' : ''}`
                ) : (
                  '—'
                )
              }
            />
            <InfoRow
              label="Last Updated"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-28" />
                ) : health?.updatedAt ? (
                  new Date(health.updatedAt).toLocaleTimeString('en-ZA', {
                    timeZone: 'Africa/Johannesburg',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                ) : (
                  '—'
                )
              }
            />
          </div>
        </SectionCard>

        {/* ── Section 7: API Configuration ──────────────────── */}
        <SectionCard
          title="API Configuration"
          icon={<Wifi size={16} aria-hidden="true" />}
        >
          <div className="flex flex-col">
            <InfoRow
              label="API URL"
              value={
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[#A0A0B0] text-xs">{apiBase}</span>
                  <a
                    href={`${apiBase}/api/health`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6B7280] hover:text-[#00FF88] transition-colors"
                    aria-label="Open API health endpoint in new tab"
                  >
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </span>
              }
            />
            <InfoRow
              label="WebSocket URL"
              value={
                <span className="font-mono text-[#A0A0B0] text-xs">
                  {wsBase}/ws
                </span>
              }
            />
            <InfoRow
              label="API Status"
              value={
                loading ? (
                  <Skeleton height="h-3" className="w-16" />
                ) : (
                  <span className="flex items-center justify-end gap-2">
                    <StatusDot
                      status={fetchError ? 'error' : 'online'}
                      size="sm"
                      pulse={false}
                    />
                    <span
                      className={clsx(
                        'text-sm',
                        fetchError ? 'text-[#EF4444]' : 'text-[#00FF88]',
                      )}
                    >
                      {fetchError ? 'Unavailable' : 'Healthy'}
                    </span>
                  </span>
                )
              }
            />
          </div>
        </SectionCard>

        {/* ── Section 8: Suppression Management ────────────── */}
        <SectionCard
          title="Suppression Management"
          icon={<ShieldOff size={16} aria-hidden="true" />}
        >
          {suppressedError && (
            <div className="flex items-center gap-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25 px-3 py-2.5 mb-3" role="alert">
              <XCircle size={14} aria-hidden="true" className="text-[#EF4444] shrink-0" />
              <p className="text-sm text-[#EF4444]">Could not load suppressed cameras. Check backend connection.</p>
            </div>
          )}
          {unsuppressError && (
            <div className="flex items-center gap-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25 px-3 py-2.5 mb-3" role="alert">
              <XCircle size={14} aria-hidden="true" className="text-[#EF4444] shrink-0" />
              <p className="text-sm text-[#EF4444]">{unsuppressError}</p>
            </div>
          )}
          {suppressedLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton height="h-4" className="w-full" />
              <Skeleton height="h-4" className="w-3/4" />
            </div>
          ) : suppressed.length === 0 && !suppressedError ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#1E1E2E]/60 px-3 py-3">
              <CheckCircle size={14} aria-hidden="true" className="text-[#22C55E] shrink-0" />
              <p className="text-sm text-[#6B7280]">
                No suppressed cameras. All cameras are eligible for analytics restart.
              </p>
            </div>
          ) : suppressed.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Suppressed camera list */}
              <div className="flex flex-col divide-y divide-[#1E1E2E]">
                {suppressed.map((cam) => (
                  <div
                    key={cam.deviceId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-xs text-[#A0A0B0] truncate" title={cam.deviceId}>
                        {truncateId(cam.deviceId)}
                      </span>
                      <span className="text-xs text-[#6B7280]">
                        {cam.count} failure{cam.count !== 1 ? 's' : ''} since{' '}
                        {new Date(cam.since).toLocaleDateString('en-ZA', {
                          timeZone: 'Africa/Johannesburg',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnsuppress(cam.deviceId)}
                      disabled={unsuppressing === cam.deviceId}
                      className={clsx(
                        'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                        'border border-[#F97316]/25 bg-[rgba(249,115,22,0.08)] text-[#F97316]',
                        'transition-all duration-200',
                        'hover:bg-[#F97316]/15 hover:border-[#F97316]/50',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(249,115,22,0.6)] focus-visible:outline-offset-2',
                      )}
                    >
                      {unsuppressing === cam.deviceId ? (
                        <RefreshCw size={12} aria-hidden="true" className="animate-spin" />
                      ) : null}
                      Unsuppress
                    </button>
                  </div>
                ))}
              </div>

              {/* Unsuppress All button */}
              <button
                onClick={handleUnsuppressAll}
                disabled={unsuppressingAll}
                className={clsx(
                  'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                  'border border-[#EF4444]/25 bg-[rgba(239,68,68,0.08)] text-[#EF4444]',
                  'transition-all duration-200',
                  'hover:bg-[#EF4444]/15 hover:border-[#EF4444]/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(239,68,68,0.6)] focus-visible:outline-offset-2',
                )}
              >
                {unsuppressingAll && (
                  <RefreshCw size={14} aria-hidden="true" className="animate-spin" />
                )}
                Unsuppress All ({suppressed.length})
              </button>
            </div>
          ) : null}
        </SectionCard>
      </div>

      {/* ── Section 9: About (full width) ───────────────────── */}
      <SectionCard
        title="About"
        icon={<Info size={16} aria-hidden="true" />}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold text-[#E0E0E0]">
              Ghosthome Monitor
            </span>
            <span className="rounded-full bg-[#00FF88]/10 border border-[#00FF88]/20 px-2 py-0.5 text-xs font-medium text-[#00FF88]">
              v1.0.0
            </span>
          </div>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Infrastructure health monitoring for NX Witness VMS and IP camera
            networks.
          </p>
          <p className="mt-1 text-xs text-[#4B5563]">
            Built for Ghosthome surveillance network — TP-Link VIGI cameras on
            NX Witness.
          </p>
        </div>
      </SectionCard>
    </motion.div>
  );
}

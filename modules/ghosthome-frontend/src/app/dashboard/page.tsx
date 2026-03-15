'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronDown,
  Clock,
  Cpu,
  MemoryStick,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

import { fetchSummary, formatUptime, RateLimitError, type DashboardSummary } from '@/lib/api';
import { useWebSocket, type WsMessage } from '@/hooks/use-websocket';
import { StatCard } from '@/components/ui/stat-card';
import { StatusDot } from '@/components/ui/status-dot';
import { SkeletonCard } from '@/components/ui/skeleton';
import { parseWsEvent, type ParsedEvent } from '@/lib/event-parser';

// ── Animation variants ────────────────────────────────────────────────────────

const pageVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
};

// ── No-motion variants (static, instant render) ──────────────────────────────

const staticVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0 } },
};

const staticPageVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0 } },
};

// ── Workflow metadata ─────────────────────────────────────────────────────────

const WORKFLOW_META = [
  { id: 'WF-01', name: 'WebSocket' },
  { id: 'WF-02', name: 'Camera Offline' },
  { id: 'WF-03', name: 'Analytics' },
  { id: 'WF-04', name: 'Server Health' },
  { id: 'WF-05', name: 'Daily Report' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function workflowStatusDot(
  wfId: string,
  wfData: Record<string, unknown> | undefined,
  wsConnected: boolean,
): 'online' | 'warning' | 'error' | 'unknown' {
  if (wfId === 'WF-01') return wsConnected ? 'online' : 'error';
  if (!wfData) return 'unknown';
  const status = wfData.status ?? wfData.state ?? null;
  if (typeof status === 'string') {
    const s = status.toLowerCase();
    if (s === 'ok' || s === 'healthy' || s === 'running') return 'online';
    if (s === 'warning' || s === 'degraded') return 'warning';
    if (s === 'error' || s === 'failed') return 'error';
  }
  if (wfData.updatedAt) return 'online';
  return 'unknown';
}

function workflowStatusText(
  wfId: string,
  wfData: Record<string, unknown> | undefined,
  wsConnected: boolean,
): string {
  if (wfId === 'WF-01') return wsConnected ? 'Live — subscribed' : 'Reconnecting…';

  if (wfId === 'WF-02') {
    const pending = wfData?.pendingCount ?? wfData?.pending ?? null;
    return pending !== null ? `${String(pending)} cameras in pipeline` : (wfData ? 'Active' : 'No data');
  }

  if (wfId === 'WF-03') {
    const healthy = wfData?.healthyCameras ?? wfData?.healthy ?? null;
    const total = wfData?.totalCameras ?? wfData?.total ?? null;
    return healthy !== null && total !== null
      ? `${String(healthy)}/${String(total)} healthy`
      : (wfData ? 'Running' : 'No data');
  }

  if (wfId === 'WF-04') {
    const cpu = wfData?.cpuPercent ?? null;
    const ram = wfData?.ramPercent ?? null;
    return cpu !== null && ram !== null
      ? `CPU ${Math.round(Number(cpu))}% · RAM ${Math.round(Number(ram))}%`
      : (wfData ? 'Monitoring' : 'No data');
  }

  // WF-05
  if (wfData?.nextRun) return `Next run ${String(wfData.nextRun)}`;
  const lastRun = wfData?.updatedAt ?? wfData?.lastRun ?? null;
  return lastRun ? `Last run ${relativeTime(String(lastRun))}` : (wfData ? 'Scheduled' : 'No data');
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return 'just now';
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

function wfUpdatedAt(wfId: string, wfData: Record<string, unknown> | undefined): string {
  if (wfId === 'WF-01') return '';
  if (!wfData) return '';
  const ts = wfData.updatedAt ?? wfData.lastRun ?? null;
  return ts ? relativeTime(String(ts)) : '';
}

const levelColor: Record<string, string> = {
  info: 'text-[#6B7280]',
  warn: 'text-[#F97316]',
  error: 'text-[#EF4444]',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage(): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const mItem = prefersReducedMotion ? staticVariants : itemVariants;
  const mPage = prefersReducedMotion ? staticPageVariants : pageVariants;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedExpanded, setFeedExpanded] = useState(false);

  const { connected, lastMessage, messages } = useWebSocket();
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Polling with rate-limit backoff ──
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delayMs = 10_000;

    async function load() {
      try {
        const data = await fetchSummary();
        if (!cancelled) {
          setSummary(data);
          setError(null);
          delayMs = 10_000; // reset to normal on success
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof RateLimitError) {
            delayMs = Math.min(err.retryAfterS * 1000, 120_000);
          }
          setError(err instanceof Error ? err.message : 'Failed to fetch summary');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(() => { void load(); }, delayMs);
        }
      }
    }

    void load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // ── Merge STATE_SNAPSHOT ──
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const parsed = JSON.parse(lastMessage.data) as { type?: string; data?: unknown };
      if (parsed.type === 'STATE_SNAPSHOT' && parsed.data && typeof parsed.data === 'object') {
        const d = parsed.data as Record<string, unknown>;
        setSummary(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(d.serverHealth != null ? { serverHealth: d.serverHealth as DashboardSummary['serverHealth'] } : {}),
            ...(d.workflows != null ? { workflows: d.workflows as DashboardSummary['workflows'] } : {}),
          };
        });
      }
    } catch {
      // ignore
    }
  }, [lastMessage]);

  // ── Auto-scroll feed ──
  useEffect(() => {
    if (feedExpanded && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, feedExpanded]);

  // ── Derived data ──
  const cam = summary?.cameras;
  const server = summary?.serverHealth;
  const wfs = summary?.workflows ?? {};
  const iCount = summary?.incidentCount ?? 0;

  const cpuVal = server?.cpuPercent !== null && server?.cpuPercent !== undefined
    ? Math.round(server.cpuPercent)
    : null;

  const ramVal = server?.ramPercent !== null && server?.ramPercent !== undefined
    ? Math.round(server.ramPercent)
    : null;

  // ── Parsed events ──
  const displayCount = feedExpanded ? 50 : 5;
  const parsedEvents: ParsedEvent[] = useMemo(
    () => messages.slice(-displayCount).map((msg: WsMessage) => parseWsEvent(msg.data, msg.receivedAt)),
    [messages, displayCount],
  );

  return (
    <motion.div
      className="flex flex-col gap-6"
      variants={mPage}
      initial="hidden"
      animate="show"
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <motion.div
        variants={mItem}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E0E0E0]">
            Dashboard
          </h1>
          <p className="text-sm text-[#6B7280]">
            Real-time infrastructure overview
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5">
            <span className="text-xs text-[#EF4444]">API error</span>
          </div>
        )}
      </motion.div>

      {/* ── Section 1: Stats Row ─────────────────────────────────────────── */}
      <motion.div
        variants={mItem}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7"
      >
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <SkeletonCard key={i} className="h-28" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Cameras"
              value={cam?.total ?? '—'}
              icon={Camera}
              variant="blue"
            />
            <StatCard
              label="Online"
              value={cam?.online ?? '—'}
              icon={Wifi}
              variant="green"
            />
            <StatCard
              label="Offline"
              value={cam?.offline ?? '—'}
              icon={WifiOff}
              variant={(cam?.offline ?? 0) > 0 ? 'red' : 'green'}
            />
            <StatCard
              label="Incidents"
              value={iCount}
              icon={AlertTriangle}
              variant={iCount > 0 ? 'orange' : 'green'}
            />
            <StatCard
              label="CPU"
              value={cpuVal !== null ? `${cpuVal}%` : '—'}
              icon={Cpu}
              variant="default"
              progress={cpuVal !== null ? { value: cpuVal, max: 100 } : undefined}
            />
            <StatCard
              label="RAM"
              value={ramVal !== null ? `${ramVal}%` : '—'}
              icon={MemoryStick}
              variant="default"
              progress={ramVal !== null ? { value: ramVal, max: 100 } : undefined}
            />
            <StatCard
              label="Uptime"
              value={formatUptime(server?.uptimeS ?? null)}
              icon={Clock}
              variant="default"
              {...(server?.serverName ? { subtitle: server.serverName } : {})}
            />
          </>
        )}
      </motion.div>

      {/* ── Section 2: Workflow Status ────────────────────────────────────── */}
      <motion.div variants={mItem}>
        <Link
          href="/workflows"
          className="group block rounded-xl border border-[#1E1E2E] bg-[#13131A] transition-all duration-200 hover:border-[rgba(0,255,136,0.25)] hover:bg-[#1A1A24]"
        >
          {/* Card header */}
          <div className="flex items-center gap-2 border-b border-[#1E1E2E] px-5 py-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(0,255,136,0.08)]">
              <Activity size={12} strokeWidth={2} className="text-[#00FF88]" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4B5563]">
              Workflow Status
            </h2>
            <span className="ml-auto text-[10px] text-[#4B5563] group-hover:text-[#6B7280]">
              View all →
            </span>
          </div>

          {/* Workflow rows */}
          <div className="divide-y divide-[rgba(30,30,46,0.6)]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="h-2 w-2 rounded-full bg-[#1E1E2E]" />
                    <div className="h-3 w-48 animate-pulse rounded bg-[#1E1E2E]" />
                  </div>
                ))
              : WORKFLOW_META.map(({ id, name }) => {
                  const wfData = wfs[id] as Record<string, unknown> | undefined;
                  const status = workflowStatusDot(id, wfData, connected);
                  const statusText = workflowStatusText(id, wfData, connected);
                  const updated = wfUpdatedAt(id, wfData);

                  return (
                    <div key={id} className="flex items-center gap-3 px-5 py-2.5">
                      <StatusDot status={status} size="sm" />
                      <span className="w-12 shrink-0 rounded bg-[rgba(0,255,136,0.06)] px-1.5 py-0.5 text-center text-[10px] font-bold text-[#00FF88]">
                        {id}
                      </span>
                      <span className="w-28 shrink-0 text-xs font-medium text-[#E0E0E0]">
                        {name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[#6B7280]">
                        {statusText}
                      </span>
                      {updated && (
                        <span className="shrink-0 text-[10px] tabular-nums text-[#4B5563]">
                          {updated}
                        </span>
                      )}
                    </div>
                  );
                })
            }
          </div>
        </Link>
      </motion.div>

      {/* ── Section 3: Activity Feed ─────────────────────────────────────── */}
      <motion.div variants={mItem}>
        <div className="rounded-xl border border-[#1E1E2E] bg-[#13131A] overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => setFeedExpanded(prev => !prev)}
            className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-[#1A1A24]"
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#4B5563]">
              Recent Activity
            </h2>

            {/* Live dot */}
            {connected && (
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
                </span>
                <span className="text-[10px] font-medium text-[#00FF88]">Live</span>
              </span>
            )}

            {messages.length > 0 && (
              <span className="rounded-full bg-[rgba(0,255,136,0.08)] px-2 py-0.5 text-[10px] font-bold text-[#00FF88]">
                {messages.length}
              </span>
            )}

            <ChevronDown
              size={14}
              className={clsx(
                'ml-auto text-[#4B5563] transition-transform duration-200',
                feedExpanded && 'rotate-180',
              )}
            />
          </button>

          {/* Scanline accent */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(0,255,136,0.2)] to-transparent" />

          {/* Event list */}
          <div
            ref={feedRef}
            className={clsx(
              'flex flex-col overflow-y-auto transition-[max-height] duration-300 ease-out',
              feedExpanded ? 'max-h-[600px]' : 'max-h-[220px]',
            )}
            aria-label="Recent activity feed"
            aria-live="polite"
          >
            {parsedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Wifi size={16} strokeWidth={1.5} className="animate-pulse text-[#4B5563]" />
                <p className="text-xs text-[#4B5563]">
                  {connected ? 'Waiting for events…' : 'Connecting…'}
                </p>
              </div>
            ) : (
              parsedEvents.map((evt, idx) => (
                <div
                  key={`${evt.time}-${idx}`}
                  className={clsx(
                    'flex items-baseline gap-3 px-5 py-2',
                    'transition-colors duration-100 hover:bg-[rgba(255,255,255,0.02)]',
                    idx < parsedEvents.length - 1 && 'border-b border-[rgba(30,30,46,0.6)]',
                  )}
                >
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#374151]">
                    {evt.time}
                  </span>
                  <span className={clsx('min-w-0 flex-1 text-xs', levelColor[evt.level])}>
                    {evt.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

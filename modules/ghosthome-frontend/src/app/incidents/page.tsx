'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  XCircle,
  RefreshCw,
  Filter,
  Radio,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { fetchIncidents, fetchCameras, RateLimitError, type IncidentEntry } from '@/lib/api';
import { useWebSocket, type WsMessage } from '@/hooks/use-websocket';
import { parseWsEvent } from '@/lib/event-parser';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard } from '@/components/ui/skeleton';

// ── Utility ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return 'Unknown';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Shorten a UUID-style device ID to a readable label */
function formatDeviceId(id: string): string {
  const uuidMatch = /^([0-9a-f]{8})-/i.exec(id);
  if (uuidMatch != null && uuidMatch[1] != null) return uuidMatch[1].toUpperCase();
  return id.length > 16 ? `${id.slice(0, 8)}\u2026${id.slice(-4)}` : id;
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'waiting' | 'escalated' | 'error' | 'in_progress';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'error', label: 'Error' },
  { key: 'in_progress', label: 'In Progress' },
];

function matchesFilter(incident: IncidentEntry, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'waiting') return incident.status === 'waiting';
  if (filter === 'escalated') return incident.status === 'escalated';
  if (filter === 'error') return incident.status === 'error';
  if (filter === 'in_progress')
    return incident.status?.includes('restarting') === true;
  return true;
}

// ── Status badge config ───────────────────────────────────────────────────────

interface BadgeStyle {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

const STATUS_BADGE: Record<string, BadgeStyle> = {
  waiting: {
    label: 'Waiting',
    bg: 'bg-[rgba(249,115,22,0.12)]',
    text: 'text-[#F97316]',
    dot: 'bg-[#F97316]',
  },
  escalated: {
    label: 'Escalated',
    bg: 'bg-[rgba(239,68,68,0.12)]',
    text: 'text-[#EF4444]',
    dot: 'bg-[#EF4444]',
  },
  error: {
    label: 'Error',
    bg: 'bg-[rgba(239,68,68,0.12)]',
    text: 'text-[#EF4444]',
    dot: 'bg-[#EF4444]',
  },
  awaiting_power_resolution: {
    label: 'Awaiting Power',
    bg: 'bg-[rgba(249,115,22,0.12)]',
    text: 'text-[#F97316]',
    dot: 'bg-[#F97316]',
  },
};

const STATUS_BADGE_FALLBACK: BadgeStyle = {
  label: 'Unknown',
  bg: 'bg-[rgba(107,114,128,0.12)]',
  text: 'text-[#6B7280]',
  dot: 'bg-[#6B7280]',
};

function getStatusBadge(status: string): BadgeStyle {
  const exact = STATUS_BADGE[status];
  if (exact != null) return exact;
  for (const key of Object.keys(STATUS_BADGE)) {
    if (status.includes(key)) {
      const match = STATUS_BADGE[key];
      if (match != null) return match;
    }
  }
  return { ...STATUS_BADGE_FALLBACK, label: status.replace(/_/g, ' ') };
}

function timelineDotColor(status: string): string {
  if (status === 'escalated' || status === 'error') return '#EF4444';
  if (status.includes('restarting')) return '#3B82F6';
  if (status === 'waiting' || status.includes('awaiting')) return '#F97316';
  return '#6B7280';
}

// ── Live event helpers ────────────────────────────────────────────────────────

const INCIDENT_EVENT_TYPES = new Set([
  'ESCALATION',
  'CAMERA_RECOVERED',
  'POLE_UNREACHABLE',
  'CAMERA_OFFLINE',
  'POWER_OUTAGE',
  'INCIDENT_OPENED',
  'INCIDENT_CLOSED',
  'CAMERA_BACK_ONLINE',
  'ALERT',
]);

interface LiveEvent {
  id: string;
  type: string;
  summary: string;
  receivedAt: string;
  color: string;
}

function eventColor(type: string): string {
  if (
    type === 'CAMERA_RECOVERED' ||
    type === 'CAMERA_BACK_ONLINE' ||
    type === 'INCIDENT_CLOSED'
  )
    return '#00FF88';
  if (
    type === 'ESCALATION' ||
    type === 'POLE_UNREACHABLE' ||
    type === 'POWER_OUTAGE'
  )
    return '#EF4444';
  if (type === 'CAMERA_OFFLINE' || type === 'INCIDENT_OPENED') return '#F97316';
  return '#6B7280';
}

function buildLiveEvents(messages: WsMessage[]): LiveEvent[] {
  const events: LiveEvent[] = [];
  for (let i = messages.length - 1; i >= 0 && events.length < 15; i--) {
    const msg = messages[i];
    if (msg == null) continue;

    // Use the shared event parser for human-readable summaries
    const parsed = parseWsEvent(msg.data, msg.receivedAt);
    // Extract type from the raw message for color coding
    let type = 'EVENT';
    try {
      const raw = JSON.parse(msg.data) as Record<string, unknown>;
      type = String(raw.type ?? raw.event ?? 'EVENT').toUpperCase();
    } catch { /* use default */ }

    // Only show incident-relevant events in this feed
    if (!INCIDENT_EVENT_TYPES.has(type)) continue;

    events.unshift({
      id: `${msg.id}`,
      type,
      summary: parsed.message,
      receivedAt: msg.receivedAt,
      color: eventColor(type),
    });
  }
  return events;
}

// ── Derived counts ────────────────────────────────────────────────────────────

interface Counts {
  total: number;
  waiting: number;
  escalated: number;
  inProgress: number;
}

function deriveCounts(incidents: IncidentEntry[]): Counts {
  return {
    total: incidents.length,
    waiting: incidents.filter((i) => i.status === 'waiting').length,
    escalated: incidents.filter((i) => i.status === 'escalated').length,
    inProgress: incidents.filter(
      (i) => i.status?.includes('restarting'),
    ).length,
  };
}

// ── Status badge component ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const badge = getStatusBadge(status);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-xs font-semibold capitalize',
        badge.bg,
        badge.text,
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 flex-shrink-0 rounded-full',
          badge.dot,
        )}
        aria-hidden="true"
      />
      {badge.label}
    </span>
  );
}

// ── Incident card ─────────────────────────────────────────────────────────────

interface IncidentCardProps {
  deviceId: string;
  displayName: string;
  incident: IncidentEntry;
  isLast: boolean;
}

function IncidentCard({ deviceId, displayName, incident, isLast }: IncidentCardProps) {
  const dotColor = timelineDotColor(incident.status);

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot + connector line */}
      <div className="flex flex-col items-center">
        <div
          className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full ring-2 ring-[#0A0A0F]"
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 8px ${dotColor}60`,
          }}
          aria-hidden="true"
        />
        {!isLast && (
          <div
            className="mt-1 w-px flex-1 min-h-[16px]"
            style={{ backgroundColor: '#1E1E2E' }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Card body */}
      <motion.article
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          'mb-3 flex-1 rounded-xl border bg-[#13131A] p-4',
          'border-[#1E1E2E] transition-all duration-200',
          'hover:border-[rgba(0,255,136,0.15)] hover:bg-[#1A1A24]',
        )}
        aria-label={`Incident on ${displayName}, status: ${incident.status}`}
      >
        {/* Header */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-[#E0E0E0]">
            {displayName}
          </span>
          <StatusBadge status={incident.status} />
          {incident.poleId != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#1E1E2E] px-2 py-0.5 text-xs text-[#6B7280]">
              <MapPin size={10} aria-hidden="true" />
              {incident.poleId}
            </span>
          )}
        </div>

        {/* Reason */}
        <p className="mb-3 text-sm leading-relaxed text-[#9CA3AF]">
          {incident.reason}
        </p>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
          <Clock size={11} aria-hidden="true" />
          <span>Started {timeAgo(incident.startedAt)}</span>
          <span className="mx-1 text-[#1E1E2E]" aria-hidden="true">
            ·
          </span>
          <time dateTime={incident.startedAt}>
            {new Date(incident.startedAt).toLocaleTimeString('en-ZA', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg',
            })}
          </time>
        </div>
      </motion.article>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
      role="status"
      aria-label="All systems operational — no active incidents"
    >
      {/* Glow backdrop + icon */}
      <div className="relative mb-8" aria-hidden="true">
        {/* Outer radial glow */}
        <div className="absolute inset-0 -m-12 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.10)_0%,transparent_70%)]" />
        {/* Animated ring */}
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 -m-5 rounded-full border border-[rgba(0,255,136,0.15)]"
        />
        {/* Secondary ring */}
        <motion.div
          animate={{ scale: [1, 1.10, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.6,
          }}
          className="absolute inset-0 -m-2 rounded-full border border-[rgba(0,255,136,0.12)]"
        />
        {/* Icon container */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[rgba(0,255,136,0.20)] bg-[rgba(0,255,136,0.06)] shadow-[0_0_40px_rgba(0,255,136,0.14)]">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <ShieldCheck
              size={40}
              className="text-[#00FF88]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </div>

      {/* Headline */}
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-[#E0E0E0]">
        All Systems Operational
      </h2>
      <p className="mb-1 text-base text-[#6B7280]">No active incidents</p>
      <p className="max-w-xs text-sm text-[#4B5563]">
        All cameras are running normally. You will be notified if anything
        changes.
      </p>

      {/* Confirmation row */}
      <div
        className="mt-8 flex items-center gap-6 text-xs text-[#4B5563]"
        aria-hidden="true"
      >
        {(['Cameras', 'Analytics', 'Network'] as const).map((label) => (
          <span key={label} className="flex items-center gap-1.5">
            <CheckCircle2
              size={13}
              className="text-[#00FF88]"
              aria-hidden="true"
            />
            {label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Live event feed ───────────────────────────────────────────────────────────

function LiveEventFeed({ messages }: { messages: WsMessage[] }) {
  const events = buildLiveEvents(messages);

  return (
    <section aria-labelledby="live-feed-heading">
      <div className="mb-4 flex items-center gap-2">
        <Radio size={15} className="text-[#00FF88]" aria-hidden="true" />
        <h2
          id="live-feed-heading"
          className="text-sm font-semibold uppercase tracking-widest text-[#4B5563]"
        >
          Live Event Feed
        </h2>
        <span className="ml-auto text-xs text-[#4B5563]">
          Last 15 incident events
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#1E1E2E] bg-[#13131A]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle
              size={22}
              className="mb-2 text-[#1E1E2E]"
              aria-hidden="true"
            />
            <p className="text-sm text-[#4B5563]">
              No incident events received yet
            </p>
          </div>
        ) : (
          <ul
            className="divide-y divide-[#1E1E2E]"
            role="list"
            aria-label="Live incident events"
          >
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <motion.li
                  key={event.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[#1A1A24]"
                >
                  {/* Color dot */}
                  <span
                    className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor: event.color,
                      boxShadow: `0 0 6px ${event.color}80`,
                    }}
                    aria-hidden="true"
                  />

                  {/* Event type chip */}
                  <span
                    className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${event.color}18`,
                      color: event.color,
                    }}
                  >
                    {event.type}
                  </span>

                  {/* Summary */}
                  <span className="min-w-0 flex-1 text-sm text-[#9CA3AF]">
                    {event.summary}
                  </span>

                  {/* Relative timestamp */}
                  <time
                    dateTime={event.receivedAt}
                    className="flex-shrink-0 text-xs text-[#4B5563]"
                  >
                    {timeAgo(event.receivedAt)}
                  </time>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function IncidentsLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-fade-in"
      aria-busy="true"
      aria-label="Loading incidents"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-shimmer rounded-lg border border-[#1E1E2E]"
          />
        ))}
      </div>

      {/* Timeline skeleton rows */}
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="mt-1.5 h-3 w-3 flex-shrink-0 animate-shimmer rounded-full" />
            <SkeletonCard className="h-24 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [cameraNames, setCameraNames] = useState<Map<string, string>>(new Map());

  const { messages, connected, lastMessage } = useWebSocket();
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(10_000);

  // Fetch camera names once on mount (best-effort, fallback to truncated IDs)
  useEffect(() => {
    fetchCameras()
      .then((cameras) => {
        const nameMap = new Map<string, string>();
        for (const cam of cameras) {
          const name = cam.name?.trim();
          if (name) {
            nameMap.set(cam.id.toLowerCase(), name);
          }
        }
        setCameraNames(nameMap);
      })
      .catch(() => {
        // Camera name resolution is best-effort — incidents still display with truncated IDs
      });
  }, []);

  /** Resolve a device ID to a camera name, falling back to truncated ID */
  const resolveName = useCallback(
    (deviceId: string): string => {
      const name = cameraNames.get(deviceId.toLowerCase());
      return name ?? formatDeviceId(deviceId);
    },
    [cameraNames],
  );

  const loadIncidents = useCallback(async () => {
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      setError(null);
      pollDelayRef.current = 10_000; // reset on success
    } catch (err) {
      if (err instanceof RateLimitError) {
        pollDelayRef.current = Math.min(err.retryAfterS * 1000, 120_000);
      }
      setError(
        err instanceof Error ? err.message : 'Failed to load incidents',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll with rate-limit backoff
  useEffect(() => {
    let cancelled = false;

    function schedule() {
      if (cancelled) return;
      pollRef.current = setTimeout(() => {
        void loadIncidents().then(() => { if (!cancelled) schedule(); });
      }, pollDelayRef.current);
    }

    void loadIncidents().then(() => { if (!cancelled) schedule(); });

    return () => {
      cancelled = true;
      if (pollRef.current !== null) clearTimeout(pollRef.current);
    };
  }, [loadIncidents]);

  // Sync incidents from WebSocket STATE_SNAPSHOT
  useEffect(() => {
    if (lastMessage == null) return;
    try {
      const parsed = JSON.parse(lastMessage.data) as Record<string, unknown>;
      const type =
        typeof parsed['type'] === 'string' ? parsed['type'] : undefined;
      if (type === 'STATE_SNAPSHOT') {
        const snap = parsed['data'] as Record<string, unknown> | undefined;
        const wsIncidents = snap?.['activeIncidents'];
        if (wsIncidents != null && typeof wsIncidents === 'object') {
          // Convert { deviceId: data } object to IncidentEntry[] — explicitly construct each field
          const entries = Object.entries(wsIncidents as Record<string, unknown>)
            .filter(([key, val]) => key && val != null && typeof val === 'object')
            .map(([deviceId, data]) => {
              const d = data as Record<string, unknown>;
              return {
                deviceId,
                status: typeof d.status === 'string' ? d.status : 'unknown',
                startedAt: typeof d.startedAt === 'string' ? d.startedAt : new Date().toISOString(),
                reason: typeof d.reason === 'string' ? d.reason : '',
                poleId: typeof d.poleId === 'string' ? d.poleId : undefined,
              } as IncidentEntry;
            });
          setIncidents(entries);
        }
      }
    } catch {
      // Non-JSON WS message — ignore
    }
  }, [lastMessage]);

  if (loading) return <IncidentsLoadingSkeleton />;

  // Derived
  const counts = deriveCounts(incidents);

  const filteredEntries = incidents
    .filter((incident) => matchesFilter(incident, activeFilter))
    .sort((a, b) => {
      // Escalated first, then error, then by recency
      const weight = (s: string) =>
        s === 'escalated' ? 0 : s === 'error' ? 1 : 2;
      const wDiff = weight(a.status) - weight(b.status);
      if (wDiff !== 0) return wDiff;
      return (
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E0E0E0]">
            Incidents
          </h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Active alerts and escalations across your camera network
          </p>
        </div>

        {/* WebSocket live indicator */}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[#1E1E2E] bg-[#13131A] px-3 py-2">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              connected
                ? 'bg-[#00FF88] shadow-[0_0_6px_rgba(0,255,136,0.7)] animate-pulse-dot'
                : 'bg-[#4B5563]',
            )}
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-[#6B7280]">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error != null && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#EF4444]"
          role="alert"
        >
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Active"
          value={counts.total}
          icon={AlertTriangle}
          variant={counts.total > 0 ? 'red' : 'default'}
          subtitle={counts.total === 0 ? 'All clear' : `${counts.total} open`}
          loading={loading}
        />
        <StatCard
          label="Waiting"
          value={counts.waiting}
          icon={Clock}
          variant="orange"
          subtitle="Awaiting resolution"
          loading={loading}
        />
        <StatCard
          label="Escalated"
          value={counts.escalated}
          icon={XCircle}
          variant="red"
          subtitle="Needs attention"
          loading={loading}
        />
        <StatCard
          label="In Progress"
          value={counts.inProgress}
          icon={RefreshCw}
          variant="blue"
          subtitle="Auto-recovery running"
          loading={loading}
        />
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter incidents by status"
      >
        <Filter
          size={14}
          className="text-[#4B5563]"
          aria-hidden="true"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            aria-pressed={activeFilter === f.key}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
              activeFilter === f.key
                ? 'bg-[#00FF88] text-[#0A0A0F] shadow-[0_0_12px_rgba(0,255,136,0.35)]'
                : [
                    'border border-[#1E1E2E] bg-[#13131A] text-[#6B7280]',
                    'hover:border-[rgba(0,255,136,0.2)] hover:text-[#E0E0E0]',
                  ],
            )}
          >
            {f.label}
          </button>
        ))}

        <span className="ml-auto text-xs text-[#4B5563]">
          {filteredEntries.length}{' '}
          {filteredEntries.length === 1 ? 'incident' : 'incidents'}
        </span>
      </div>

      {/* Incidents list or empty state */}
      {filteredEntries.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-label="Active incidents">
          <div className="relative pl-2">
            {/* Vertical timeline line */}
            <div
              className="absolute bottom-0 left-3.5 top-2 w-px"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(0,255,136,0.3) 0%, rgba(30,30,46,0.4) 100%)',
              }}
              aria-hidden="true"
            />

            <AnimatePresence mode="popLayout">
              {filteredEntries.map((incident, index) => (
                <IncidentCard
                  key={incident.deviceId}
                  deviceId={incident.deviceId}
                  displayName={resolveName(incident.deviceId)}
                  incident={incident}
                  isLast={index === filteredEntries.length - 1}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Live event feed */}
      <LiveEventFeed messages={messages} />
    </div>
  );
}

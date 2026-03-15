'use client';

import { useEffect, useState, useCallback, useRef, type MutableRefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  ShieldAlert,
  Activity,
  Server,
  FileText,
  Loader2,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { fetchWorkflows, triggerAction, RateLimitError, type WorkflowSummary } from '@/lib/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { StatusDot, type DotStatus } from '@/components/ui/status-dot';
import { SkeletonCard } from '@/components/ui/skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Wf01Data extends WorkflowSummary {
  connected?: boolean;
  eventCount?: number;
  lastEventType?: string;
  lastEventAt?: string;
}

interface Wf02Data extends WorkflowSummary {
  activeIncidents?: number;
  lastCameraHandled?: string;
  recoveryMethod?: string;
  camerasRecovered?: number;
  escalations?: number;
  pendingWaits?: number;
}

interface Wf03Data extends WorkflowSummary {
  total?: number;
  healthy?: number;
  restarted?: number;
  escalated?: number;
  uptimePct?: number;
  durationMs?: number;
  running?: boolean;
}

interface Wf04Data extends WorkflowSummary {
  cpuPercent?: number;
  ramPercent?: number;
  storageCount?: number;
  uptimeS?: number;
  lastCheckAt?: string;
}

interface Wf05Data extends WorkflowSummary {
  date?: string;
  status?: 'ALL_OK' | 'WARNINGS' | 'CRITICAL';
  cameras?: { total: number; online: number; offline: number };
  incidents?: { cameraOffline: number; escalated: number; selfRecovered: number; analyticsRestarted: number; serverRestarts: number };
}

interface WorkflowsState {
  wf01?: Wf01Data;
  wf02?: Wf02Data;
  wf03?: Wf03Data;
  wf04?: Wf04Data;
  wf05?: Wf05Data;
}

/** Build a WorkflowsState from raw API data, omitting keys where the value is undefined. */
function parseWorkflowsState(data: Record<string, WorkflowSummary>): WorkflowsState {
  const state: WorkflowsState = {};
  const wf01 = data['WF-01'] as Wf01Data | undefined;
  const wf02 = data['WF-02'] as Wf02Data | undefined;
  const wf03 = data['WF-03'] as Wf03Data | undefined;
  const wf04 = data['WF-04'] as Wf04Data | undefined;
  const wf05 = data['WF-05'] as Wf05Data | undefined;
  if (wf01 !== undefined) state.wf01 = wf01;
  if (wf02 !== undefined) state.wf02 = wf02;
  if (wf03 !== undefined) state.wf03 = wf03;
  if (wf04 !== undefined) state.wf04 = wf04;
  if (wf05 !== undefined) state.wf05 = wf05;
  return state;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string | undefined): string {
  if (!isoString) return 'never';
  const ms = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function nodeStatus(updatedAt: string | undefined): 'online' | 'warning' | 'unknown' {
  if (!updatedAt) return 'unknown';
  const ms = Date.now() - new Date(updatedAt).getTime();
  if (ms < 5 * 60 * 1000) return 'online';
  if (ms < 10 * 60 * 1000) return 'warning';
  return 'unknown';
}

function formatUptime(s: number | undefined): string {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function formatCycleDuration(ms: number | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Trigger Button ────────────────────────────────────────────────────────────

/** Map raw error messages to safe, operator-friendly text */
function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('timed out')) return 'Request timed out';
  if (msg.includes('401')) return 'Unauthorized — check API token';
  if (msg.includes('429')) return 'Rate limited — try again later';
  if (/\b5\d{2}\b/.test(msg)) return 'Server error';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Network error';
  return 'Action failed';
}

function TriggerButton({
  label,
  action,
  disabled = false,
}: {
  label: string;
  action: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>;
  const mountedRef = useRef(true);

  // Clean up timer and mark unmounted
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    setSuccess(false);
    setError(null);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    try {
      await triggerAction(action);
      if (!mountedRef.current) return;
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(sanitizeError(err));
      setLoading(false);
    }
    if (!mountedRef.current) return;
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setSuccess(false);
      setError(null);
    }, 5000);
  };

  const hasError = error !== null;

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        onClick={handleClick}
        disabled={loading || disabled}
        whileTap={{ scale: 0.97 }}
        className={clsx(
          'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,255,136,0.6)]',
          (loading || disabled) && 'opacity-60 cursor-not-allowed',
          hasError
            ? 'border border-[rgba(239,68,68,0.4)] text-[#EF4444] bg-[rgba(239,68,68,0.06)]'
            : success
              ? 'border border-[rgba(0,255,136,0.6)] text-[#00FF88] bg-[rgba(0,255,136,0.06)]'
              : 'border border-[rgba(0,255,136,0.3)] text-[#00FF88] hover:bg-[rgba(0,255,136,0.08)] hover:border-[rgba(0,255,136,0.6)] hover:shadow-[0_0_12px_rgba(0,255,136,0.15)]',
        )}
        aria-label={label}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : hasError ? (
          <XCircle size={14} aria-hidden="true" />
        ) : success ? (
          <CheckCircle2 size={14} aria-hidden="true" />
        ) : (
          <Zap size={14} aria-hidden="true" />
        )}
        <span>
          {loading ? 'Running…' : hasError ? 'Failed' : success ? 'Triggered' : label}
        </span>
      </motion.button>

      {/* Error detail banner */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[#EF4444]" role="alert">
              <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pipeline SVG Visualization ────────────────────────────────────────────────

interface PipelineNodeDef {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  x: number;
  y: number;
  updatedAt: string | undefined;
}

interface PipelineEdgeDef {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  curved?: boolean;
}

function PipelineNode({
  node,
}: {
  node: PipelineNodeDef;
}) {
  const status = nodeStatus(node.updatedAt);
  const W = 130;
  const H = 52;

  const borderColor =
    status === 'online'
      ? 'rgba(0,255,136,0.55)'
      : status === 'warning'
        ? 'rgba(249,115,22,0.55)'
        : 'rgba(30,30,46,0.9)';

  const glowColor =
    status === 'online'
      ? 'rgba(0,255,136,0.18)'
      : status === 'warning'
        ? 'rgba(249,115,22,0.12)'
        : 'transparent';

  return (
    <g>
      {/* Glow layer */}
      {status !== 'unknown' && (
        <rect
          x={node.x - W / 2 - 4}
          y={node.y - H / 2 - 4}
          width={W + 8}
          height={H + 8}
          rx={14}
          fill={glowColor}
          className={status === 'online' ? 'animate-pulse-dot' : undefined}
        />
      )}
      {/* Card */}
      <rect
        x={node.x - W / 2}
        y={node.y - H / 2}
        width={W}
        height={H}
        rx={10}
        fill="#13131A"
        stroke={borderColor}
        strokeWidth={1.5}
      />
      {/* Icon area */}
      <circle
        cx={node.x - W / 2 + 22}
        cy={node.y}
        r={11}
        fill={
          status === 'online'
            ? 'rgba(0,255,136,0.12)'
            : status === 'warning'
              ? 'rgba(249,115,22,0.1)'
              : 'rgba(30,30,46,0.6)'
        }
      />
      {/* Status dot */}
      <circle
        cx={node.x + W / 2 - 8}
        cy={node.y - H / 2 + 8}
        r={4}
        fill={
          status === 'online'
            ? '#00FF88'
            : status === 'warning'
              ? '#F97316'
              : '#374151'
        }
        className={status !== 'unknown' ? 'animate-pulse-dot' : undefined}
      />
      {/* Label */}
      <text
        x={node.x - W / 2 + 42}
        y={node.y - 7}
        fontSize={11}
        fontWeight={600}
        fill="#E0E0E0"
        fontFamily="DM Sans, sans-serif"
      >
        {node.id}
      </text>
      <text
        x={node.x - W / 2 + 42}
        y={node.y + 8}
        fontSize={9.5}
        fill="#6B7280"
        fontFamily="DM Sans, sans-serif"
      >
        {node.sub}
      </text>
    </g>
  );
}

function AnimatedEdge({ edge, index }: { edge: PipelineEdgeDef; index: number }) {
  const dashLength = 6;
  const gapLength = 5;
  const animDuration = 1.8 + index * 0.25;

  if (edge.curved) {
    const mx = (edge.x1 + edge.x2) / 2;
    const my = edge.y1 + 45;
    const d = `M ${edge.x1} ${edge.y1} Q ${mx} ${my} ${edge.x2} ${edge.y2}`;
    return (
      <g>
        {/* Ghost base line */}
        <path d={d} stroke="rgba(30,30,46,0.6)" strokeWidth={1.5} fill="none" />
        {/* Animated dash */}
        <path
          d={d}
          stroke="rgba(0,255,136,0.45)"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray={`${dashLength} ${gapLength}`}
          style={{
            animation: `flow-dash ${animDuration}s linear infinite`,
          }}
        />
        {edge.label && (
          <text
            x={mx}
            y={my - 6}
            fontSize={8.5}
            fill="rgba(107,114,128,0.8)"
            textAnchor="middle"
            fontFamily="DM Sans, sans-serif"
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  }

  const d = `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`;
  return (
    <g>
      <path d={d} stroke="rgba(30,30,46,0.6)" strokeWidth={1.5} fill="none" />
      <path
        d={d}
        stroke="rgba(0,255,136,0.45)"
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={`${dashLength} ${gapLength}`}
        style={{
          animation: `flow-dash ${animDuration}s linear infinite`,
        }}
      />
      {edge.label && (
        <text
          x={(edge.x1 + edge.x2) / 2}
          y={(edge.y1 + edge.y2) / 2 - 6}
          fontSize={8.5}
          fill="rgba(107,114,128,0.8)"
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

function PipelineViz({ workflows }: { workflows: WorkflowsState }) {
  const SVG_W = 780;
  const SVG_H = 220;

  const nodes: PipelineNodeDef[] = [
    {
      id: 'WF-01',
      label: 'WebSocket Monitor',
      sub: 'WebSocket',
      icon: null,
      x: 100,
      y: 80,
      updatedAt: workflows.wf01?.updatedAt,
    },
    {
      id: 'WF-02',
      label: 'Camera Recovery',
      sub: 'Cam Offline',
      icon: null,
      x: 340,
      y: 50,
      updatedAt: workflows.wf02?.updatedAt,
    },
    {
      id: 'WF-03',
      label: 'Analytics Health',
      sub: 'Analytics',
      icon: null,
      x: 340,
      y: 155,
      updatedAt: workflows.wf03?.updatedAt,
    },
    {
      id: 'WF-04',
      label: 'Server Health',
      sub: 'Server',
      icon: null,
      x: 570,
      y: 80,
      updatedAt: workflows.wf04?.updatedAt,
    },
    {
      id: 'WF-05',
      label: 'Daily Report',
      sub: 'Aggregator',
      icon: null,
      x: 700,
      y: 170,
      updatedAt: workflows.wf05?.updatedAt,
    },
  ];

  const edges: PipelineEdgeDef[] = [
    // WF-01 -> WF-02
    { id: 'e1', x1: 165, y1: 68, x2: 275, y2: 55, label: 'events' },
    // WF-01 -> WF-04
    { id: 'e2', x1: 165, y1: 88, x2: 505, y2: 82, label: 'events' },
    // WF-01 -> WF-03
    { id: 'e3', x1: 165, y1: 94, x2: 275, y2: 148, label: '' },
    // WF-04 -> WF-03 (post-recovery trigger)
    { id: 'e4', x1: 570, y1: 106, x2: 405, y2: 129, label: 'triggers', curved: true },
    // WF-02 -> WF-05
    { id: 'e5', x1: 405, y1: 76, x2: 635, y2: 155, label: '' },
    // WF-03 -> WF-05
    { id: 'e6', x1: 405, y1: 163, x2: 635, y2: 168, label: 'aggregates' },
    // WF-04 -> WF-05
    { id: 'e7', x1: 635, y1: 104, x2: 680, y2: 144, label: '' },
  ];

  return (
    <div className="relative w-full overflow-x-auto">
      <style>{`
        @keyframes flow-dash {
          from { stroke-dashoffset: 22; }
          to   { stroke-dashoffset: 0;  }
        }
      `}</style>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height={SVG_H}
        role="img"
        aria-label="Workflow pipeline diagram"
        className="select-none"
        style={{ minWidth: 520 }}
      >
        {/* Edges rendered behind nodes */}
        {edges.map((edge, i) => (
          <AnimatedEdge key={edge.id} edge={edge} index={i} />
        ))}

        {/* Arrowheads for each edge endpoint */}
        <defs>
          <marker
            id="arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(0,255,136,0.55)" />
          </marker>
        </defs>

        {/* Nodes */}
        {nodes.map((node) => (
          <PipelineNode key={node.id} node={node} />
        ))}
      </svg>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function WorkflowCard({
  children,
  index,
  status,
}: {
  children: React.ReactNode;
  index: number;
  status: DotStatus;
}) {
  const borderGlow =
    status === 'online'
      ? 'border-[rgba(0,255,136,0.2)] hover:border-[rgba(0,255,136,0.38)] hover:shadow-[0_0_24px_rgba(0,255,136,0.06)]'
      : status === 'warning'
        ? 'border-[rgba(249,115,22,0.25)] hover:border-[rgba(249,115,22,0.4)]'
        : status === 'error'
          ? 'border-[rgba(239,68,68,0.25)] hover:border-[rgba(239,68,68,0.4)]'
          : 'border-[#1E1E2E] hover:border-[rgba(30,30,46,0.9)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className={clsx(
        'rounded-xl border bg-[#13131A] p-5 transition-all duration-300',
        borderGlow,
      )}
    >
      {children}
    </motion.div>
  );
}

function CardHeader({
  icon,
  title,
  wfId,
  status,
  updatedAt,
}: {
  icon: React.ReactNode;
  title: string;
  wfId: string;
  status: DotStatus;
  updatedAt: string | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            status === 'online'
              ? 'bg-[rgba(0,255,136,0.1)] text-[#00FF88]'
              : status === 'warning'
                ? 'bg-[rgba(249,115,22,0.1)] text-[#F97316]'
                : status === 'error'
                  ? 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]'
                  : 'bg-[rgba(30,30,46,0.6)] text-[#4B5563]',
          )}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-[#4B5563] tracking-widest uppercase">
              {wfId}
            </span>
            <StatusDot status={status} size="sm" />
          </div>
          <h2 className="text-[15px] font-semibold text-[#E0E0E0] leading-tight">{title}</h2>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[11px] text-[#4B5563]">Last updated</p>
        <p className="text-[11px] text-[#6B7280] font-medium">{timeAgo(updatedAt)}</p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number | undefined;
  accent?: boolean | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[rgba(30,30,46,0.5)] last:border-0">
      <span className="text-[12px] text-[#6B7280]">{label}</span>
      <span
        className={clsx(
          'text-[13px] font-semibold tabular-nums',
          accent ? 'text-[#00FF88]' : 'text-[#E0E0E0]',
        )}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function ThresholdBar({
  value,
  label,
  warningAt = 70,
  errorAt = 90,
}: {
  value: number | null | undefined;
  label: string;
  warningAt?: number;
  errorAt?: number;
}) {
  const pct = value ?? 0;
  const color =
    pct >= errorAt
      ? '#EF4444'
      : pct >= warningAt
        ? '#F97316'
        : '#00FF88';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-[11px] text-[#6B7280]">{label}</span>
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color }}
        >
          {value != null ? `${Math.round(pct)}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#1E1E2E] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── WF-01 Card ────────────────────────────────────────────────────────────────

function Wf01Card({ data }: { data: Wf01Data | undefined }) {
  const wsStatus: DotStatus = data?.connected ? 'online' : data ? 'error' : 'unknown';

  return (
    <WorkflowCard index={0} status={wsStatus}>
      <CardHeader
        icon={<Radio size={18} />}
        title="WebSocket Monitor"
        wfId="WF-01"
        status={wsStatus}
        updatedAt={data?.updatedAt}
      />

      <div className="space-y-1">
        <StatRow
          label="Connection"
          value={data?.connected ? 'Connected' : 'Disconnected'}
          accent={data?.connected === true}
        />
        <StatRow label="Events received" value={data?.eventCount?.toLocaleString()} />
        <StatRow label="Last event type" value={data?.lastEventType ?? 'none'} />
        {data?.lastEventAt && (
          <StatRow label="Last event" value={timeAgo(data.lastEventAt)} />
        )}
      </div>

      <div className="mt-4 rounded-lg bg-[rgba(30,30,46,0.35)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'h-2 w-2 rounded-full flex-shrink-0',
              data?.connected
                ? 'bg-[#00FF88] animate-pulse-dot'
                : 'bg-[#EF4444]',
            )}
          />
          <span className="text-[12px] text-[#6B7280]">
            {data?.connected
              ? 'NX Witness event stream active — monitoring in real-time'
              : 'WebSocket connection lost — retrying with backoff'}
          </span>
        </div>
      </div>
    </WorkflowCard>
  );
}

// ── WF-02 Card ────────────────────────────────────────────────────────────────

function Wf02Card({ data }: { data: Wf02Data | undefined }) {
  const activeCount = data?.activeIncidents ?? 0;
  const status: DotStatus =
    !data ? 'unknown' : activeCount > 0 ? 'warning' : 'online';

  return (
    <WorkflowCard index={1} status={status}>
      <CardHeader
        icon={<ShieldAlert size={18} />}
        title="Camera Offline Recovery"
        wfId="WF-02"
        status={status}
        updatedAt={data?.updatedAt}
      />

      <div className="space-y-1 mb-4">
        <StatRow
          label="Active incidents"
          value={data?.activeIncidents ?? '—'}
          accent={(data?.activeIncidents ?? 0) === 0}
        />
        <StatRow label="Last camera handled" value={data?.lastCameraHandled ?? 'none'} />
        <StatRow label="Recovery method" value={data?.recoveryMethod ?? '—'} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        {[
          { label: 'Recovered', value: data?.camerasRecovered ?? 0, color: '#00FF88' },
          { label: 'Escalated', value: data?.escalations ?? 0, color: '#F97316' },
          { label: 'Pending', value: data?.pendingWaits ?? 0, color: '#6B7280' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-lg bg-[rgba(30,30,46,0.4)] py-3 px-2"
          >
            <span className="text-xl font-bold tabular-nums" style={{ color }}>
              {value}
            </span>
            <span className="text-[10px] text-[#4B5563] mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </WorkflowCard>
  );
}

// ── WF-03 Card ────────────────────────────────────────────────────────────────

function Wf03Card({ data }: { data: Wf03Data | undefined }) {
  const uptime = data?.uptimePct ?? null;
  const status: DotStatus =
    !data
      ? 'unknown'
      : (uptime ?? 100) < 80
        ? 'error'
        : (uptime ?? 100) < 95
          ? 'warning'
          : 'online';

  const healthy = data?.healthy ?? 0;
  const total = data?.total ?? 0;
  const healthPct = total > 0 ? Math.round((healthy / total) * 100) : null;

  return (
    <WorkflowCard index={2} status={status}>
      <CardHeader
        icon={<Activity size={18} />}
        title="Analytics Health"
        wfId="WF-03"
        status={status}
        updatedAt={data?.updatedAt}
      />

      <div className="space-y-1 mb-4">
        <StatRow label="Cameras checked" value={data?.total} />
        <StatRow label="Healthy" value={data?.healthy} accent />
        <StatRow label="Restarted" value={data?.restarted} />
        <StatRow label="Escalated" value={data?.escalated} />
        <StatRow label="Cycle duration" value={formatCycleDuration(data?.durationMs)} />
      </div>

      {/* Uptime bar */}
      <div className="mb-4">
        <ThresholdBar
          value={healthPct}
          label="Camera health rate"
          warningAt={85}
          errorAt={70}
        />
      </div>

      {/* Analytics progress bar if running */}
      <AnimatePresence>
        {data?.running && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="rounded-lg bg-[rgba(0,255,136,0.06)] border border-[rgba(0,255,136,0.2)] px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Loader2 size={12} className="animate-spin text-[#00FF88]" />
                <span className="text-[11px] text-[#00FF88] font-medium">
                  Analytics cycle running…
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-[rgba(30,30,46,0.6)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#00FF88]"
                  style={{
                    animation: 'progress-indeterminate 1.4s ease-in-out infinite',
                    width: '40%',
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TriggerButton label="Run Analytics Cycle" action="trigger-analytics" />
    </WorkflowCard>
  );
}

// ── WF-04 Card ────────────────────────────────────────────────────────────────

function Wf04Card({ data }: { data: Wf04Data | undefined }) {
  const cpu = data?.cpuPercent ?? null;
  const ram = data?.ramPercent ?? null;

  const status: DotStatus =
    !data
      ? 'unknown'
      : (cpu ?? 0) > 90 || (ram ?? 0) > 90
        ? 'error'
        : (cpu ?? 0) > 70 || (ram ?? 0) > 70
          ? 'warning'
          : 'online';

  return (
    <WorkflowCard index={3} status={status}>
      <CardHeader
        icon={<Server size={18} />}
        title="Server Health"
        wfId="WF-04"
        status={status}
        updatedAt={data?.updatedAt}
      />

      <div className="space-y-3 mb-4">
        <ThresholdBar value={cpu} label="CPU Usage" warningAt={70} errorAt={90} />
        <ThresholdBar value={ram} label="RAM Usage" warningAt={75} errorAt={90} />
      </div>

      <div className="space-y-1 mb-4">
        <StatRow label="Storage drives" value={data?.storageCount} />
        <StatRow label="Server uptime" value={formatUptime(data?.uptimeS)} accent />
        {data?.lastCheckAt && (
          <StatRow label="Last check" value={timeAgo(data.lastCheckAt)} />
        )}
      </div>

      <TriggerButton label="Run Health Check" action="trigger-health-check" />
    </WorkflowCard>
  );
}

// ── WF-05 Card ────────────────────────────────────────────────────────────────

const REPORT_STATUS_CONFIG = {
  ALL_OK: { label: 'All OK', color: '#00FF88', bg: 'rgba(0,255,136,0.08)', icon: CheckCircle2 },
  WARNINGS: { label: 'Warnings', color: '#F97316', bg: 'rgba(249,115,22,0.08)', icon: AlertTriangle },
  CRITICAL: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: XCircle },
} as const;

function Wf05Card({ data }: { data: Wf05Data | undefined }) {
  const reportCfg = data?.status
    ? REPORT_STATUS_CONFIG[data.status]
    : null;

  const status: DotStatus =
    !data
      ? 'unknown'
      : data.status === 'CRITICAL'
        ? 'error'
        : data.status === 'WARNINGS'
          ? 'warning'
          : 'online';

  const nextSast = (() => {
    const now = new Date();
    // Get current hour in SAST
    const sastHour = parseInt(
      now.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: 'numeric', hour12: false }),
      10,
    );
    // Next report is at 6:00 or 18:00 SAST, whichever comes first
    let nextHour: number;
    if (sastHour < 6) nextHour = 6;
    else if (sastHour < 18) nextHour = 18;
    else nextHour = 6; // wraps to next day
    const hoursUntil = sastHour < 6 ? 6 - sastHour
      : sastHour < 18 ? 18 - sastHour
      : 24 - sastHour + 6;
    const sastMin = parseInt(
      now.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', minute: 'numeric' }),
      10,
    );
    const totalMin = hoursUntil * 60 - sastMin;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return { label: `${nextHour}:00 SAST`, countdown: `${h}h ${m}m` };
  })();

  return (
    <WorkflowCard index={4} status={status}>
      <CardHeader
        icon={<FileText size={18} />}
        title="Daily Report"
        wfId="WF-05"
        status={status}
        updatedAt={data?.updatedAt}
      />

      {/* Report status badge */}
      {reportCfg && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4"
          style={{ backgroundColor: reportCfg.bg, borderColor: reportCfg.color + '33' }}
        >
          <reportCfg.icon size={15} style={{ color: reportCfg.color }} />
          <span className="text-[13px] font-semibold" style={{ color: reportCfg.color }}>
            {reportCfg.label}
          </span>
          {data?.date && (
            <span className="ml-auto text-[11px] text-[#4B5563]">
              {new Date(data.date).toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
        </div>
      )}

      <div className="space-y-1 mb-4">
        <StatRow
          label="Cameras online"
          value={
            data?.cameras?.online != null && data?.cameras?.total != null
              ? `${data.cameras.online} / ${data.cameras.total}`
              : '—'
          }
          accent
        />
        <StatRow label="Incidents yesterday" value={data?.incidents?.cameraOffline} />
        <StatRow label="Next report" value={`${nextSast.label} (in ${nextSast.countdown})`} />
      </div>

      <TriggerButton label="Generate Report Now" action="trigger-daily-report" />
    </WorkflowCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowsState>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(15_000);

  const loadWorkflows = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await fetchWorkflows();
      setWorkflows(parseWorkflowsState(data));
      setLastRefresh(new Date());
      setFetchError(null);
      pollDelayRef.current = 15_000; // reset on success
    } catch (err) {
      if (err instanceof RateLimitError) {
        pollDelayRef.current = Math.min(err.retryAfterS * 1000, 120_000);
      }
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch workflows');
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setRefreshing(false), 600);
    }
  }, []);

  // Initial fetch + poll with rate-limit backoff
  useEffect(() => {
    let cancelled = false;

    function schedule() {
      if (cancelled) return;
      intervalRef.current = setTimeout(() => {
        void loadWorkflows().then(() => { if (!cancelled) schedule(); });
      }, pollDelayRef.current);
    }

    void loadWorkflows().then(() => { if (!cancelled) schedule(); });

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) clearTimeout(intervalRef.current);
    };
  }, [loadWorkflows]);

  // WebSocket STATE_SNAPSHOT updates
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const parsed = JSON.parse(lastMessage.data) as {
        type?: string;
        data?: { workflows?: Record<string, WorkflowSummary> };
      };
      if (parsed.type === 'STATE_SNAPSHOT' && parsed.data?.workflows) {
        const w = parsed.data.workflows;
        setWorkflows(parseWorkflowsState(w));
        setLastRefresh(new Date());
      }
    } catch {
      // non-JSON WS messages are ignored
    }
  }, [lastMessage]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] tracking-tight leading-none">
            Workflow Monitor
          </h1>
          <p className="text-[13px] text-[#4B5563] mt-1.5 flex items-center gap-1.5">
            <Clock size={12} />
            {lastRefresh
              ? `Last sync ${lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Fetching…'}
          </p>
        </div>

        <button
          onClick={() => void loadWorkflows(true)}
          disabled={refreshing}
          className={clsx(
            'flex items-center gap-2 rounded-lg border border-[#1E1E2E] bg-[#13131A]',
            'px-3 py-2 text-[13px] text-[#6B7280] transition-all duration-200',
            'hover:border-[rgba(0,255,136,0.3)] hover:text-[#00FF88]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,255,136,0.6)]',
            refreshing && 'opacity-60 cursor-not-allowed',
          )}
          aria-label="Refresh workflow data"
        >
          <RefreshCw
            size={14}
            className={refreshing ? 'animate-spin' : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#EF4444]" role="alert">
          <AlertTriangle size={15} />
          <span>Unable to reach API — showing last known data</span>
        </div>
      )}

      {/* Pipeline visualization */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="rounded-xl border border-[#1E1E2E] bg-[#0D0D14] p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(0,255,136,0.15)] to-transparent" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#4B5563] px-3">
            Pipeline
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(0,255,136,0.15)] to-transparent" />
        </div>

        <PipelineViz workflows={workflows} />

        {/* Pipeline legend */}
        <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-[rgba(30,30,46,0.5)]">
          {[
            { color: '#00FF88', label: 'Active (< 5m)' },
            { color: '#F97316', label: 'Stale (5–10m)' },
            { color: '#374151', label: 'Unknown' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-[#4B5563]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div
              className="h-px w-6"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(0,255,136,0.5) 50%, transparent 50%)',
                backgroundSize: '8px 1px',
              }}
            />
            <span className="text-[10px] text-[#4B5563]">Event flow</span>
          </div>
        </div>
      </motion.div>

      {/* Section divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[rgba(30,30,46,0.6)]" />
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[#4B5563] flex items-center gap-1.5">
          <ChevronRight size={12} />
          Workflow Details
        </span>
        <div className="h-px flex-1 bg-[rgba(30,30,46,0.6)]" />
      </div>

      {/* Workflow cards */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} className="h-52" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Wf01Card data={workflows.wf01} />
          <Wf02Card data={workflows.wf02} />
          <Wf03Card data={workflows.wf03} />
          <Wf04Card data={workflows.wf04} />
          <Wf05Card data={workflows.wf05} />
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronUp,
  Filter,
  Grid3X3,
  List,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { fetchCameras, RateLimitError, type Camera as CameraType } from '@/lib/api';
import { StatusDot, type DotStatus } from '@/components/ui/status-dot';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, Skeleton } from '@/components/ui/skeleton';
import { AnalyticsPanel } from '@/components/analytics-panel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusToDot(status: string): DotStatus {
  const s = status.toLowerCase();
  if (s === 'recording' || s === 'online') return 'online';
  if (s === 'offline' || s === 'unauthorized') return 'error';
  return 'unknown';
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'recording') return 'text-[#00FF88]';
  if (s === 'online') return 'text-[#22C55E]';
  if (s === 'offline' || s === 'unauthorized') return 'text-[#EF4444]';
  return 'text-[#6B7280]';
}

type FilterValue = 'all' | 'online' | 'offline' | 'recording';
type SortField = keyof Pick<CameraType, 'name' | 'status' | 'model' | 'vendor' | 'mac' | 'physicalId'>;

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
  { label: 'Recording', value: 'recording' },
];

const TABLE_COLUMNS: { key: SortField; label: string; className?: string }[] = [
  { key: 'name',       label: 'Name',        className: 'w-[28%]' },
  { key: 'status',     label: 'Status',      className: 'w-[12%]' },
  { key: 'model',      label: 'Model',       className: 'w-[16%]' },
  { key: 'vendor',     label: 'Vendor',      className: 'w-[14%]' },
  { key: 'mac',        label: 'MAC',         className: 'w-[16%]' },
  { key: 'physicalId', label: 'Physical ID', className: 'w-[14%]' },
];

// ── Card entrance animation variants ─────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.035,
      duration: 0.28,
      ease: 'easeOut' as const,
    },
  }),
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CameraCard({
  camera,
  index,
  selected,
  onClick,
}: {
  camera: CameraType;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      layout
      onClick={onClick}
      className={clsx(
        'group relative rounded-xl border bg-[#13131A] p-4 cursor-pointer',
        'transition-all duration-200 ease-out',
        selected
          ? 'border-[#00FF88] shadow-[0_0_12px_rgba(0,255,136,0.18)]'
          : 'border-[#1E1E2E] hover:border-[rgba(0,255,136,0.35)] hover:shadow-[0_0_8px_rgba(0,255,136,0.08)]',
        'hover:-translate-y-px',
      )}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top row: name + status dot */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p
          className="text-sm font-semibold text-[#E0E0E0] leading-tight truncate flex-1 min-w-0"
          title={camera.name}
        >
          {camera.name}
        </p>
        <StatusDot status={statusToDot(camera.status)} size="md" />
      </div>

      {/* Status label */}
      <p className={clsx('text-xs font-medium mb-3', statusColor(camera.status))}>
        {camera.status}
      </p>

      {/* Footer metadata */}
      <div className="flex flex-col gap-0.5 border-t border-[#1E1E2E] pt-2.5 mt-auto">
        <p className="text-xs text-[#4B5563] truncate" title={camera.model}>
          {camera.model || '—'}
        </p>
        <p className="text-xs text-[#374151] truncate" title={camera.vendor}>
          {camera.vendor || '—'}
        </p>
      </div>

      {/* Selected accent line */}
      {selected && (
        <div
          className="absolute inset-x-0 bottom-0 h-px rounded-b-xl bg-[#00FF88] opacity-60"
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}

function SortHeader({
  col,
  sortBy,
  sortDir,
  onSort,
}: {
  col: { key: SortField; label: string; className?: string };
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortField) => void;
}) {
  const active = sortBy === col.key;
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest',
        'select-none cursor-pointer transition-colors duration-150',
        active ? 'text-[#00FF88]' : 'text-[#4B5563] hover:text-[#6B7280]',
        col.className,
      )}
      onClick={() => onSort(col.key)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <span className="inline-flex items-center gap-1">
        {col.label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp size={12} className="text-[#00FF88]" aria-hidden="true" />
          ) : (
            <ChevronDown size={12} className="text-[#00FF88]" aria-hidden="true" />
          )
        ) : (
          <ChevronDown size={12} className="opacity-30" aria-hidden="true" />
        )}
      </span>
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CamerasPage() {
  const [cameras, setCameras]   = useState<CameraType[] | null>(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<FilterValue>('all');
  const [view, setView]         = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy]     = useState<SortField>('name');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const pollDelayRef = useRef(30_000);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await fetchCameras();
      setCameras(data);
      setFetchError(false);
      pollDelayRef.current = 30_000; // reset on success
    } catch (err) {
      // On first load (cameras still null), surface the error to the user.
      // Use functional state access to avoid stale closure (cameras is always
      // null in this callback because deps is []).
      setCameras((prev) => {
        if (prev === null) setFetchError(true);
        return prev;
      });
      // Back off on rate limit
      if (err instanceof RateLimitError) {
        pollDelayRef.current = Math.min(err.retryAfterS * 1000, 120_000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(() => {
        void load(false).then(() => { if (!cancelled) schedule(); });
      }, pollDelayRef.current);
    }

    // Initial load, then start polling
    void load(true).then(() => { if (!cancelled) schedule(); });

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [load]);

  // ── Derived stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!cameras) return { total: 0, online: 0, offline: 0 };
    const online = cameras.filter(
      (c) => {
        const s = c.status?.toLowerCase();
        return s === 'online' || s === 'recording';
      },
    ).length;
    return { total: cameras.length, online, offline: cameras.length - online };
  }, [cameras]);

  // ── Filtering + sorting ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!cameras) return [];
    return cameras
      .filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        const s = c.status?.toLowerCase();
        if (filter === 'online')
          return s === 'online' || s === 'recording';
        if (filter === 'offline') return s === 'offline';
        if (filter === 'recording') return s === 'recording';
        return true;
      })
      .sort((a, b) => {
        const aVal = (a as unknown as Record<string, string>)[sortBy] ?? '';
        const bVal = (b as unknown as Record<string, string>)[sortBy] ?? '';
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
  }, [cameras, search, filter, sortBy, sortDir]);

  // ── Sort handler ────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (key: SortField) => {
      if (sortBy === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(key);
        setSortDir('asc');
      }
    },
    [sortBy],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 animate-fade-in">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] tracking-tight">
            Cameras
          </h1>
          <p className="mt-1 text-sm text-[#4B5563]">
            TP-Link VIGI camera fleet — live status from NX Witness
          </p>
        </div>

        <button
          onClick={() => setShowAnalytics((v) => !v)}
          className={clsx(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all shrink-0',
            showAnalytics
              ? 'border-[rgba(0,255,136,0.4)] bg-[rgba(0,255,136,0.08)] text-[#00FF88]'
              : 'border-[#1E1E2E] bg-[#13131A] text-[#6B7280] hover:text-[#E0E0E0] hover:border-[rgba(0,255,136,0.25)]',
          )}
        >
          <Activity size={14} />
          {showAnalytics ? 'Hide Analytics' : 'Analytics Manager'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Cameras"
          value={cameras === null ? 0 : stats.total}
          icon={Camera}
          variant="blue"
          loading={loading && cameras === null}
        />
        <StatCard
          label="Online"
          value={cameras === null ? 0 : stats.online}
          icon={Wifi}
          variant="green"
          loading={loading && cameras === null}
        />
        <StatCard
          label="Offline"
          value={cameras === null ? 0 : stats.offline}
          icon={WifiOff}
          variant={stats.offline > 0 ? 'red' : 'green'}
          loading={loading && cameras === null}
        />
      </div>

      {/* Analytics panel */}
      <AnimatePresence>
        {showAnalytics && (
          <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
        )}
      </AnimatePresence>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2.5">

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search cameras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(
              'w-full rounded-lg border border-[#1E1E2E] bg-[#13131A]',
              'pl-8 pr-3 py-2 text-sm text-[#E0E0E0] placeholder-[#374151]',
              'outline-none transition-colors duration-150',
              'focus:border-[rgba(0,255,136,0.4)] focus:ring-1 focus:ring-[rgba(0,255,136,0.15)]',
            )}
            aria-label="Search cameras by name"
          />
        </div>

        {/* Filter icon (decorative) */}
        <Filter size={14} className="text-[#4B5563] hidden sm:block" aria-hidden="true" />

        {/* Filter buttons */}
        <div
          className="flex items-center gap-1 rounded-lg border border-[#1E1E2E] bg-[#13131A] p-1"
          role="group"
          aria-label="Filter cameras"
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                filter === opt.value
                  ? 'bg-[#00FF88] text-[#0A0A0F] shadow-[0_0_6px_rgba(0,255,136,0.35)]'
                  : 'text-[#6B7280] hover:text-[#E0E0E0] hover:bg-[#1E1E2E]',
              )}
              aria-pressed={filter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div
          className="flex items-center gap-1 rounded-lg border border-[#1E1E2E] bg-[#13131A] p-1"
          role="group"
          aria-label="Toggle view"
        >
          <button
            onClick={() => setView('grid')}
            className={clsx(
              'rounded-md p-2 transition-all duration-150',
              view === 'grid'
                ? 'bg-[rgba(0,255,136,0.12)] text-[#00FF88]'
                : 'text-[#4B5563] hover:text-[#6B7280] hover:bg-[#1E1E2E]',
            )}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <Grid3X3 size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => setView('table')}
            className={clsx(
              'rounded-md p-2 transition-all duration-150',
              view === 'table'
                ? 'bg-[rgba(0,255,136,0.12)] text-[#00FF88]'
                : 'text-[#4B5563] hover:text-[#6B7280] hover:bg-[#1E1E2E]',
            )}
            aria-label="Table view"
            aria-pressed={view === 'table'}
          >
            <List size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={() => void load(true)}
          disabled={loading}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border border-[#1E1E2E] bg-[#13131A]',
            'px-3 py-2 text-xs font-medium text-[#6B7280]',
            'hover:text-[#E0E0E0] hover:border-[rgba(0,255,136,0.25)] transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          aria-label="Refresh camera list"
        >
          <RefreshCw
            size={13}
            className={clsx('transition-transform', loading && 'animate-spin')}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Grid View ─────────────────────────────────────────────────────────── */}

      <AnimatePresence mode="wait">
        {view === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {loading && cameras === null ? (
              // Loading skeleton grid
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonCard key={i} className="h-[118px]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Camera size={36} className="text-[#1E1E2E] mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-[#4B5563]">
                  No cameras match your filters
                </p>
                <p className="mt-1 text-xs text-[#374151]">
                  Try adjusting your search or filter selection
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((cam, i) => (
                  <CameraCard
                    key={cam.id}
                    camera={cam}
                    index={i}
                    selected={selected === cam.id}
                    onClick={() =>
                      setSelected((prev) => (prev === cam.id ? null : cam.id))
                    }
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Table View ──────────────────────────────────────────────────────── */}

        {view === 'table' && (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-x-auto rounded-xl border border-[#1E1E2E]"
          >
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[#0E0E18] border-b border-[#1E1E2E]">
                <tr>
                  {TABLE_COLUMNS.map((col) => (
                    <SortHeader
                      key={col.key}
                      col={col}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && cameras === null ? (
                  // Skeleton rows
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1E1E2E]">
                      {TABLE_COLUMNS.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          <Skeleton height="h-3" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={TABLE_COLUMNS.length}
                      className="px-4 py-16 text-center text-sm text-[#4B5563]"
                    >
                      No cameras match your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((cam, i) => (
                    <motion.tr
                      key={cam.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.018, duration: 0.2 }}
                      onClick={() =>
                        setSelected((prev) => (prev === cam.id ? null : cam.id))
                      }
                      className={clsx(
                        'border-b border-[#1E1E2E] cursor-pointer',
                        'transition-colors duration-100',
                        i % 2 === 0 ? 'bg-[#13131A]' : 'bg-[#0F0F17]',
                        selected === cam.id
                          ? 'bg-[rgba(0,255,136,0.06)] border-l-2 border-l-[#00FF88]'
                          : 'hover:bg-[#1A1A24]',
                      )}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-[#E0E0E0] truncate max-w-0">
                        <span className="block truncate" title={cam.name}>
                          {cam.name}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <StatusDot status={statusToDot(cam.status)} size="sm" />
                          <span className={clsx('text-xs font-medium', statusColor(cam.status))}>
                            {cam.status}
                          </span>
                        </span>
                      </td>

                      {/* Model */}
                      <td
                        className="px-4 py-3 text-[#6B7280] truncate max-w-0"
                        title={cam.model}
                      >
                        <span className="block truncate">{cam.model || '—'}</span>
                      </td>

                      {/* Vendor */}
                      <td
                        className="px-4 py-3 text-[#6B7280] truncate max-w-0"
                        title={cam.vendor}
                      >
                        <span className="block truncate">{cam.vendor || '—'}</span>
                      </td>

                      {/* MAC */}
                      <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">
                        {cam.mac || '—'}
                      </td>

                      {/* Physical ID */}
                      <td
                        className="px-4 py-3 font-mono text-xs text-[#4B5563] truncate max-w-0"
                        title={cam.physicalId}
                      >
                        <span className="block truncate">{cam.physicalId || '—'}</span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {fetchError && cameras === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <WifiOff size={36} className="text-[#EF4444] mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-[#EF4444] mb-1">
            Failed to load cameras
          </p>
          <p className="text-xs text-[#4B5563] mb-4">
            Could not reach the backend API. Check your connection.
          </p>
          <button
            onClick={() => { setFetchError(false); void load(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E1E2E] bg-[#13131A] px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#E0E0E0] hover:border-[rgba(0,255,136,0.25)] transition-all"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Footer count */}
      <p className="text-xs text-[#374151] pb-2" aria-live="polite" aria-atomic="true">
        {cameras === null
          ? (fetchError ? 'Unable to load cameras' : 'Loading cameras…')
          : `Showing ${filtered.length} of ${cameras.length} camera${cameras.length !== 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

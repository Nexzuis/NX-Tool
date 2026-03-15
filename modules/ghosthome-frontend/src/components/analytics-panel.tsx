'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Activity,
  Loader2,
  Power,
  PowerOff,
  Search,
  X,
} from 'lucide-react';
import {
  fetchAnalytics,
  toggleAnalytics,
  bulkToggleAnalytics,
  type AnalyticsCamera,
} from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(cam: AnalyticsCamera): string {
  if (!cam.hasAgent) return 'No Agent';
  return cam.analyticsEnabled ? 'Enabled' : 'Disabled';
}

function statusColor(cam: AnalyticsCamera): string {
  if (!cam.hasAgent) return 'text-[#4B5563]';
  return cam.analyticsEnabled ? 'text-[#00FF88]' : 'text-[#EF4444]';
}

function statusDotColor(cam: AnalyticsCamera): string {
  if (!cam.hasAgent) return 'bg-[#374151]';
  return cam.analyticsEnabled ? 'bg-[#00FF88]' : 'bg-[#EF4444]';
}

type FilterValue = 'all' | 'enabled' | 'disabled';

// ── Main Component ──────────────────────────────────────────────────────────

export function AnalyticsPanel({ onClose }: { onClose: () => void }) {
  const [cameras, setCameras] = useState<AnalyticsCamera[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAnalytics();
      setCameras(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!cameras) return { total: 0, enabled: 0, disabled: 0, noAgent: 0 };
    const enabled = cameras.filter((c) => c.hasAgent && c.analyticsEnabled).length;
    const noAgent = cameras.filter((c) => !c.hasAgent).length;
    return {
      total: cameras.length,
      enabled,
      disabled: cameras.length - enabled - noAgent,
      noAgent,
    };
  }, [cameras]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!cameras) return [];
    return cameras
      .filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'enabled') return c.hasAgent && c.analyticsEnabled;
        if (filter === 'disabled') return c.hasAgent && !c.analyticsEnabled;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cameras, search, filter]);

  // ── Toggle handlers ───────────────────────────────────────────────────────

  const handleToggle = async (cam: AnalyticsCamera) => {
    if (!cam.hasAgent || toggling.has(cam.id)) return;

    setToggling((prev) => new Set(prev).add(cam.id));
    try {
      await toggleAnalytics(cam.id, !cam.analyticsEnabled);
      // Optimistic update
      setCameras((prev) =>
        prev?.map((c) =>
          c.id === cam.id ? { ...c, analyticsEnabled: !c.analyticsEnabled } : c,
        ) ?? null,
      );
    } catch {
      // Refresh to get real state
      await load();
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(cam.id);
        return next;
      });
    }
  };

  const handleBulk = async (enabled: boolean) => {
    if (bulkLoading) return;
    setBulkLoading(true);
    try {
      await bulkToggleAnalytics(enabled);
      // Refresh to get real state
      await load();
    } catch {
      setError('Bulk toggle failed — try again');
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-[#1E1E2E] bg-[#0D0D14] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E1E2E] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,255,136,0.1)]">
            <Activity size={16} className="text-[#00FF88]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#E0E0E0] tracking-tight">
              Analytics Manager
            </h2>
            <p className="text-[11px] text-[#4B5563]">
              CVEDIA-RT person detection per camera
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-[#4B5563] hover:text-[#E0E0E0] hover:bg-[#1A1A24] transition-colors"
          aria-label="Close analytics panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Stats + Bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1E2E] px-5 py-3">
        {/* Stat chips */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#6B7280]">
            <span className="font-semibold text-[#E0E0E0]">{stats.total}</span> cameras
          </span>
          <span className="text-[#1E1E2E]">|</span>
          <span className="text-[#00FF88]">
            <span className="font-semibold">{stats.enabled}</span> enabled
          </span>
          <span className="text-[#1E1E2E]">|</span>
          <span className="text-[#EF4444]">
            <span className="font-semibold">{stats.disabled}</span> disabled
          </span>
        </div>

        {/* Bulk buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleBulk(true)}
            disabled={bulkLoading}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              'border border-[rgba(0,255,136,0.3)] text-[#00FF88]',
              'hover:bg-[rgba(0,255,136,0.08)] hover:border-[rgba(0,255,136,0.5)]',
              bulkLoading && 'opacity-50 cursor-not-allowed',
            )}
          >
            {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
            Enable All
          </button>
          <button
            onClick={() => void handleBulk(false)}
            disabled={bulkLoading}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              'border border-[rgba(239,68,68,0.3)] text-[#EF4444]',
              'hover:bg-[rgba(239,68,68,0.08)] hover:border-[rgba(239,68,68,0.5)]',
              bulkLoading && 'opacity-50 cursor-not-allowed',
            )}
          >
            {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <PowerOff size={12} />}
            Disable All
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#1E1E2E] px-5 py-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563] pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search cameras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(
              'w-full rounded-lg border border-[#1E1E2E] bg-[#13131A]',
              'pl-8 pr-3 py-1.5 text-xs text-[#E0E0E0] placeholder-[#374151]',
              'outline-none transition-colors',
              'focus:border-[rgba(0,255,136,0.4)]',
            )}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[#1E1E2E] bg-[#13131A] p-0.5">
          {(['all', 'enabled', 'disabled'] as FilterValue[]).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={clsx(
                'rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all',
                filter === v
                  ? 'bg-[#00FF88] text-[#0A0A0F]'
                  : 'text-[#6B7280] hover:text-[#E0E0E0]',
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-[#4B5563]">
          {filtered.length} shown
        </span>
      </div>

      {/* Camera list */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[#4B5563]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#4B5563]">
            No cameras match your filter
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[#0E0E18] border-b border-[#1E1E2E]">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4B5563]">
                  Camera
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4B5563]">
                  Camera Status
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4B5563]">
                  Analytics
                </th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#4B5563]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cam, i) => {
                const isToggling = toggling.has(cam.id);
                return (
                  <tr
                    key={cam.id}
                    className={clsx(
                      'border-b border-[#1E1E2E] transition-colors',
                      i % 2 === 0 ? 'bg-[#13131A]' : 'bg-[#0F0F17]',
                      'hover:bg-[#1A1A24]',
                    )}
                  >
                    {/* Name */}
                    <td className="px-5 py-2.5 font-medium text-[#E0E0E0] max-w-0">
                      <span className="block truncate" title={cam.name}>
                        {cam.name}
                      </span>
                    </td>

                    {/* Camera status */}
                    <td className="px-3 py-2.5">
                      <span className={clsx(
                        'text-[11px] font-medium',
                        cam.status?.toLowerCase() === 'recording' || cam.status?.toLowerCase() === 'online'
                          ? 'text-[#22C55E]'
                          : 'text-[#EF4444]',
                      )}>
                        {cam.status}
                      </span>
                    </td>

                    {/* Analytics status */}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 rounded-full flex-shrink-0',
                            statusDotColor(cam),
                          )}
                        />
                        <span className={clsx('text-[11px] font-medium', statusColor(cam))}>
                          {statusLabel(cam)}
                        </span>
                      </span>
                    </td>

                    {/* Toggle button */}
                    <td className="px-5 py-2.5 text-right">
                      {cam.hasAgent ? (
                        <button
                          onClick={() => void handleToggle(cam)}
                          disabled={isToggling}
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                            cam.analyticsEnabled
                              ? 'border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]'
                              : 'border border-[rgba(0,255,136,0.3)] text-[#00FF88] hover:bg-[rgba(0,255,136,0.08)]',
                            isToggling && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          {isToggling ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : cam.analyticsEnabled ? (
                            <PowerOff size={10} />
                          ) : (
                            <Power size={10} />
                          )}
                          {cam.analyticsEnabled ? 'Disable' : 'Enable'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#374151]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}

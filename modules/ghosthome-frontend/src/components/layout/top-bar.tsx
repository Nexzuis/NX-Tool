'use client';

import { clsx } from 'clsx';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusDot } from '@/components/ui/status-dot';

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/workflows': 'Workflow Monitor',
  '/cameras':   'Cameras',
  '/incidents': 'Incidents',
  '/assistant': 'AI Assistant',
  '/settings':  'Settings',
};

function resolvePageTitle(pathname: string): string {
  // Exact match first
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname] ?? 'Page';

  // Prefix match (nested routes)
  for (const [prefix, label] of Object.entries(breadcrumbMap)) {
    if (pathname.startsWith(`${prefix}/`)) return label ?? 'Page';
  }

  return 'Ghosthome Monitor';
}

/** Format a Date as HH:MM:SS in Africa/Johannesburg (UTC+2) */
function formatJHBTime(date: Date): string {
  return date.toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface TopBarProps {
  connected: boolean;
  className?: string;
}

export function TopBar({ connected, className }: TopBarProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  const [time, setTime] = useState<string>('');

  useEffect(() => {
    setTime(formatJHBTime(new Date()));
    const id = setInterval(() => {
      setTime(formatJHBTime(new Date()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className={clsx(
        'flex h-14 flex-shrink-0 items-center justify-between',
        'border-b border-[#1E1E2E] bg-[#0A0A0F]/80 backdrop-blur-sm',
        'px-6 sticky top-0 z-30',
        className,
      )}
    >
      {/* ── Left: breadcrumb ────────────────────────────── */}
      <div className="flex items-center gap-2" aria-label="Page location">
        <span className="text-xs font-medium text-[#4B5563] uppercase tracking-widest">
          Ghosthome
        </span>
        <span className="text-[#1E1E2E]" aria-hidden="true">/</span>
        <span className="text-sm font-semibold text-[#E0E0E0]">
          {pageTitle}
        </span>
      </div>

      {/* ── Right: time + connection indicator ──────────── */}
      <div className="flex items-center gap-5">
        {/* Clock */}
        <div
          className="flex items-center gap-2"
          aria-label={`Current time in Johannesburg: ${time}`}
        >
          <span className="font-mono text-xs font-medium text-[#4B5563] tabular-nums" suppressHydrationWarning>
            {time}
          </span>
          <span className="text-[10px] font-medium text-[#2D2D3E] uppercase tracking-widest">
            SAST
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[#1E1E2E]" aria-hidden="true" />

        {/* Connection indicator */}
        <div
          className="flex items-center gap-2"
          aria-live="polite"
          aria-label={`API connection: ${connected ? 'connected' : 'disconnected'}`}
        >
          <StatusDot
            status={connected ? 'online' : 'error'}
            size="sm"
            pulse={connected}
          />
          <span
            className={clsx(
              'text-xs font-medium hidden sm:block',
              connected ? 'text-[#00FF88]' : 'text-[#EF4444]',
            )}
          >
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}

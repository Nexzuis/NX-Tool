'use client';

import { clsx } from 'clsx';
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { StatusDot } from '@/components/ui/status-dot';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/workflows',  label: 'Workflows',  icon: Activity },
  { href: '/cameras',    label: 'Cameras',    icon: Camera },
  { href: '/incidents',  label: 'Incidents',  icon: AlertTriangle },
  { href: '/settings',   label: 'Settings',   icon: Settings },
];

interface SidebarProps {
  connected: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ connected, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col',
        'bg-[#0D0D14] border-r border-[#1E1E2E]',
        'transition-all duration-200 ease-out',
      )}
      style={{ width: collapsed ? 64 : 240 }}
      aria-label="Main navigation"
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex h-16 flex-shrink-0 items-center px-4">
        <div
          className={clsx(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(0,255,136,0.1)]',
            !collapsed && 'mr-3',
          )}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="3.5" fill="#00FF88" />
            <circle cx="9" cy="9" r="7" stroke="#00FF88" strokeOpacity="0.3" strokeWidth="1.5" />
            <circle cx="9" cy="9" r="4.5" stroke="#00FF88" strokeOpacity="0.15" strokeWidth="4" />
          </svg>
        </div>

        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold tracking-[0.15em] text-[#00FF88] uppercase leading-none">
              Ghosthome
            </p>
            <p className="text-[10px] font-medium tracking-[0.2em] text-[#4B5563] uppercase leading-none mt-0.5">
              Monitor
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="mx-3 h-px bg-[#1E1E2E]" aria-hidden="true" />

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Pages">
        <ul className="space-y-0.5" role="list">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={clsx(
                    'group relative flex h-10 items-center gap-3 rounded-lg px-3',
                    'transition-all duration-150 ease-out',
                    collapsed && 'justify-center',
                    isActive
                      ? 'bg-[rgba(0,255,136,0.08)] text-[#00FF88]'
                      : 'text-[#6B7280] hover:bg-[#1A1A24] hover:text-[#E0E0E0]',
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#00FF88]"
                      aria-hidden="true"
                    />
                  )}

                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2 : 1.75}
                    className="flex-shrink-0"
                    aria-hidden="true"
                  />

                  {!collapsed && (
                    <span className="text-sm font-medium leading-none">
                      {label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Collapse toggle ─────────────────────────────────── */}
      <div className="mx-3 h-px bg-[#1E1E2E]" aria-hidden="true" />
      <button
        onClick={onToggle}
        className={clsx(
          'flex h-10 items-center gap-2 mx-2 my-1 rounded-lg px-3',
          'text-[#4B5563] hover:text-[#E0E0E0] hover:bg-[#1A1A24]',
          'transition-all duration-150 ease-out',
          collapsed && 'justify-center',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={16} className="flex-shrink-0" />
        ) : (
          <>
            <ChevronLeft size={16} className="flex-shrink-0" />
            <span className="text-xs font-medium">Collapse</span>
          </>
        )}
      </button>

      {/* ── Connection status footer ──────────────────────────── */}
      <div className="mx-3 h-px bg-[#1E1E2E]" aria-hidden="true" />
      <div className={clsx(
        'flex h-14 flex-shrink-0 items-center px-4',
        collapsed && 'justify-center px-0',
      )}>
        <StatusDot
          status={connected ? 'online' : 'error'}
          size="sm"
          pulse={connected}
        />
        {!collapsed && (
          <span className="ml-2 text-xs font-medium text-[#4B5563]">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        )}
      </div>
    </aside>
  );
}

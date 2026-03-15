'use client';

import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

export type StatCardVariant = 'default' | 'green' | 'red' | 'orange' | 'blue';

interface TrendInfo {
  direction: 'up' | 'down' | 'neutral';
  label: string;
}

interface ProgressInfo {
  value: number;
  max: number;
  color?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: TrendInfo;
  progress?: ProgressInfo | undefined;
  icon?: LucideIcon;
  variant?: StatCardVariant;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<
  StatCardVariant,
  {
    border: string;
    hoverBorder: string;
    iconBg: string;
    iconColor: string;
    accentColor: string;
  }
> = {
  default: {
    border:       'border-[#1E1E2E]',
    hoverBorder:  'hover:border-[rgba(0,255,136,0.25)]',
    iconBg:       'bg-[rgba(0,255,136,0.08)]',
    iconColor:    'text-[#00FF88]',
    accentColor:  'text-[#00FF88]',
  },
  green: {
    border:       'border-[rgba(34,197,94,0.2)]',
    hoverBorder:  'hover:border-[rgba(34,197,94,0.45)]',
    iconBg:       'bg-[rgba(34,197,94,0.08)]',
    iconColor:    'text-[#22C55E]',
    accentColor:  'text-[#22C55E]',
  },
  red: {
    border:       'border-[rgba(239,68,68,0.2)]',
    hoverBorder:  'hover:border-[rgba(239,68,68,0.45)]',
    iconBg:       'bg-[rgba(239,68,68,0.08)]',
    iconColor:    'text-[#EF4444]',
    accentColor:  'text-[#EF4444]',
  },
  orange: {
    border:       'border-[rgba(249,115,22,0.2)]',
    hoverBorder:  'hover:border-[rgba(249,115,22,0.45)]',
    iconBg:       'bg-[rgba(249,115,22,0.08)]',
    iconColor:    'text-[#F97316]',
    accentColor:  'text-[#F97316]',
  },
  blue: {
    border:       'border-[rgba(59,130,246,0.2)]',
    hoverBorder:  'hover:border-[rgba(59,130,246,0.45)]',
    iconBg:       'bg-[rgba(59,130,246,0.08)]',
    iconColor:    'text-[#3B82F6]',
    accentColor:  'text-[#3B82F6]',
  },
};

const trendColor = {
  up:      'text-[#22C55E]',
  down:    'text-[#EF4444]',
  neutral: 'text-[#6B7280]',
};

/** Auto-select progress bar color based on percentage */
function progressColor(pct: number, override?: string): string {
  if (override) return override;
  if (pct >= 85) return '#EF4444';
  if (pct >= 70) return '#F97316';
  return '#22C55E';
}

export function StatCard({
  label,
  value,
  subtitle,
  trend,
  progress,
  icon: Icon,
  variant = 'default',
  loading = false,
  className,
  onClick,
}: StatCardProps) {
  const styles = variantStyles[variant];
  const isInteractive = onClick !== undefined;

  if (loading) {
    return (
      <div
        className={clsx(
          'rounded-xl border bg-[#13131A] p-5',
          styles.border,
          className,
        )}
        aria-hidden="true"
      >
        {/* Shimmer skeleton */}
        <div className="mb-3 h-3 w-20 animate-shimmer rounded" />
        <div className="mb-2 h-8 w-2/3 animate-shimmer rounded" />
        <div className="h-3 w-1/2 animate-shimmer rounded" />
      </div>
    );
  }

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={clsx(
        'group relative rounded-xl border bg-[#13131A] p-5',
        'transition-all duration-200 ease-out',
        styles.border,
        styles.hoverBorder,
        'hover:bg-[#1A1A24]',
        isInteractive && 'cursor-pointer',
        className,
      )}
    >
      {/* Icon */}
      {Icon != null && (
        <div
          className={clsx(
            'mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg',
            styles.iconBg,
            styles.iconColor,
          )}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      )}

      {/* Label */}
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-[#4B5563]">
        {label}
      </p>

      {/* Value */}
      <p className="text-3xl font-bold leading-none tracking-tight text-[#E0E0E0]">
        {value}
      </p>

      {/* Progress bar */}
      {progress != null && (
        <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[#1E1E2E]">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, (progress.value / progress.max) * 100))}%`,
              backgroundColor: progressColor(
                (progress.value / progress.max) * 100,
                progress.color,
              ),
            }}
          />
        </div>
      )}

      {/* Subtitle */}
      {subtitle != null && (
        <p className="mt-2 text-sm text-[#6B7280]">{subtitle}</p>
      )}

      {/* Trend */}
      {trend != null && (
        <div
          className={clsx(
            'mt-2.5 flex items-center gap-1 text-xs font-medium',
            trendColor[trend.direction],
          )}
          aria-label={`Trend: ${trend.label}`}
        >
          {trend.direction === 'up' && (
            <TrendingUp size={13} aria-hidden="true" />
          )}
          {trend.direction === 'down' && (
            <TrendingDown size={13} aria-hidden="true" />
          )}
          <span>{trend.label}</span>
        </div>
      )}

      {/* Subtle bottom accent line on hover */}
      <div
        className={clsx(
          'absolute inset-x-0 bottom-0 h-px rounded-b-xl',
          'bg-gradient-to-r from-transparent via-current to-transparent',
          'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          styles.accentColor,
        )}
        aria-hidden="true"
      />
    </div>
  );
}

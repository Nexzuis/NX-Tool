import { clsx } from 'clsx';

export type DotStatus = 'online' | 'error' | 'warning' | 'unknown';

interface StatusDotProps {
  status: DotStatus;
  /** Show a pulsing animation (default: true for 'online' and 'error') */
  pulse?: boolean;
  /** Size override — default 8px dot */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label rendered next to the dot */
  label?: string;
  className?: string;
}

const colorMap: Record<DotStatus, string> = {
  online:  'bg-[#00FF88]',
  error:   'bg-[#EF4444]',
  warning: 'bg-[#F97316]',
  unknown: 'bg-[#4B5563]',
};

const glowMap: Record<DotStatus, string> = {
  online:  'shadow-[0_0_6px_rgba(0,255,136,0.7)]',
  error:   'shadow-[0_0_6px_rgba(239,68,68,0.7)]',
  warning: 'shadow-[0_0_6px_rgba(249,115,22,0.7)]',
  unknown: '',
};

const sizeMap = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

const ariaLabelMap: Record<DotStatus, string> = {
  online:  'Online',
  error:   'Error',
  warning: 'Warning',
  unknown: 'Unknown',
};

export function StatusDot({
  status,
  pulse,
  size = 'md',
  label,
  className,
}: StatusDotProps) {
  const shouldPulse = pulse ?? (status === 'online' || status === 'error');

  return (
    <span
      className={clsx('inline-flex items-center gap-2', className)}
      role="img"
      aria-label={ariaLabelMap[status]}
    >
      <span
        className={clsx(
          'inline-block flex-shrink-0 rounded-full',
          sizeMap[size],
          colorMap[status],
          glowMap[status],
          shouldPulse && 'animate-pulse-dot',
        )}
      />
      {label != null && (
        <span className="text-sm text-[#6B7280]">{label}</span>
      )}
    </span>
  );
}

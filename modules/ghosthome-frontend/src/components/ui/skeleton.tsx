import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  /** Number of rows to render (default 1) */
  rows?: number;
  /** Height class for each row (default h-4) */
  height?: string;
}

export function Skeleton({
  className,
  rows = 1,
  height = 'h-4',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={clsx('flex flex-col gap-2', className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'animate-shimmer rounded',
            height,
            // Last row slightly narrower for a natural look
            i === rows - 1 && rows > 1 ? 'w-3/4' : 'w-full',
          )}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Single-line inline skeleton */
export function SkeletonText({ width = 'w-24' }: { width?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading…"
      className={clsx('inline-block h-4 rounded animate-shimmer', width)}
    />
  );
}

/** Card-shaped skeleton block */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={clsx(
        'rounded-xl border border-[#1E1E2E] bg-[#13131A] p-5 animate-shimmer',
        className,
      )}
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}

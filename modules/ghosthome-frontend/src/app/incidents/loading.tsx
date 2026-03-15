import { SkeletonCard } from '@/components/ui/skeleton';

export default function IncidentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <div className="h-7 w-28 animate-shimmer rounded" />
        <div className="mt-2 h-4 w-72 animate-shimmer rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-shimmer rounded-lg border border-[#1E1E2E]"
          />
        ))}
      </div>

      {/* Incident cards */}
      <div className="flex flex-col gap-3">
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

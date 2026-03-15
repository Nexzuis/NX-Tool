import { SkeletonCard } from '@/components/ui/skeleton';

export default function CamerasLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <div className="h-7 w-28 animate-shimmer rounded" />
        <div className="mt-2 h-4 w-64 animate-shimmer rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>

      {/* Controls bar placeholder */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-48 animate-shimmer rounded-lg border border-[#1E1E2E]" />
        <div className="h-9 w-56 animate-shimmer rounded-lg border border-[#1E1E2E]" />
        <div className="flex-1" />
        <div className="h-9 w-20 animate-shimmer rounded-lg border border-[#1E1E2E]" />
      </div>

      {/* Camera grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} className="h-[118px]" />
        ))}
      </div>
    </div>
  );
}

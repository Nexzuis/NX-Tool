import { SkeletonCard } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <div className="h-7 w-32 animate-shimmer rounded" />
        <div className="mt-2 h-4 w-56 animate-shimmer rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>

      {/* Workflow status card */}
      <SkeletonCard className="h-64" />

      {/* Activity feed */}
      <SkeletonCard className="h-56" />
    </div>
  );
}

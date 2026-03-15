import { SkeletonCard } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <div className="h-7 w-28 animate-shimmer rounded" />
        <div className="mt-2 h-4 w-72 animate-shimmer rounded" />
      </div>

      {/* Two-column grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-56" />
        ))}
      </div>

      {/* About section */}
      <SkeletonCard className="h-28" />
    </div>
  );
}

import { SkeletonCard } from '@/components/ui/skeleton';

export default function WorkflowsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <div className="h-7 w-44 animate-shimmer rounded" />
        <div className="mt-2 h-4 w-36 animate-shimmer rounded" />
      </div>

      {/* Pipeline visualization */}
      <SkeletonCard className="h-[260px]" />

      {/* Section divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[rgba(30,30,46,0.6)]" />
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[#4B5563]">
          Workflow Details
        </span>
        <div className="h-px flex-1 bg-[rgba(30,30,46,0.6)]" />
      </div>

      {/* Workflow cards */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="h-52" />
        ))}
      </div>
    </div>
  );
}

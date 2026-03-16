import { SkeletonCard } from '@/components/ui/skeleton';

export default function AssistantLoading() {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-40 animate-shimmer rounded bg-[#1E1E2E]" />
        <div className="mt-2 h-4 w-64 animate-shimmer rounded bg-[#1E1E2E]" />
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 rounded-xl border border-[#1E1E2E] bg-[#13131A] p-6">
        <div className="flex flex-col gap-4">
          {/* AI message bubble skeleton */}
          <div className="flex gap-3">
            <div className="h-8 w-8 flex-shrink-0 animate-shimmer rounded-full bg-[#1E1E2E]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-shimmer rounded bg-[#1E1E2E]" />
              <div className="h-4 w-1/2 animate-shimmer rounded bg-[#1E1E2E]" />
            </div>
          </div>

          {/* User message skeleton */}
          <div className="flex justify-end">
            <div className="space-y-2">
              <div className="h-4 w-48 animate-shimmer rounded bg-[#1E1E2E]" />
            </div>
          </div>

          {/* AI message skeleton */}
          <div className="flex gap-3">
            <div className="h-8 w-8 flex-shrink-0 animate-shimmer rounded-full bg-[#1E1E2E]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full animate-shimmer rounded bg-[#1E1E2E]" />
              <div className="h-4 w-2/3 animate-shimmer rounded bg-[#1E1E2E]" />
              <div className="h-4 w-1/3 animate-shimmer rounded bg-[#1E1E2E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="h-14 animate-shimmer rounded-xl border border-[#1E1E2E] bg-[#13131A]" />
    </div>
  );
}

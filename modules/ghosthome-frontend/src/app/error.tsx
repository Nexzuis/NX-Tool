'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
        <AlertTriangle size={28} className="text-[#EF4444]" />
      </div>
      <h2 className="text-lg font-semibold text-[#E0E0E0]">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-[#6B7280]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg border border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.06)] px-5 py-2 text-sm font-medium text-[#00FF88] transition-all hover:bg-[rgba(0,255,136,0.12)] hover:border-[rgba(0,255,136,0.5)]"
      >
        Try again
      </button>
    </div>
  );
}

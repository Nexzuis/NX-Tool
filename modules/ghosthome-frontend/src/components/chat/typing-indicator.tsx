'use client';

import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  toolName?: string | null;
}

export function TypingIndicator({ toolName }: TypingIndicatorProps) {
  return (
    <div className="flex items-start gap-3">
      {/* AI avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(0,255,136,0.1)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="3" fill="#00FF88" />
          <circle cx="7" cy="7" r="5.5" stroke="#00FF88" strokeOpacity="0.3" strokeWidth="1" />
        </svg>
      </div>

      <div className="rounded-xl rounded-tl-sm bg-[#13131A] border border-[#1E1E2E] px-4 py-3">
        {toolName ? (
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2 w-2 rounded-full bg-[#00FF88]"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm text-[#6B7280]">
              {toolName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#6B7280]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

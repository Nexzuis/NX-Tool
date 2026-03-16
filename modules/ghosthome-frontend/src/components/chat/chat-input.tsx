'use client';

import { useRef, useState, useCallback } from 'react';
import { Send, Square } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
  onAbort?: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onAbort, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  return (
    <div className="flex items-end gap-2 rounded-xl border border-[#1E1E2E] bg-[#13131A] p-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => { setValue(e.target.value); handleInput(); }}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'AI assistant not configured' : 'Ask Ghosthome AI...'}
        disabled={disabled}
        rows={1}
        className={clsx(
          'flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[#E0E0E0]',
          'placeholder:text-[#4B5563] focus:outline-none',
          'max-h-[150px] scrollbar-thin',
        )}
      />

      {isLoading && onAbort ? (
        <button
          onClick={onAbort}
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            'bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20',
            'transition-colors duration-150',
          )}
          title="Stop generating"
        >
          <Square size={16} />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading || disabled}
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            'transition-colors duration-150',
            value.trim() && !isLoading && !disabled
              ? 'bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20'
              : 'text-[#4B5563] cursor-not-allowed',
          )}
          title="Send message"
        >
          <Send size={16} />
        </button>
      )}
    </div>
  );
}

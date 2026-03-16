'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Download, MessageCircle, RotateCcw } from 'lucide-react';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatInput } from '@/components/chat/chat-input';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { streamChat, fetchChatHistory, fetchSummary } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const DEFAULT_STARTERS = [
  'Which cameras are offline?',
  'Check server health',
  'Show analytics status',
  'How many cameras are online?',
  'List active incidents',
  'Show workflow status',
];

function buildContextualStarters(summary: { cameras?: { offline?: number }; incidentCount?: number; serverHealth?: { cpuPercent?: number | null } } | null): string[] {
  if (!summary) return DEFAULT_STARTERS;
  const starters: string[] = [];

  const offline = summary.cameras?.offline ?? 0;
  if (offline > 0) {
    starters.push(`Why are ${offline} cameras offline?`);
  }
  if ((summary.incidentCount ?? 0) > 0) {
    starters.push(`Show me the ${summary.incidentCount} active incidents`);
  }
  const cpu = summary.serverHealth?.cpuPercent;
  if (cpu != null && cpu > 70) {
    starters.push(`Server CPU is at ${Math.round(cpu)}% — what's going on?`);
  }

  starters.push('Show analytics status');
  starters.push('Check server health');
  starters.push('Show workflow status');

  return starters.slice(0, 6);
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('ghosthome-session-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ghosthome-session-id', id);
  }
  return id;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [starters, setStarters] = useState<string[]>(DEFAULT_STARTERS);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Initialize session ID on client + fetch contextual starters
  useEffect(() => {
    setSessionId(getSessionId());
    fetchSummary()
      .then(summary => setStarters(buildContextualStarters(summary)))
      .catch(() => { /* use defaults */ });
  }, []);

  // Load existing conversation history
  useEffect(() => {
    if (!sessionId || initialLoadDone.current) return;
    initialLoadDone.current = true;

    fetchChatHistory(sessionId)
      .then(history => {
        if (history && history.length > 0) {
          setMessages(history);
        }
      })
      .catch(() => { /* no history — fresh session */ });
  }, [sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, toolStatus]);

  const handleSend = useCallback((text: string) => {
    if (!sessionId) return;

    // [F3/F5] Block rapid sends — if there's an in-flight request, ignore new sends.
    // Use ref check (not stale state) to avoid closure issues.
    if (abortRef.current) return;

    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setToolStatus(null);

    let assistantText = '';
    let doneOrErrorCalled = false;

    const controller = streamChat(text, sessionId, {
      onToken: (token) => {
        assistantText += token;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.timestamp === '__streaming__') {
            return [...prev.slice(0, -1), { ...last, content: assistantText }];
          }
          return [...prev, {
            role: 'assistant',
            content: assistantText,
            timestamp: '__streaming__',
          }];
        });
      },
      onToolStart: (name) => {
        setToolStatus(name);
      },
      onToolEnd: () => {
        setToolStatus(null);
      },
      onDone: (fullMessage) => {
        if (doneOrErrorCalled) return;
        doneOrErrorCalled = true;
        const msg = fullMessage || assistantText;
        setMessages(prev => {
          const filtered = prev.filter(m => m.timestamp !== '__streaming__');
          if (!msg) return filtered;
          return [...filtered, {
            role: 'assistant',
            content: msg,
            timestamp: new Date().toISOString(),
          }];
        });
        setIsLoading(false);
        setToolStatus(null);
        abortRef.current = null;
      },
      onError: (msg) => {
        if (doneOrErrorCalled) return;
        doneOrErrorCalled = true;
        // [F1] Also clear loading state on error — onDone may never fire
        setMessages(prev => prev.filter(m => m.timestamp !== '__streaming__'));
        setError(msg);
        setIsLoading(false);
        setToolStatus(null);
        abortRef.current = null;
      },
    });

    abortRef.current = controller;
  }, [sessionId]);

  const handleAbort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
      setToolStatus(null);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const lines = messages.map(m => {
      const time = m.timestamp && m.timestamp !== '__streaming__'
        ? new Date(m.timestamp).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
        : '';
      return `[${time}] ${m.role === 'user' ? 'You' : 'Ghosthome AI'}:\n${m.content}\n`;
    });
    const text = `Ghosthome AI — Conversation Export\nSession: ${sessionId}\nExported: ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}\n${'─'.repeat(50)}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghosthome-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, sessionId]);

  const handleNewChat = useCallback(() => {
    // Abort any in-flight SSE request before clearing state
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const newId = crypto.randomUUID();
    localStorage.setItem('ghosthome-session-id', newId);
    setSessionId(newId);
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setToolStatus(null);
    initialLoadDone.current = true;
  }, []);

  const handleStarterClick = useCallback((question: string) => {
    handleSend(question);
  }, [handleSend]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-lg font-semibold text-[#E0E0E0]">AI Assistant</h1>
          <p className="text-xs text-[#4B5563]">
            Ask questions about your surveillance infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E1E2E] bg-[#13131A] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:border-[rgba(0,255,136,0.25)] hover:text-[#E0E0E0] transition-colors duration-150"
              title="Export conversation"
            >
              <Download size={12} />
              Export
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E1E2E] bg-[#13131A] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:border-[rgba(0,255,136,0.25)] hover:text-[#E0E0E0] transition-colors duration-150"
            title="Start new conversation"
          >
            <RotateCcw size={12} />
            New Chat
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-2.5 text-sm text-[#EF4444]"
        >
          {error}
        </motion.div>
      )}

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-xl border border-[#1E1E2E] bg-[#0A0A0F]/50 p-4 scrollbar-thin"
      >
        {isEmpty ? (
          /* Empty state with starter questions */
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(0,255,136,0.06)] border border-[rgba(0,255,136,0.1)]">
                <Bot size={28} className="text-[#00FF88]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#E0E0E0]">Ghosthome AI</p>
                <p className="text-xs text-[#4B5563] mt-0.5">
                  Ask me about cameras, analytics, server health, or incidents
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {starters.map(q => (
                <button
                  key={q}
                  onClick={() => handleStarterClick(q)}
                  className="rounded-lg border border-[#1E1E2E] bg-[#13131A] px-3 py-2.5 text-left text-xs text-[#6B7280] hover:border-[rgba(0,255,136,0.25)] hover:text-[#E0E0E0] transition-colors duration-150"
                >
                  <MessageCircle size={10} className="inline mr-1.5 opacity-50" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp === '__streaming__' ? null : msg.timestamp}
              />
            ))}

            {isLoading && !messages.some(m => m.timestamp === '__streaming__') && (
              <TypingIndicator toolName={toolStatus} />
            )}

            {isLoading && toolStatus && messages.some(m => m.timestamp === '__streaming__') && (
              <div className="flex items-center gap-2 pl-11">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-[#00FF88]"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs text-[#6B7280]">{toolStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3">
        <ChatInput
          onSend={handleSend}
          onAbort={handleAbort}
          isLoading={isLoading}
          disabled={!sessionId}
        />
      </div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | null;
}

/**
 * Enhanced markdown rendering: headers, bold, italic, code blocks, inline code,
 * bullet/numbered lists, tables, horizontal rules.
 */
function renderContent(text: string) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const langMatch = inner.match(/^(\w+)\n/);
      const code = langMatch ? inner.slice(langMatch[0].length) : inner;
      const lang = langMatch?.[1] || '';
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg bg-[#0A0A0F] border border-[#1E1E2E] p-3 text-xs"
        >
          {lang && (
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[#4B5563]">{lang}</div>
          )}
          <code className="text-[#E0E0E0]">{code}</code>
        </pre>
      );
    }

    // Check if this part contains a table
    const lines = part.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j] ?? '';

      // Table detection: line contains | and looks like a table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableBuffer.push(line);
        continue;
      }

      // Flush table buffer if we have one
      if (tableBuffer.length > 0) {
        elements.push(renderTable(tableBuffer, `tbl-${i}-${j}`));
        tableBuffer = [];
      }

      // Horizontal rule
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        elements.push(<hr key={`hr-${i}-${j}`} className="my-2 border-[#1E1E2E]" />);
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headerMatch && headerMatch[1] && headerMatch[2]) {
        const level = headerMatch[1].length;
        const hText = headerMatch[2];
        const hClass = level === 1
          ? 'text-base font-bold text-[#E0E0E0] mt-3 mb-1'
          : level === 2
            ? 'text-sm font-semibold text-[#E0E0E0] mt-2 mb-0.5'
            : 'text-sm font-medium text-[#E0E0E0] mt-1.5';
        elements.push(<div key={`h-${i}-${j}`} className={hClass}>{renderInline(hText)}</div>);
        continue;
      }

      // Bullet list items
      if (/^\s*[-*•]\s/.test(line)) {
        const content = line.replace(/^\s*[-*•]\s+/, '');
        const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
        elements.push(
          <div key={`li-${i}-${j}`} className="flex gap-1.5" style={{ paddingLeft: Math.min(indent * 4, 32) }}>
            <span className="text-[#00FF88] mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(content)}</span>
          </div>
        );
        continue;
      }

      // Numbered list items
      const numMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/);
      if (numMatch && numMatch[1] && numMatch[2]) {
        elements.push(
          <div key={`ol-${i}-${j}`} className="flex gap-1.5">
            <span className="text-[#00FF88] font-mono text-xs mt-0.5 flex-shrink-0 w-4 text-right">{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Regular line
      if (line.trim()) {
        elements.push(<span key={`l-${i}-${j}`}>{renderInline(line)}</span>);
      }
      if (j < lines.length - 1 && (line.trim() || lines[j + 1]?.trim())) {
        elements.push(<br key={`br-${i}-${j}`} />);
      }
    }

    // Flush remaining table
    if (tableBuffer.length > 0) {
      elements.push(renderTable(tableBuffer, `tbl-${i}-end`));
    }

    return <span key={i}>{elements}</span>;
  });
}

function renderTable(rows: string[], key: string) {
  const parseRow = (row: string) =>
    row.split('|').slice(1, -1).map(cell => cell.trim());

  // Skip separator rows (---|----|---)
  const dataRows = rows.filter(r => !/^\|[\s-:|]+\|$/.test(r.trim()));
  if (dataRows.length === 0) return null;

  const header = parseRow(dataRows[0] ?? '');
  const body = dataRows.slice(1).map(parseRow);

  return (
    <div key={key} className="my-2 overflow-x-auto rounded-lg border border-[#1E1E2E]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1E1E2E] bg-[#0A0A0F]">
            {header.map((cell, ci) => (
              <th key={ci} className="px-3 py-1.5 text-left font-semibold text-[#E0E0E0]">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-[#1E1E2E] last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-[#6B7280]">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(text: string) {
  // Bold, italic, inline code
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#E0E0E0]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i} className="italic text-[#E0E0E0]">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-[#0A0A0F] px-1.5 py-0.5 text-xs font-mono text-[#00FF88]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={clsx('flex max-w-[85%] gap-3', isUser && 'flex-row-reverse')}>
        {/* Avatar */}
        {!isUser && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(0,255,136,0.1)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="3" fill="#00FF88" />
              <circle cx="7" cy="7" r="5.5" stroke="#00FF88" strokeOpacity="0.3" strokeWidth="1" />
            </svg>
          </div>
        )}

        {/* Bubble */}
        <div
          className={clsx(
            'rounded-xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.15)] text-[#E0E0E0]'
              : 'rounded-tl-sm bg-[#13131A] border border-[#1E1E2E] text-[#E0E0E0]',
          )}
        >
          <div className="whitespace-pre-wrap break-words">
            {isUser ? content : renderContent(content)}
          </div>

          {timestamp && (
            <div className={clsx(
              'mt-1.5 text-[10px]',
              isUser ? 'text-right text-[rgba(0,255,136,0.4)]' : 'text-[#4B5563]',
            )}>
              {new Date(timestamp).toLocaleTimeString('en-ZA', {
                timeZone: 'Africa/Johannesburg',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

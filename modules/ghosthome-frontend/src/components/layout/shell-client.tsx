'use client';

import { useState } from 'react';
import { useWebSocketStatus } from '@/hooks/use-websocket';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

interface ShellClientProps {
  children: React.ReactNode;
}

export function ShellClient({ children }: ShellClientProps) {
  const { connected } = useWebSocketStatus();
  const [collapsed, setCollapsed] = useState(false);

  // Sidebar is always 64px when collapsed, 240px when expanded
  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0F]">
      <Sidebar
        connected={connected}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div
        className="flex flex-1 flex-col overflow-hidden transition-[margin] duration-200 ease-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <TopBar connected={connected} />
        <main
          className="flex-1 overflow-y-auto p-6"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

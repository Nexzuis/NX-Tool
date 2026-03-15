'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function getDefaultWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  // Derive from API URL if set (replace http(s) with ws(s), append /ws)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      // Remove any trailing slash then append /ws
      return parsed.origin + '/ws';
    } catch { /* fall through */ }
  }
  if (typeof window === 'undefined') return 'ws://localhost:4301/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
const WS_URL = getDefaultWsUrl();

const MAX_MESSAGES = 100;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export interface WsMessage {
  id: number;
  data: string;
  receivedAt: string;
}

export interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: WsMessage | null;
  messages: WsMessage[];
  send: (data: string) => void;
}

// ── Singleton manager ──────────────────────────────────────────────
// One WebSocket per URL, ref-counted across all hook consumers.

interface SocketEntry {
  ws: WebSocket | null;
  connected: boolean;
  messages: WsMessage[];
  lastMessage: WsMessage | null;
  refCount: number;
  retryDelay: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  messageId: number;
  listeners: Set<() => void>;
  /** Listeners that only care about connection state changes (open/close/error) */
  statusListeners: Set<() => void>;
}

const sockets = new Map<string, SocketEntry>();

function getOrCreate(url: string): SocketEntry {
  let entry = sockets.get(url);
  if (!entry) {
    entry = {
      ws: null,
      connected: false,
      messages: [],
      lastMessage: null,
      refCount: 0,
      retryDelay: BASE_DELAY_MS,
      retryTimer: null,
      messageId: 0,
      listeners: new Set(),
      statusListeners: new Set(),
    };
    sockets.set(url, entry);
  }
  return entry;
}

function notify(entry: SocketEntry) {
  entry.listeners.forEach((cb) => cb());
}

function notifyStatus(entry: SocketEntry) {
  entry.statusListeners.forEach((cb) => cb());
}

function scheduleReconnect(url: string, entry: SocketEntry) {
  if (entry.refCount <= 0) return;
  const delay = entry.retryDelay;
  entry.retryDelay = Math.min(delay * 2, MAX_DELAY_MS);
  entry.retryTimer = setTimeout(() => {
    if (entry.refCount > 0) connect(url, entry);
  }, delay);
}

function connect(url: string, entry: SocketEntry) {
  if (entry.refCount <= 0) return;

  try {
    const ws = new WebSocket(url);
    entry.ws = ws;

    ws.onopen = () => {
      if (entry.refCount <= 0) return;
      entry.connected = true;
      entry.retryDelay = BASE_DELAY_MS;
      notify(entry);
      notifyStatus(entry);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (entry.refCount <= 0) return;
      const msg: WsMessage = {
        id: ++entry.messageId,
        data: event.data,
        receivedAt: new Date().toISOString(),
      };
      entry.lastMessage = msg;
      const next = [...entry.messages, msg];
      entry.messages =
        next.length > MAX_MESSAGES
          ? next.slice(next.length - MAX_MESSAGES)
          : next;
      notify(entry);
    };

    ws.onclose = () => {
      if (entry.refCount <= 0) return;
      entry.connected = false;
      entry.ws = null;
      notify(entry);
      notifyStatus(entry);
      scheduleReconnect(url, entry);
    };

    ws.onerror = () => {
      // onclose fires after onerror — reconnect handled there
      if (entry.refCount <= 0) return;
      entry.connected = false;
      notify(entry);
      notifyStatus(entry);
    };
  } catch {
    scheduleReconnect(url, entry);
  }
}

function subscribe(url: string, entry: SocketEntry) {
  entry.refCount++;
  if (entry.refCount === 1) {
    connect(url, entry);
  }
}

function unsubscribe(url: string, entry: SocketEntry) {
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.refCount = 0;
    if (entry.retryTimer !== null) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
    }
    if (entry.ws) {
      entry.ws.onclose = null;
      entry.ws.close();
      entry.ws = null;
    }
    entry.connected = false;
    entry.messages = [];
    entry.lastMessage = null;
    entry.retryDelay = BASE_DELAY_MS;
    entry.messageId = 0;
    sockets.delete(url);
  }
}

// ── Hook ───────────────────────────────────────────────────────────

export function useWebSocket(url: string = WS_URL): UseWebSocketReturn {
  const entry = getOrCreate(url);

  // Trigger re-renders when the shared entry changes
  const [, setTick] = useState(0);
  const tickRef = useRef(() => setTick((t) => t + 1));

  useEffect(() => {
    const cb = tickRef.current;
    entry.listeners.add(cb);
    subscribe(url, entry);

    return () => {
      entry.listeners.delete(cb);
      unsubscribe(url, entry);
    };
  }, [url]);

  const send = useCallback(
    (data: string) => {
      if (entry.ws?.readyState === WebSocket.OPEN) {
        entry.ws.send(data);
      }
    },
    [url],
  );

  return {
    connected: entry.connected,
    lastMessage: entry.lastMessage,
    messages: entry.messages,
    send,
  };
}

// ── Status-only hook ────────────────────────────────────────────────
// Only re-renders on connection state changes (open/close/error),
// NOT on every message. Use this for components that only need
// the `connected` boolean (e.g. layout shells, status indicators).

export function useWebSocketStatus(url: string = WS_URL): { connected: boolean } {
  const entry = getOrCreate(url);
  const [connected, setConnected] = useState(entry.connected);

  useEffect(() => {
    const onStatusChange = () => setConnected(entry.connected);
    entry.statusListeners.add(onStatusChange);
    subscribe(url, entry);

    // Sync initial state in case it changed between render and effect
    setConnected(entry.connected);

    return () => {
      entry.statusListeners.delete(onStatusChange);
      unsubscribe(url, entry);
    };
  }, [url]);

  return { connected };
}

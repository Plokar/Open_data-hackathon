'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');

/**
 * WebSocket s automatickým reconnectem (exponenciální backoff, max 15 s).
 * Po (znovu)připojení zavolá onOpen – tam pošli {"type":"ready"} pro obnovení stavu.
 * Zavření s kódem 4xxx (odmítnuto serverem) se neopakuje.
 */
export function useWebSocket(
  path: string | null,
  { onMessage, onOpen }: { onMessage?: (m: WsMessage) => void; onOpen?: (send: (m: WsMessage) => void) => void } = {},
) {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const handlers = useRef({ onMessage, onOpen });
  useEffect(() => {
    handlers.current = { onMessage, onOpen };
  });

  const send = useCallback((m: WsMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  useEffect(() => {
    if (!path) return;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const open = () => {
      setStatus('connecting');
      const sock = new WebSocket(`${WS_BASE}${path}`);
      ws.current = sock;
      sock.onopen = () => {
        attempt = 0;
        setStatus('connected');
        handlers.current.onOpen?.(send);
      };
      sock.onmessage = (e) => {
        try {
          handlers.current.onMessage?.(JSON.parse(e.data));
        } catch {
          /* nevalidní JSON ignorujeme */
        }
      };
      sock.onclose = (e) => {
        setStatus('disconnected');
        if (stopped || (e.code >= 4000 && e.code < 5000)) return;
        timer = setTimeout(open, Math.min(15000, 500 * 2 ** attempt++));
      };
    };
    open();

    return () => {
      stopped = true;
      clearTimeout(timer);
      ws.current?.close(1000);
    };
  }, [path, send]);

  return { status, send };
}

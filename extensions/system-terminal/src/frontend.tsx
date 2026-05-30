import '@xterm/xterm/css/xterm.css';

import type { ExtensionSurfaceProps } from '@neon-pilot/extensions/ui';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

const TERMINAL_ROUTE_PREFIX = '/api/extensions/system-terminal/routes';

interface TerminalState {
  id: string | null;
  eventSource: EventSource | null;
  xterm: Terminal | null;
  fitAddon: FitAddon | null;
}

function buildStreamUrl(terminalId: string): string {
  return `${TERMINAL_ROUTE_PREFIX}/stream?id=${encodeURIComponent(terminalId)}`;
}

export function TerminalPanel({ pa, context }: ExtensionSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TerminalState>({ id: null, eventSource: null, xterm: null, fitAddon: null });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = stateRef.current;

    // Create xterm.js terminal
    const xterm = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'Geist Mono', 'JetBrains Mono', 'SF Mono', Menlo, monospace",
      theme: {
        background: 'rgb(var(--color-base))',
        foreground: 'rgb(var(--color-primary))',
        cursor: 'rgb(var(--color-accent))',
        selectionBackground: 'rgb(var(--color-accent) / 0.3)',
        black: '#1d2021',
        red: '#ea6962',
        green: '#a9b665',
        yellow: '#d8a657',
        blue: '#7daea3',
        magenta: '#d3869b',
        cyan: '#89b482',
        white: '#d4be98',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(container);
    fitAddon.fit();

    state.xterm = xterm;
    state.fitAddon = fitAddon;

    // Create terminal session via backend action
    let terminalId: string | null = null;
    let eventSource: EventSource | null = null;
    let closed = false;

    pa.extension
      .invoke<{ id: string; pid: number | null }>('terminalCreate', {
        cwd: context.cwd ?? undefined,
      })
      .then((result) => {
        if (closed) return;
        terminalId = result.id;
        state.id = result.id;

        // Write a welcome message
        xterm.writeln(`\x1b[90mTerminal ready (pid: ${result.pid ?? '?'}). Type 'exit' to close.\x1b[0m\r\n`);

        // Connect to SSE stream
        const es = new EventSource(buildStreamUrl(result.id));
        eventSource = es;
        state.eventSource = es;

        es.addEventListener('output', (event: MessageEvent) => {
          if (closed) return;
          xterm.write(event.data);
        });

        es.addEventListener('exit', (event: MessageEvent) => {
          if (closed) return;
          closed = true;
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          xterm.writeln(`\r\n\x1b[90mProcess exited (code: ${data.code}).\x1b[0m`);
          es.close();
        });

        es.addEventListener('error', () => {
          // SSE errors are expected when the terminal closes; don't spam the user.
          if (!closed) {
            xterm.writeln(`\r\n\x1b[91mConnection lost.\x1b[0m`);
          }
        });
      });

    // Handle user input
    const disposable = xterm.onData((data: string) => {
      if (terminalId && !closed) {
        pa.extension.invoke('terminalWrite', { id: terminalId, data }).catch(() => {
          // Ignore write errors if terminal was closed
        });
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (terminalId && !closed) {
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            pa.extension
              .invoke('terminalResize', {
                id: terminalId,
                cols: dims.cols,
                rows: dims.rows,
              })
              .catch(() => {});
          }
        }
      } catch {
        // Ignore fit errors
      }
    });
    resizeObserver.observe(container);

    // Focus the terminal when clicked
    const handleFocusClick = () => xterm.focus();
    container.addEventListener('click', handleFocusClick);

    // Give terminal focus
    setTimeout(() => xterm.focus(), 100);

    return () => {
      closed = true;

      disposable.dispose();
      resizeObserver.disconnect();
      container.removeEventListener('click', handleFocusClick);

      if (terminalId) {
        pa.extension.invoke('terminalClose', { id: terminalId }).catch(() => {});
      }

      if (eventSource) {
        eventSource.close();
      }

      xterm.dispose();
      state.id = null;
      state.eventSource = null;
      state.xterm = null;
      state.fitAddon = null;
    };
  }, [pa, context.cwd]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden bg-base" style={{ padding: '4px' }} />;
}

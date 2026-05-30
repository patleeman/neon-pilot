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
  const pendingWritesRef = useRef<string[]>([]);

  const focusTerminal = (xterm: Terminal) => {
    try {
      const textarea = xterm.element?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
        return;
      }
      xterm.focus();
    } catch {
      /* focus failures can happen in transient states */
    }
  };

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

    const flushPendingWrites = (id: string) => {
      const pendingWrites = pendingWritesRef.current;
      while (pendingWrites.length > 0 && state.id === id) {
        const data = pendingWrites.shift();
        if (!data) continue;
        pa.extension.invoke('terminalWrite', { id, data }).catch(() => {
          // Ignore write errors if terminal was closed.
        });
      }
    };

    // Create terminal session via backend action
    let terminalId: string | null = null;
    let eventSource: EventSource | null = null;
    let closed = false;

    pa.extension
      .invoke<{ id: string; pid: number | null; usingPty: boolean }>('terminalCreate', {
        cwd: context.cwd ?? undefined,
      })
      .then((result) => {
        if (closed) return;
        terminalId = result.id;
        state.id = result.id;
        flushPendingWrites(result.id);

        // Write a welcome message
        xterm.writeln(`\x1b[90mTerminal ready (pid: ${result.pid ?? '?'}). Type 'exit' to close.\x1b[0m\r\n`);
        if (!result.usingPty) {
          xterm.writeln(`\x1b[101m\x1b[97m Notice: Degraded terminal mode (PTY unavailable) \x1b[0m\x1b[93m\r\n`);
          xterm.writeln(`\x1b[93mInput/output may be limited until a PTY-capable shell is available.\x1b[0m\r\n`);
        }

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
      })
      .catch((error) => {
        if (closed) return;
        const message = error instanceof Error ? error.message : String(error);
        xterm.writeln(`\r\n\x1b[91mTerminal failed to start: ${message}\x1b[0m`);
      });

    // Handle user input
    const disposable = xterm.onData((data: string) => {
      if (terminalId && !closed) {
        pa.extension.invoke('terminalWrite', { id: terminalId, data }).catch(() => {
          // Ignore write errors if terminal was closed
        });
      } else if (!closed) {
        pendingWritesRef.current.push(data);
      }
    });

    // Ensure keyboard focus is explicitly captured, even when child handlers stop propagation.
    const handleFocusTerminal = () => focusTerminal(xterm);

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
    container.addEventListener('mousedown', handleFocusTerminal, true);
    container.addEventListener('click', handleFocusTerminal, true);
    container.addEventListener('focusin', handleFocusTerminal, true);
    container.addEventListener('pointerdown', handleFocusTerminal, true);

    // Give terminal focus
    requestAnimationFrame(() => requestAnimationFrame(() => focusTerminal(xterm)));

    return () => {
      closed = true;
      pendingWritesRef.current = [];

      disposable.dispose();
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleFocusTerminal, true);
      container.removeEventListener('click', handleFocusTerminal, true);
      container.removeEventListener('focusin', handleFocusTerminal, true);
      container.removeEventListener('pointerdown', handleFocusTerminal, true);

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

    return (
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden bg-base"
        style={{ padding: '4px' }}
        tabIndex={0}
        aria-label="Interactive terminal"
        onFocus={() => {
          if (stateRef.current.xterm) {
            focusTerminal(stateRef.current.xterm);
          }
        }}
      />
    );
  }

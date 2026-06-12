import '@xterm/xterm/css/xterm.css';

import { streamExtensionRouteSse, type ExtensionSurfaceProps } from '@neon-pilot/extensions/ui';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

interface TerminalState {
  id: string | null;
  xterm: Terminal | null;
  fitAddon: FitAddon | null;
  usingPty: boolean;
}

function readRgbVar(element: HTMLElement, name: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value ? `rgb(${value})` : '';
}

type TerminalRealtimeMessage =
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null };

export function TerminalPanel({ pa, context }: ExtensionSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TerminalState>({ id: null, xterm: null, fitAddon: null, usingPty: false });
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
    const baseColor = readRgbVar(container, '--color-base') || '#080c10';
    const primaryColor = readRgbVar(container, '--color-primary') || '#f6f4ec';
    const accentColor = readRgbVar(container, '--color-accent') || '#7aa2f7';
    const xterm = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'Geist Mono', 'JetBrains Mono', 'SF Mono', Menlo, monospace",
      theme: {
        background: baseColor,
        foreground: primaryColor,
        cursor: accentColor,
        selectionBackground: accentColor.replace(/^rgb\((.*)\)$/, 'rgba($1, 0.3)'),
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
    const ansiRequestModeHandler = xterm.parser.registerCsiHandler({ intermediates: '$', final: 'p' }, () => true);
    const decRequestModeHandler = xterm.parser.registerCsiHandler({ prefix: '?', intermediates: '$', final: 'p' }, () => true);
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
    let streamAbort: AbortController | null = null;
    let closed = false;
    let usingPty = false;
    let degradedInputColumns = 0;
    let requestedWorkbenchClose = false;

    const closeWorkbenchTab = () => {
      if (requestedWorkbenchClose) return;
      requestedWorkbenchClose = true;
      pa.workbench.closeTab(context.instanceId);
    };

    const handleTerminalExit = () => {
      closeWorkbenchTab();
    };

    const attachTerminalStream = async (id: string) => {
      const abort = new AbortController();
      streamAbort = abort;
      for await (const event of streamExtensionRouteSse<TerminalRealtimeMessage>(
        'system-terminal',
        `/stream?id=${encodeURIComponent(id)}`,
        { signal: abort.signal },
      )) {
        if (closed || state.id !== id) return;
        if (event.type === 'output') {
          xterm.write(event.data);
          continue;
        }
        if (event.type === 'exit') handleTerminalExit();
      }
    };

    const echoInput = (data: string) => {
      // A real PTY owns echoing and line editing. Only emulate minimal echo after
      // the backend explicitly falls back to non-PTY mode, and never backspace
      // past input we echoed ourselves; otherwise the shell prompt can be erased.
      if (!terminalId || usingPty) return;
      switch (data) {
        case '\n':
        case '\r':
          degradedInputColumns = 0;
          xterm.write('\r\n');
          break;
        case '\x7f':
          if (degradedInputColumns > 0) {
            degradedInputColumns -= 1;
            xterm.write('\b \b');
          }
          break;
        default:
          if (data >= ' ') {
            degradedInputColumns += data.length;
            xterm.write(data);
          }
      }
    };

    const writeTerminalData = (data: string) => {
      echoInput(data);
      if (terminalId && !closed) {
        pa.extension.invoke('terminalWrite', { id: terminalId, data }).catch(() => {
          // Ignore write errors if terminal was closed.
        });
      } else if (!closed) {
        pendingWritesRef.current.push(data);
      }
    };

    pa.extension
      .invoke<{ id: string; pid: number | null; usingPty: boolean; initialOutput?: string; realtimeUrl?: string }>('terminalCreate', {
        cwd: context.cwd ?? undefined,
      })
      .then((result) => {
        if (closed) return;
        terminalId = result.id;
        state.id = result.id;
        state.usingPty = result.usingPty;
        usingPty = result.usingPty;
        container.dataset.terminalId = result.id;
        flushPendingWrites(result.id);

        // Write a welcome message
        const modeLabel = result.usingPty ? 'PTY ready' : 'Terminal ready (degraded mode)';
        xterm.writeln(`\x1b[90m${modeLabel} (pid: ${result.pid ?? '?'}). Type 'exit' to close.\x1b[0m\r\n`);
        void attachTerminalStream(result.id).catch((error) => {
          if (closed || (error instanceof DOMException && error.name === 'AbortError')) return;
          const message = error instanceof Error ? error.message : String(error);
          xterm.writeln(`\r\n\x1b[91mTerminal output stream failed: ${message}\x1b[0m`);
        });
      })
      .catch((error) => {
        if (closed) return;
        const message = error instanceof Error ? error.message : String(error);
        xterm.writeln(`\r\n\x1b[91mTerminal failed to start: ${message}\x1b[0m`);
      });

    // Handle user input
    const disposable = xterm.onData((data: string) => {
      writeTerminalData(data);
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
            pa.extension.invoke('terminalResize', { id: terminalId, cols: dims.cols, rows: dims.rows }).catch(() => {});
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
      ansiRequestModeHandler.dispose();
      decRequestModeHandler.dispose();
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleFocusTerminal, true);
      container.removeEventListener('click', handleFocusTerminal, true);
      container.removeEventListener('focusin', handleFocusTerminal, true);
      container.removeEventListener('pointerdown', handleFocusTerminal, true);

      if (terminalId) {
        pa.extension.invoke('terminalClose', { id: terminalId }).catch(() => {});
      }
      streamAbort?.abort();

      xterm.dispose();
      state.id = null;
      delete container.dataset.terminalId;
      state.xterm = null;
      state.fitAddon = null;
      state.usingPty = false;
    };
  }, [pa, context.cwd]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-base [&_.xterm-screen]:bg-base [&_.xterm-viewport]:bg-base [&_.xterm]:bg-base"
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

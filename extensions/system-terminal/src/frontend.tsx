import '@xterm/xterm/css/xterm.css';

import type { ExtensionSurfaceProps } from '@neon-pilot/extensions/ui';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

interface TerminalState {
  id: string | null;
  eventSource: EventSource | null;
  xterm: Terminal | null;
  fitAddon: FitAddon | null;
  usingPty: boolean;
}

function readRgbVar(element: HTMLElement, name: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value ? `rgb(${value})` : '';
}

function terminalKeyData(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey'>, options: { usingPty: boolean }): string | null {
  if (event.metaKey) return null;
  if (event.ctrlKey && event.key.length === 1) {
    const code = event.key.toUpperCase().charCodeAt(0);
    if (code >= 64 && code <= 95) return String.fromCharCode(code - 64);
  }
  switch (event.key) {
    case 'Enter':
      return options.usingPty ? '\r' : '\n';
    case 'Backspace':
      return '\x7f';
    case 'Tab':
      return '\t';
    case 'Escape':
      return '\x1b';
    case 'ArrowUp':
      return '\x1b[A';
    case 'ArrowDown':
      return '\x1b[B';
    case 'ArrowRight':
      return '\x1b[C';
    case 'ArrowLeft':
      return '\x1b[D';
    default:
      return event.key.length === 1 && !event.altKey ? event.key : null;
  }
}

export function TerminalPanel({ pa, context }: ExtensionSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TerminalState>({ id: null, eventSource: null, xterm: null, fitAddon: null, usingPty: false });
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
    let drainTimer: ReturnType<typeof window.setInterval> | null = null;
    let closed = false;
    let usingPty = false;

    const echoInput = (data: string) => {
      if (usingPty) return;
      switch (data) {
        case '\n':
        case '\r':
          xterm.write('\r\n');
          break;
        case '\x7f':
          xterm.write('\b \b');
          break;
        default:
          if (data >= ' ') xterm.write(data);
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
      .invoke<{ id: string; pid: number | null; usingPty: boolean }>('terminalCreate', {
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
        xterm.writeln(`\x1b[90mTerminal ready (pid: ${result.pid ?? '?'}). Type 'exit' to close.\x1b[0m\r\n`);

        const drainOutput = () => {
          if (closed || !terminalId) return;
          pa.extension
            .invoke<{ ok: boolean; output: string }>('terminalDrain', { id: terminalId })
            .then((drain) => {
              if (!closed && drain.ok && drain.output) xterm.write(drain.output);
            })
            .catch(() => {
              // Ignore transient drain errors; write/close paths surface terminal state.
            });
        };
        drainTimer = window.setInterval(drainOutput, 150);
        drainOutput();
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
    const handleTerminalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const data = terminalKeyData(event, { usingPty });
      if (!data) return;
      event.preventDefault();
      event.stopPropagation();
      writeTerminalData(data);
    };

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
    container.addEventListener('keydown', handleTerminalKeyDown, true);

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
      container.removeEventListener('keydown', handleTerminalKeyDown, true);

      if (terminalId) {
        pa.extension.invoke('terminalClose', { id: terminalId }).catch(() => {});
      }

      if (drainTimer) {
        window.clearInterval(drainTimer);
      }

      xterm.dispose();
      state.id = null;
      delete container.dataset.terminalId;
      state.eventSource = null;
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

import '@xterm/xterm/css/xterm.css';

import {
  buildDesktopWebSocketUrl,
  type ExtensionSurfaceProps,
  streamExtensionRouteSse,
  WindowedTerminalFrame,
} from '@neon-pilot/extensions/ui';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

interface TerminalState {
  id: string | null;
  xterm: Terminal | null;
  fitAddon: FitAddon | null;
  usingPty: boolean;
}

// Keep this aligned with the backend terminal replay window so fallback can
// suppress the exact history the realtime attach already rendered.
const MAX_REMOTE_REPLAY_CHUNKS = 128;

function readRgbVar(element: HTMLElement, name: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value ? `rgb(${value})` : '';
}

function readCssVar(element: HTMLElement, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function terminalThemeForSurface(element: HTMLElement, shellPresentation?: 'windowed') {
  if (shellPresentation === 'windowed') {
    return {
      background: readCssVar(element, '--wos-surface-1') || '#fbf7ea',
      foreground: readCssVar(element, '--wos-ink-900') || '#2b241d',
      cursor: readCssVar(element, '--wos-extensions') || '#e78a3c',
      selectionBackground: 'rgba(43, 36, 29, 0.18)',
      black: '#2b241d',
      red: '#b84a35',
      green: '#317a54',
      yellow: '#9a6a12',
      blue: '#326d86',
      magenta: '#8755a5',
      cyan: '#2d7f75',
      white: '#fbf7ea',
    };
  }

  const baseColor = readRgbVar(element, '--color-base') || '#080c10';
  const primaryColor = readRgbVar(element, '--color-primary') || '#f6f4ec';
  const accentColor = readRgbVar(element, '--color-accent') || '#7aa2f7';
  return {
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
  };
}

type TerminalRealtimeMessage = { type: 'output'; data: string } | { type: 'exit'; code: number | null };

type TerminalSocketMessage =
  | { type: 'connected' }
  | { type: 'terminal_attached'; id?: string; terminalId: string; replay: string; exited: boolean; exitCode: number | null }
  | { type: 'terminal'; terminalId: string; event: TerminalRealtimeMessage }
  | { type: 'error'; id?: string; message: string };

function formatTerminalStartupError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const extensionActionMatch = /^Extension "[^"]+" action "[^"]+" failed:\s*(.+)$/i.exec(raw.trim());
  if (extensionActionMatch?.[1]) {
    return formatTerminalStartupError(new Error(extensionActionMatch[1]));
  }
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  if (
    !firstLine ||
    raw.includes('\n') ||
    /ENOENT|ENOTDIR|EACCES|permission denied|no such file or directory|chdir|cwd/i.test(raw) ||
    /Local API route did not complete/i.test(raw) ||
    /\/api\//i.test(raw) ||
    /file:\/\//i.test(raw) ||
    /\s+at\s+\S+/i.test(raw)
  ) {
    return 'Terminal could not start in this workspace. Choose an existing folder or reopen the conversation.';
  }
  return firstLine;
}

export function TerminalPanel({ pa, context }: ExtensionSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TerminalState>({ id: null, xterm: null, fitAddon: null, usingPty: false });
  const pendingWritesRef = useRef<string[]>([]);
  const remoteOutputReplayRef = useRef<string[]>([]);
  const pendingFallbackReplayRef = useRef<string | null>(null);

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
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      theme: terminalThemeForSurface(container, context.shellPresentation),
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

    // Create terminal session via backend action
    let terminalId: string | null = null;
    let streamAbort: AbortController | null = null;
    let terminalSocket: WebSocket | null = null;
    let realtimeAttached = false;
    let pendingResize: { cols: number; rows: number } | null = null;
    let closed = false;
    let usingPty = false;
    let degradedInputColumns = 0;
    let requestedWorkbenchClose = false;
    let fallbackActive = false;

    const recordRemoteOutput = (data: string) => {
      if (data.length === 0) return;
      const replay = remoteOutputReplayRef.current;
      replay.push(data);
      if (replay.length > MAX_REMOTE_REPLAY_CHUNKS) {
        replay.splice(0, replay.length - MAX_REMOTE_REPLAY_CHUNKS);
      }
    };

    const writeRemoteOutput = (data: string) => {
      if (data.length === 0) return;
      xterm.write(data);
      recordRemoteOutput(data);
    };

    const consumeFallbackReplay = (data: string): string => {
      const replay = pendingFallbackReplayRef.current;
      if (!replay || data.length === 0) return data;
      if (replay.startsWith(data)) {
        const remaining = replay.slice(data.length);
        pendingFallbackReplayRef.current = remaining.length > 0 ? remaining : null;
        return '';
      }
      if (data.startsWith(replay)) {
        pendingFallbackReplayRef.current = null;
        return data.slice(replay.length);
      }
      pendingFallbackReplayRef.current = null;
      return data;
    };

    const sendTerminalSocketMessage = (message: Record<string, unknown>): boolean => {
      if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN || !realtimeAttached) return false;
      terminalSocket.send(JSON.stringify(message));
      return true;
    };

    const flushPendingWritesThroughSocket = (id: string) => {
      const pendingWrites = pendingWritesRef.current;
      while (pendingWrites.length > 0 && state.id === id) {
        const data = pendingWrites.shift();
        if (!data) continue;
        if (!sendTerminalSocketMessage({ type: 'terminal_input', terminalId: id, data })) {
          pendingWrites.unshift(data);
          break;
        }
      }
    };

    const flushPendingWritesThroughActions = (id: string) => {
      const pendingWrites = pendingWritesRef.current;
      while (pendingWrites.length > 0 && state.id === id) {
        const data = pendingWrites.shift();
        if (!data) continue;
        pa.extension.invoke('terminalWrite', { id, data }).catch(() => {
          // Ignore write errors if terminal was closed.
        });
      }
    };

    const closeWorkbenchTab = () => {
      if (requestedWorkbenchClose) return;
      requestedWorkbenchClose = true;
      pa.workbench.closeTab(context.instanceId);
    };

    const handleTerminalExit = () => {
      closeWorkbenchTab();
    };

    const startFallbackStream = (id: string, warningMessage?: string) => {
      if (closed || state.id !== id || fallbackActive) return Promise.resolve();
      fallbackActive = true;
      realtimeAttached = false;
      terminalSocket = null;
      pendingFallbackReplayRef.current = remoteOutputReplayRef.current.join('');
      flushPendingWritesThroughActions(id);
      if (warningMessage) {
        xterm.writeln(`\r\n\x1b[93m${warningMessage}\x1b[0m`);
      }
      return attachTerminalStream(id);
    };

    const attachTerminalRealtime = (id: string, url: string) =>
      new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(url);
        const attachId = `terminal:${id}:${Date.now().toString(36)}`;
        let settled = false;
        terminalSocket = socket;

        const fail = (error: Error) => {
          if (terminalSocket === socket) terminalSocket = null;
          if (settled) return;
          settled = true;
          socket.close();
          reject(error);
        };

        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'terminal_attach', id: attachId, terminalId: id }));
        });

        socket.addEventListener('message', (event) => {
          if (closed || state.id !== id || terminalSocket !== socket || fallbackActive) return;
          let message: TerminalSocketMessage;
          try {
            message = JSON.parse(String(event.data)) as TerminalSocketMessage;
          } catch {
            fail(new Error('Terminal realtime message was invalid.'));
            return;
          }

          if (message.type === 'terminal_attached' && message.terminalId === id && message.id === attachId) {
            realtimeAttached = true;
            writeRemoteOutput(message.replay);
            flushPendingWritesThroughSocket(id);
            if (pendingResize) {
              sendTerminalSocketMessage({ type: 'terminal_resize', terminalId: id, cols: pendingResize.cols, rows: pendingResize.rows });
              pendingResize = null;
            }
            if (message.exited) handleTerminalExit();
            if (!settled) {
              settled = true;
              resolve();
            }
            return;
          }

          if (message.type === 'terminal' && message.terminalId === id) {
            if (message.event.type === 'output') {
              writeRemoteOutput(message.event.data);
              return;
            }
            if (message.event.type === 'exit') handleTerminalExit();
            return;
          }

          if (message.type === 'error' && (!message.id || message.id === attachId)) {
            fail(new Error(message.message));
          }
        });

        socket.addEventListener('error', () => {
          if (settled) {
            void startFallbackStream(id, 'Terminal realtime connection dropped; using fallback stream.');
            return;
          }
          fail(new Error('Terminal realtime connection failed.'));
        });

        socket.addEventListener('close', () => {
          if (terminalSocket === socket) terminalSocket = null;
          if (closed) return;
          if (settled) {
            void startFallbackStream(id, 'Terminal realtime connection dropped; using fallback stream.');
            return;
          }
          fail(new Error('Terminal realtime connection closed.'));
        });
      });

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
          const data = consumeFallbackReplay(event.data);
          if (data.length > 0) writeRemoteOutput(data);
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
        if (fallbackActive) {
          pa.extension.invoke('terminalWrite', { id: terminalId, data }).catch(() => {
            // Ignore write errors if terminal was closed.
          });
          return;
        }
        if (!sendTerminalSocketMessage({ type: 'terminal_input', terminalId, data })) {
          pendingWritesRef.current.push(data);
        }
      } else if (!closed) {
        pendingWritesRef.current.push(data);
      }
    };

    const echoPendingDegradedInput = () => {
      if (usingPty) return;
      for (const data of pendingWritesRef.current) {
        echoInput(data);
      }
    };

    pa.extension
      .invoke<{ id: string; pid: number | null; usingPty: boolean; initialOutput?: string; realtimeUrl?: string }>('terminalCreate', {
        cwd: context.cwd ?? undefined,
      })
      .then((result) => {
        if (closed) {
          pa.extension.invoke('terminalClose', { id: result.id }).catch(() => {});
          return;
        }
        terminalId = result.id;
        state.id = result.id;
        state.usingPty = result.usingPty;
        usingPty = result.usingPty;
        container.dataset.terminalId = result.id;
        echoPendingDegradedInput();

        // Write a welcome message
        const modeLabel = result.usingPty ? 'PTY ready' : 'Terminal ready (degraded mode)';
        xterm.writeln(`\x1b[90m${modeLabel} (pid: ${result.pid ?? '?'}). Type 'exit' to close.\x1b[0m\r\n`);
        const realtimeUrl = result.realtimeUrl ?? buildDesktopWebSocketUrl('/api/realtime');
        void attachTerminalRealtime(result.id, realtimeUrl)
          .catch((error) => {
            if (closed || state.id !== result.id) return;
            const message = error instanceof Error ? error.message : String(error);
            return startFallbackStream(result.id, `Terminal realtime connection failed; using fallback stream. ${message}`);
          })
          .catch((error) => {
            if (closed || (error instanceof DOMException && error.name === 'AbortError')) return;
            const message = error instanceof Error ? error.message : String(error);
            xterm.writeln(`\r\n\x1b[91mTerminal output stream failed: ${message}\x1b[0m`);
          });
      })
      .catch((error) => {
        if (closed) return;
        const message = formatTerminalStartupError(error);
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
            pendingResize = { cols: dims.cols, rows: dims.rows };
            if (sendTerminalSocketMessage({ type: 'terminal_resize', terminalId, cols: dims.cols, rows: dims.rows })) {
              pendingResize = null;
            } else if (terminalSocket && !fallbackActive) {
              // Realtime is connecting; send the latest size once attach completes.
            } else {
              pa.extension.invoke('terminalResize', { id: terminalId, cols: dims.cols, rows: dims.rows }).catch(() => {});
            }
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
      remoteOutputReplayRef.current = [];
      pendingFallbackReplayRef.current = null;

      disposable.dispose();
      ansiRequestModeHandler.dispose();
      decRequestModeHandler.dispose();
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleFocusTerminal, true);
      container.removeEventListener('click', handleFocusTerminal, true);
      container.removeEventListener('focusin', handleFocusTerminal, true);
      container.removeEventListener('pointerdown', handleFocusTerminal, true);

      if (terminalId) {
        if (!sendTerminalSocketMessage({ type: 'terminal_close', terminalId })) {
          pa.extension.invoke('terminalClose', { id: terminalId }).catch(() => {});
        }
      }
      terminalSocket?.close();
      streamAbort?.abort();

      xterm.dispose();
      state.id = null;
      delete container.dataset.terminalId;
      state.xterm = null;
      state.fitAddon = null;
      state.usingPty = false;
    };
  }, [pa, context.cwd, context.shellPresentation]);

  const terminalHost = (
    <div
      ref={containerRef}
      className={
        context.shellPresentation === 'windowed'
          ? 'wos-terminal-panel'
          : 'h-full w-full overflow-hidden bg-base p-1 [&_.xterm-screen]:bg-base [&_.xterm-viewport]:bg-base [&_.xterm]:bg-base'
      }
      data-shell-presentation={context.shellPresentation}
      tabIndex={0}
      aria-label="Interactive terminal"
      onFocus={() => {
        if (stateRef.current.xterm) {
          focusTerminal(stateRef.current.xterm);
        }
      }}
    />
  );

  if (context.shellPresentation === 'windowed') {
    return (
      <WindowedTerminalFrame cwd={context.cwd} status="PTY shell">
        {terminalHost}
      </WindowedTerminalFrame>
    );
  }

  return terminalHost;
}

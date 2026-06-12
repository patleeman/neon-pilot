// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xterm/xterm/css/xterm.css', () => ({}), { virtual: true });

const terminalHarness = vi.hoisted(() => {
  class FakeTerminal {
    static instances: FakeTerminal[] = [];
    element: HTMLDivElement | null = null;
    parser = {
      registerCsiHandler: vi.fn(() => ({ dispose: vi.fn() })),
    };
    write = vi.fn();
    writeln = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn((element: HTMLDivElement) => {
      this.element = element;
      const textarea = document.createElement('textarea');
      element.appendChild(textarea);
    });
    private onDataHandler: ((data: string) => void) | null = null;

    constructor() {
      FakeTerminal.instances.push(this);
    }

    onData(handler: (data: string) => void) {
      this.onDataHandler = handler;
      return { dispose: vi.fn() };
    }

    emitData(data: string) {
      this.onDataHandler?.(data);
    }
  }

  class FakeFitAddon {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  }

  return { FakeTerminal, FakeFitAddon };
});

const streamHarness = vi.hoisted(() => {
  let push: ((value: { type: 'output'; data: string } | { type: 'exit'; code: number | null }) => void) | null = null;
  let finish: (() => void) | null = null;
  const streamExtensionRouteSse = vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      const queue: Array<{ type: 'output'; data: string } | { type: 'exit'; code: number | null }> = [];
      let done = false;
      let wake: (() => void) | null = null;
      push = (value) => {
        queue.push(value);
        wake?.();
        wake = null;
      };
      finish = () => {
        done = true;
        wake?.();
        wake = null;
      };
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        yield queue.shift()!;
      }
    },
  }));

  return {
    streamExtensionRouteSse,
    pushEvent(value: { type: 'output'; data: string } | { type: 'exit'; code: number | null }) {
      push?.(value);
    },
    closeStream() {
      finish?.();
    },
  };
});

vi.mock('@xterm/xterm', () => ({ Terminal: terminalHarness.FakeTerminal }));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: terminalHarness.FakeFitAddon }));
vi.mock('@neon-pilot/extensions/ui', () => ({
  buildDesktopWebSocketUrl: vi.fn(() => 'ws://127.0.0.1:4321/api/realtime'),
  streamExtensionRouteSse: streamHarness.streamExtensionRouteSse,
}));

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(payload: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

Object.assign(globalThis, {
  React,
  IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: FakeResizeObserver,
});

describe('TerminalPanel', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    terminalHarness.FakeTerminal.instances.length = 0;
    FakeWebSocket.instances.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    streamHarness.closeStream();
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    vi.unstubAllGlobals();
  });

  it('falls back to SSE and action writes when realtime disconnects after attach', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'terminalCreate') {
        return { id: 'term-1', pid: 123, usingPty: true, realtimeUrl: 'ws://127.0.0.1:4321/api/realtime' };
      }
      return { ok: true };
    });
    const closeTab = vi.fn();

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={{
            extension: { invoke },
            workbench: { closeTab },
          } as never}
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toBe('ws://127.0.0.1:4321/api/realtime');
    const attachRequest = JSON.parse(socket?.sent[0] ?? '{}') as { id?: string };

    await act(async () => {
      socket?.open();
      socket?.receive({
        type: 'terminal_attached',
        id: attachRequest.id,
        terminalId: 'term-1',
        replay: 'prompt> ',
        exited: false,
        exitCode: null,
      });
    });

    await act(async () => {
      socket?.close();
      await Promise.resolve();
    });

    expect(streamHarness.streamExtensionRouteSse).toHaveBeenCalledWith('system-terminal', '/stream?id=term-1', {
      signal: expect.any(AbortSignal),
    });

    const terminal = terminalHarness.FakeTerminal.instances[0];
    await act(async () => {
      terminal?.emitData('l');
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith('terminalWrite', { id: 'term-1', data: 'l' });

    await act(async () => {
      streamHarness.pushEvent({ type: 'output', data: 'fallback-output' });
      await Promise.resolve();
    });

    expect(terminal?.write).toHaveBeenCalledWith('fallback-output');
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('ignores stale realtime terminal events after fallback starts from attach failure', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'terminalCreate') {
        return { id: 'term-1', pid: 123, usingPty: true, realtimeUrl: 'ws://127.0.0.1:4321/api/realtime' };
      }
      return { ok: true };
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={{
            extension: { invoke },
            workbench: { closeTab: vi.fn() },
          } as never}
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const socket = FakeWebSocket.instances[0];
    socket?.open();
    const attachRequest = JSON.parse(socket?.sent[0] ?? '{}') as { id?: string };

    await act(async () => {
      socket?.receive({
        type: 'error',
        id: attachRequest.id,
        message: 'Terminal not found or already closed.',
      });
      await Promise.resolve();
    });

    expect(streamHarness.streamExtensionRouteSse).toHaveBeenCalledWith('system-terminal', '/stream?id=term-1', {
      signal: expect.any(AbortSignal),
    });

    const terminal = terminalHarness.FakeTerminal.instances[0];
    const writesBeforeStaleMessage = terminal?.write.mock.calls.length ?? 0;

    await act(async () => {
      socket?.receive({
        type: 'terminal',
        terminalId: 'term-1',
        event: { type: 'output', data: 'stale-output' },
      });
      streamHarness.pushEvent({ type: 'output', data: 'fallback-output' });
      await Promise.resolve();
    });

    expect(terminal?.write.mock.calls.slice(writesBeforeStaleMessage).map(([value]) => value)).toEqual(['fallback-output']);
  });
});

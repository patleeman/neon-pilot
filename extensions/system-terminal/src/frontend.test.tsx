// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xterm/xterm/css/xterm.css', () => ({}), { virtual: true });

const terminalHarness = vi.hoisted(() => {
  class FakeTerminal {
    static instances: FakeTerminal[] = [];
    static options: unknown[] = [];
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

    constructor(options?: unknown) {
      FakeTerminal.instances.push(this);
      FakeTerminal.options.push(options);
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
  static instances: FakeResizeObserver[] = [];
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
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
    terminalHarness.FakeTerminal.options.length = 0;
    FakeWebSocket.instances.length = 0;
    FakeResizeObserver.instances.length = 0;
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
          pa={
            {
              extension: { invoke },
              workbench: { closeTab },
            } as never
          }
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toBe('ws://127.0.0.1:4321/api/realtime');
    await act(async () => {
      socket?.open();
      await Promise.resolve();
    });

    const attachRequest = JSON.parse(socket?.sent[0] ?? '{}') as { id?: string };
    expect(attachRequest.id).toBeTruthy();

    await act(async () => {
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
    expect(terminal?.write).toHaveBeenCalledWith('prompt> ');
    await act(async () => {
      terminal?.emitData('l');
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith('terminalWrite', { id: 'term-1', data: 'l' });

    await act(async () => {
      streamHarness.pushEvent({ type: 'output', data: 'prompt> ' });
      streamHarness.pushEvent({ type: 'output', data: 'fallback-output' });
      await Promise.resolve();
    });

    expect(terminal?.write.mock.calls.map(([value]) => value)).toEqual(['prompt> ', 'fallback-output']);
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('uses scoped windowed OS colors when hosted by the windowed shell', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'terminalCreate') {
        return { id: 'term-1', pid: 123, usingPty: true, realtimeUrl: 'ws://127.0.0.1:4321/api/realtime' };
      }
      return { ok: true };
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const style = originalGetComputedStyle(element, pseudoElement);
      if (element instanceof HTMLElement && element.classList.contains('wos-terminal-panel')) {
        return {
          ...style,
          getPropertyValue(name: string) {
            if (name === '--wos-surface-1') return 'oklch(99% 0.01 75)';
            if (name === '--wos-ink-900') return 'oklch(20% 0.01 60)';
            if (name === '--wos-extensions') return 'oklch(70% 0.15 60)';
            return style.getPropertyValue(name);
          },
        };
      }
      return style;
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <div>
          <TerminalPanel
            pa={
              {
                extension: { invoke },
                workbench: { closeTab: vi.fn() },
              } as never
            }
            context={{ cwd: '/repo', instanceId: 'tab-1', shellPresentation: 'windowed' } as never}
          />
        </div>,
      );
      await Promise.resolve();
    });

    const options = terminalHarness.FakeTerminal.options[0] as { theme?: Record<string, string> };
    expect(options.theme?.background).toBe('oklch(99% 0.01 75)');
    expect(options.theme?.foreground).toBe('oklch(20% 0.01 60)');
    expect(options.theme?.cursor).toBe('oklch(70% 0.15 60)');
    expect(options.theme?.selectionBackground).toBe('rgba(43, 36, 29, 0.18)');
    expect(container?.querySelector('.wos-terminal-panel')).toBeTruthy();
    expect(container?.querySelector('[data-shell-presentation="windowed"]')).toBeTruthy();
    getComputedStyleSpy.mockRestore();
  });

  it('does not render internal startup errors when the workspace is unavailable', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'terminalCreate') {
        throw new Error(
          [
            'Error: Local API route did not complete for GET /api/extensions/action at Module.ep',
            '(file:///Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/localApi.js:132:20)',
          ].join('\n'),
        );
      }
      return { ok: true };
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/missing-workspace', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const terminal = terminalHarness.FakeTerminal.instances[0];
    await vi.waitFor(() => {
      expect(terminal?.writeln).toHaveBeenCalledWith(
        expect.stringContaining(
          'Terminal failed to start: Terminal could not start in this workspace. Choose an existing folder or reopen the conversation.',
        ),
      );
    });

    const rendered = terminal?.writeln.mock.calls.map(([value]) => value).join('\n') ?? '';
    expect(rendered).not.toContain('/api/extensions/action');
    expect(rendered).not.toContain('localApi.js');
    expect(rendered).not.toContain('file://');
    expect(rendered).not.toContain('Module.ep');
  });

  it('strips extension action wrappers from startup errors', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'terminalCreate') {
        throw new Error('Extension "system-terminal" action "terminalCreate" failed: Terminal workspace folder is unavailable.');
      }
      return { ok: true };
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/missing-workspace', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const terminal = terminalHarness.FakeTerminal.instances[0];
    await vi.waitFor(() => {
      expect(terminal?.writeln).toHaveBeenCalledWith(
        expect.stringContaining('Terminal failed to start: Terminal workspace folder is unavailable.'),
      );
    });

    const rendered = terminal?.writeln.mock.calls.map(([value]) => value).join('\n') ?? '';
    expect(rendered).not.toContain('system-terminal');
    expect(rendered).not.toContain('terminalCreate');
  });

  it('skips split fallback replay chunks that were already rendered over realtime', async () => {
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
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const socket = FakeWebSocket.instances[0];
    const terminal = terminalHarness.FakeTerminal.instances[0];
    await act(async () => {
      socket?.open();
      await Promise.resolve();
    });

    const attachRequest = JSON.parse(socket?.sent[0] ?? '{}') as { id?: string };
    expect(attachRequest.id).toBeTruthy();

    await act(async () => {
      socket?.receive({
        type: 'terminal_attached',
        id: attachRequest.id,
        terminalId: 'term-1',
        replay: 'prompt> ',
        exited: false,
        exitCode: null,
      });
    });

    expect(terminal?.write).toHaveBeenCalledWith('prompt> ');

    await act(async () => {
      socket?.close();
      streamHarness.pushEvent({ type: 'output', data: 'prom' });
      streamHarness.pushEvent({ type: 'output', data: 'pt> ' });
      streamHarness.pushEvent({ type: 'output', data: 'echo hi\r\n' });
      await Promise.resolve();
    });

    expect(terminal?.write.mock.calls.map(([value]) => value)).toEqual(['prompt> ', 'echo hi\r\n']);
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
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
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

  it('closes the backend terminal if create resolves after the panel unmounts', async () => {
    let resolveCreate: ((value: { id: string; pid: number | null; usingPty: boolean; realtimeUrl: string }) => void) | null = null;
    const invoke = vi.fn((action: string) => {
      if (action === 'terminalCreate') {
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      }
      return Promise.resolve({ ok: true });
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });

    await act(async () => {
      resolveCreate?.({ id: 'term-1', pid: 123, usingPty: true, realtimeUrl: 'ws://127.0.0.1:4321/api/realtime' });
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith('terminalClose', { id: 'term-1' });
  });

  it('echoes queued input once degraded mode is known after create resolves', async () => {
    let resolveCreate: ((value: { id: string; pid: number | null; usingPty: boolean; realtimeUrl: string }) => void) | null = null;
    const invoke = vi.fn((action: string) => {
      if (action === 'terminalCreate') {
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      }
      return Promise.resolve({ ok: true });
    });

    const { TerminalPanel } = await import('./frontend.js');

    await act(async () => {
      root?.render(
        <TerminalPanel
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const terminal = terminalHarness.FakeTerminal.instances[0];
    await act(async () => {
      terminal?.emitData('l');
      await Promise.resolve();
    });

    expect(terminal?.write).not.toHaveBeenCalledWith('l');

    await act(async () => {
      resolveCreate?.({ id: 'term-1', pid: 123, usingPty: false, realtimeUrl: 'ws://127.0.0.1:4321/api/realtime' });
      await Promise.resolve();
    });

    expect(terminal?.write).toHaveBeenCalledWith('l');
  });

  it('sends a startup resize once when realtime attaches after the panel has measured', async () => {
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
          pa={
            {
              extension: { invoke },
              workbench: { closeTab: vi.fn() },
            } as never
          }
          context={{ cwd: '/repo', instanceId: 'tab-1' } as never}
        />,
      );
      await Promise.resolve();
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeTruthy();

    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
      await Promise.resolve();
    });

    expect(invoke).not.toHaveBeenCalledWith('terminalResize', expect.anything());

    await act(async () => {
      socket?.open();
      await Promise.resolve();
    });

    const attachRequest = JSON.parse(socket?.sent[0] ?? '{}') as { id?: string };

    await act(async () => {
      socket?.receive({
        type: 'terminal_attached',
        id: attachRequest.id,
        terminalId: 'term-1',
        replay: '',
        exited: false,
        exitCode: null,
      });
      await Promise.resolve();
    });

    const resizeMessages = socket?.sent
      .map((payload) => JSON.parse(payload) as { type?: string; cols?: number; rows?: number })
      .filter((message) => message.type === 'terminal_resize');
    expect(resizeMessages).toEqual([{ type: 'terminal_resize', terminalId: 'term-1', cols: 80, rows: 24 }]);
  });
});

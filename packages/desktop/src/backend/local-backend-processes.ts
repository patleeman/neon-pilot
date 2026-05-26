import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DesktopApiStreamEvent } from '../hosts/types.js';

export interface LocalBackendWorkbenchBrowserToolHost {
  isActive(conversationId: string): Promise<boolean>;
  listTabs(): Promise<Array<{ sessionKey: string; url: string; title: string }>>;
  snapshot(conversationId: string, tabId?: string): Promise<unknown>;
  screenshot(conversationId: string, tabId?: string): Promise<unknown>;
  cdp(input: { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string }): Promise<unknown>;
}

interface LocalBackendStatus {
  daemonHealthy: boolean;
}

interface BackendReadyMessage {
  type: 'ready';
  port: number;
  token: string;
}

interface BackendFatalMessage {
  type: 'fatal';
  error: string;
}

type BackendChildMessage = BackendReadyMessage | BackendFatalMessage;

const nativeWorkbenchBrowserMethods = new Set(['isActive', 'listTabs', 'snapshot', 'screenshot', 'cdp']);
const NATIVE_WORKBENCH_BROWSER_SLOW_MS = 1_000;

interface NativeWorkbenchBrowserRequest {
  type: 'native-workbench-browser-request';
  id: string;
  method: 'isActive' | 'listTabs' | 'snapshot' | 'screenshot' | 'cdp';
  args: unknown[];
}

function isBackendChildMessage(value: unknown): value is BackendChildMessage {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');
}

function resolveBackendChildEntry(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, 'local-backend-child.js'),
    resolve(currentDir, '..', 'backend', 'local-backend-child.js'),
    resolve(currentDir, 'backend', 'local-backend-child.js'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function renderBackendChildExit(code: number | null, signal: NodeJS.Signals | null): Error {
  return new Error(`Local backend exited before it was ready (code=${String(code)} signal=${String(signal)})`);
}

export class LocalBackendProcesses {
  private child?: ChildProcess;
  private startPromise?: Promise<void>;
  private disposed = false;
  private baseUrl?: string;
  private token?: string;
  private workbenchBrowserToolHost: LocalBackendWorkbenchBrowserToolHost | null = null;

  async ensureStarted(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (this.hasOwnedRuntime()) {
      return;
    }

    await this.start();
  }

  async getStatus(): Promise<LocalBackendStatus> {
    if (!this.hasOwnedRuntime()) {
      return { daemonHealthy: false };
    }

    try {
      const response = await this.fetch('/health', { method: 'GET' });
      if (!response.ok) {
        return { daemonHealthy: false };
      }
      const body = (await response.json()) as { daemonHealthy?: unknown };
      return { daemonHealthy: body.daemonHealthy === true };
    } catch {
      return { daemonHealthy: false };
    }
  }

  async restart(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }
    await this.stop();
    this.disposed = false;
    await this.start();
  }

  async stop(): Promise<void> {
    this.disposed = true;
    const child = this.child;
    this.child = undefined;
    this.baseUrl = undefined;
    this.token = undefined;

    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // Startup may fail during quit.
      }
    }

    if (!child || child.killed) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve();
      }, 3_000);
      timeout.unref?.();
      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      if (typeof child.send === 'function' && child.connected) {
        child.send({ type: 'shutdown' });
      } else {
        child.kill('SIGTERM');
      }
    });
  }

  async dispatchApiRequest(input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ statusCode: number; headers: Record<string, string>; body: Uint8Array }> {
    await this.ensureStarted();
    const response = await this.fetch('/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: input }),
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  }

  async callLocalApiMethod(method: string, args: unknown[]): Promise<unknown> {
    await this.ensureStarted();
    const response = await this.fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
    });
    const body = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error || `Local backend RPC failed: ${String(response.status)}`);
    }
    return body.result;
  }

  async subscribeApiStream(path: string, onEvent: (event: DesktopApiStreamEvent) => void): Promise<() => void> {
    await this.ensureStarted();
    const controller = new AbortController();
    const url = new URL('/stream', this.baseUrl);
    url.searchParams.set('path', path);
    void this.fetch(`${url.pathname}${url.search}`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          onEvent({ type: 'error', message: `Stream failed: ${String(response.status)}` });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separator = buffer.indexOf('\n\n');
          while (separator >= 0) {
            const raw = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            this.emitSseEvent(raw, onEvent);
            separator = buffer.indexOf('\n\n');
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          onEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }

  setWorkbenchBrowserToolHost(host: LocalBackendWorkbenchBrowserToolHost | null): void {
    this.workbenchBrowserToolHost = host;
  }

  private emitSseEvent(raw: string, onEvent: (event: DesktopApiStreamEvent) => void): void {
    const lines = raw.split(/\r?\n/);
    const eventType =
      lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim() || 'message';
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');
    if (eventType === 'open' || eventType === 'close') {
      onEvent({ type: eventType });
      return;
    }
    if (eventType === 'error') {
      onEvent({ type: 'error', message: data ? JSON.parse(data).message : 'Stream error' });
      return;
    }
    onEvent({ type: 'message', data });
  }

  private hasOwnedRuntime(): boolean {
    return Boolean(this.child && !this.child.killed && this.baseUrl && this.token);
  }

  private async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  }

  private async startInternal(): Promise<void> {
    const token = randomUUID();
    const child = spawn(process.execPath, [resolveBackendChildEntry()], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NEON_PILOT_BACKEND_TOKEN: token,
      },
    });

    this.child = child;

    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[desktop-backend] ${String(chunk)}`);
    });
    child.on('message', (message) => {
      if (this.isNativeWorkbenchBrowserRequest(message)) {
        void this.handleNativeWorkbenchBrowserRequest(child, message);
      }
    });

    const ready = await new Promise<BackendReadyMessage>((resolveReady, rejectReady) => {
      const cleanup = () => {
        child.off('message', onMessage);
        child.off('exit', onExit);
        child.off('error', onError);
      };
      const onMessage = (message: unknown) => {
        if (!isBackendChildMessage(message)) return;
        if (message.type === 'ready') {
          cleanup();
          resolveReady(message);
          return;
        }
        cleanup();
        rejectReady(new Error(message.error));
      };
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        rejectReady(renderBackendChildExit(code, signal));
      };
      const onError = (error: Error) => {
        cleanup();
        rejectReady(error);
      };
      child.on('message', onMessage);
      child.once('exit', onExit);
      child.once('error', onError);
    });

    if (this.disposed) {
      await this.stop();
      return;
    }

    this.token = ready.token || token;
    this.baseUrl = `http://127.0.0.1:${String(ready.port)}`;
    child.once('exit', () => {
      if (this.child === child) {
        this.child = undefined;
        this.baseUrl = undefined;
        this.token = undefined;
      }
    });
  }

  private isNativeWorkbenchBrowserRequest(value: unknown): value is NativeWorkbenchBrowserRequest {
    return (
      Boolean(value && typeof value === 'object') &&
      (value as { type?: unknown }).type === 'native-workbench-browser-request' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { method?: unknown }).method === 'string' &&
      nativeWorkbenchBrowserMethods.has((value as { method: string }).method) &&
      Array.isArray((value as { args?: unknown }).args)
    );
  }

  private async handleNativeWorkbenchBrowserRequest(child: ChildProcess, request: NativeWorkbenchBrowserRequest): Promise<void> {
    const startedAt = Date.now();
    try {
      const host = this.workbenchBrowserToolHost;
      if (!host) {
        throw new Error('Workbench Browser native host is unavailable.');
      }

      let result: unknown;
      switch (request.method) {
        case 'isActive':
          result = await host.isActive(String(request.args[0] ?? ''));
          break;
        case 'listTabs':
          result = await host.listTabs();
          break;
        case 'snapshot':
          result = await host.snapshot(String(request.args[0] ?? ''), typeof request.args[1] === 'string' ? request.args[1] : undefined);
          break;
        case 'screenshot':
          result = await host.screenshot(String(request.args[0] ?? ''), typeof request.args[1] === 'string' ? request.args[1] : undefined);
          break;
        case 'cdp':
          result = await host.cdp(
            request.args[0] as { conversationId: string; command: unknown; continueOnError?: boolean; tabId?: string },
          );
          break;
      }

      const durationMs = Date.now() - startedAt;
      if (durationMs > NATIVE_WORKBENCH_BROWSER_SLOW_MS) {
        process.stderr.write(`[desktop-backend] Workbench Browser native ${request.method} took ${String(durationMs)}ms\n`);
      }
      child.send?.({ type: 'native-workbench-browser-response', id: request.id, ok: true, result });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[desktop-backend] Workbench Browser native ${request.method} failed after ${String(durationMs)}ms: ${message}\n`,
      );
      child.send?.({
        type: 'native-workbench-browser-response',
        id: request.id,
        ok: false,
        error: message,
      });
    }
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Local backend is not ready.');
    }
    return fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        ...(init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init.headers as Record<string, string> | undefined)),
        Authorization: `Bearer ${this.token}`,
      },
    });
  }
}

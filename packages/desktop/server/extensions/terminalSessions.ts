import { randomUUID } from 'node:crypto';
import { accessSync, constants } from 'node:fs';
import { basename } from 'node:path';

import type { ExtensionRouteRequest, ExtensionRouteResponse, ExtensionRouteSseEvent } from '@neon-pilot/extensions';

import { getLocalBackendBaseUrl } from '../app/localBackendBaseUrl.js';
import { createExtensionShellCapability } from './extensionShell.js';

interface TerminalSession {
  id: string;
  usingPty: boolean;
  process: {
    pid: number | null;
    usingPty?: boolean;
    kill: () => void;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
  };
  listeners: Set<(event: ExtensionRouteSseEvent) => void>;
  outputReplay: string[];
  outputBuffer: string[];
  startedAt: number;
  closed: boolean;
  exited: boolean;
  exitCode: number | null;
}

const sessions = new Map<string, TerminalSession>();
const MAX_REPLAY_CHUNKS = 128;
const STARTUP_OUTPUT_SETTLE_MS = 750;
const shell = createExtensionShellCapability();

function resolveRealtimeUrl(): string | undefined {
  const baseUrl = getLocalBackendBaseUrl();
  if (!baseUrl) return undefined;
  try {
    const url = new URL('/api/realtime', baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  } catch {
    return undefined;
  }
}

function generateId(): string {
  return randomUUID();
}

function resolveLoginShell(): string {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash'].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known shell.
    }
  }
  return '/bin/sh';
}

function resolveShellArgs(shellPath: string, options: { interactive?: boolean } = {}): string[] | undefined {
  if (options.interactive === false) return undefined;
  const binary = basename(shellPath).toLowerCase();
  if (binary === 'sh' || binary === 'bash' || binary === 'zsh' || binary === 'fish') return ['-i'];
  return undefined;
}

async function waitForStartupOutput(session: TerminalSession): Promise<void> {
  const startedAt = Date.now();
  while (!session.closed && session.outputBuffer.length === 0 && Date.now() - startedAt < STARTUP_OUTPUT_SETTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function broadcastOutput(session: TerminalSession, data: string): void {
  if (session.closed) return;
  session.outputReplay.push(data);
  if (session.outputReplay.length > MAX_REPLAY_CHUNKS) {
    session.outputReplay.splice(0, session.outputReplay.length - MAX_REPLAY_CHUNKS);
  }
  session.outputBuffer.push(data);
  const event: ExtensionRouteSseEvent = { data: { type: 'output', data } };
  for (const listener of session.listeners) {
    try {
      listener(event);
    } catch {
      /* drop disconnected */
    }
  }
}

function broadcastExit(session: TerminalSession, code: number | null): void {
  if (session.closed) return;
  session.exited = true;
  session.exitCode = code;
  const event: ExtensionRouteSseEvent = { data: { type: 'exit', code } };
  for (const listener of session.listeners) {
    try {
      listener(event);
    } catch {
      /* drop disconnected */
    }
  }
  session.listeners.clear();
}

export type TerminalSessionEvent =
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null };

export function subscribeTerminalSession(
  input: { id: string },
  listener: (event: TerminalSessionEvent) => void,
): { ok: true; unsubscribe: () => void; replay: string; exited: boolean; exitCode: number | null } | { ok: false } {
  const session = sessions.get(input.id);
  if (!session || session.closed) return { ok: false };

  const routeListener = (event: ExtensionRouteSseEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const candidate = data as Partial<TerminalSessionEvent>;
    if (candidate.type === 'output' && typeof candidate.data === 'string') {
      listener({ type: 'output', data: candidate.data });
      return;
    }
    if (candidate.type === 'exit') {
      listener({ type: 'exit', code: typeof candidate.code === 'number' ? candidate.code : null });
    }
  };

  session.listeners.add(routeListener);
  return {
    ok: true,
    unsubscribe: () => {
      session.listeners.delete(routeListener);
    },
    replay: session.outputReplay.join(''),
    exited: session.exited,
    exitCode: session.exitCode,
  };
}

export function clearTerminalSessionsForTests(): void {
  const ids = [...sessions.keys()];
  for (const id of ids) {
    const session = sessions.get(id);
    if (!session) continue;
    session.closed = true;
    try {
      session.process.kill();
    } catch {
      /* ignore */
    }
    sessions.delete(id);
  }
}

function removeSession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  try {
    session.process.kill();
  } catch {
    /* ignore */
  }
  if (!session.exited) {
    broadcastExit(session, null);
  }
  session.closed = true;
  sessions.delete(id);
}

export async function createTerminalSession(input: {
  cwd?: string;
}): Promise<{ id: string; pid: number | null; usingPty: boolean; initialOutput: string; realtimeUrl?: string }> {
  const shellPath = resolveLoginShell();
  const id = generateId();
  const earlyOutputReplay: string[] = [];

  const recordOutput = (sessionId: string, chunk: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      broadcastOutput(session, chunk);
      return;
    }
    earlyOutputReplay.push(chunk);
    if (earlyOutputReplay.length > MAX_REPLAY_CHUNKS) {
      earlyOutputReplay.splice(0, earlyOutputReplay.length - MAX_REPLAY_CHUNKS);
    }
  };

  const makeSpawnHandlers = (sessionId: string) => ({
    onStdout: (chunk: string) => {
      recordOutput(sessionId, chunk);
    },
    onStderr: (chunk: string) => {
      recordOutput(sessionId, chunk);
    },
    onExit: (event: { code: number | null; signal?: NodeJS.Signals | null }) => {
      const session = sessions.get(sessionId);
      if (session) {
        broadcastExit(session, event.code);
      }
    },
  });

  let usingPty = true;
  let child: TerminalSession['process'];
  try {
    child = await shell.spawn({
      command: shellPath,
      pty: { cols: 80, rows: 24 },
      args: resolveShellArgs(shellPath, { interactive: true }),
      cwd: input.cwd,
      ...makeSpawnHandlers(id),
    });
  } catch {
    usingPty = false;
    child = await shell.spawn({
      command: shellPath,
      args: resolveShellArgs(shellPath, { interactive: true }),
      cwd: input.cwd,
      ...makeSpawnHandlers(id),
    });
  }
  if (!child.usingPty) usingPty = false;

  const session: TerminalSession = {
    id,
    usingPty,
    process: child,
    listeners: new Set(),
    outputReplay: [...earlyOutputReplay],
    outputBuffer: [...earlyOutputReplay],
    startedAt: Date.now(),
    closed: false,
    exited: false,
    exitCode: null,
  };
  sessions.set(id, session);
  await waitForStartupOutput(session);

  const initialOutput = session.outputBuffer.join('');
  session.outputBuffer.length = 0;
  const realtimeUrl = resolveRealtimeUrl();
  return { id, pid: child.pid, usingPty, initialOutput, ...(realtimeUrl ? { realtimeUrl } : {}) };
}

export function writeTerminalSession(input: { id: string; data: string }): { ok: boolean } {
  const session = sessions.get(input.id);
  if (!session || session.closed || session.exited) return { ok: false };
  session.process.write(input.data);
  return { ok: true };
}

export function drainTerminalSession(input: { id: string }): { ok: boolean; output: string; exited: boolean; exitCode: number | null } {
  const session = sessions.get(input.id);
  if (!session || session.closed) return { ok: false, output: '', exited: true, exitCode: null };
  const output = session.outputBuffer.join('');
  session.outputBuffer.length = 0;
  return { ok: true, output, exited: session.exited, exitCode: session.exitCode };
}

export function resizeTerminalSession(input: { id: string; cols: number; rows: number }): { ok: boolean } {
  const session = sessions.get(input.id);
  if (!session || session.closed || session.exited) return { ok: false };
  session.process.resize(input.cols, input.rows);
  return { ok: true };
}

export function closeTerminalSession(input: { id: string }): { ok: boolean } {
  removeSession(input.id);
  return { ok: true };
}

export async function streamTerminalSession(request: ExtensionRouteRequest): Promise<ExtensionRouteResponse> {
  const idParam = request.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const session = sessions.get(id);
  if (!session || session.closed) {
    return { status: 404, body: { error: 'Terminal not found or already closed.' } };
  }

  return {
    stream: 'sse',
    events: createTerminalOutputStream(id),
  };
}

async function* createTerminalOutputStream(id: string): AsyncIterable<ExtensionRouteSseEvent> {
  const session = sessions.get(id);
  if (!session) return;

  for (const data of session.outputReplay) {
    yield { data: { type: 'output', data } };
  }

  if (session.exited) {
    yield { data: { type: 'exit', code: session.exitCode } };
    return;
  }

  let resolveEvent: ((event: IteratorResult<ExtensionRouteSseEvent>) => void) | null = null;
  let pendingEvent: ExtensionRouteSseEvent | null = null;

  const listener = (event: ExtensionRouteSseEvent) => {
    if (resolveEvent) {
      const resolve = resolveEvent;
      resolveEvent = null;
      resolve({ value: event, done: false });
    } else {
      pendingEvent = event;
    }
  };

  session.listeners.add(listener);

  try {
    while (!session.closed && !session.exited) {
      if (pendingEvent) {
        const event = pendingEvent;
        pendingEvent = null;
        yield event;
      } else {
        const event = await new Promise<IteratorResult<ExtensionRouteSseEvent>>((resolve) => {
          resolveEvent = resolve;
        });
        if (event.done) return;
        yield event.value;
      }
    }
  } finally {
    session.listeners.delete(listener);
  }
}

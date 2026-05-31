import { randomUUID } from 'node:crypto';
import { accessSync, constants } from 'node:fs';
import { basename } from 'node:path';

import type {
  ExtensionBackendContext,
  ExtensionRouteRequest,
  ExtensionRouteResponse,
  ExtensionRouteSseEvent,
} from '@neon-pilot/extensions';

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
}

const sessions = new Map<string, TerminalSession>();
const MAX_REPLAY_CHUNKS = 128;
const STARTUP_OUTPUT_SETTLE_MS = 750;

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

function resolveShellArgs(shell: string, options: { interactive?: boolean } = {}): string[] | undefined {
  if (options.interactive === false) return undefined;
  const binary = basename(shell).toLowerCase();
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
  session.closed = true;
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

/** @internal exported for testing */
export function _clearSessions(): void {
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
  session.closed = true;
  try {
    session.process.kill();
  } catch {
    /* ignore */
  }
  broadcastExit(session, null);
  sessions.delete(id);
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function createTerminal(
  input: { cwd?: string },
  ctx: ExtensionBackendContext,
): Promise<{ id: string; pid: number | null; usingPty: boolean; initialOutput: string }> {
  const shell = resolveLoginShell();
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
        sessions.delete(sessionId);
      }
    },
  });

  let usingPty = true;
  let child: TerminalSession['process'];
  try {
    child = await ctx.shell.spawn({
      command: shell,
      pty: { cols: 80, rows: 24 },
      args: resolveShellArgs(shell, { interactive: true }),
      cwd: input.cwd,
      ...makeSpawnHandlers(id),
    });
  } catch {
    usingPty = false;
    child = await ctx.shell.spawn({
      command: shell,
      args: resolveShellArgs(shell, { interactive: true }),
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
  };
  sessions.set(id, session);
  await waitForStartupOutput(session);

  ctx.log.info('Terminal created', { id, pid: child.pid, cwd: input.cwd });
  const initialOutput = session.outputBuffer.join('');
  session.outputBuffer.length = 0;
  return { id, pid: child.pid, usingPty, initialOutput };
}

export async function writeTerminal(input: { id: string; data: string }, _ctx: ExtensionBackendContext): Promise<{ ok: boolean }> {
  const session = sessions.get(input.id);
  if (!session || session.closed) return { ok: false };
  session.process.write(input.data);
  return { ok: true };
}

export async function drainTerminal(input: { id: string }, _ctx: ExtensionBackendContext): Promise<{ ok: boolean; output: string }> {
  const session = sessions.get(input.id);
  if (!session || session.closed) return { ok: false, output: '' };
  const output = session.outputBuffer.join('');
  session.outputBuffer.length = 0;
  return { ok: true, output };
}

export async function resizeTerminal(
  input: { id: string; cols: number; rows: number },
  _ctx: ExtensionBackendContext,
): Promise<{ ok: boolean }> {
  const session = sessions.get(input.id);
  if (!session || session.closed) return { ok: false };
  session.process.resize(input.cols, input.rows);
  return { ok: true };
}

export async function closeTerminal(input: { id: string }, _ctx: ExtensionBackendContext): Promise<{ ok: boolean }> {
  removeSession(input.id);
  return { ok: true };
}

// ── SSE route ────────────────────────────────────────────────────────────────

export async function streamTerminal(request: ExtensionRouteRequest, _ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
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

  // Resolve the SSE connection when the listener is established.
  // We push events through the listener set so the async generator
  // can yield them on demand.
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
    while (!session.closed) {
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

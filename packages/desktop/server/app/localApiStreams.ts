import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';

import { getDurableRunLogCursor, getDurableRunSnapshot, readDurableRunLogDelta } from '../automation/durableRuns.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { subscribeProviderOAuthLogin } from '../models/providerAuth.js';
import { buildSnapshotEventsForTopic, readInitialAppEventTopics } from '../routes/system.js';
import { subscribeAppEvents } from '../shared/appEvents.js';
import { readWorkspaceRootSnapshot } from '../workspace/workspaceExplorer.js';
import { subscribeDesktopControlCommands } from './localApiDesktopControl.js';
import { shouldCloseProviderOAuthSubscription } from './localApiProviderOAuthSubscription.js';

const DEFERRED_APP_EVENT_SNAPSHOT_DELAY_MS = 6_000;

export type DesktopLocalApiStreamEvent =
  | { type: 'open' }
  | { type: 'message'; data: string }
  | { type: 'sse'; data: string; event?: string; id?: string; retry?: number }
  | { type: 'error'; message: string }
  | { type: 'close' };

function emitStreamMessage(onEvent: (event: DesktopLocalApiStreamEvent) => void, payload: unknown): void {
  onEvent({ type: 'message', data: JSON.stringify(payload) });
}

function normalizeStreamQuery(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const existing = query[key];
    if (typeof existing === 'string') {
      query[key] = [existing, value];
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = value;
    }
  }
  return query;
}

function initialAppEventSnapshotDelayMs(topics: readonly string[]): number {
  return topics.includes('sessions') ? DEFERRED_APP_EVENT_SNAPSHOT_DELAY_MS : 0;
}

function parsePositiveInteger(raw: string | null, options?: { minimum?: number; maximum?: number }): number | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed)) {
    return undefined;
  }

  const minimum = options?.minimum ?? 1;
  if (parsed < minimum) {
    return undefined;
  }

  const maximum = options?.maximum;
  if (typeof maximum === 'number' && parsed > maximum) {
    return maximum;
  }

  return parsed;
}

async function subscribeDesktopExtensionRouteStream(url: URL, onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  const match = /^\/api\/extensions\/([^/]+)\/routes\/(.*)$/.exec(url.pathname);
  const extensionId = decodeURIComponent(match?.[1] ?? '');
  const routePath = `/${match?.[2] ?? ''}`;
  if (!extensionId || !match) {
    throw new Error('Extension stream route is required.');
  }

  const abort = new AbortController();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    abort.abort();
    onEvent({ type: 'close' });
  };

  const result = await getExtensionHostClient().invokeRoute({
    extensionId,
    method: 'GET',
    routePath,
    request: {
      method: 'GET',
      path: routePath,
      query: normalizeStreamQuery(url.searchParams),
      params: {},
      signal: abort.signal,
    },
  });

  if (result.stream !== 'sse' || !result.events) {
    throw new Error(`Extension route ${extensionId}${routePath} is not an SSE stream.`);
  }
  const events = result.events;

  onEvent({ type: 'open' });
  void (async () => {
    try {
      for await (const event of events) {
        if (closed) return;
        onEvent({
          type: 'sse',
          data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data ?? null),
          ...(typeof event.event === 'string' ? { event: event.event } : {}),
          ...(typeof event.id === 'string' ? { id: event.id } : {}),
          ...(typeof event.retry === 'number' ? { retry: event.retry } : {}),
        });
      }
      close();
    } catch (error) {
      if (closed) return;
      onEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      close();
    }
  })();

  return close;
}

async function subscribeDesktopControlCommandStream(onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  onEvent({ type: 'open' });
  const unsubscribe = subscribeDesktopControlCommands((command) => {
    emitStreamMessage(onEvent, command);
  });
  return () => {
    unsubscribe();
    onEvent({ type: 'close' });
  };
}

const ACTIVE_RUN_POLL_INTERVAL_MS = 1_000;
const IDLE_RUN_POLL_INTERVAL_MS = 5_000;
const ACTIVE_RUN_LOG_POLL_INTERVAL_MS = 250;
const IDLE_RUN_LOG_POLL_INTERVAL_MS = 2_000;
const TERMINAL_RUN_STREAM_GRACE_MS = 1_500;

function isRunStreamActive(snapshot: { detail: { run: { status?: { status?: string } | string } } }): boolean {
  const runStatus = typeof snapshot.detail.run.status === 'string' ? snapshot.detail.run.status : snapshot.detail.run.status?.status;

  return runStatus === 'queued' || runStatus === 'waiting' || runStatus === 'running' || runStatus === 'recovering';
}

function getRunStreamPollInterval(snapshot: { detail: { run: { status?: { status?: string } | string } } }): number {
  return isRunStreamActive(snapshot) ? ACTIVE_RUN_POLL_INTERVAL_MS : IDLE_RUN_POLL_INTERVAL_MS;
}

function getRunLogPollInterval(active: boolean): number {
  return active ? ACTIVE_RUN_LOG_POLL_INTERVAL_MS : IDLE_RUN_LOG_POLL_INTERVAL_MS;
}

async function subscribeDesktopRunStream(url: URL, onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  const match = /^\/api\/runs\/([^/]+)\/events$/.exec(url.pathname);
  const runId = decodeURIComponent(match?.[1] ?? '');
  if (!runId) {
    throw new Error('Run id is required.');
  }

  const tail = parsePositiveInteger(url.searchParams.get('tail'), { minimum: 1, maximum: 1000 }) ?? 120;
  const initial = await getDurableRunSnapshot(runId, tail);
  if (!initial) {
    throw new Error('Run not found');
  }

  let closed = false;
  let detailPollTimer: ReturnType<typeof setTimeout> | null = null;
  let logPollTimer: ReturnType<typeof setTimeout> | null = null;
  let terminalStopTimer: ReturnType<typeof setTimeout> | null = null;
  let logPath = initial.log.path;
  let logCursor = getDurableRunLogCursor(logPath);
  let runActive = isRunStreamActive(initial);
  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    if (detailPollTimer) {
      clearTimeout(detailPollTimer);
      detailPollTimer = null;
    }
    if (logPollTimer) {
      clearTimeout(logPollTimer);
      logPollTimer = null;
    }
    if (terminalStopTimer) {
      clearTimeout(terminalStopTimer);
      terminalStopTimer = null;
    }
    onEvent({ type: 'close' });
  };

  const scheduleTerminalStop = () => {
    if (closed || terminalStopTimer) {
      return;
    }

    terminalStopTimer = setTimeout(() => {
      close();
    }, TERMINAL_RUN_STREAM_GRACE_MS);
  };

  const scheduleDetailPoll = (delayMs: number) => {
    if (closed || !runActive) {
      return;
    }

    detailPollTimer = setTimeout(() => {
      void pollDetailOnce();
    }, delayMs);
  };

  const scheduleLogPoll = (delayMs: number) => {
    if (closed) {
      return;
    }

    logPollTimer = setTimeout(() => {
      void pollLogOnce();
    }, delayMs);
  };

  const pollDetailOnce = async () => {
    if (closed) {
      return;
    }

    try {
      const next = await getDurableRunSnapshot(runId, tail);
      if (closed) {
        return;
      }

      if (!next) {
        emitStreamMessage(onEvent, { type: 'deleted', runId });
        close();
        return;
      }

      runActive = isRunStreamActive(next);
      if (next.log.path !== logPath) {
        logPath = next.log.path;
        logCursor = getDurableRunLogCursor(logPath);
        emitStreamMessage(onEvent, {
          type: 'snapshot',
          detail: next.detail,
          log: next.log,
        });
      } else {
        emitStreamMessage(onEvent, {
          type: 'detail',
          detail: next.detail,
        });
      }
      if (!runActive) {
        scheduleTerminalStop();
        return;
      }
      scheduleDetailPoll(getRunStreamPollInterval(next));
    } catch {
      scheduleDetailPoll(ACTIVE_RUN_POLL_INTERVAL_MS);
    }
  };

  const pollLogOnce = async () => {
    if (closed) {
      return;
    }

    try {
      const delta = readDurableRunLogDelta(logPath, logCursor);
      if (closed) {
        return;
      }

      if (delta?.reset) {
        const next = await getDurableRunSnapshot(runId, tail);
        if (closed) {
          return;
        }

        if (!next) {
          emitStreamMessage(onEvent, { type: 'deleted', runId });
          close();
          return;
        }

        runActive = isRunStreamActive(next);
        logPath = next.log.path;
        logCursor = getDurableRunLogCursor(logPath);
        emitStreamMessage(onEvent, {
          type: 'snapshot',
          detail: next.detail,
          log: next.log,
        });
      } else if (delta) {
        logCursor = delta.nextCursor;
        if (delta.delta.length > 0) {
          emitStreamMessage(onEvent, { type: 'log_delta', path: delta.path, delta: delta.delta });
        }
      }
    } finally {
      if (runActive) {
        scheduleLogPoll(getRunLogPollInterval(runActive));
      } else {
        scheduleTerminalStop();
      }
    }
  };

  onEvent({ type: 'open' });
  emitStreamMessage(onEvent, {
    type: 'snapshot',
    detail: initial.detail,
    log: initial.log,
  });
  if (runActive) {
    scheduleDetailPoll(getRunStreamPollInterval(initial));
    scheduleLogPoll(getRunLogPollInterval(runActive));
  } else {
    scheduleTerminalStop();
  }

  return close;
}

async function subscribeDesktopProviderOAuthStream(url: URL, onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  const match = /^\/api\/provider-auth\/oauth\/([^/]+)\/events$/.exec(url.pathname);
  const loginId = decodeURIComponent(match?.[1] ?? '');
  if (!loginId) {
    throw new Error('Provider OAuth login id is required.');
  }

  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    const teardown = unsubscribe;
    unsubscribe = null;
    teardown?.();
    onEvent({ type: 'close' });
  };

  onEvent({ type: 'open' });
  const teardown = subscribeProviderOAuthLogin(loginId, (login) => {
    if (closed) {
      return;
    }

    emitStreamMessage(onEvent, login);
    if (shouldCloseProviderOAuthSubscription(login)) {
      close();
    }
  });
  if (closed) {
    teardown();
    return () => {};
  }
  unsubscribe = teardown;

  timeoutId = setTimeout(
    () => {
      close();
    },
    10 * 60 * 1000,
  );

  return close;
}

async function subscribeDesktopWorkspaceEventsStream(url: URL, onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  const cwd = url.searchParams.get('cwd')?.trim();
  if (!cwd) {
    throw new Error('Workspace cwd is required');
  }

  const snapshot = readWorkspaceRootSnapshot(cwd);
  const watchers: Array<ReturnType<typeof watch>> = [];
  let closed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    for (const watcher of watchers.splice(0)) {
      watcher.close();
    }
    onEvent({ type: 'close' });
  };

  const emitWorkspaceChange = () => {
    if (closed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (closed) return;
      emitStreamMessage(onEvent, { type: 'workspace' });
    }, 250);
  };

  onEvent({ type: 'open' });
  emitStreamMessage(onEvent, { type: 'ready', root: snapshot.root });

  try {
    // Avoid recursive repo watches here. In packaged Electron on large repos they can
    // create a startup event storm big enough to freeze the renderer. A shallow root
    // watch plus .git watch is enough to invalidate workspace/git status cheaply.
    watchers.push(watch(snapshot.root, emitWorkspaceChange));
    const gitDir = join(snapshot.root, '.git');
    if (existsSync(gitDir)) {
      watchers.push(watch(gitDir, emitWorkspaceChange));
    }
  } catch (error) {
    for (const watcher of watchers.splice(0)) {
      watcher.close();
    }
    const message = error instanceof Error ? error.message : String(error);
    onEvent({ type: 'error', message });
    close();
    return close;
  }

  return close;
}

async function subscribeDesktopAppEventsStream(url: URL, onEvent: (event: DesktopLocalApiStreamEvent) => void): Promise<() => void> {
  onEvent({ type: 'open' });
  const initialSnapshotTopics = readInitialAppEventTopics(url.searchParams);
  let closed = false;
  const unsubscribe = subscribeAppEvents((event) => {
    if (closed) {
      return;
    }

    emitStreamMessage(onEvent, event);
  });

  const deferredSnapshotTimer = setTimeout(() => {
    void (async () => {
      for (const topic of initialSnapshotTopics) {
        if (closed) {
          continue;
        }
        for (const event of await buildSnapshotEventsForTopic(topic)) {
          if (closed) {
            return;
          }
          emitStreamMessage(onEvent, event);
        }
      }
    })();
  }, initialAppEventSnapshotDelayMs(initialSnapshotTopics));
  deferredSnapshotTimer.unref?.();

  return () => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimeout(deferredSnapshotTimer);
    unsubscribe();
    onEvent({ type: 'close' });
  };
}

export async function subscribeDesktopLocalApiStreamByUrl(
  url: URL,
  onEvent: (event: DesktopLocalApiStreamEvent) => void,
): Promise<() => void> {
  if (/^\/api\/runs\/[^/]+\/events$/.test(url.pathname)) {
    return subscribeDesktopRunStream(url, onEvent);
  }

  if (/^\/api\/provider-auth\/oauth\/[^/]+\/events$/.test(url.pathname)) {
    return subscribeDesktopProviderOAuthStream(url, onEvent);
  }

  if (/^\/api\/extensions\/[^/]+\/routes\/.*$/.test(url.pathname)) {
    return subscribeDesktopExtensionRouteStream(url, onEvent);
  }

  if (url.pathname === '/api/app-events/events') {
    return subscribeDesktopAppEventsStream(url, onEvent);
  }

  if (url.pathname === '/api/desktop/control/events') {
    return subscribeDesktopControlCommandStream(onEvent);
  }

  if (url.pathname === '/api/workspace/events') {
    return subscribeDesktopWorkspaceEventsStream(url, onEvent);
  }

  throw new Error(`No local API stream for ${url.pathname}`);
}

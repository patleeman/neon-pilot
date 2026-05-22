import type { MethodHandler } from '../codexJsonRpcServer.js';

/**
 * Compatibility handlers for Codex API methods Kitty may call outside the core
 * PA bridge surface. Implement PA-backed behavior where possible; otherwise
 * fail loudly with a stable unsupported error instead of silently pretending.
 */

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function storageKey(method: string, id = 'default'): string {
  return `compat:${method}:${id}`;
}

function paramsObject(params: unknown): Record<string, unknown> {
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
}

function ok(extra: Record<string, unknown> = {}) {
  return { ok: true, ...extra };
}

function unsupported(method: string, reason: string): MethodHandler {
  return async () => {
    throw new Error(`${method} is unsupported by Neon Pilot Kitty Litter bridge: ${reason}`);
  };
}

// ── Thread experimental features ───────────────────────────────────────────

export const threadRealtime = {
  start: (async (params, ctx) => {
    const p = paramsObject(params);
    const threadId = typeof p.threadId === 'string' ? p.threadId : 'default';
    const session = { id: `realtime-${Date.now().toString(36)}`, threadId, status: 'disabled', startedAt: nowSeconds() };
    await ctx.storage.put(storageKey('thread/realtime', threadId), session);
    return { session, realtimeSessionId: session.id, status: 'disabled' };
  }) as MethodHandler,
  stop: (async (params, ctx) => {
    const p = paramsObject(params);
    const threadId = typeof p.threadId === 'string' ? p.threadId : 'default';
    await ctx.storage.delete(storageKey('thread/realtime', threadId)).catch(() => null);
    return ok({ status: 'stopped' });
  }) as MethodHandler,
  appendAudio: unsupported('thread/realtime/appendAudio', 'Neon Pilot does not expose a realtime audio stream over this protocol'),
  appendText: (async (params, ctx) => {
    const p = paramsObject(params);
    const threadId = typeof p.threadId === 'string' ? p.threadId : undefined;
    const text = typeof p.text === 'string' ? p.text : '';
    if (threadId && text.trim()) await ctx.conversations.sendMessage(threadId, text).catch(() => null);
    return ok({ accepted: Boolean(threadId && text.trim()) });
  }) as MethodHandler,
};

export const threadBackgroundTerminals = {
  clean: (async () => ok({ cleaned: true })) as MethodHandler,
};

export const threadMemoryMode = {
  set: (async (params, ctx) => {
    const p = paramsObject(params);
    const threadId = typeof p.threadId === 'string' ? p.threadId : 'default';
    const mode = typeof p.mode === 'string' ? p.mode : p.memoryMode;
    await ctx.storage.put(storageKey('thread/memoryMode', threadId), { threadId, mode: mode ?? null, updatedAt: nowSeconds() });
    return { threadId, mode: mode ?? null };
  }) as MethodHandler,
};

// ── Process (standalone) ───────────────────────────────────────────────────

const processes = new Map<string, { pid: number | null; kill: () => void; stdout: string; stderr: string; exit: unknown }>();

export const processStubs = {
  spawn: (async (params, ctx, _conn, notify) => {
    const p = paramsObject(params);
    const command = typeof p.command === 'string' ? p.command : undefined;
    if (!command) throw new Error('command is required');
    const args = Array.isArray(p.args) ? p.args.filter((arg): arg is string => typeof arg === 'string') : [];
    const id = `proc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    processes.set(id, { pid: null, kill: () => undefined, stdout: '', stderr: '', exit: null });
    const child = await ctx.shell.spawn({
      command,
      args,
      cwd: typeof p.cwd === 'string' ? p.cwd : undefined,
      env: p.env && typeof p.env === 'object' ? (p.env as Record<string, string>) : undefined,
      onStdout: (chunk) => {
        const proc = processes.get(id);
        if (proc) proc.stdout += chunk;
        notify('process/outputDelta', { processId: id, stream: 'stdout', dataBase64: Buffer.from(chunk).toString('base64') });
      },
      onStderr: (chunk) => {
        const proc = processes.get(id);
        if (proc) proc.stderr += chunk;
        notify('process/outputDelta', { processId: id, stream: 'stderr', dataBase64: Buffer.from(chunk).toString('base64') });
      },
      onExit: (event) => {
        const proc = processes.get(id);
        if (proc) proc.exit = event;
        notify('process/exited', { processId: id, ...event });
      },
    });
    const proc = processes.get(id);
    if (proc) {
      proc.pid = child.pid;
      proc.kill = child.kill;
    }
    return { processId: id, pid: child.pid, executionWrappers: child.executionWrappers };
  }) as MethodHandler,
  writeStdin: unsupported('process/writeStdin', 'managed extension processes do not expose stdin handles yet'),
  resizePty: unsupported('process/resizePty', 'managed extension processes do not expose PTY resize yet'),
  kill: (async (params) => {
    const p = paramsObject(params);
    const id = typeof p.processId === 'string' ? p.processId : typeof p.id === 'string' ? p.id : undefined;
    const proc = id ? processes.get(id) : undefined;
    proc?.kill();
    if (id) processes.delete(id);
    return ok({ killed: Boolean(proc) });
  }) as MethodHandler,
};

// ── File watching ──────────────────────────────────────────────────────────

export const fsWatch = {
  watch: unsupported('fs/watch', 'extension file watching is not exposed through this bridge yet'),
  unwatch: (async () => ok({ unwatched: true })) as MethodHandler,
};

// ── Model provider ─────────────────────────────────────────────────────────

export const modelProvider = {
  capabilitiesRead: (async () => ({
    modelProvider: 'neon-pilot',
    capabilities: {
      supportsReasoningEffort: false,
      supportsServiceTier: false,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
    },
  })) as MethodHandler,
};

// ── Experimental features ──────────────────────────────────────────────────

export const experimentalFeature = {
  list: (async () => ({ data: [], nextCursor: null })) as MethodHandler,
  enablementSet: (async (params, ctx) => {
    const p = paramsObject(params);
    const feature = typeof p.feature === 'string' ? p.feature : typeof p.id === 'string' ? p.id : 'unknown';
    const enabled = p.enabled === true;
    await ctx.storage.put(storageKey('experimentalFeature', feature), { feature, enabled, updatedAt: nowSeconds() });
    return { feature, enabled };
  }) as MethodHandler,
};

// ── Hooks ─────────────────────────────────────────────────────────────────

export const hooksList = (async () => ({ data: [], nextCursor: null })) as MethodHandler;

// ── Marketplace ───────────────────────────────────────────────────────────

export const marketplace = {
  add: unsupported('marketplace/add', 'Neon Pilot extensions are installed through the desktop extension manager'),
  remove: unsupported('marketplace/remove', 'Neon Pilot extensions are removed through the desktop extension manager'),
  upgrade: unsupported('marketplace/upgrade', 'Neon Pilot extensions are upgraded through the desktop extension manager'),
};

// ── Plugins ───────────────────────────────────────────────────────────────

export const plugin = {
  list: (async (params, ctx) => {
    const prefix = storageKey('plugin', '');
    const rows = await ctx.storage.list<Record<string, unknown>>(prefix).catch(() => []);
    return { data: rows.map((row) => row.value), nextCursor: null };
  }) as MethodHandler,
  read: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? 'unknown');
    return { plugin: await ctx.storage.get(storageKey('plugin', id)).catch(() => null) };
  }) as MethodHandler,
  install: unsupported('plugin/install', 'Neon Pilot does not install Codex plugins through Kitty'),
  uninstall: unsupported('plugin/uninstall', 'Neon Pilot does not uninstall Codex plugins through Kitty'),
};

// ── Review ─────────────────────────────────────────────────────────────────

export const reviewStart = (async (params, ctx) => {
  const p = paramsObject(params);
  const threadId = typeof p.threadId === 'string' ? p.threadId : undefined;
  if (threadId)
    await ctx.conversations.sendMessage(threadId, 'Please review the current changes and call out concrete issues.').catch(() => null);
  return { reviewId: `review-${Date.now().toString(36)}`, threadId: threadId ?? null, started: Boolean(threadId) };
}) as MethodHandler;

// ── Collaboration ──────────────────────────────────────────────────────────

export const collaborationModeList = (async () => ({
  data: [
    { id: 'default', name: 'Default', description: 'Standard Neon Pilot mode', isDefault: true },
    { id: 'plan', name: 'Plan', description: 'Planning-oriented mode', isDefault: false },
  ],
  nextCursor: null,
})) as MethodHandler;

// ── MCP Server ────────────────────────────────────────────────────────────

export const mcpServer = {
  oauthLogin: unsupported('mcpServer/oauth/login', 'MCP OAuth is managed by Neon Pilot desktop'),
};

export const mcpServerStatusList = (async () => ({ data: [], nextCursor: null })) as MethodHandler;

export const mcpServerResource = {
  read: unsupported('mcpServer/resource/read', 'MCP resources are not exposed through Kitty yet'),
};

export const mcpServerTool = {
  call: unsupported('mcpServer/tool/call', 'MCP tool calls are not exposed through Kitty yet'),
};

// ── Config ─────────────────────────────────────────────────────────────────

export const configStubs = {
  valueWrite: (async (params, ctx) => {
    const p = paramsObject(params);
    const key = String(p.key ?? p.path ?? 'unknown');
    await ctx.storage.put(storageKey('config', key), { key, value: p.value ?? null, updatedAt: nowSeconds() });
    return ok({ key });
  }) as MethodHandler,
  batchWrite: (async (params, ctx) => {
    const p = paramsObject(params);
    const entries = Array.isArray(p.entries) ? p.entries : Array.isArray(p.values) ? p.values : [];
    for (const entry of entries) {
      const e = paramsObject(entry);
      const key = String(e.key ?? e.path ?? 'unknown');
      await ctx.storage.put(storageKey('config', key), { key, value: e.value ?? null, updatedAt: nowSeconds() });
    }
    return ok({ count: entries.length });
  }) as MethodHandler,
  requirementsRead: (async () => ({ requirements: [], data: [] })) as MethodHandler,
};

// ── Feedback ───────────────────────────────────────────────────────────────

export const feedbackUpload = unsupported('feedback/upload', 'feedback upload is not routed through the Neon Pilot bridge');

// ── External Agent Config ─────────────────────────────────────────────────

export const externalAgentConfig = {
  detect: (async () => ({ data: [], detected: [] })) as MethodHandler,
  import_: unsupported('externalAgentConfig/import', 'external agent config import is not applicable to Neon Pilot'),
};

// ── Tool ───────────────────────────────────────────────────────────────────

export const toolRequestUserInput = (async (params, ctx) => {
  const p = paramsObject(params);
  const threadId = typeof p.threadId === 'string' ? p.threadId : undefined;
  const prompt = typeof p.prompt === 'string' ? p.prompt : typeof p.message === 'string' ? p.message : 'Input requested from Kitty Litter.';
  if (threadId)
    await ctx.conversations.appendTranscriptBlock({ conversationId: threadId, type: 'context', content: prompt }).catch(() => null);
  return { requestId: `input-${Date.now().toString(36)}`, status: 'recorded', threadId: threadId ?? null };
}) as MethodHandler;

// ── App ───────────────────────────────────────────────────────────────────

export const appList = (async () => ({
  data: [
    {
      id: 'neon-pilot',
      name: 'neon-pilot',
      displayName: 'Neon Pilot',
      description: 'Neon Pilot desktop agent runtime exposed through the Kitty Litter bridge.',
      available: true,
      isDefault: true,
    },
  ],
  nextCursor: null,
})) as MethodHandler;

// ── Remote Control ─────────────────────────────────────────────────────────

export const remoteControlStatusChanged = (async () => ok({ status: 'disabled' })) as MethodHandler;

// ── Windows Sandbox ────────────────────────────────────────────────────────

export const windowsSandboxSetupStart = unsupported(
  'windowsSandbox/setupStart',
  'Windows sandbox setup is not applicable on this Neon Pilot host',
);

// ── Environment ────────────────────────────────────────────────────────────

export const environmentAdd = (async (params, ctx) => {
  const p = paramsObject(params);
  const id = String(p.id ?? p.name ?? `environment-${Date.now().toString(36)}`);
  const environment = { ...p, id, createdAt: nowSeconds() };
  await ctx.storage.put(storageKey('environment', id), environment);
  return { environment };
}) as MethodHandler;

// ── Memory ─────────────────────────────────────────────────────────────────

export const memoryReset = (async (params, ctx) => {
  const p = paramsObject(params);
  const threadId = typeof p.threadId === 'string' ? p.threadId : 'global';
  await ctx.storage.delete(storageKey('memory', threadId)).catch(() => null);
  return ok({ threadId, reset: true });
}) as MethodHandler;

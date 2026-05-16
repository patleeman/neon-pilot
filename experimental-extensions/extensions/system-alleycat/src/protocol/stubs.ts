import type { MethodHandler } from '../codexJsonRpcServer.js';

/**
 * Compatibility handlers for Codex API methods Kitty may call outside the core
 * PA bridge surface. Prefer deterministic, typed no-op/stateful behavior over
 * "not implemented" stubs so the mobile client does not spin forever.
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
  appendAudio: (async () => ok({ accepted: false, reason: 'realtime audio is not supported by Personal Agent' })) as MethodHandler,
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
  spawn: (async (params, ctx) => {
    const p = paramsObject(params);
    const command = typeof p.command === 'string' ? p.command : undefined;
    if (!command) throw new Error('command is required');
    const args = Array.isArray(p.args) ? p.args.filter((arg): arg is string => typeof arg === 'string') : [];
    const id = `proc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const child = await ctx.shell.spawn({
      command,
      args,
      cwd: typeof p.cwd === 'string' ? p.cwd : undefined,
      env: p.env && typeof p.env === 'object' ? (p.env as Record<string, string>) : undefined,
      onStdout: (chunk) => {
        const proc = processes.get(id);
        if (proc) proc.stdout += chunk;
      },
      onStderr: (chunk) => {
        const proc = processes.get(id);
        if (proc) proc.stderr += chunk;
      },
      onExit: (event) => {
        const proc = processes.get(id);
        if (proc) proc.exit = event;
      },
    });
    processes.set(id, { pid: child.pid, kill: child.kill, stdout: '', stderr: '', exit: null });
    return { processId: id, pid: child.pid, executionWrappers: child.executionWrappers };
  }) as MethodHandler,
  writeStdin: (async () => ok({ written: false, reason: 'stdin streaming is not supported by this bridge yet' })) as MethodHandler,
  resizePty: (async () => ok({ resized: false, reason: 'pty resize is not supported by this bridge yet' })) as MethodHandler,
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
  watch: (async (params, ctx) => {
    const p = paramsObject(params);
    const path = typeof p.path === 'string' ? p.path : 'default';
    await ctx.storage.put(storageKey('fs/watch', path), { path, updatedAt: nowSeconds() });
    return { watchId: path, path };
  }) as MethodHandler,
  unwatch: (async (params, ctx) => {
    const p = paramsObject(params);
    const watchId = typeof p.watchId === 'string' ? p.watchId : typeof p.path === 'string' ? p.path : 'default';
    await ctx.storage.delete(storageKey('fs/watch', watchId)).catch(() => null);
    return ok({ watchId });
  }) as MethodHandler,
};

// ── Model provider ─────────────────────────────────────────────────────────

export const modelProvider = {
  capabilitiesRead: (async () => ({
    modelProvider: 'personal-agent',
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
  add: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? p.url ?? `marketplace-${Date.now().toString(36)}`);
    await ctx.storage.put(storageKey('marketplace', id), { ...p, id, installedAt: nowSeconds() });
    return { id, installed: true };
  }) as MethodHandler,
  remove: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? 'unknown');
    await ctx.storage.delete(storageKey('marketplace', id)).catch(() => null);
    return { id, removed: true };
  }) as MethodHandler,
  upgrade: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? 'unknown');
    await ctx.storage.put(storageKey('marketplaceUpgrade', id), { ...p, id, upgradedAt: nowSeconds() });
    return { id, upgraded: true };
  }) as MethodHandler,
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
  install: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? `plugin-${Date.now().toString(36)}`);
    const plugin = { ...p, id, installed: true, installedAt: nowSeconds() };
    await ctx.storage.put(storageKey('plugin', id), plugin);
    return { plugin };
  }) as MethodHandler,
  uninstall: (async (params, ctx) => {
    const p = paramsObject(params);
    const id = String(p.id ?? p.name ?? 'unknown');
    await ctx.storage.delete(storageKey('plugin', id)).catch(() => null);
    return { id, uninstalled: true };
  }) as MethodHandler,
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
    { id: 'default', name: 'Default', description: 'Standard Personal Agent mode', isDefault: true },
    { id: 'plan', name: 'Plan', description: 'Planning-oriented mode', isDefault: false },
  ],
  nextCursor: null,
})) as MethodHandler;

// ── MCP Server ────────────────────────────────────────────────────────────

export const mcpServer = {
  oauthLogin: (async () => ({
    loginId: null,
    status: 'unavailable',
    message: 'MCP OAuth is managed by Personal Agent desktop.',
  })) as MethodHandler,
};

export const mcpServerStatusList = (async () => ({ data: [], nextCursor: null })) as MethodHandler;

export const mcpServerResource = {
  read: (async () => ({ contents: [], data: null })) as MethodHandler,
};

export const mcpServerTool = {
  call: (async () => ({
    content: [{ type: 'text', text: 'MCP tool calls are not exposed through Kitty Litter yet.' }],
    isError: true,
  })) as MethodHandler,
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

export const feedbackUpload = (async (params, ctx) => {
  const id = `feedback-${Date.now().toString(36)}`;
  await ctx.storage.put(storageKey('feedback', id), { id, params, createdAt: nowSeconds() });
  return { feedbackId: id, uploaded: true };
}) as MethodHandler;

// ── External Agent Config ─────────────────────────────────────────────────

export const externalAgentConfig = {
  detect: (async () => ({ data: [], detected: [] })) as MethodHandler,
  import_: (async () => ({ imported: false, data: [] })) as MethodHandler,
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

export const appList = (async () => ({ data: [], nextCursor: null })) as MethodHandler;

// ── Remote Control ─────────────────────────────────────────────────────────

export const remoteControlStatusChanged = (async () => ok({ status: 'disabled' })) as MethodHandler;

// ── Windows Sandbox ────────────────────────────────────────────────────────

export const windowsSandboxSetupStart = (async () => ok({ started: false, platform: process.platform })) as MethodHandler;

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

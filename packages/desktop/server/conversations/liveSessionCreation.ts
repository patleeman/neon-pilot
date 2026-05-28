import { type AgentSession, SessionManager } from '@earendil-works/pi-coding-agent';

import { readConversationSessionMetaByFile } from './conversationService.js';
import { createPreparedLiveAgentSession } from './liveSessionFactory.js';
import { type LiveSessionLoaderOptions, queuePrewarmLiveSessionLoader } from './liveSessionLoader.js';
import { resolveLiveSessionFile } from './liveSessionPersistence.js';

const CREATED_LIVE_SESSION_LOADER_PREWARM_DELAY_MS = 30_000;

export async function createLiveSession(input: {
  cwd: string;
  agentDir: string;
  settingsFile: string;
  persistentSessionDir: string;
  options?: LiveSessionLoaderOptions;
  wireSession: (id: string, session: AgentSession, cwd: string) => unknown;
}): Promise<{ id: string; sessionFile: string; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const options = input.options ?? {};
  const sessionManager = SessionManager.create(input.cwd, input.persistentSessionDir);
  const sessionManagerAtMs = performance.now();
  const { session, perf: preparedPerf } = await createPreparedLiveAgentSession({
    cwd: input.cwd,
    agentDir: options.agentDir ?? input.agentDir,
    sessionManager,
    settingsFile: input.settingsFile,
    options,
    applyInitialPreferences: true,
  });

  const id = session.sessionId;
  input.wireSession(id, session, input.cwd);
  const wiredAtMs = performance.now();
  const prewarmTimer = setTimeout(() => {
    queuePrewarmLiveSessionLoader(input.cwd, options);
  }, CREATED_LIVE_SESSION_LOADER_PREWARM_DELAY_MS);
  prewarmTimer.unref?.();
  const beforeResolveSessionFileAtMs = performance.now();
  const sessionFile = resolveLiveSessionFile(session) ?? '';
  const resolvedSessionFileAtMs = performance.now();
  return {
    id,
    sessionFile,
    perf: {
      sessionManagerMs: Math.round(sessionManagerAtMs - startedAtMs),
      preparedMs: Math.round(wiredAtMs - sessionManagerAtMs),
      wireMs: Math.round(wiredAtMs - sessionManagerAtMs - (preparedPerf?.totalMs ?? 0)),
      resolveSessionFileMs: Math.round(resolvedSessionFileAtMs - beforeResolveSessionFileAtMs),
      totalMs: Math.round(resolvedSessionFileAtMs - startedAtMs),
      ...(preparedPerf ? Object.fromEntries(Object.entries(preparedPerf).map(([key, value]) => [`prepared.${key}`, value])) : {}),
    },
  };
}

export async function createLiveSessionFromExisting(input: {
  sessionFile: string;
  cwd: string;
  agentDir: string;
  settingsFile: string;
  persistentSessionDir: string;
  options?: LiveSessionLoaderOptions;
  wireSession: (id: string, session: AgentSession, cwd: string) => unknown;
}): Promise<{ id: string; sessionFile: string; perf?: Record<string, number> }> {
  const options = input.options ?? {};
  const sessionManager = SessionManager.forkFrom(input.sessionFile, input.cwd, input.persistentSessionDir);
  const { session } = await createPreparedLiveAgentSession({
    cwd: input.cwd,
    agentDir: options.agentDir ?? input.agentDir,
    sessionManager,
    settingsFile: input.settingsFile,
    options,
  });

  const id = session.sessionId;
  input.wireSession(id, session, input.cwd);
  queuePrewarmLiveSessionLoader(input.cwd, options);
  return { id, sessionFile: resolveLiveSessionFile(session) ?? '' };
}

export async function resumeLiveSession(input: {
  sessionFile: string;
  agentDir: string;
  settingsFile: string;
  options?: LiveSessionLoaderOptions & { cwdOverride?: string };
  findLiveSessionByFile: (sessionFile: string) => { id: string } | null;
  wireSession: (id: string, session: AgentSession, cwd: string) => unknown;
}): Promise<{ id: string; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const live = input.findLiveSessionByFile(input.sessionFile);
  const liveCheckedAtMs = performance.now();
  if (live) {
    return {
      ...live,
      perf: {
        liveCheckMs: Math.round(liveCheckedAtMs - startedAtMs),
        alreadyLive: 1,
        totalMs: Math.round(liveCheckedAtMs - startedAtMs),
      },
    };
  }

  const { cwdOverride, ...loaderOptions } = input.options ?? {};
  const normalizedCwdOverride = typeof cwdOverride === 'string' && cwdOverride.trim().length > 0 ? cwdOverride.trim() : undefined;

  const metadataCwd = readConversationSessionMetaByFile(input.sessionFile)?.cwd;
  const metadataAtMs = performance.now();
  const effectiveCwdOverride = normalizedCwdOverride ?? metadataCwd;
  const sessionManager = SessionManager.open(input.sessionFile, undefined, effectiveCwdOverride);
  const sessionManagerAtMs = performance.now();
  const cwd = effectiveCwdOverride ?? sessionManager.getCwd();
  const cwdAtMs = performance.now();
  const { session, perf: preparedPerf } = await createPreparedLiveAgentSession({
    cwd,
    agentDir: loaderOptions.agentDir ?? input.agentDir,
    sessionManager,
    settingsFile: input.settingsFile,
    options: loaderOptions,
    ensureSessionFile: false,
  });
  const preparedAtMs = performance.now();

  const id = session.sessionId;
  input.wireSession(id, session, cwd);
  const wiredAtMs = performance.now();
  queuePrewarmLiveSessionLoader(cwd, loaderOptions);
  const prewarmQueuedAtMs = performance.now();
  return {
    id,
    perf: {
      liveCheckMs: Math.round(liveCheckedAtMs - startedAtMs),
      metadataMs: Math.round(metadataAtMs - liveCheckedAtMs),
      sessionManagerOpenMs: Math.round(sessionManagerAtMs - metadataAtMs),
      cwdMs: Math.round(cwdAtMs - sessionManagerAtMs),
      preparedMs: Math.round(preparedAtMs - cwdAtMs),
      wireMs: Math.round(wiredAtMs - preparedAtMs),
      queuePrewarmMs: Math.round(prewarmQueuedAtMs - wiredAtMs),
      totalMs: Math.round(prewarmQueuedAtMs - startedAtMs),
      ...(preparedPerf ? Object.fromEntries(Object.entries(preparedPerf).map(([key, value]) => [`prepared.${key}`, value])) : {}),
    },
  };
}

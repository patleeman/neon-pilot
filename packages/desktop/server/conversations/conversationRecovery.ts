import { existsSync } from 'node:fs';

import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { parsePendingOperation } from '@neon-pilot/daemon';

import { getDurableRun } from '../automation/durableRuns.js';
import { logError } from '../middleware/index.js';
import { LIVE_SESSION_RESOURCE_OPTIONS_PERF } from '../routes/context.js';
import {
  createWebLiveConversationRunId,
  syncWebLiveConversationRun,
  type WebLiveConversationPendingOperation,
} from './conversationRuns.js';
import { readConversationSessionMeta, resolveConversationSessionFile } from './conversationService.js';
import {
  isLive as isLiveSession,
  promptSession,
  queuePromptContext,
  registry as liveRegistry,
  repairLiveSessionTranscriptTail,
  resumeSession,
} from './liveSessions.js';
interface RecoveryLoaderOptions {
  extensionFactories?: ExtensionFactory[];
  additionalExtensionPaths?: string[];
  additionalSkillPaths?: string[];
  additionalPromptTemplatePaths?: string[];
  additionalThemePaths?: string[];
}

export interface RecoverConversationCapabilityContext {
  getRuntimeScope: () => string;
  buildLiveSessionResourceOptions: (profile?: string) => Omit<RecoveryLoaderOptions, 'extensionFactories'>;
  buildLiveSessionResourceOptionsAsync?: (profile?: string) => Promise<Omit<RecoveryLoaderOptions, 'extensionFactories'>>;
  buildLiveSessionExtensionFactories: () => ExtensionFactory[];
  flushLiveDeferredResumes: () => Promise<void>;
}

export interface RecoverConversationResult {
  conversationId: string;
  live: true;
  recovered: true;
  replayedPendingOperation: boolean;
  usedFallbackPrompt: boolean;
  perf?: Record<string, number>;
}

async function buildRecoveryLoaderOptions(
  context: RecoverConversationCapabilityContext,
  profile: string,
): Promise<{
  options: RecoveryLoaderOptions;
  perf: Record<string, number>;
}> {
  const startedAtMs = performance.now();
  const resourceOptionsPromise = context.buildLiveSessionResourceOptionsAsync
    ? context.buildLiveSessionResourceOptionsAsync(profile)
    : Promise.resolve(context.buildLiveSessionResourceOptions(profile));
  const resourceOptionsDispatchedAtMs = performance.now();
  const extensionFactories = context.buildLiveSessionExtensionFactories();
  const extensionFactoriesAtMs = performance.now();
  const resourceOptions = await resourceOptionsPromise;
  const resourceOptionsAtMs = performance.now();
  const resourceOptionsPerf =
    resourceOptions && typeof resourceOptions === 'object'
      ? ((resourceOptions as Record<symbol, unknown>)[LIVE_SESSION_RESOURCE_OPTIONS_PERF] as Record<string, number> | undefined)
      : undefined;
  return {
    options: {
      ...resourceOptions,
      extensionFactories,
    },
    perf: {
      recoveryResourceOptionsMs: Math.round(resourceOptionsAtMs - startedAtMs),
      recoveryResourceOptionsDispatchMs: Math.round(resourceOptionsDispatchedAtMs - startedAtMs),
      recoveryResourceOptionsWaitMs: Math.round(resourceOptionsAtMs - extensionFactoriesAtMs),
      recoveryExtensionFactoriesMs: Math.round(extensionFactoriesAtMs - resourceOptionsDispatchedAtMs),
      ...(resourceOptionsPerf
        ? Object.fromEntries(Object.entries(resourceOptionsPerf).map(([key, value]) => [`recoveryResourceOptions.${key}`, value]))
        : {}),
    },
  };
}

function readCheckpointString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function continueRecoveredConversation(input: {
  conversationId: string;
  sessionFile?: string;
  cwd: string;
  title?: string;
  profile: string;
  recoveryOperation: WebLiveConversationPendingOperation | null;
}): Promise<Pick<RecoverConversationResult, 'replayedPendingOperation' | 'usedFallbackPrompt'>> {
  repairLiveSessionTranscriptTail(input.conversationId);
  const promptOperation = input.recoveryOperation;

  const sessionFile = input.sessionFile?.trim();
  if (sessionFile) {
    const syncRun = syncWebLiveConversationRun({
      conversationId: input.conversationId,
      sessionFile,
      cwd: input.cwd,
      title: input.title,
      profile: input.profile,
      state: promptOperation ? 'running' : 'waiting',
      pendingOperation: promptOperation,
    });
    if (promptOperation) {
      await syncRun;
    } else {
      void syncRun.catch((error) => {
        logError('conversation recovery run sync failed', {
          sessionId: input.conversationId,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    }
  }

  if (promptOperation) {
    for (const message of promptOperation.contextMessages ?? []) {
      await queuePromptContext(input.conversationId, message.customType, message.content);
    }

    promptSession(input.conversationId, promptOperation.text, promptOperation.behavior, promptOperation.images).catch(async (error) => {
      if (sessionFile) {
        await syncWebLiveConversationRun({
          conversationId: input.conversationId,
          sessionFile,
          cwd: input.cwd,
          title: input.title,
          profile: input.profile,
          state: 'failed',
          lastError: error instanceof Error ? error.message : String(error),
        });
      }

      logError('conversation recovery error', {
        sessionId: input.conversationId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  }

  return {
    replayedPendingOperation: Boolean(input.recoveryOperation),
    usedFallbackPrompt: false,
  };
}

export async function recoverConversationCapability(
  conversationIdInput: string,
  context: RecoverConversationCapabilityContext,
  options: { replayPendingOperation?: boolean } = {},
): Promise<RecoverConversationResult> {
  const startedAtMs = performance.now();
  const conversationId = conversationIdInput.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }

  if (isLiveSession(conversationId)) {
    const liveReadyAtMs = performance.now();
    const liveEntry = liveRegistry.get(conversationId);
    const sessionMeta = readConversationSessionMeta(conversationId);
    const sessionMetaAtMs = performance.now();
    const continuation = await continueRecoveredConversation({
      conversationId,
      sessionFile: liveEntry?.session.sessionFile,
      cwd: liveEntry?.cwd ?? sessionMeta?.cwd ?? '',
      title: liveEntry?.title ?? sessionMeta?.title,
      profile: context.getRuntimeScope(),
      recoveryOperation: null,
    });
    const continuedAtMs = performance.now();

    return {
      conversationId,
      live: true,
      recovered: true,
      ...continuation,
      perf: {
        liveCheckMs: Math.round(liveReadyAtMs - startedAtMs),
        sessionMetaMs: Math.round(sessionMetaAtMs - liveReadyAtMs),
        continueMs: Math.round(continuedAtMs - sessionMetaAtMs),
        totalBeforeReturnMs: Math.round(continuedAtMs - startedAtMs),
      },
    };
  }

  const runDetail = await getDurableRun(createWebLiveConversationRunId(conversationId));
  const durableRunAtMs = performance.now();
  const payload = runDetail?.run.checkpoint?.payload;
  const checkpointPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

  const pendingOperation = options.replayPendingOperation ? parsePendingOperation(checkpointPayload.pendingOperation) : undefined;
  const sessionMeta = readConversationSessionMeta(conversationId);
  const sessionMetaAtMs = performance.now();
  const sessionFile =
    sessionMeta?.file ??
    resolveConversationSessionFile(conversationId) ??
    readCheckpointString(checkpointPayload, 'sessionFile') ??
    runDetail?.run.manifest?.source?.filePath?.trim();

  if (!sessionFile || !existsSync(sessionFile)) {
    throw new Error('Conversation not found.');
  }

  const runtimeScope = context.getRuntimeScope();
  const manifestSpec = runDetail?.run.manifest?.spec;
  const manifestCwd = typeof manifestSpec?.cwd === 'string' && manifestSpec.cwd.trim().length > 0 ? manifestSpec.cwd.trim() : undefined;
  const requestedCwd = sessionMeta?.cwd ?? readCheckpointString(checkpointPayload, 'cwd') ?? manifestCwd;
  const optionsStartedAtMs = performance.now();
  const { options: loaderOptions, perf: loaderOptionsPerf } = await buildRecoveryLoaderOptions(context, runtimeScope);
  const optionsReadyAtMs = performance.now();
  const resumed = await resumeSession(sessionFile, {
    ...loaderOptions,
    ...(requestedCwd ? { cwdOverride: requestedCwd } : {}),
  });
  const resumedAtMs = performance.now();
  void context.flushLiveDeferredResumes().catch((error) => {
    logError('conversation recovery deferred resume flush failed', {
      sessionId: resumed.id,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  const resumedEntry = liveRegistry.get(resumed.id);
  const effectiveCwd = resumedEntry?.cwd ?? requestedCwd;
  const effectiveTitle = sessionMeta?.title ?? readCheckpointString(checkpointPayload, 'title');
  const effectiveProfile = readCheckpointString(checkpointPayload, 'profile') ?? runtimeScope;

  if (!effectiveCwd) {
    throw new Error('Could not determine the conversation working directory.');
  }

  const continuation = await continueRecoveredConversation({
    conversationId: resumed.id,
    sessionFile,
    cwd: effectiveCwd,
    title: effectiveTitle,
    profile: effectiveProfile,
    recoveryOperation: pendingOperation ?? null,
  });
  const continuedAtMs = performance.now();

  return {
    conversationId: resumed.id,
    live: true,
    recovered: true,
    ...continuation,
    perf: {
      durableRunMs: Math.round(durableRunAtMs - startedAtMs),
      sessionMetaMs: Math.round(sessionMetaAtMs - durableRunAtMs),
      optionBuildMs: Math.round(optionsReadyAtMs - optionsStartedAtMs),
      ...loaderOptionsPerf,
      resumeMs: Math.round(resumedAtMs - optionsReadyAtMs),
      ...(resumed.perf ? Object.fromEntries(Object.entries(resumed.perf).map(([key, value]) => [`resume.${key}`, value])) : {}),
      continueMs: Math.round(continuedAtMs - resumedAtMs),
      totalBeforeReturnMs: Math.round(continuedAtMs - startedAtMs),
    },
  };
}

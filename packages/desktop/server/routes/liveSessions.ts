import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import type { Express, Request, Response } from 'express';

import { resolveConversationCwd } from '../conversations/conversationCwd.js';
import { parseTailBlocksQuery } from '../conversations/conversationService.js';
import {
  type LiveSessionCapabilityContext,
  LiveSessionCapabilityInputError,
  submitLiveSessionPromptCapability,
} from '../conversations/liveSessionCapability.js';
import {
  isLive as isLocalLive,
  LiveSessionControlError,
  prewarmLiveSessionLoader,
  subscribe as subscribeLocal,
} from '../conversations/liveSessions.js';
import { logError, logWarn } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('live session routes not initialized');
};

let getRepoRootFn: () => string = () => {
  throw new Error('live session routes not initialized');
};

let getDefaultWebCwdFn: () => string = () => {
  throw new Error('live session routes not initialized');
};

let buildLiveSessionResourceOptionsFn: (profile?: string) => Record<string, unknown> = () => ({
  additionalExtensionPaths: [],
  additionalSkillPaths: [],
  additionalPromptTemplatePaths: [],
  additionalThemePaths: [],
});

let buildLiveSessionExtensionFactoriesFn: () => ExtensionFactory[] = () => [];

let flushLiveDeferredResumesFn: () => Promise<void> = async () => {};

let listTasksForRuntimeScopeFn: () => {
  id: string;
  title?: string;
  filePath?: string;
  prompt: string;
  enabled: boolean;
  running: boolean;
  cron?: string;
  at?: string;
  model?: string;
  cwd?: string;
  lastStatus?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastAttemptCount?: number;
}[] = () => [];

let listMemoryDocsFn: () => {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  path: string;
  updated?: string;
}[] = () => [];

function initializeLiveSessionRoutesContext(
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'getRepoRoot'
    | 'getDefaultWebCwd'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'flushLiveDeferredResumes'
    | 'listTasksForRuntimeScope'
    | 'listMemoryDocs'
  >,
): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  getRepoRootFn = context.getRepoRoot;
  getDefaultWebCwdFn = context.getDefaultWebCwd;
  buildLiveSessionResourceOptionsFn = context.buildLiveSessionResourceOptions;
  buildLiveSessionExtensionFactoriesFn = context.buildLiveSessionExtensionFactories;
  flushLiveDeferredResumesFn = context.flushLiveDeferredResumes;
  listTasksForRuntimeScopeFn = context.listTasksForRuntimeScope;
  listMemoryDocsFn = context.listMemoryDocs;
  queueDefaultLiveSessionLoaderPrewarm();
}

function buildLiveSessionResourceOptions(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...buildLiveSessionResourceOptionsFn(getRuntimeScopeFn()),
    extensionFactories: buildLiveSessionExtensionFactoriesFn(),
    ...overrides,
  };
}

function queueDefaultLiveSessionLoaderPrewarm(): void {
  try {
    const profile = getRuntimeScopeFn();
    const cwd = resolveConversationCwd({
      repoRoot: getRepoRootFn(),
      profile,
      explicitCwd: undefined,
      defaultCwd: getDefaultWebCwdFn(),
    });

    void prewarmLiveSessionLoader(cwd, buildLiveSessionResourceOptions()).catch((error) => {
      logWarn('default live session loader prewarm failed', {
        cwd,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  } catch (error) {
    logWarn('default live session loader prewarm setup failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

function getLiveSessionCapabilityContext(): LiveSessionCapabilityContext {
  return {
    getRuntimeScope: getRuntimeScopeFn,
    getRepoRoot: getRepoRootFn,
    getDefaultWebCwd: getDefaultWebCwdFn,
    buildLiveSessionResourceOptions: buildLiveSessionResourceOptionsFn,
    buildLiveSessionExtensionFactories: buildLiveSessionExtensionFactoriesFn,
    flushLiveDeferredResumes: flushLiveDeferredResumesFn,
    listTasksForRuntimeScope: listTasksForRuntimeScopeFn,
    listMemoryDocs: listMemoryDocsFn,
  };
}

function readPromptImages(value: unknown): Array<{ data: string; mimeType: string; name?: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((image): image is { data?: unknown; mimeType?: unknown; name?: unknown } => !!image && typeof image === 'object')
    .map((image) => ({
      data: typeof image.data === 'string' ? image.data : '',
      mimeType: typeof image.mimeType === 'string' ? image.mimeType : '',
      ...(typeof image.name === 'string' ? { name: image.name } : {}),
    }));
}

export async function handleLiveSessionPrompt(req: Request, res: Response): Promise<void> {
  try {
    const result = await submitLiveSessionPromptCapability(
      {
        conversationId: req.params.id,
        text: typeof req.body?.text === 'string' ? req.body.text : '',
        behavior: req.body?.behavior,
        images: readPromptImages(req.body?.images),
        attachmentRefs: req.body?.attachmentRefs,
        contextMessages: req.body?.contextMessages,
        relatedConversationIds: req.body?.relatedConversationIds,
        surfaceId: readRequestSurfaceId(req.body),
      },
      getLiveSessionCapabilityContext(),
    );
    res.json(result);
  } catch (err) {
    logError('request handler error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (err instanceof LiveSessionCapabilityInputError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (writeLiveConversationControlError(res, err)) {
      return;
    }
    res.status(500).json({ error: String(err) });
  }
}

function isLiveSession(sessionId: string): boolean {
  return isLocalLive(sessionId);
}

function subscribeLiveSession(
  sessionId: string,
  listener: (event: unknown) => void,
  options?: {
    tailBlocks?: number;
    surface?: {
      surfaceId: string;
      surfaceType: 'desktop_web' | 'mobile_web';
    };
  },
): (() => void) | null {
  return subscribeLocal(sessionId, listener, options);
}

function readRequestSurfaceId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const value = (body as { surfaceId?: unknown }).surfaceId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function ensureRequestControlsLocalLiveConversation(_conversationId: string, body: unknown): string | undefined {
  return readRequestSurfaceId(body);
}

export function writeLiveConversationControlError(res: Response, error: unknown): boolean {
  if (error instanceof LiveSessionControlError) {
    res.status(409).json({ error: error.message });
    return true;
  }

  return false;
}

export function registerLiveSessionRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>,
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'getRepoRoot'
    | 'getDefaultWebCwd'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'flushLiveDeferredResumes'
    | 'listTasksForRuntimeScope'
    | 'listMemoryDocs'
  >,
): void {
  initializeLiveSessionRoutesContext(context);

  /** Create a new live session */

  /** Resume an existing session file into a live session */

  router.get('/api/live-sessions/:id/events', (req, res) => {
    const { id } = req.params;
    if (!isLiveSession(id)) {
      res.status(404).json({ error: 'Not a live session' });
      return;
    }

    const tailBlocks = parseTailBlocksQuery(req.query.tailBlocks);
    const rawSurfaceId = Array.isArray(req.query.surfaceId) ? req.query.surfaceId[0] : req.query.surfaceId;
    const surfaceId = typeof rawSurfaceId === 'string' ? rawSurfaceId.trim() : '';
    const rawSurfaceType = Array.isArray(req.query.surfaceType) ? req.query.surfaceType[0] : req.query.surfaceType;
    const surfaceType = rawSurfaceType === 'mobile_web' ? 'mobile_web' : 'desktop_web';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
    const unsubscribe = subscribeLiveSession(
      id,
      (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      {
        ...(tailBlocks ? { tailBlocks } : {}),
        ...(surfaceId ? { surface: { surfaceId, surfaceType } } : {}),
      },
    );

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe?.();
    });
  });

  /** Abort a running agent */

  /** Get workspace context for a conversation */

  /** Destroy / close a live session */
}

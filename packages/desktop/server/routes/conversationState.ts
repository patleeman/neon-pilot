import { existsSync } from 'node:fs';

import { type ExtensionFactory, SessionManager } from '@earendil-works/pi-coding-agent';
import type { DesktopRootLayout } from '@neon-pilot/core';
import type { Express } from 'express';

import { writeConversationActivityEntry } from '../conversations/conversationActivityProducers.js';
import { readConversationAutoModeStateFromSessionManager, writeConversationAutoModeState } from '../conversations/conversationAutoMode.js';
import { recoverConversationCapability } from '../conversations/conversationRecovery.js';
import {
  appendConversationOffshootMetadata,
  publishConversationSessionMetaChanged,
  readConversationSessionMeta,
  resolveConversationSessionFile,
} from '../conversations/conversationService.js';
import {
  createSessionFromExisting,
  isLive as isLocalLive,
  readLiveSessionAutoModeState,
  registry as liveRegistry,
  setLiveSessionAutoModeState,
} from '../conversations/liveSessions.js';
import { getDocumentsStore } from '../documents/store.js';
import { logError } from '../middleware/index.js';
import { publishAppEvent } from '../shared/appEvents.js';
import type { LiveSessionResourceOptions, ServerRouteContext } from './context.js';
import { ensureRequestControlsLocalLiveConversation } from './liveSessions.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for conversation state routes');
};

let buildLiveSessionResourceOptionsFn: (profile?: string) => LiveSessionResourceOptions = () => ({
  additionalExtensionPaths: [],
  additionalSkillPaths: [],
  additionalPromptTemplatePaths: [],
  additionalThemePaths: [],
});

let buildLiveSessionExtensionFactoriesFn: () => ExtensionFactory[] = () => [];

let flushLiveDeferredResumesFn: () => Promise<void> = async () => {};

let getStateRootFn: () => string = () => {
  throw new Error('getStateRoot not initialized for conversation state routes');
};

let getDesktopRootLayoutFn: () => DesktopRootLayout = () => {
  throw new Error('getDesktopRootLayout not initialized for conversation state routes');
};

function initializeConversationStateRoutesContext(
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'flushLiveDeferredResumes'
    | 'getStateRoot'
    | 'getDesktopRootLayout'
  >,
): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  buildLiveSessionResourceOptionsFn = context.buildLiveSessionResourceOptions;
  buildLiveSessionExtensionFactoriesFn = context.buildLiveSessionExtensionFactories;
  flushLiveDeferredResumesFn = context.flushLiveDeferredResumes;
  getStateRootFn = context.getStateRoot;
  getDesktopRootLayoutFn = context.getDesktopRootLayout;
}

function resolveConversationSource(conversationId: string) {
  const liveEntry = liveRegistry.get(conversationId);
  const meta = readConversationSessionMeta(conversationId);
  const cwd = liveEntry?.cwd ?? meta?.cwd;
  const sessionFile = liveEntry?.session.sessionFile ?? meta?.file;

  if (!cwd || !sessionFile) {
    return null;
  }

  return {
    cwd,
    sessionFile,
    meta,
    liveEntry,
  };
}

export function registerConversationStateRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch'>,
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'flushLiveDeferredResumes'
    | 'getStateRoot'
    | 'getDesktopRootLayout'
  >,
): void {
  initializeConversationStateRoutesContext(context);

  router.get('/api/conversations/:id/auto-mode', async (req, res) => {
    try {
      if (isLocalLive(req.params.id)) {
        res.json(readLiveSessionAutoModeState(req.params.id));
        return;
      }
      const sessionFile = resolveConversationSessionFile(req.params.id);
      if (!sessionFile || !existsSync(sessionFile)) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json(readConversationAutoModeStateFromSessionManager(SessionManager.open(sessionFile)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError('request handler error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: message });
    }
  });

  router.patch('/api/conversations/:id/auto-mode', async (req, res) => {
    try {
      const body = req.body as { enabled?: boolean; mode?: string; surfaceId?: string };
      if (typeof body.enabled !== 'boolean' && typeof body.mode !== 'string') {
        res.status(400).json({ error: 'mode or enabled required' });
        return;
      }
      const input = typeof body.mode === 'string' ? { mode: body.mode as never } : { enabled: body.enabled };
      if (isLocalLive(req.params.id)) {
        ensureRequestControlsLocalLiveConversation(req.params.id, { enabled: body.enabled, surfaceId: body.surfaceId });
        res.json(await setLiveSessionAutoModeState(req.params.id, input));
        return;
      }
      const recovered =
        body.enabled === true
          ? await recoverConversationCapability(req.params.id, {
              getRuntimeScope: getRuntimeScopeFn,
              buildLiveSessionResourceOptions: buildLiveSessionResourceOptionsFn,
              buildLiveSessionExtensionFactories: buildLiveSessionExtensionFactoriesFn,
              flushLiveDeferredResumes: flushLiveDeferredResumesFn,
            })
          : { live: false };
      if (recovered.live) {
        ensureRequestControlsLocalLiveConversation(req.params.id, { enabled: body.enabled, surfaceId: body.surfaceId });
        res.json(await setLiveSessionAutoModeState(req.params.id, input));
        return;
      }
      const sessionFile = resolveConversationSessionFile(req.params.id);
      if (!sessionFile || !existsSync(sessionFile)) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      const result = writeConversationAutoModeState(SessionManager.open(sessionFile), input);
      publishAppEvent({ type: 'session_file_changed', sessionId: req.params.id });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError('request handler error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: message });
    }
  });

  router.post('/api/conversations/:id/duplicate', async (req, res) => {
    try {
      const conversationId = req.params.id;
      const source = resolveConversationSource(conversationId);

      if (!source) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }

      const result = await createSessionFromExisting(source.sessionFile, source.cwd, {
        ...buildLiveSessionResourceOptionsFn(),
        extensionFactories: buildLiveSessionExtensionFactoriesFn(),
      });
      appendConversationOffshootMetadata({
        sessionFile: result.sessionFile,
        kind: 'duplicate',
        parentSessionFile: source.sessionFile,
        parentSessionId: conversationId,
      });

      try {
        const store = getDocumentsStore(getStateRootFn(), getDesktopRootLayoutFn());
        writeConversationActivityEntry(store, conversationId, 'duplicated', source.meta?.title || 'Unknown', {
          sourceConversationId: conversationId,
          newConversationId: result.id,
        });
      } catch {
        // Activity entry is best-effort; duplicate succeeds regardless.
      }

      publishConversationSessionMetaChanged(conversationId, result.id);
      res.json({ newSessionId: result.id, sessionFile: result.sessionFile });
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });
}

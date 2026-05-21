import type { Express } from 'express';

import {
  ConversationAssetCapabilityInputError,
  ConversationAssetCapabilityNotFoundError,
  createConversationCommitCheckpointCommentCapability,
  readConversationCheckpointReviewContextCapability,
} from '../conversations/conversationAssetsCapability.js';
import { readConversationContextDocs, writeConversationContextDocs } from '../conversations/conversationContextDocs.js';
import {
  ConversationInspectCapabilityInputError,
  searchConversationInspectSessions,
} from '../conversations/conversationInspectCapability.js';
import {
  parseTailBlocksQuery,
  publishConversationSessionMetaChanged,
  readConversationSessionSignature,
  readSessionDetailForRoute,
  setConversationServiceContext,
} from '../conversations/conversationService.js';
import {
  readConversationSessionMetaCapability,
  readConversationSessionsCapability,
  readConversationSessionSearchIndexCapability,
} from '../conversations/conversationSessionCapability.js';
import { readConversationSummaryIndexCapability, startConversationSummaryBackfillLoop } from '../conversations/conversationSummaries.js';
import { buildAppendOnlySessionDetailResponse, readSessionBlock, readSessionImageAsset } from '../conversations/sessions.js';
import { logError, logSlowConversationPerf, setServerTimingHeaders } from '../middleware/index.js';
import { buildContentDispositionHeader } from '../shared/httpHeaders.js';
import type { ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for conversation routes');
};

function initializeConversationRoutesContext(
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'getSavedUiPreferences'>,
): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  setConversationServiceContext({
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getSavedUiPreferences: context.getSavedUiPreferences,
  });
}

function parseNonNegativeIntegerQuery(rawValue: unknown): number | undefined {
  const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const parsed =
    typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && /^\d+$/.test(candidate.trim())
        ? Number.parseInt(candidate.trim(), 10)
        : undefined;

  return Number.isSafeInteger(parsed) && (parsed as number) >= 0 ? (parsed as number) : undefined;
}

function parseNonNegativeIntegerPath(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseTrimmedQueryString(rawValue: unknown): string | undefined {
  const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (typeof candidate !== 'string') {
    return undefined;
  }

  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function writeConversationAssetCapabilityError(
  res: { status(code: number): { json(value: unknown): void } },
  err: unknown,
  options?: { notFoundMessage?: string },
): boolean {
  if (err instanceof ConversationAssetCapabilityInputError) {
    res.status(400).json({ error: err.message });
    return true;
  }

  if (err instanceof ConversationAssetCapabilityNotFoundError) {
    res.status(404).json({ error: options?.notFoundMessage ?? err.message });
    return true;
  }

  return false;
}

function registerConversationReadRoutes(router: Pick<Express, 'get'>): void {
  router.get('/api/sessions/:id/meta', (req, res) => {
    try {
      const session = readConversationSessionMetaCapability(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(session);
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/sessions/:id', async (req, res) => {
    const startedAt = process.hrtime.bigint();

    try {
      const tailBlocks = parseTailBlocksQuery(req.query.tailBlocks);
      const rawKnownSessionSignature = Array.isArray(req.query.knownSessionSignature)
        ? req.query.knownSessionSignature[0]
        : req.query.knownSessionSignature;
      const knownSessionSignature =
        typeof rawKnownSessionSignature === 'string' && rawKnownSessionSignature.trim().length > 0
          ? rawKnownSessionSignature.trim()
          : undefined;
      const knownBlockOffset = parseNonNegativeIntegerQuery(req.query.knownBlockOffset);
      const knownTotalBlocks = parseNonNegativeIntegerQuery(req.query.knownTotalBlocks);
      const knownLastBlockId = parseTrimmedQueryString(req.query.knownLastBlockId);
      const currentSessionSignature = readConversationSessionSignature(req.params.id);
      if (knownSessionSignature && currentSessionSignature && knownSessionSignature === currentSessionSignature) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        setServerTimingHeaders(
          res,
          [
            { name: 'remote_sync', durationMs: 0, description: 'deferred' },
            { name: 'session_read', durationMs: 0, description: 'reuse/signature' },
            { name: 'total', durationMs },
          ],
          {
            route: 'session-detail',
            conversationId: req.params.id,
            ...(tailBlocks ? { tailBlocks } : {}),
            remoteMirror: { status: 'deferred', durationMs: 0 },
            sessionRead: null,
            durationMs,
          },
        );

        res.json({
          unchanged: true,
          sessionId: req.params.id,
          signature: currentSessionSignature,
        });
        return;
      }

      const { sessionRead, remoteMirror } = await readSessionDetailForRoute({
        conversationId: req.params.id,
        profile: getRuntimeScopeFn(),
        tailBlocks,
      });
      if (!sessionRead.detail) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const appendOnly =
        knownSessionSignature && sessionRead.detail.signature && knownSessionSignature !== sessionRead.detail.signature
          ? buildAppendOnlySessionDetailResponse({
              detail: sessionRead.detail,
              knownBlockOffset,
              knownTotalBlocks,
              knownLastBlockId,
            })
          : null;
      if (appendOnly) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        setServerTimingHeaders(
          res,
          [
            { name: 'remote_sync', durationMs: remoteMirror.durationMs, description: remoteMirror.status },
            {
              name: 'session_read',
              durationMs: sessionRead.telemetry?.durationMs ?? 0,
              description: sessionRead.telemetry ? `${sessionRead.telemetry.cache}/${sessionRead.telemetry.loader}` : 'unknown',
            },
            { name: 'total', durationMs },
          ],
          {
            route: 'session-detail',
            conversationId: req.params.id,
            ...(tailBlocks ? { tailBlocks } : {}),
            remoteMirror,
            sessionRead: sessionRead.telemetry,
            result: 'append-only',
            durationMs,
          },
        );

        res.json(appendOnly);
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      setServerTimingHeaders(
        res,
        [
          { name: 'remote_sync', durationMs: remoteMirror.durationMs, description: remoteMirror.status },
          {
            name: 'session_read',
            durationMs: sessionRead.telemetry?.durationMs ?? 0,
            description: sessionRead.telemetry ? `${sessionRead.telemetry.cache}/${sessionRead.telemetry.loader}` : 'unknown',
          },
          { name: 'total', durationMs },
        ],
        {
          route: 'session-detail',
          conversationId: req.params.id,
          ...(tailBlocks ? { tailBlocks } : {}),
          remoteMirror,
          sessionRead: sessionRead.telemetry,
          durationMs,
        },
      );
      logSlowConversationPerf('session detail request', {
        conversationId: req.params.id,
        durationMs,
        ...(tailBlocks ? { tailBlocks } : {}),
        remoteMirrorStatus: remoteMirror.status,
        sessionReadCache: sessionRead.telemetry?.cache,
        sessionReadLoader: sessionRead.telemetry?.loader,
        sessionReadDurationMs: sessionRead.telemetry?.durationMs,
      });

      res.json(sessionRead.detail);
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/sessions/:id/blocks/:blockId/image', (req, res) => {
    try {
      const asset = readSessionImageAsset(req.params.id, req.params.blockId);
      if (!asset) {
        res.status(404).json({ error: 'Session image not found' });
        return;
      }
      if (asset.fileName) {
        res.setHeader('Content-Disposition', buildContentDispositionHeader('inline', asset.fileName));
      }
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.type(asset.mimeType);
      res.send(asset.data);
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/sessions/:id/blocks/:blockId/images/:imageIndex', (req, res) => {
    try {
      const imageIndex = parseNonNegativeIntegerPath(req.params.imageIndex);
      if (imageIndex === null) {
        res.status(400).json({ error: 'imageIndex must be a non-negative integer' });
        return;
      }
      const asset = readSessionImageAsset(req.params.id, req.params.blockId, imageIndex);
      if (!asset) {
        res.status(404).json({ error: 'Session image not found' });
        return;
      }
      if (asset.fileName) {
        res.setHeader('Content-Disposition', buildContentDispositionHeader('inline', asset.fileName));
      }
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.type(asset.mimeType);
      res.send(asset.data);
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/sessions/:id/blocks/:blockId', (req, res) => {
    try {
      const result = readSessionBlock(req.params.id, req.params.blockId);
      if (!result) {
        res.status(404).json({ error: 'Session block not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });
}

export function registerConversationRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'getSavedUiPreferences'>,
): void {
  initializeConversationRoutesContext(context);
  startConversationSummaryBackfillLoop({
    listSessions: readConversationSessionsCapability,
  });
  router.get('/api/sessions', (_req, res) => {
    try {
      res.json(readConversationSessionsCapability());
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  registerConversationReadRoutes(router);

  router.post('/api/sessions/search-index', (req, res) => {
    try {
      res.json(readConversationSessionSearchIndexCapability(req.body as { sessionIds?: unknown }));
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/sessions/search', (req, res) => {
    try {
      const body = req.body as { query?: unknown; limit?: unknown };
      res.json(
        searchConversationInspectSessions({
          query: body.query,
          limit: body.limit,
          scope: 'all',
          searchMode: 'allTerms',
          maxSnippetCharacters: 220,
          stopAfterLimit: true,
        }),
      );
    } catch (err) {
      if (err instanceof ConversationInspectCapabilityInputError) {
        res.status(400).json({ error: err.message });
        return;
      }

      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/conversation-summaries', (req, res) => {
    try {
      res.json(readConversationSummaryIndexCapability(req.body as { sessionIds?: unknown }));
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/conversations/:id/checkpoints/:checkpointId/review-context', async (req, res) => {
    try {
      res.json(
        await readConversationCheckpointReviewContextCapability(getRuntimeScopeFn(), {
          conversationId: req.params.id,
          checkpointId: req.params.checkpointId,
        }),
      );
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (writeConversationAssetCapabilityError(res, err)) {
        return;
      }
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/conversations/:id/checkpoints/:checkpointId/comments', (req, res) => {
    try {
      res.json(
        createConversationCommitCheckpointCommentCapability(getRuntimeScopeFn(), {
          conversationId: req.params.id,
          checkpointId: req.params.checkpointId,
          body: req.body?.body,
          filePath: req.body?.filePath,
        }),
      );
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (writeConversationAssetCapabilityError(res, err)) {
        return;
      }
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/api/conversations/:id/context-docs', (req, res) => {
    try {
      res.json({
        conversationId: req.params.id,
        attachedContextDocs: readConversationContextDocs(req.params.id),
      });
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.patch('/api/conversations/:id/context-docs', (req, res) => {
    try {
      const body = req.body as { docs?: unknown };
      const attachedContextDocs = writeConversationContextDocs({
        conversationId: req.params.id,
        attachedContextDocs: body.docs,
      });
      publishConversationSessionMetaChanged(req.params.id);
      res.json({
        conversationId: req.params.id,
        attachedContextDocs,
      });
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}

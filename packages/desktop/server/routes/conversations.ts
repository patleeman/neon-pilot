import type { Express } from 'express';

import {
  ConversationAssetCapabilityInputError,
  ConversationAssetCapabilityNotFoundError,
  createConversationCommitCheckpointCommentCapability,
  readConversationCheckpointReviewContextCapability,
} from '../conversations/conversationAssetsCapability.js';
import { startConversationCatalogBackfill } from '../conversations/conversationCatalog.js';
import { readConversationContextDocs, writeConversationContextDocs } from '../conversations/conversationContextDocs.js';
import { ConversationInspectCapabilityInputError } from '../conversations/conversationInspectCapability.js';
import { searchIndexedConversationContent } from '../conversations/conversationSearchIndex.js';
import {
  publishConversationSessionMetaChanged,
  setConversationServiceContext,
  startConversationReadModelBackfill,
} from '../conversations/conversationService.js';
import { readConversationSessionImageAssetCapability } from '../conversations/conversationSessionAssetCapability.js';
import { readConversationSessionsCapability } from '../conversations/conversationSessionCapability.js';
import { readConversationSummaryIndexCapability, startConversationSummaryBackfillLoop } from '../conversations/conversationSummaries.js';
import { logError } from '../middleware/index.js';
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

function parseNonNegativeIntegerPath(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeSearchTerms(query: unknown): string[] {
  return typeof query === 'string'
    ? query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 0)
    : [];
}

function searchConversationContentFast(input: { query: unknown; limit: unknown }) {
  const terms = normalizeSearchTerms(input.query);
  if (terms.length === 0) {
    throw new ConversationInspectCapabilityInputError('query is required.');
  }
  const limit = Math.min(100, Math.max(1, typeof input.limit === 'number' && Number.isFinite(input.limit) ? Math.floor(input.limit) : 80));
  const matches = searchIndexedConversationContent({ terms, limit });

  return {
    query: terms.join(' '),
    mode: 'allTerms' as const,
    scope: 'all' as const,
    totalMatching: matches.length,
    returnedCount: matches.length,
    matches,
  };
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
  router.get('/api/sessions/:id/blocks/:blockId/image', (req, res) => {
    try {
      const asset = readConversationSessionImageAssetCapability(req.params.id, req.params.blockId);
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
      const asset = readConversationSessionImageAssetCapability(req.params.id, req.params.blockId, imageIndex);
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
}

export function registerConversationRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'getRepoRoot' | 'getSavedUiPreferences'>,
): void {
  initializeConversationRoutesContext(context);
  startConversationCatalogBackfill({
    listSessions: readConversationSessionsCapability,
  });
  startConversationReadModelBackfill();
  startConversationSummaryBackfillLoop({
    listSessions: readConversationSessionsCapability,
  });

  registerConversationReadRoutes(router);

  router.post('/api/sessions/search', (req, res) => {
    try {
      const body = req.body as { query?: unknown; limit?: unknown };
      res.json(searchConversationContentFast({ query: body.query, limit: body.limit }));
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

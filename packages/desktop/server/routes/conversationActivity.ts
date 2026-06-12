import type { Express, Response } from 'express';

import { listConversationActivity } from '../conversations/conversationActivity.js';
import {
  listConversationConnections,
  type ConversationConnectionKind,
  type ConversationConnectionSurface,
} from '../conversations/conversationConnections.js';
import { logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function parseVisibilityQuery(value: unknown): 'primary' | 'system' | 'hidden' | 'visible' | 'all' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === 'primary' || normalized === 'system' || normalized === 'hidden' || normalized === 'visible' || normalized === 'all'
    ? normalized
    : undefined;
}

function parseKindQuery(value: unknown): ConversationConnectionKind | 'all' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === 'activity' ||
    normalized === 'state' ||
    normalized === 'asset' ||
    normalized === 'context' ||
    normalized === 'integration' ||
    normalized === 'surface' ||
    normalized === 'all'
    ? normalized
    : undefined;
}

function parseSurfaceQuery(value: unknown): ConversationConnectionSurface | 'all' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === 'activityShelf' ||
    normalized === 'composerShelf' ||
    normalized === 'rightRail' ||
    normalized === 'workbench' ||
    normalized === 'sidebar' ||
    normalized === 'cli' ||
    normalized === 'all'
    ? normalized
    : undefined;
}

function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  logError('request handler error', {
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: message });
}

export function registerConversationActivityRoutes(
  router: Pick<Express, 'get'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'listTasksForRuntimeScope'>,
): void {
  router.get('/api/conversations/:id/activity', async (req, res) => {
    try {
      res.json(
        await listConversationActivity(req.params.id, {
          active: parseBooleanQuery(req.query.active),
          visibility: parseVisibilityQuery(req.query.visibility),
          tasks: context.listTasksForRuntimeScope(),
          profile: context.getRuntimeScope(),
        }),
      );
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/api/conversations/:id/connections', async (req, res) => {
    try {
      res.json(
        await listConversationConnections(req.params.id, {
          active: parseBooleanQuery(req.query.active),
          kind: parseKindQuery(req.query.kind),
          surface: parseSurfaceQuery(req.query.surface),
          visibility: parseVisibilityQuery(req.query.visibility),
          tasks: context.listTasksForRuntimeScope(),
          profile: context.getRuntimeScope(),
        }),
      );
    } catch (err) {
      handleError(res, err);
    }
  });
}

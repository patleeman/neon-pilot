import type { Express, Response } from 'express';

import {
  type ConversationConnectionKind,
  type ConversationConnectionSurface,
  listConversationConnections,
} from '../conversations/conversationConnections.js';
import { logError } from '../middleware/index.js';
import type { RuntimeScopeTaskSummary, ServerRouteContext } from './context.js';

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

function readRuntimeScope(context: Pick<ServerRouteContext, 'getRuntimeScope'>): string | undefined {
  try {
    return context.getRuntimeScope();
  } catch (err) {
    logError('conversation activity runtime scope unavailable', {
      message: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

function readRuntimeTasks(context: Pick<ServerRouteContext, 'listTasksForRuntimeScope'>): RuntimeScopeTaskSummary[] {
  try {
    return context.listTasksForRuntimeScope();
  } catch (err) {
    logError('conversation activity scheduled tasks unavailable', {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export function registerConversationActivityRoutes(
  router: Pick<Express, 'get'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'listTasksForRuntimeScope'>,
): void {
  router.get('/api/conversations/:id/connections', async (req, res) => {
    try {
      res.json(
        await listConversationConnections(req.params.id, {
          active: parseBooleanQuery(req.query.active),
          kind: parseKindQuery(req.query.kind),
          surface: parseSurfaceQuery(req.query.surface),
          visibility: parseVisibilityQuery(req.query.visibility),
          tasks: readRuntimeTasks(context),
          profile: readRuntimeScope(context),
        }),
      );
    } catch (err) {
      handleError(res, err);
    }
  });
}

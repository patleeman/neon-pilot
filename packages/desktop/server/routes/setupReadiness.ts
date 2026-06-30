import type { Express, Response } from 'express';

import { logError } from '../middleware/index.js';
import { dismissSetupReadinessItem, readSetupReadiness, runSetupReadinessAction } from '../setupReadiness.js';
import type { ServerRouteContext } from './context.js';

function sendSetupReadinessError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const status = /not declared|not found|disabled/i.test(message) ? 404 : 500;
  logError('setup readiness route error', { message, stack: error instanceof Error ? error.stack : undefined });
  res.status(status).json({ error: message });
}

export function registerSetupReadinessRoutes(app: Express, context: ServerRouteContext): void {
  app.get('/api/setup/readiness', async (_req, res) => {
    try {
      res.json(await readSetupReadiness(context));
    } catch (error) {
      sendSetupReadinessError(res, error);
    }
  });

  app.post('/api/setup/readiness/items/:extensionId/:itemId/actions/:actionId', async (req, res) => {
    try {
      res.json(
        await runSetupReadinessAction(context, {
          extensionId: req.params.extensionId,
          itemId: req.params.itemId,
          actionId: req.params.actionId,
        }),
      );
    } catch (error) {
      sendSetupReadinessError(res, error);
    }
  });

  app.post('/api/setup/readiness/items/:extensionId/:itemId/dismiss', async (req, res) => {
    try {
      res.json(
        await dismissSetupReadinessItem(context, {
          extensionId: req.params.extensionId,
          itemId: req.params.itemId,
          dismissed: true,
        }),
      );
    } catch (error) {
      sendSetupReadinessError(res, error);
    }
  });

  app.post('/api/setup/readiness/items/:extensionId/:itemId/restore', async (req, res) => {
    try {
      res.json(
        await dismissSetupReadinessItem(context, {
          extensionId: req.params.extensionId,
          itemId: req.params.itemId,
          dismissed: false,
        }),
      );
    } catch (error) {
      sendSetupReadinessError(res, error);
    }
  });
}

import type { Express } from 'express';

import { logError } from '../middleware/index.js';
import { deleteSecret, listSecretStatuses, readSecretBackendId, setSecret } from '../secrets/secretStore.js';
import type { ServerRouteContext } from './context.js';

type SecretRouteContext = Pick<ServerRouteContext, 'getStateRoot'> & Partial<Pick<ServerRouteContext, 'getDesktopRootLayout'>>;
type SecretRouteRoot = string | ReturnType<ServerRouteContext['getDesktopRootLayout']>;

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required`);
  return value.trim();
}

function resolveSecretRoot(context: SecretRouteContext): SecretRouteRoot {
  return context.getDesktopRootLayout?.() ?? context.getStateRoot();
}

export function registerSecretRoutes(router: Pick<Express, 'get' | 'put' | 'delete'>, context: SecretRouteContext): void {
  router.get('/api/secrets', (_req, res) => {
    try {
      const root = resolveSecretRoot(context);
      res.json({ backend: readSecretBackendId(root), secrets: listSecretStatuses(root) });
    } catch (err) {
      logError('secrets read error', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: String(err) });
    }
  });

  router.put('/api/secrets/:extensionId/:secretId', (req, res) => {
    try {
      const params = req.params as { extensionId?: unknown; secretId?: unknown };
      const body = req.body as { value?: unknown } | undefined;
      const extensionId = readRequiredString(params.extensionId, 'extensionId');
      const secretId = readRequiredString(params.secretId, 'secretId');
      const value = readRequiredString(body?.value, 'value');
      const root = resolveSecretRoot(context);
      res.json({ backend: readSecretBackendId(root), secrets: setSecret(extensionId, secretId, value, root) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError('secret write error', { message });
      res.status(500).json({ error: message });
    }
  });

  router.delete('/api/secrets/:extensionId/:secretId', (req, res) => {
    try {
      const params = req.params as { extensionId?: unknown; secretId?: unknown };
      const extensionId = readRequiredString(params.extensionId, 'extensionId');
      const secretId = readRequiredString(params.secretId, 'secretId');
      const root = resolveSecretRoot(context);
      res.json({ backend: readSecretBackendId(root), secrets: deleteSecret(extensionId, secretId, root) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError('secret delete error', { message });
      res.status(500).json({ error: message });
    }
  });
}

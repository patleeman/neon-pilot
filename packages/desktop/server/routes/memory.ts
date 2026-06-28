import type { Express } from 'express';

import {
  createMemoryScope,
  getMemoryState,
  importKnowledgeMemoryDocs,
  initializeMemory,
  listMemoryFileHistory,
  memoryScopeSlugForPath,
  setMemoryRemote,
  syncMemoryRemote,
  writeMemoryFile,
} from '../memory/memoryStore.js';
import type { ServerRouteContext } from './context.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

export function registerMemoryRoutes(router: Pick<Express, 'get' | 'post' | 'put'>, context: ServerRouteContext): void {
  router.get('/api/memory', async (req, res) => {
    try {
      const cwd = optionalString(req.query.cwd) ?? context.getDefaultWebCwd();
      res.json(await getMemoryState({ cwd }));
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/init', async (req, res) => {
    try {
      const cwd = optionalString((req.body as { cwd?: unknown } | undefined)?.cwd) ?? context.getDefaultWebCwd();
      res.json(await initializeMemory({ cwd }));
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/remote', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const url = optionalString(body.url);
      if (!url) {
        res.status(400).json({ error: 'Remote URL is required.' });
        return;
      }
      await setMemoryRemote(url);
      res.json(await getMemoryState({ cwd: context.getDefaultWebCwd() }));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/sync', async (_req, res) => {
    try {
      await syncMemoryRemote();
      res.json(await getMemoryState({ cwd: context.getDefaultWebCwd() }));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/import/knowledge', async (_req, res) => {
    try {
      const result = await importKnowledgeMemoryDocs();
      res.json({ importedCount: result.importedCount, state: await getMemoryState({ cwd: context.getDefaultWebCwd() }) });
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/scopes', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = optionalString(body.name);
      if (!name) {
        res.status(400).json({ error: 'Scope name is required.' });
        return;
      }
      await createMemoryScope({
        name,
        slug: optionalString(body.slug),
        roots: stringArray(body.roots),
        aliases: stringArray(body.aliases),
        type: optionalString(body.type),
        inject: typeof body.inject === 'boolean' ? body.inject : undefined,
        reason: optionalString(body.reason),
      });
      res.json(await getMemoryState({ cwd: context.getDefaultWebCwd() }));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.post('/api/memory/scopes/from-cwd', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cwd = optionalString(body.cwd) ?? context.getDefaultWebCwd();
      const name = optionalString(body.name) ?? memoryScopeSlugForPath(cwd);
      await createMemoryScope({
        name,
        slug: optionalString(body.slug),
        roots: [cwd],
        aliases: stringArray(body.aliases),
        type: 'workspace',
        inject: true,
        reason: optionalString(body.reason) ?? `Add ${name} memory scope`,
      });
      res.json(await getMemoryState({ cwd }));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.put('/api/memory/file', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const relativePath = optionalString(body.relativePath);
      const content = typeof body.content === 'string' ? body.content : undefined;
      if (!relativePath || content === undefined) {
        res.status(400).json({ error: 'relativePath and content are required.' });
        return;
      }
      await writeMemoryFile({ relativePath, content, reason: optionalString(body.reason) });
      res.json(await getMemoryState({ cwd: context.getDefaultWebCwd() }));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.get('/api/memory/file/history', async (req, res) => {
    try {
      const relativePath = optionalString(req.query.relativePath);
      if (!relativePath) {
        res.status(400).json({ error: 'relativePath is required.' });
        return;
      }
      res.json({ history: await listMemoryFileHistory(relativePath) });
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });
}

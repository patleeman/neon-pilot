import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('./bootstrap.js', async () => {
  const actual = await vi.importActual<typeof import('./bootstrap.js')>('./bootstrap.js');
  return {
    ...actual,
    startDeferredResumeLoop: vi.fn(),
    startAttentionDispatchLoop: vi.fn(),
  };
});

vi.mock('@neon-pilot/core', async () => {
  const actual = await vi.importActual<typeof import('@neon-pilot/core')>('@neon-pilot/core');
  return {
    ...actual,
    startKnowledgeBaseSyncLoop: vi.fn(),
    subscribeKnowledgeBaseState: vi.fn(() => vi.fn()),
  };
});

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    listServices: async () => [],
    listPromptAssemblyContributions: async () => ({ assemblyProviders: [], contextProviders: [], hooks: [] }),
    listStaticContributions: async () => ({ skills: [], tools: [], modelDiscovery: [] }),
    listEventSubscriptions: async () => [],
    beginStartupGuard: async () => ({ safeMode: false, disabledIds: [] }),
    completeStartupGuard: async () => undefined,
    startStartupActions: async () => [],
    resolveFilePath: async ({ extensionId, relativePath }: { extensionId: string; relativePath: string }) => {
      const registry = await import('../extensions/extensionRegistry.js');
      const entry = registry.findExtensionEntry(extensionId);
      if (!entry?.packageRoot) throw new Error('Extension files are unavailable for this extension.');
      const packageRoot = resolve(entry.packageRoot);
      const filePath = resolve(packageRoot, relativePath);
      if (filePath !== packageRoot && !filePath.startsWith(`${packageRoot}${sep}`)) {
        throw new Error('Extension file path escapes package root.');
      }
      return filePath;
    },
    readRegistryPresentation: async () => {
      const registry = await import('../extensions/extensionRegistry.js');
      return {
        schema: registry.readExtensionSchema(),
        installSummaries: registry.listExtensionInstallSummaries(),
        commandRegistrations: registry.listExtensionCommandRegistrations(),
        keybindingRegistrations: registry.listExtensionKeybindingRegistrations(),
        slashCommandRegistrations: registry.listExtensionSlashCommandRegistrations(),
        mentionRegistrations: registry.listExtensionMentionRegistrations(),
        quickOpenRegistrations: registry.listExtensionQuickOpenRegistrations(),
        searchProviderRegistrations: registry.listExtensionSearchProviderRegistrations(),
        snapshot: registry.readExtensionRegistrySnapshot(),
      };
    },
    invokeAction: async () => ({ ok: true, result: null }),
  }),
}));

import { saveConversationArtifact } from '@neon-pilot/core';

import { dispatchDesktopLocalApiRequest, normalizeDesktopLocalApiTailBlocks, rollbackDesktopConversation } from './localApi.js';

function readJsonBody(response: Awaited<ReturnType<typeof dispatchDesktopLocalApiRequest>>) {
  return JSON.parse(Buffer.from(response.body).toString('utf-8')) as Record<string, unknown>;
}

describe('desktop local API conversation actions', () => {
  it('drops unsafe desktop local API tail block limits', () => {
    expect(normalizeDesktopLocalApiTailBlocks(20)).toBe(20);
    expect(normalizeDesktopLocalApiTailBlocks(50000)).toBe(10000);
    expect(normalizeDesktopLocalApiTailBlocks(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined();
  });

  it('rejects unsafe rollback turn counts before resolving conversation state', async () => {
    await expect(
      rollbackDesktopConversation({
        conversationId: 'conversation-1',
        numTurns: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow('numTurns must be a positive integer.');

    await expect(
      rollbackDesktopConversation({
        conversationId: 'conversation-1',
        numTurns: Number.MAX_SAFE_INTEGER,
      }),
    ).rejects.toThrow('numTurns must be a positive integer.');
  });

  it('serves conversation recover through the desktop product fast path', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/conversations/missing-conversation/recover',
    });

    expect(response.statusCode).toBe(404);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Conversation not found.');
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
  });

  it('serves execution snapshots through the desktop product fast path', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/executions',
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(readJsonBody(response).executions)).toBe(true);
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
  });

  it('serves conversation execution snapshots through the desktop product fast path', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/conversations/conversation-1/executions?active=true&visibility=visible',
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toMatchObject({
      conversationId: 'conversation-1',
      primary: expect.any(Array),
      system: expect.any(Array),
      hidden: expect.any(Array),
      executions: expect.any(Array),
    });
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
  });

  it('serves conversation summaries through the desktop product fast path', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/conversation-summaries',
      body: { sessionIds: ['missing-session'] },
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({ summaries: {} });
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
  });

  it('continues past host-webapp wildcard routes for workspace tree requests', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: `/api/workspace/tree?cwd=${encodeURIComponent(resolve('.'))}`,
    });
    const body = readJsonBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.path).toBe('');
    expect(Array.isArray(body.entries)).toBe(true);
    expect(Buffer.from(response.body).toString('utf-8')).not.toContain('Local API route did not complete');
  });

  it('returns a friendly 404 for unregistered extension webapp localhost hosts', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/',
      headers: { host: 'missing-extension-webapp.localhost' },
    });

    expect(response.statusCode).toBe(404);
    expect(readJsonBody(response)).toEqual({ error: 'No Neon Pilot webapp is registered for this host.' });
    expect(Buffer.from(response.body).toString('utf-8')).not.toContain('Local API route did not complete');
  });
});

describe('desktop local API conversation rename route', () => {
  it('rejects unsafe cross-origin dispatch before product handlers run', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
      headers: {
        host: 'desktop.local',
        origin: 'https://evil.example',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Cross-origin request rejected.');
  });

  it('allows unsafe same-origin dispatches to reach product handlers', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
      headers: {
        host: 'desktop.local',
        origin: 'http://desktop.local',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Conversation title is required.');
  });

  it('rejects browser-mode unsafe webapp dispatches with missing origin', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
      headers: {
        host: 'board-agent-board.localhost',
      },
      trustMode: 'browser',
    });

    expect(response.statusCode).toBe(403);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Cross-origin request rejected.');
  });

  it('allows browser-mode unsafe webapp same-origin dispatches', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
      headers: {
        host: 'desktop.local',
        origin: 'http://desktop.local',
      },
      trustMode: 'browser',
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Conversation title is required.');
  });

  it('rejects rename with missing name instead of throwing No local API route', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Conversation title is required.');
  });

  it('rejects rename with empty name instead of throwing No local API route', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('Conversation title is required.');
  });
});

describe('desktop local API conversation asset routes', () => {
  const tempStateRoot = mkdtempSync(join(tmpdir(), 'pa-local-api-assets-'));
  const previousStateRoot = process.env.NEON_PILOT_STATE_ROOT;

  afterAll(() => {
    if (previousStateRoot === undefined) {
      delete process.env.NEON_PILOT_STATE_ROOT;
    } else {
      process.env.NEON_PILOT_STATE_ROOT = previousStateRoot;
    }
    rmSync(tempStateRoot, { recursive: true, force: true });
  });

  it('serves conversation artifact list and detail from desktop product routes', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;
    saveConversationArtifact({
      profile: 'shared',
      conversationId: 'conversation-1',
      artifactId: 'artifact-1',
      kind: 'html',
      title: 'Artifact 1',
      content: '<h1>Hello</h1>',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const listResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/conversations/conversation-1/artifacts',
    });
    expect(readJsonBody(listResponse)).toEqual({
      conversationId: 'conversation-1',
      artifacts: [expect.objectContaining({ id: 'artifact-1', title: 'Artifact 1', kind: 'html', revision: 1 })],
    });

    const detailResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/conversations/conversation-1/artifacts/artifact-1',
    });
    expect(readJsonBody(detailResponse)).toEqual({
      conversationId: 'conversation-1',
      artifact: expect.objectContaining({ id: 'artifact-1', content: '<h1>Hello</h1>' }),
    });

    const deleteResponse = await dispatchDesktopLocalApiRequest({
      method: 'DELETE',
      path: '/api/conversations/conversation-1/artifacts/artifact-1',
    });
    expect(readJsonBody(deleteResponse)).toEqual({
      conversationId: 'conversation-1',
      artifactId: 'artifact-1',
      deleted: true,
      artifacts: [],
    });

    const listAfterDeleteResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/conversations/conversation-1/artifacts',
    });
    expect(readJsonBody(listAfterDeleteResponse)).toEqual({
      conversationId: 'conversation-1',
      artifacts: [],
    });
  });
});

describe('desktop local API product fast-path errors', () => {
  it('serves health and session-state compatibility endpoints instead of falling through to incomplete routes', async () => {
    const healthResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/health',
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(readJsonBody(healthResponse)).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ready',
        profile: 'shared',
      }),
    );

    const sessionStateResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/session-state',
    });
    expect(sessionStateResponse.statusCode).toBe(200);
    expect(readJsonBody(sessionStateResponse)).toEqual(
      expect.objectContaining({
        ok: true,
        sessions: expect.any(Array),
        liveSessions: expect.any(Array),
      }),
    );

    const executionsResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/executions',
    });
    expect(executionsResponse.statusCode).toBe(200);
    expect(readJsonBody(executionsResponse)).toEqual(
      expect.objectContaining({
        executions: expect.any(Array),
      }),
    );

    const summariesResponse = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/conversation-summaries',
      body: { sessionIds: [] },
    });
    expect(summariesResponse.statusCode).toBe(200);
    expect(readJsonBody(summariesResponse)).toEqual({ summaries: {} });

    const executionDetailResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/executions/missing-local-api-product-execution',
    });
    expect(executionDetailResponse.statusCode).toBe(404);
    expect(readJsonBody(executionDetailResponse)).toEqual({ error: 'Execution not found' });
  });

  it('returns mapped error responses instead of throwing through the backend child', async () => {
    const runResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/runs/missing-local-api-product-run',
    });
    expect(runResponse.statusCode).toBe(404);
    expect(Buffer.from(runResponse.body).toString('utf-8')).toBe('Run not found');

    const preferencesResponse = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/conversations/missing-local-api-product-conversation/model-preferences',
    });
    expect(preferencesResponse.statusCode).toBe(404);
    expect(Buffer.from(preferencesResponse.body).toString('utf-8')).toBe('Conversation not found');

    const modelUpdateResponse = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/missing-local-api-product-conversation/model-preferences',
      body: { model: 'openai/gpt-5.5' },
    });
    expect(modelUpdateResponse.statusCode).toBe(200);
    expect(readJsonBody(modelUpdateResponse)).toEqual(
      expect.objectContaining({
        currentModel: 'gpt-5.5',
        currentThinkingLevel: expect.any(String),
        currentServiceTier: expect.any(String),
      }),
    );
  });
});

describe('desktop local API extension routes', () => {
  const tempStateRoot = mkdtempSync(join(tmpdir(), 'pa-local-api-extensions-'));
  const previousStateRoot = process.env.NEON_PILOT_STATE_ROOT;

  afterAll(() => {
    if (previousStateRoot === undefined) {
      delete process.env.NEON_PILOT_STATE_ROOT;
    } else {
      process.env.NEON_PILOT_STATE_ROOT = previousStateRoot;
    }
    rmSync(tempStateRoot, { recursive: true, force: true });
  });

  it('dispatches wildcard extension bundle routes in the desktop local API', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;
    const extensionRoot = join(tempStateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          nav: [{ id: 'agent-board', label: 'Agent Board', route: '/agent-board', icon: 'app' }],
          tools: [{ id: 'slow-tool', name: 'slow_tool', action: 'tools.slow', description: 'Slow tool', inputSchema: {} }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export function AgentBoardPage() {}');

    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/extensions/agent-board/files/dist/frontend.js?surfaceId=page',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/javascript|\bjs\b/);
    expect(Buffer.from(response.body).toString('utf-8')).toContain('AgentBoardPage');
  }, 30000);

  it('serves the critical extension registry from the desktop local API fast path', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;

    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/extensions/registry/critical',
    });
    const body = readJsonBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.settings).toEqual({});
    expect(body.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agent-board',
          manifest: expect.objectContaining({
            contributes: expect.objectContaining({
              nav: [expect.objectContaining({ id: 'agent-board' })],
            }),
          }),
        }),
      ]),
    );
    const agentBoard = (body.extensions as Array<{ id: string; manifest: { contributes?: Record<string, unknown> } }>).find(
      (extension) => extension.id === 'agent-board',
    );
    expect(agentBoard?.manifest.contributes).not.toHaveProperty('tools');
  }, 30000);

  it('prioritizes extension webapp host routing over product API routes', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;
    const extensionRoot = join(tempStateRoot, 'extensions', 'agent-webapp');
    mkdirSync(join(extensionRoot, 'dist', 'webapp'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-webapp',
        name: 'Agent Webapp',
        contributes: {
          webapps: [{ id: 'board', title: 'Board', entry: 'dist/webapp/index.html' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'webapp', 'index.html'), '<h1>Board Webapp</h1>');

    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/extensions',
      headers: { host: 'board-agent-webapp.localhost' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(Buffer.from(response.body).toString('utf-8')).toContain('Board Webapp');
  }, 30000);

  it('does not dispatch webapp localhost hosts through product fast-path APIs', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;
    const extensionRoot = join(tempStateRoot, 'extensions', 'agent-webapp-fast-path');
    mkdirSync(join(extensionRoot, 'dist', 'webapp'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-webapp-fast-path',
        name: 'Agent Webapp Fast Path',
        contributes: {
          webapps: [{ id: 'board', title: 'Board', entry: 'dist/webapp/index.html' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'webapp', 'index.html'), '<h1>Board Webapp Fast Path</h1>');

    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/status',
      headers: { host: 'board-agent-webapp-fast-path.localhost' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(Buffer.from(response.body).toString('utf-8')).toContain('Board Webapp Fast Path');
  }, 30000);

  it('serves localhost webapp proxy status through the desktop local API fast path', async () => {
    process.env.NEON_PILOT_STATE_ROOT = tempStateRoot;

    const response = await dispatchDesktopLocalApiRequest({
      method: 'GET',
      path: '/api/extensions/webapps/localhost-proxy',
    });

    expect(response.statusCode).toBe(200);
    expect(readJsonBody(response)).toEqual({ running: false });
  }, 30000);
});

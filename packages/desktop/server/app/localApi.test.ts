import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    readRegistryPresentation: async () => {
      const registry = await import('../extensions/extensionRegistry.js');
      return {
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
});

describe('desktop local API conversation rename route', () => {
  it('rejects rename with missing name instead of throwing No local API route', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
    });

    expect(response.statusCode).toBe(500);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('name required');
  });

  it('rejects rename with empty name instead of throwing No local API route', async () => {
    const response = await dispatchDesktopLocalApiRequest({
      method: 'PATCH',
      path: '/api/conversations/test-id/title',
      body: { name: '' },
    });

    expect(response.statusCode).toBe(500);
    expect(Buffer.from(response.body).toString('utf-8')).toBe('name required');
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
  });
});

describe('desktop local API product fast-path errors', () => {
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
});

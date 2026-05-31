import { describe, expect, it, vi } from 'vitest';

const backend = await import('./backend.js');

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    runtimeScope: 'shared',
    runtime: {
      getRepoRoot: () => '/repo',
    },
    toolContext: {
      conversationId: 'conversation-1',
      cwd: '/repo',
    },
    storage: {
      get: vi.fn(),
      put: vi.fn(async () => ({ ok: true })),
      delete: vi.fn(async () => ({ ok: true, deleted: true })),
    },
    models: {
      saveProvider: vi.fn(async () => ({ providers: [] })),
      saveProviderModel: vi.fn(async () => ({ providers: [] })),
    },
    shell: {
      exec: vi.fn(),
    },
    ...overrides,
  } as never;
}

describe('DS4 provider setup', () => {
  it('installs the upstream ds4 Pi provider shape', async () => {
    const context = ctx();

    await backend.installProvider({}, context);

    expect(context.models.saveProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ds4',
        baseUrl: 'http://127.0.0.1:8000/v1',
        api: 'openai-completions',
        apiKey: 'dsv4-local',
        compat: expect.objectContaining({ thinkingFormat: 'deepseek' }),
      }),
    );
    expect(context.models.saveProviderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ds4',
        modelId: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash (ds4.c local)',
        reasoning: true,
        contextWindow: 100000,
        maxTokens: 384000,
      }),
    );
  });
});

describe('DS4 agent profile activation', () => {
  it('adds ds4-agent-shaped tools when the DS4 profile is active', () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    backend.createDs4AgentExtension()({
      on: (event: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(event, handler),
    } as never);
    const calls: string[][] = [];

    handlers.get('session_start')?.(
      {},
      {
        getActiveTools: () => ['artifact'],
        setActiveTools: (tools: string[]) => calls.push(tools),
        modelProfile: { kind: 'resolved', profile: { id: 'ds4-compatible' } },
      },
    );

    expect(calls).toEqual([['artifact', 'bash', 'read', 'more', 'write', 'edit', 'search']]);
  });
});

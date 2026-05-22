import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
  SessionManager: { inMemory: vi.fn((cwd: string) => ({ kind: 'in-memory', cwd })) },
}));
const factory = vi.hoisted(() => ({ makeAuth: vi.fn(() => ({ auth: true })), makeRegistry: vi.fn(() => ({ registry: true })) }));
const loader = vi.hoisted(() => ({ makeLoader: vi.fn(async () => ({ loader: true })) }));

vi.mock('@earendil-works/pi-coding-agent', () => agent);
vi.mock('./liveSessionFactory.js', () => factory);
vi.mock('./liveSessionLoader.js', () => loader);

import { inspectAvailableLiveSessionTools } from './liveSessionToolInspection.js';

describe('live session tool inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function session(overrides: Record<string, unknown> = {}) {
    return {
      systemPrompt: 'base system prompt',
      state: {
        tools: [
          { name: 'write', description: 'Write files', parameters: { type: 'object' } },
          { name: 'read', description: 'Read files', parameters: { type: 'object' } },
        ],
      },
      getActiveToolNames: vi.fn(() => ['read']),
      getAllTools: vi.fn(() => [
        { name: 'write', description: 'Write files', parameters: { type: 'object' } },
        { name: 'read', description: 'Read files', parameters: { type: 'object' } },
        { name: 'bash', description: 'Run shell', parameters: { type: 'object' } },
      ]),
      dispose: vi.fn(),
      ...overrides,
    };
  }

  it('creates an in-memory session and returns sorted tool inspection data', async () => {
    const s = session({
      _extensionRunner: {
        emitBeforeAgentStart: vi.fn(async () => ({
          systemPrompt: 'extended system prompt',
          messages: [{ customType: 'context', content: 'injected', details: { ok: true } }],
        })),
      },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await expect(
      inspectAvailableLiveSessionTools({ cwd: '/repo', agentDir: '/agent', options: { agentDir: '/override-agent' } as never }),
    ).resolves.toEqual({
      cwd: '/repo',
      activeTools: ['read'],
      tools: [
        { name: 'read', description: 'Read files', parameters: { type: 'object' }, active: true },
        { name: 'bash', description: 'Run shell', parameters: { type: 'object' }, active: false },
        { name: 'write', description: 'Write files', parameters: { type: 'object' }, active: false },
      ],
      newSessionSystemPrompt: 'extended system prompt',
      newSessionInjectedMessages: [{ customType: 'context', content: 'injected', details: { ok: true } }],
      newSessionToolDefinitions: [
        { name: 'write', description: 'Write files', parameters: { type: 'object' }, active: true },
        { name: 'read', description: 'Read files', parameters: { type: 'object' }, active: true },
      ],
    });

    expect(factory.makeAuth).toHaveBeenCalledWith('/agent');
    expect(loader.makeLoader).toHaveBeenCalledWith('/repo', { agentDir: '/override-agent' });
    expect(agent.SessionManager.inMemory).toHaveBeenCalledWith('/repo');
    expect(agent.createAgentSession).toHaveBeenCalledWith({
      cwd: '/repo',
      agentDir: '/override-agent',
      authStorage: { auth: true },
      modelRegistry: { registry: true },
      resourceLoader: { loader: true },
      sessionManager: { kind: 'in-memory', cwd: '/repo' },
    });
    expect(s._extensionRunner.emitBeforeAgentStart).toHaveBeenCalledWith('hello', undefined, 'base system prompt');
    expect(s.dispose).toHaveBeenCalledOnce();
  });

  it('falls back to base system prompt and still disposes when inspection fails', async () => {
    const s = session({
      getAllTools: vi.fn(() => {
        throw new Error('tool failure');
      }),
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await expect(inspectAvailableLiveSessionTools({ cwd: '/repo', agentDir: '/agent' })).rejects.toThrow('tool failure');
    expect(s.dispose).toHaveBeenCalledOnce();
  });

  it('uses base system prompt and no injected messages when there is no extension runner', async () => {
    const s = session({ getAllTools: vi.fn(() => []), getActiveToolNames: vi.fn(() => []), state: { tools: [] } });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await expect(inspectAvailableLiveSessionTools({ cwd: '/repo', agentDir: '/agent' })).resolves.toMatchObject({
      newSessionSystemPrompt: 'base system prompt',
      newSessionInjectedMessages: [],
      newSessionToolDefinitions: [],
    });
  });
});

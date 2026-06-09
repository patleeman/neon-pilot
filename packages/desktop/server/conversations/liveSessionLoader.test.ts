import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => {
  class DefaultResourceLoader {
    static instances: DefaultResourceLoader[] = [];
    static reloadImpl: () => Promise<void> = async () => undefined;
    options: unknown;
    reload = vi.fn(async () => DefaultResourceLoader.reloadImpl());
    constructor(options: unknown) {
      this.options = options;
      DefaultResourceLoader.instances.push(this);
    }
  }
  const loadProjectContextFiles = vi.fn(() => [
    { path: '/agent-runtime/AGENTS.md', content: 'full global instructions' },
    { path: '/repo/AGENTS.md', content: 'full repo instructions' },
  ]);
  return { DefaultResourceLoader, loadProjectContextFiles };
});
const core = vi.hoisted(() => ({ getPiAgentRuntimeDir: vi.fn(() => '/agent-runtime') }));
const logging = vi.hoisted(() => ({ logWarn: vi.fn() }));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  DefaultResourceLoader: agent.DefaultResourceLoader,
  loadProjectContextFiles: agent.loadProjectContextFiles,
}));
vi.mock('@neon-pilot/core', () => core);
vi.mock('../shared/logging.js', () => logging);

import {
  clearPrewarmedLiveSessionLoaders,
  makeLoader,
  prewarmLiveSessionLoader,
  queuePrewarmLiveSessionLoader,
} from './liveSessionLoader.js';

describe('live session loader cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.DefaultResourceLoader.instances.length = 0;
    agent.DefaultResourceLoader.reloadImpl = async () => undefined;
    agent.loadProjectContextFiles.mockReturnValue([
      { path: '/agent-runtime/AGENTS.md', content: 'full global instructions' },
      { path: '/repo/AGENTS.md', content: 'full repo instructions' },
    ]);
    clearPrewarmedLiveSessionLoaders();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  it('creates fresh loaders with normalized options and reloads them', async () => {
    const factoryA = function FactoryA() {} as never;
    const loader = await makeLoader('/repo', {
      extensionFactories: [factoryA],
      additionalExtensionPaths: [' /b ', '/a', '/a'],
      additionalSkillPaths: [' /skills '],
      additionalPromptTemplatePaths: [' /prompts '],
      additionalThemePaths: [' /themes '],
      noThemes: true,
    });

    expect(loader).toBe(agent.DefaultResourceLoader.instances[0]);
    expect(agent.DefaultResourceLoader.instances[0].options).toEqual({
      cwd: '/repo',
      agentDir: '/agent-runtime',
      extensionFactories: [factoryA],
      additionalExtensionPaths: [' /b ', '/a', '/a'],
      additionalSkillPaths: [' /skills '],
      additionalPromptTemplatePaths: [' /prompts '],
      additionalThemePaths: [' /themes '],
      systemPrompt: expect.stringContaining('Neon Pilot'),
      noSkills: undefined,
      noThemes: true,
      noContextFiles: true,
    });
    expect(agent.DefaultResourceLoader.instances[0].options).toEqual(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('## Global user agent preferences'),
      }),
    );
    expect(agent.DefaultResourceLoader.instances[0].options).toEqual(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('full repo instructions'),
      }),
    );
    expect(agent.DefaultResourceLoader.instances[0].options).toEqual(
      expect.objectContaining({
        systemPrompt: expect.not.stringContaining('<project_context>'),
      }),
    );
    expect(agent.DefaultResourceLoader.instances[0].options).not.toEqual(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Pi documentation'),
      }),
    );
    expect(agent.DefaultResourceLoader.instances[0].reload).toHaveBeenCalledOnce();
  });

  it('turns AGENTS files and skills into pointers for progressive DS4 sessions', async () => {
    await makeLoader('/repo', {
      agentDir: '/agent-runtime',
      progressiveDisclosure: true,
      noSkills: true,
      additionalSkillPaths: [],
      skillDiscoveryPaths: ['/skills/ds4/SKILL.md', '/skills/repo/SKILL.md'],
    });

    const options = agent.DefaultResourceLoader.instances[0].options as {
      systemPrompt: string;
      noSkills: boolean;
      noContextFiles: boolean;
      appendSystemPromptOverride?: (base: string[]) => string[];
      agentsFilesOverride?: (base: { agentsFiles: Array<{ path: string; content: string }> }) => {
        agentsFiles: Array<{ path: string; content: string }>;
      };
    };
    expect(options.noSkills).toBe(true);
    expect(options.noContextFiles).toBe(true);
    expect(options.systemPrompt).toContain('DS4 mode');
    expect(options.systemPrompt).toContain('ds4 help');
    expect(options.systemPrompt).toContain('ds4 skills search <query>');
    expect(options.systemPrompt).not.toContain('/skills/ds4/SKILL.md');
    expect(options.appendSystemPromptOverride).toBeUndefined();
    expect(options.agentsFilesOverride).toBeUndefined();
    expect(options.systemPrompt).toContain('- Global user agent preferences: /agent-runtime/AGENTS.md (pointer only; read if relevant)');
    expect(options.systemPrompt).toContain('- Repo user agent preferences: /repo/AGENTS.md (pointer only; read if relevant)');
    expect(options.systemPrompt).not.toContain('full global instructions');
    expect(options.systemPrompt).not.toContain('full repo instructions');
    expect(options.systemPrompt).not.toContain('<project_context>');
  });

  it('returns a prewarmed loader once and reloads fresh after it is consumed', async () => {
    await prewarmLiveSessionLoader('/repo', { additionalExtensionPaths: ['/b', '/a'] });
    expect(agent.DefaultResourceLoader.instances).toHaveLength(1);

    const first = await makeLoader('/repo', { additionalExtensionPaths: ['/a', '/b'] });
    const second = await makeLoader('/repo', { additionalExtensionPaths: ['/a', '/b'] });

    expect(first).toBe(agent.DefaultResourceLoader.instances[0]);
    expect(second).toBe(agent.DefaultResourceLoader.instances[1]);
  });

  it('deduplicates inflight prewarms and lets makeLoader await the warmup', async () => {
    const first = prewarmLiveSessionLoader('/repo');
    const second = prewarmLiveSessionLoader('/repo');
    await Promise.all([first, second]);

    expect(agent.DefaultResourceLoader.instances).toHaveLength(1);
    expect(agent.DefaultResourceLoader.instances[0].reload).toHaveBeenCalledOnce();

    const warmed = await makeLoader('/repo');
    expect(warmed).toBe(agent.DefaultResourceLoader.instances[0]);
  });

  it('expires stale prewarmed loaders and trims cache to the newest four', async () => {
    await prewarmLiveSessionLoader('/repo-old');
    vi.setSystemTime(10 * 60_000 + 1);
    const staleReplacement = await makeLoader('/repo-old');
    expect(staleReplacement).toBe(agent.DefaultResourceLoader.instances[1]);

    for (let index = 0; index < 5; index += 1) {
      await prewarmLiveSessionLoader(`/repo-${index}`);
    }
    const oldestEvicted = await makeLoader('/repo-0');
    expect(oldestEvicted).toBe(agent.DefaultResourceLoader.instances[7]);
  });

  it('clears prewarmed loaders and logs queued prewarm failures', async () => {
    await prewarmLiveSessionLoader('/repo');
    clearPrewarmedLiveSessionLoaders();
    const fresh = await makeLoader('/repo');
    expect(fresh).toBe(agent.DefaultResourceLoader.instances[1]);

    const error = new Error('reload failed');
    agent.DefaultResourceLoader.instances.length = 0;
    agent.DefaultResourceLoader.reloadImpl = async () => {
      throw error;
    };
    queuePrewarmLiveSessionLoader('/bad');
    await vi.waitFor(() => expect(logging.logWarn).toHaveBeenCalled());
    expect(logging.logWarn).toHaveBeenCalledWith('live session loader prewarm failed', {
      cwd: '/bad',
      message: 'reload failed',
      stack: error.stack,
    });
    agent.DefaultResourceLoader.reloadImpl = async () => undefined;
  });
});

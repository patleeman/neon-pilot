import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
      spawn: vi.fn(),
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

    expect(calls).toEqual([
      ['artifact', 'google_search', 'visit_page', 'bash', 'bash_status', 'bash_stop', 'read', 'more', 'write', 'edit', 'search', 'list'],
    ]);
  });
});

describe('DS4 file tools', () => {
  it('supports raw chunk reads and compact directory listing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-extension-'));
    try {
      await writeFile(path.join(dir, 'sample.txt'), 'one\ntwo\nthree\nfour\n', 'utf8');
      const context = ctx({ runtime: { getRepoRoot: () => dir }, toolContext: { conversationId: 'conversation-1', cwd: dir } });

      const readResult = await backend.read({ path: 'sample.txt', raw: true, start_line: 2, max_lines: 2 }, context);
      const listResult = await backend.list({ path: '.' }, context);

      expect(readResult.text).toBe('two\nthree');
      expect(listResult.text).toContain('sample.txt');
      expect(context.storage.put).toHaveBeenCalledWith(
        'read-state:conversation-1',
        expect.objectContaining({ path: 'sample.txt', nextLine: 4, count: 2 }),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('applies ds4 [upto] edit anchors', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-extension-'));
    try {
      const file = path.join(dir, 'sample.txt');
      await writeFile(file, 'alpha\nstart\nmiddle\nend\nomega\n', 'utf8');
      const context = ctx({ runtime: { getRepoRoot: () => dir }, toolContext: { conversationId: 'conversation-1', cwd: dir } });

      await backend.edit({ path: 'sample.txt', old: 'start\n[upto]end\n', new: 'replacement\n' }, context);

      await expect(readFile(file, 'utf8')).resolves.toBe('alpha\nreplacement\nomega\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('DS4 bash jobs', () => {
  it('starts, reports, and stops refresh_sec jobs', async () => {
    let stdout: ((chunk: string) => void) | undefined;
    let exit: ((event: { code: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
    const kill = vi.fn(() => exit?.({ code: null, signal: 'SIGTERM' }));
    const context = ctx({
      shell: {
        exec: vi.fn(),
        spawn: vi.fn(async (input: { onStdout?: (chunk: string) => void; onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void }) => {
          stdout = input.onStdout;
          exit = input.onExit;
          stdout?.('first\n');
          return { pid: 42, usingPty: false, executionWrappers: [], kill, write: vi.fn(), resize: vi.fn() };
        }),
      },
    });

    const started = await backend.bash({ command: 'sleep 30', refresh_sec: 0.001 }, context);
    stdout?.('second\n');
    const status = await backend.bash_status({ job: started.details.job }, context);
    const stopped = await backend.bash_stop({ job: started.details.job }, context);

    expect(started.text).toContain('first');
    expect(status.text).toContain('second');
    expect(kill).toHaveBeenCalled();
    expect(stopped.text).toContain('SIGTERM');
  });
});

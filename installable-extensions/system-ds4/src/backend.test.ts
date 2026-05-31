import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
      get: vi.fn(async () => null),
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
    filesystem: {
      app: vi.fn(async () => ({ root: { path: path.join(tmpdir(), 'ds4-extension-app') } })),
    },
    ...overrides,
  } as never;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('DS4 managed runtime', () => {
  it('reports extension-owned install and server state', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      await mkdir(path.join(dir, 'runtime', 'ds4', '.git'), { recursive: true });
      await mkdir(path.join(dir, 'runtime', 'ds4', 'gguf'), { recursive: true });
      await writeFile(path.join(dir, 'runtime', 'ds4', 'ds4-server'), '#!/bin/sh\n', 'utf8');
      await writeFile(
        path.join(dir, 'runtime', 'ds4', 'gguf', 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf'),
        '',
        'utf8',
      );
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'deepseek-v4-flash' }] }),
        })),
      );
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        shell: {
          exec: vi.fn(async () => ({ stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] })),
          spawn: vi.fn(),
        },
      });

      const result = await backend.status({}, context);

      expect(result.reachable).toBe(true);
      expect(result.runtime).toEqual(
        expect.objectContaining({
          installed: true,
          repoInstalled: true,
          serverInstalled: true,
          modelInstalled: true,
        }),
      );
      expect(result.models).toEqual(['deepseek-v4-flash']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('starts bootstrap in the extension app root instead of requiring a machine install', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      const exec = vi.fn(async (input: { args?: string[] }) => {
        const command = input.args?.join(' ') ?? '';
        if (command.includes('kill -0')) return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        return { stdout: '12345\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      });
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        shell: { exec, spawn: vi.fn() },
      });

      const result = await backend.bootstrapRuntime({}, context);

      expect(result.started).toBe(true);
      expect(context.storage.put).toHaveBeenCalledWith('runtime/bootstrapPid', 12345);
      const launchScript = exec.mock.calls.find(([input]) => (input.args?.join(' ') ?? '').includes('git clone'))?.[0].args?.join(' ');
      expect(launchScript).toContain('https://github.com/antirez/ds4.git');
      expect(launchScript).toContain('./download_model.sh');
      expect(launchScript).toContain('q2-imatrix');
      expect(launchScript).toContain(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('starts the managed ds4-server when the runtime is installed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      await mkdir(path.join(dir, 'runtime', 'ds4', 'gguf'), { recursive: true });
      await writeFile(path.join(dir, 'runtime', 'ds4', 'ds4-server'), '#!/bin/sh\n', 'utf8');
      await writeFile(
        path.join(dir, 'runtime', 'ds4', 'gguf', 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf'),
        '',
        'utf8',
      );
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      const exec = vi.fn(async (input: { args?: string[] }) => {
        const command = input.args?.join(' ') ?? '';
        if (command.includes('kill -0')) return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        return { stdout: '54321\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      });
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        shell: { exec, spawn: vi.fn() },
      });

      const result = await backend.startServer({ timeoutMs: 0 }, context);

      expect(result.started).toBe(true);
      expect(context.storage.put).toHaveBeenCalledWith('runtime/serverPid', 54321);
      const launchScript = exec.mock.calls.find(([input]) => (input.args?.join(' ') ?? '').includes('ds4-server'))?.[0].args?.join(' ');
      expect(launchScript).toContain('--ctx 100000');
      expect(launchScript).toContain('--kv-disk-space-mb 8192');
      expect(launchScript).toContain(path.join(dir, 'runtime'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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

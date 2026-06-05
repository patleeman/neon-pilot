import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

const backendTools = {
  listInvocableExtensionTools: vi.fn(async () => []),
  invokeToolByName: vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }], details: { ok: true } })),
};
const backendSkills = {
  buildSkillInventoryAsync: vi.fn(async () => []),
};

const backend = await import('./backend.js');

function ctx(overrides: Record<string, unknown> = {}) {
  const defaultAppRoot = path.join(tmpdir(), 'ds4-extension-app');
  const scopedRoot = (rootPath: string) => ({
    root: { path: rootPath },
    readText: async (target: string) => readFile(path.resolve(rootPath, target), 'utf8'),
    writeText: async (target: string, content: string) => writeFile(path.resolve(rootPath, target), content, 'utf8'),
    list: async (target: string) => {
      const dir = path.resolve(rootPath, target);
      const entries = await readdir(dir, { withFileTypes: true });
      return Promise.all(
        entries.map(async (entry) => {
          const itemStat = await stat(path.join(dir, entry.name));
          return {
            name: entry.name,
            path: entry.name,
            type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
            ...(entry.isFile() ? { size: itemStat.size } : {}),
          };
        }),
      );
    },
  });
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
      deleteProvider: vi.fn(async () => ({ providers: [] })),
    },
    conversations: {
      setActiveTools: vi.fn(async (_conversationId: string, toolNames: string[]) => ({ toolNames })),
    },
    shell: {
      exec: vi.fn(),
      spawn: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    filesystem: {
      app: vi.fn(async () => scopedRoot(defaultAppRoot)),
      workspace: vi.fn(async (input?: { cwd?: string }) => scopedRoot(input?.cwd ?? '/repo')),
    },
    ...overrides,
  } as never;
}

afterEach(() => {
  backend.__setDs4ToolsApiForTest(null);
  backend.__setDs4SkillsApiForTest(null);
  backendTools.listInvocableExtensionTools.mockReset();
  backendTools.invokeToolByName.mockReset();
  backendSkills.buildSkillInventoryAsync.mockReset();
  backendTools.listInvocableExtensionTools.mockResolvedValue([]);
  backendTools.invokeToolByName.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], details: { ok: true } });
  backendSkills.buildSkillInventoryAsync.mockResolvedValue([]);
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
        name: 'DeepSeek V4 Flash',
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 384000,
      }),
    );
  });

  it('discovers the configured DS4 model even when the local server is offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(backend.discover({}, ctx())).resolves.toMatchObject({
      provider: 'ds4',
      baseUrl: 'http://127.0.0.1:8000/v1',
      models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 1000000 }],
    });
  });

  it('uses saved advanced DS4 settings for model metadata', async () => {
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) =>
          key === 'settings' ? { shellCompression: 'rtk', contextWindow: 262144, maxTokens: 131072, kvDiskSpaceMb: 16384 } : null,
        ),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
    });

    await backend.installProvider({}, context);

    expect(context.models.saveProviderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        contextWindow: 262144,
        maxTokens: 131072,
      }),
    );
  });

  it('removes the DS4 provider when disabled', async () => {
    const context = ctx({
      shell: {
        exec: vi.fn(async () => ({ stdout: '', stderr: '', code: 0 })),
        spawn: vi.fn(),
      },
    });

    await expect(backend.disable({}, context)).resolves.toMatchObject({
      ok: true,
      provider: 'ds4',
      server: { ok: true },
    });

    expect(context.models.deleteProvider).toHaveBeenCalledWith('ds4');
  });

  it('installs and discovers enabled custom DS4 model slots', async () => {
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) =>
          key === 'settings'
            ? {
                activeModelSlotId: 'spark-mini-q2-reap',
                modelSlots: [
                  {
                    id: 'default',
                    enabled: true,
                    modelId: 'deepseek-v4-flash',
                    name: 'DeepSeek V4 Flash',
                    filename: 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf',
                    downloadVariant: 'q2-imatrix',
                  },
                  {
                    id: 'spark-mini-q2-reap',
                    enabled: true,
                    modelId: 'deepseek-v4-flash-spark-mini-q2-reap',
                    name: 'DeepSeek V4 Flash Spark Mini Q2 REAP',
                    filename: 'DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf',
                    downloadUrl: 'https://huggingface.co/0xSero/DeepSeek-V4-Flash-162B-GGUF/resolve/main/DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf',
                  },
                ],
              }
            : null,
        ),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
    });

    await backend.installProvider({}, context);
    const discovered = await backend.discover({}, context);

    expect(context.models.saveProviderModel).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'deepseek-v4-flash' }));
    expect(context.models.saveProviderModel).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'deepseek-v4-flash-spark-mini-q2-reap' }));
    expect(discovered.models.map((model: { id: string }) => model.id)).toEqual(['deepseek-v4-flash', 'deepseek-v4-flash-spark-mini-q2-reap']);
  });
});

describe('DS4 managed runtime', () => {
  it('publishes the DS4 helper CLI to process PATH when status is read', async () => {
    const previousPath = process.env.PATH;
    const previousCli = process.env.DS4_CLI_BIN;
    process.env.PATH = '/usr/bin';
    delete process.env.DS4_CLI_BIN;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const exec = vi.fn(async (input: { args?: string[] }) => {
      const command = input.args?.join('\n') ?? '';
      if (command.includes('command -v rtk')) return { stdout: 'installed=no\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
    });

    try {
      await backend.status({}, ctx({ shell: { exec, spawn: vi.fn() } }));

      expect(process.env.PATH?.split(path.delimiter)[0]).toContain('system-ds4/bin');
      expect(process.env.DS4_CLI_BIN).toContain('system-ds4/bin/ds4');
    } finally {
      process.env.PATH = previousPath;
      if (previousCli === undefined) delete process.env.DS4_CLI_BIN;
      else process.env.DS4_CLI_BIN = previousCli;
    }
  });

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
        storage: {
          get: vi.fn(async (key: string) => (key === 'runtime/serverSlotId' ? 'default' : null)),
          put: vi.fn(async () => ({ ok: true })),
          delete: vi.fn(async () => ({ ok: true, deleted: true })),
        },
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
          modelBytes: 0,
          tools: expect.any(Object),
          rtk: expect.objectContaining({ installed: false, valid: false }),
          modelSlots: expect.arrayContaining([expect.objectContaining({ id: 'default', installed: true })]),
        }),
      );
      expect(result.server).toEqual(expect.objectContaining({ slotId: 'default', modelId: 'deepseek-v4-flash' }));
      expect(result.settings).toEqual(expect.objectContaining({
        shellCompression: 'rtk',
        contextWindow: 1000000,
        maxTokens: 384000,
        kvDiskSpaceMb: 8192,
        directCoreTools: true,
        progressiveSkills: true,
        compactSkillPrompt: true,
        agentsPointers: true,
        activeModelSlotId: 'default',
      }));
      expect(result.settings.modelSlots.length).toBeGreaterThanOrEqual(2);
      expect(result.bootstrap.steps.map((step) => step.id)).toEqual(['tools', 'source', 'build', 'model', 'verify', 'done']);
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
      expect(launchScript).toContain('write_status running tools');
      expect(launchScript).toContain('Missing required tools');
      expect(launchScript).toContain('Downloading DeepSeek V4 Flash');
      expect(launchScript).toContain('./download_model.sh');
      expect(launchScript).toContain('q2-imatrix');
      expect(launchScript).toContain('ds4flash.gguf');
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
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValueOnce(new Error('offline'))
          .mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 'deepseek-v4-flash' }] }),
          }),
      );
      const exec = vi.fn(async (input: { args?: string[] }) => {
        const command = input.args?.join(' ') ?? '';
        if (command.includes('kill -0')) return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        return { stdout: '54321\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      });
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        storage: {
          get: vi.fn(async (key: string) =>
            key === 'settings' ? { shellCompression: 'rtk', contextWindow: 262144, maxTokens: 131072, kvDiskSpaceMb: 16384 } : null,
          ),
          put: vi.fn(async () => ({ ok: true })),
          delete: vi.fn(async () => ({ ok: true, deleted: true })),
        },
        shell: { exec, spawn: vi.fn() },
      });

      const result = await backend.startServer({ timeoutMs: 0 }, context);

      expect(result.started).toBe(true);
      expect(context.storage.put).toHaveBeenCalledWith('runtime/serverPid', 54321);
      const launchScript = exec.mock.calls.find(([input]) => (input.args?.join(' ') ?? '').includes('ds4-server'))?.[0].args?.join(' ');
      expect(launchScript).toContain('--ctx 262144');
      expect(launchScript).toContain('--kv-disk-space-mb 16384');
      expect(launchScript).toContain(path.join(dir, 'runtime'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('switches the active slot and restarts when a different DS4 model is selected', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      await mkdir(path.join(dir, 'runtime', 'ds4', 'gguf'), { recursive: true });
      await writeFile(path.join(dir, 'runtime', 'ds4', 'ds4-server'), '#!/bin/sh\n', 'utf8');
      await writeFile(path.join(dir, 'runtime', 'ds4', 'gguf', 'DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf'), '', 'utf8');
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 'deepseek-v4-flash' }] }),
          })
          .mockRejectedValueOnce(new Error('offline'))
          .mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 'deepseek-v4-flash-spark-mini-q2-reap' }] }),
          }),
      );
      let oldRunning = true;
      const exec = vi.fn(async (input: { args?: string[] }) => {
        const command = input.args?.join(' ') ?? '';
        if (command.includes('kill -0')) return { stdout: oldRunning ? 'yes\n' : '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        if (command.includes('kill -TERM')) {
          oldRunning = false;
          return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        }
        return { stdout: '67890\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      });
      const stored: Record<string, unknown> = {
        settings: {
          activeModelSlotId: 'default',
          modelSlots: [
            {
              id: 'default',
              enabled: true,
              modelId: 'deepseek-v4-flash',
              name: 'DeepSeek V4 Flash',
              filename: 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf',
              downloadVariant: 'q2-imatrix',
            },
            {
              id: 'spark-mini-q2-reap',
              enabled: true,
              modelId: 'deepseek-v4-flash-spark-mini-q2-reap',
              name: 'DeepSeek V4 Flash Spark Mini Q2 REAP',
              filename: 'DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf',
            },
          ],
        },
        'runtime/serverPid': 12345,
        'runtime/serverSlotId': 'default',
      };
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        storage: {
          get: vi.fn(async (key: string) => stored[key] ?? null),
          put: vi.fn(async (key: string, value: unknown) => {
            stored[key] = value;
            return { ok: true };
          }),
          delete: vi.fn(async () => ({ ok: true, deleted: true })),
        },
        shell: { exec, spawn: vi.fn() },
      });

      const result = await backend.startServer({ model: 'deepseek-v4-flash-spark-mini-q2-reap', timeoutMs: 0 }, context);

      expect(result.started).toBe(true);
      expect(context.storage.put).toHaveBeenCalledWith('runtime/serverPid', 0);
      expect(context.storage.put).toHaveBeenCalledWith('settings', expect.objectContaining({ activeModelSlotId: 'spark-mini-q2-reap' }));
      expect(context.storage.put).toHaveBeenCalledWith('runtime/serverSlotId', 'spark-mini-q2-reap');
      expect(exec.mock.calls.some(([input]) => (input.args?.join(' ') ?? '').includes('DeepSeek-V4-Flash-Spark-Mini-Q2-REAP-ds4.gguf'))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails startup when the managed server never becomes reachable', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      await mkdir(path.join(dir, 'runtime', 'ds4', 'gguf'), { recursive: true });
      await writeFile(path.join(dir, 'runtime', 'ds4', 'ds4-server'), '#!/bin/sh\n', 'utf8');
      await writeFile(
        path.join(dir, 'runtime', 'ds4', 'gguf', 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf'),
        '',
        'utf8',
      );
      await writeFile(path.join(dir, 'runtime', 'server.log'), 'load failed\n', 'utf8');
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

      await expect(backend.startServer({ timeoutMs: 0 }, context)).rejects.toThrow(/did not become reachable[\s\S]*load failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('stops the managed ds4-server gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    let running = true;
    const exec = vi.fn(async (input: { args?: string[] }) => {
      const command = input.args?.join(' ') ?? '';
      if (command.includes('kill -0')) return { stdout: running ? 'yes\n' : '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      if (command.includes('kill -TERM')) running = false;
      return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
    });
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) => (key === 'runtime/serverPid' ? 54321 : null)),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
      shell: { exec, spawn: vi.fn() },
    });

    const result = await backend.stopServer({}, context);

    expect(result.stopped).toBe(true);
    expect(result.graceful).toBe(true);
    expect(exec.mock.calls.some(([input]) => (input.args?.join(' ') ?? '').includes('kill -TERM 54321'))).toBe(true);
    expect(exec.mock.calls.some(([input]) => (input.args?.join(' ') ?? '').includes('kill -KILL 54321'))).toBe(false);
    expect(context.storage.put).toHaveBeenCalledWith('runtime/serverPid', 0);
  });

  it('declares a lifecycle service that stays healthy until shutdown cleanup runs', async () => {
    await expect(backend.runtimeService()).resolves.toEqual({ ok: true });
    await expect(backend.runtimeServiceHealth()).resolves.toEqual({ running: true });
  });

  it('reveals runtime paths and clears the KV cache from settings actions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-runtime-'));
    try {
      await mkdir(path.join(dir, 'runtime', 'kv-cache'), { recursive: true });
      await writeFile(path.join(dir, 'runtime', 'kv-cache', 'cache.bin'), 'cache', 'utf8');
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      const exec = vi.fn(async (input: { command?: string; args?: string[] }) => {
        const command = input.args?.join(' ') ?? '';
        if (command.includes('kill -0')) return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        return { stdout: '', stderr: '', command: input.command ?? 'open', args: input.args ?? [], executionWrappers: [] };
      });
      const context = ctx({
        filesystem: { app: vi.fn(async () => ({ root: { path: dir } })) },
        shell: { exec, spawn: vi.fn() },
      });

      await backend.revealRuntimeFolder({}, context);
      await backend.revealModelFile({}, context);
      const cleared = await backend.clearKvCache({}, context);

      expect(exec).toHaveBeenCalledWith({ command: 'open', args: [path.join(dir, 'runtime')] });
      expect(exec).toHaveBeenCalledWith({ command: 'open', args: ['-R', path.join(dir, 'runtime', 'ds4', 'gguf')] });
      await expect(stat(path.join(dir, 'runtime', 'kv-cache', 'cache.bin'))).rejects.toThrow();
      expect(cleared.path).toBe(path.join(dir, 'runtime', 'kv-cache'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('stores RTK shell compression settings and verifies the token killer binary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const exec = vi.fn(async (input: { args?: string[] }) => {
      const command = input.args?.join('\n') ?? '';
      if (command.includes('command -v rtk')) {
        return {
          stdout: 'installed=yes\npath=/opt/homebrew/bin/rtk\nversion=rtk 0.28.2\ngain_exit=0\ngain=Saved 100 tokens\n',
          stderr: '',
          command: 'sh',
          args: [],
          executionWrappers: [],
        };
      }
      return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
    });
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) => (key === 'settings' ? { shellCompression: 'rtk' } : null)),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
      shell: { exec, spawn: vi.fn() },
    });

    const current = await backend.getSettings({}, context);
    const saved = await backend.saveSettings({ shellCompression: 'off' }, context);

    expect(current.settings).toEqual(expect.objectContaining({
      shellCompression: 'rtk',
      contextWindow: 1000000,
      maxTokens: 384000,
      kvDiskSpaceMb: 8192,
      directCoreTools: true,
      progressiveSkills: true,
      compactSkillPrompt: true,
      agentsPointers: true,
      activeModelSlotId: 'default',
    }));
    expect(current.settings.modelSlots.length).toBeGreaterThanOrEqual(2);
    expect(current.status.runtime.rtk).toEqual(
      expect.objectContaining({ installed: true, valid: true, path: '/opt/homebrew/bin/rtk', version: 'rtk 0.28.2' }),
    );
    expect(saved.settings).toEqual(expect.objectContaining({
      shellCompression: 'off',
      contextWindow: 1000000,
      maxTokens: 384000,
      kvDiskSpaceMb: 8192,
      directCoreTools: true,
      progressiveSkills: true,
      compactSkillPrompt: true,
      agentsPointers: true,
      activeModelSlotId: 'default',
    }));
    expect(context.storage.put).toHaveBeenCalledWith('settings', expect.objectContaining({
      shellCompression: 'off',
      contextWindow: 1000000,
      maxTokens: 384000,
      kvDiskSpaceMb: 8192,
      directCoreTools: true,
      progressiveSkills: true,
      compactSkillPrompt: true,
      agentsPointers: true,
      activeModelSlotId: 'default',
    }));
  });

  it('lets the DS4 CLI disable shell compression', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    const stdout = { write: vi.fn() };
    const context = ctx({ stdio: { stdout } });

    await backend.ds4ToolsCli({ args: ['compression', 'off'] }, context as never);

    expect(context.storage.put).toHaveBeenCalledWith('settings', expect.objectContaining({
      shellCompression: 'off',
      contextWindow: 1000000,
      maxTokens: 384000,
      kvDiskSpaceMb: 8192,
      directCoreTools: true,
      progressiveSkills: true,
      compactSkillPrompt: true,
      agentsPointers: true,
      activeModelSlotId: 'default',
    }));
    expect(stdout.write.mock.calls[0]?.[0]).toContain('Shell compression disabled');
  });

  it('installs RTK through the upstream installer and refreshes status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const exec = vi.fn(async (input: { args?: string[] }) => {
      const command = input.args?.join('\n') ?? '';
      if (command.includes('install.sh')) return { stdout: 'Saved 100 tokens\n', stderr: '', command: 'sh', args: [], executionWrappers: [] };
      if (command.includes('command -v rtk')) {
        return {
          stdout: 'installed=yes\npath=/Users/patrick/.local/bin/rtk\nversion=rtk 0.28.2\ngain_exit=0\ngain=Saved 100 tokens\n',
          stderr: '',
          command: 'sh',
          args: [],
          executionWrappers: [],
        };
      }
      return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
    });
    const context = ctx({ shell: { exec, spawn: vi.fn() } });

    const result = await backend.installRtk({}, context);

    expect(exec).toHaveBeenCalledWith({
      command: 'sh',
      args: [
        '-lc',
        'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh && export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH" && rtk gain',
      ],
    });
    expect(result.status.runtime.rtk).toEqual(
      expect.objectContaining({ installed: true, valid: true, path: '/Users/patrick/.local/bin/rtk' }),
    );
  });
});

describe('DS4 agent profile activation', () => {
  it('keeps only DS4 core tools active when the DS4 profile is active', () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    backend.createDs4AgentExtension()({
      on: (event: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(event, handler),
      registerBashProcessWrapper: vi.fn(),
    } as never);
    const calls: string[][] = [];

    handlers.get('session_start')?.(
      {},
      {
        getActiveTools: () => ['artifact', 'google_search', 'write', 'bash_status'],
        setActiveTools: (tools: string[]) => calls.push(tools),
        modelProfile: { kind: 'resolved', profile: { extensionId: 'system-ds4', id: 'ds4-compatible' } },
      },
    );

    expect(calls).toEqual([['bash', 'read', 'edit']]);
  });

  it('does not force DS4 core tools when the direct tool intervention is disabled', () => {
    const previousTools = process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
    process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = '0';
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    backend.createDs4AgentExtension()({
      on: (event: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(event, handler),
      registerBashProcessWrapper: vi.fn(),
    } as never);
    const setActiveTools = vi.fn();

    try {
      handlers.get('session_start')?.(
        {},
        {
          getActiveTools: () => ['artifact'],
          setActiveTools,
          modelProfile: { kind: 'resolved', profile: { extensionId: 'system-ds4', id: 'ds4-compatible' } },
        },
      );

      expect(setActiveTools).not.toHaveBeenCalled();
    } finally {
      if (previousTools === undefined) delete process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
      else process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = previousTools;
    }
  });

  it('adds the DS4 CLI to bash PATH for DS4 sessions', () => {
    const registerBashProcessWrapper = vi.fn();

    backend.createDs4AgentExtension()({
      on: vi.fn(),
      registerBashProcessWrapper,
    } as never);

    expect(registerBashProcessWrapper).toHaveBeenCalledWith('system-ds4-cli', expect.any(Function), { label: 'DS4 CLI' });
    const wrap = registerBashProcessWrapper.mock.calls[0]?.[1] as (context: {
      command: string;
      args: string[];
      env: NodeJS.ProcessEnv;
      wrappers: Array<{ id: string }>;
    }) => { command: string; args: string[]; env: NodeJS.ProcessEnv };
    const result = wrap({ command: 'sh', args: ['-lc', 'ds4 help'], env: { PATH: '/usr/bin' }, wrappers: [] });
    expect(result.env.PATH).toContain('/usr/bin');
    expect(result.env.PATH).toContain('bin');
    expect(result.env.DS4_CLI_BIN).toContain('ds4');
    expect(result.args).toEqual(['-lc', 'ds4 help']);

    const rtkResult = wrap({
      command: 'sh',
      args: ['-lc', 'git status --short'],
      env: { PATH: '/usr/bin', NEON_PILOT_DS4_RTK_SHELL_COMPRESSION: 'rtk' },
      wrappers: [],
    });
    expect(rtkResult.args[1]).toContain('rtk git status --short');
  });

  it('compacts prompt assembly for DS4 only', async () => {
    const plan = {
      skills: { skillPaths: ['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent'], inlineSkills: [{ id: 'x' }] },
      tools: { activeToolNames: ['bash', 'write', 'google_search', 'list', 'ds4_capabilities'] },
      instructions: {
        layers: [
          { id: 'agents:/Users/patrick/AGENTS.md', title: 'AGENTS.md', content: 'very long global instructions', source: { label: '/Users/patrick/AGENTS.md' } },
          { id: 'runtime:generated-system-template', title: 'Generated', content: 'keep me', source: { label: 'runtime' } },
        ],
      },
      diagnostics: [],
    };

    const result = await backend.optimizePromptAssembly({ plan, context: { modelRef: 'ds4/deepseek-v4-flash' } });

    expect(result.plan.skills.skillPaths).toEqual(['/extensions/system-ds4/skills/ds4-local-agent']);
    expect(result.plan.skills.inlineSkills).toEqual([]);
    expect(result.plan.tools.activeToolNames).toEqual(['bash']);
    expect(result.plan.instructions.layers[0].content).toContain('Full instructions are available');
    expect(result.plan.instructions.layers[1].content).toBe('keep me');
  });

  it('can disable individual DS4 prompt assembly interventions', async () => {
    const previousTools = process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
    const previousSkills = process.env.NEON_PILOT_DS4_COMPACT_SKILL_PROMPT;
    const previousAgents = process.env.NEON_PILOT_DS4_AGENTS_POINTERS;
    process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = '0';
    process.env.NEON_PILOT_DS4_COMPACT_SKILL_PROMPT = '0';
    process.env.NEON_PILOT_DS4_AGENTS_POINTERS = '0';
    const plan = {
      skills: { skillPaths: ['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent'], inlineSkills: [{ id: 'x' }] },
      tools: { activeToolNames: ['bash', 'write', 'google_search'] },
      instructions: { layers: [{ id: 'agents:/Users/patrick/AGENTS.md', title: 'AGENTS.md', content: 'very long global instructions' }] },
      diagnostics: [],
    };

    try {
      const result = await backend.optimizePromptAssembly({ plan, context: { modelRef: 'ds4/deepseek-v4-flash' } });

      expect(result.plan.skills.skillPaths).toEqual(['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent']);
      expect(result.plan.skills.inlineSkills).toEqual([{ id: 'x' }]);
      expect(result.plan.tools.activeToolNames).toEqual(['bash', 'write', 'google_search']);
      expect(result.plan.instructions.layers[0].content).toBe('very long global instructions');
    } finally {
      if (previousTools === undefined) delete process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
      else process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = previousTools;
      if (previousSkills === undefined) delete process.env.NEON_PILOT_DS4_COMPACT_SKILL_PROMPT;
      else process.env.NEON_PILOT_DS4_COMPACT_SKILL_PROMPT = previousSkills;
      if (previousAgents === undefined) delete process.env.NEON_PILOT_DS4_AGENTS_POINTERS;
      else process.env.NEON_PILOT_DS4_AGENTS_POINTERS = previousAgents;
    }
  });

  it('leaves DS4 prompt assembly unmodified in baseline optimization mode', async () => {
    const previousMode = process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE;
    process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE = 'baseline';
    const plan = {
      skills: { skillPaths: ['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent'], inlineSkills: [{ id: 'x' }] },
      tools: { activeToolNames: ['bash', 'write', 'google_search'] },
      instructions: { layers: [{ id: 'agents:/Users/patrick/AGENTS.md', title: 'AGENTS.md', content: 'very long global instructions' }] },
      diagnostics: [],
    };

    try {
      const result = await backend.optimizePromptAssembly({ plan, context: { modelRef: 'ds4/deepseek-v4-flash' } });

      expect(result.plan).toBe(plan);
      expect(result.plan.skills.skillPaths).toEqual(['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent']);
      expect(result.plan.tools.activeToolNames).toEqual(['bash', 'write', 'google_search']);
      expect(result.plan.instructions.layers[0].content).toBe('very long global instructions');
    } finally {
      if (previousMode === undefined) delete process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE;
      else process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE = previousMode;
    }
  });

  it('leaves opencode DeepSeek V4 Flash prompt assembly unmodified', async () => {
    const plan = {
      skills: { skillPaths: ['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent'], inlineSkills: [{ id: 'x' }] },
      tools: { activeToolNames: ['bash', 'write', 'google_search'] },
      instructions: { layers: [{ id: 'agents:/Users/patrick/AGENTS.md', title: 'AGENTS.md', content: 'very long global instructions' }] },
      diagnostics: [],
    };

    const result = await backend.optimizePromptAssembly({ plan, context: { provider: 'opencode-go', modelRef: 'opencode-go/deepseek-v4-flash' } });

    expect(result.plan).toBe(plan);
    expect(result.plan.tools.activeToolNames).toEqual(['bash', 'write', 'google_search']);
    expect(result.plan.instructions.layers[0].content).toBe('very long global instructions');
  });

  it('leaves opencode DeepSeek V4 Flash unmodified when prompt context has a bare model id', async () => {
    const plan = {
      skills: { skillPaths: ['/skills/a', '/extensions/system-ds4/skills/ds4-local-agent'], inlineSkills: [{ id: 'x' }] },
      tools: { activeToolNames: ['bash', 'write', 'google_search'] },
      instructions: { layers: [{ id: 'agents:/Users/patrick/AGENTS.md', title: 'AGENTS.md', content: 'very long global instructions' }] },
      diagnostics: [],
    };

    const result = await backend.optimizePromptAssembly({ plan, context: { provider: 'opencode-go', modelRef: 'deepseek-v4-flash' } });

    expect(result.plan).toBe(plan);
    expect(result.plan.skills.inlineSkills).toEqual([{ id: 'x' }]);
    expect(result.plan.tools.activeToolNames).toEqual(['bash', 'write', 'google_search']);
    expect(result.plan.instructions.layers[0].content).toBe('very long global instructions');
  });
});

describe('DS4 tool CLI gateway', () => {
  it('lists active undisclosed extension tools through the host tool gateway', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    backendTools.listInvocableExtensionTools.mockResolvedValueOnce([
      {
        name: 'web_search',
        description: 'Search the web',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'integer' } }, required: ['query'] },
        source: { extensionId: 'system-duckduckgo-search', toolId: 'search' },
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['tools'] }, ctx({ stdio: { stdout } }) as never);

    expect(backendTools.listInvocableExtensionTools).toHaveBeenCalledWith({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      modelRef: 'ds4/deepseek-v4-flash',
      directToolNames: ['bash', 'read', 'edit'],
    });
    expect(stdout.write.mock.calls[0]?.[0]).toContain('web_search (system-duckduckgo-search/search)');
  });

  it('invokes a named extension tool with JSON input and DS4 session context', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    backendTools.listInvocableExtensionTools.mockResolvedValueOnce([
      {
        name: 'web_search',
        description: 'Search the web',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ]);
    const stdout = { write: vi.fn() };
    const context = ctx({
      stdio: {
        stdin: Readable.from(['{"query":"hello"}']),
        stdout,
      },
      toolContext: undefined,
    });
    process.env.NEON_PILOT_SOURCE_CONVERSATION_ID = 'conversation-env';
    process.env.NEON_PILOT_SOURCE_SESSION_FILE = '/sessions/env.jsonl';

    try {
      await backend.ds4ToolsCli({ args: ['call', 'web_search', '--stdin'] }, context as never);
    } finally {
      delete process.env.NEON_PILOT_SOURCE_CONVERSATION_ID;
      delete process.env.NEON_PILOT_SOURCE_SESSION_FILE;
    }

    expect(backendTools.invokeToolByName).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'web_search',
        input: { query: 'hello' },
        toolContext: expect.objectContaining({
          conversationId: 'conversation-env',
          sessionFile: '/sessions/env.jsonl',
        }),
      }),
    );
    expect(stdout.write.mock.calls[0]?.[0]).toBe('ok\n');
  });

  it('lists and searches skills through the DS4 CLI instead of prompt-injecting skill paths', async () => {
    backend.__setDs4SkillsApiForTest(backendSkills);
    backendSkills.buildSkillInventoryAsync.mockResolvedValueOnce([
      {
        id: 'browser',
        title: 'Browser',
        description: 'Use browser automation.',
        enabled: true,
        source: { kind: 'extension', label: 'system-browser' },
        location: { kind: 'file', path: '/skills/browser/SKILL.md' },
      },
      {
        id: 'disabled',
        description: 'Hidden skill',
        enabled: false,
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['skills', 'search', 'browser'] }, ctx({ stdio: { stdout } }) as never);

    expect(backendSkills.buildSkillInventoryAsync).toHaveBeenCalledWith({ runtimeScope: 'shared', repoRoot: '/repo' });
    expect(stdout.write.mock.calls[0]?.[0]).toContain('browser (system-browser)');
    expect(stdout.write.mock.calls[0]?.[0]).not.toContain('disabled');
  });

  it('discovers the built-in dynamic workflow skill through the DS4 CLI', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-workflow-skill-'));
    const skillFile = path.join(dir, 'SKILL.md');
    await writeFile(skillFile, '---\nname: dynamic-workflows\ndescription: Use the workflow tool.\n---\n\nNo module exports. Use workflow.finish().', 'utf8');
    backend.__setDs4SkillsApiForTest(backendSkills);
    backendSkills.buildSkillInventoryAsync
      .mockResolvedValueOnce([
        {
          id: 'dynamic-workflows',
          title: 'Dynamic Workflows',
          description: 'Built-in guidance for using the workflow tool.',
          enabled: true,
          source: { kind: 'extension', label: 'system-dynamic-workflows', extensionId: 'system-dynamic-workflows' },
          location: { kind: 'file', path: skillFile },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'dynamic-workflows',
          title: 'Dynamic Workflows',
          description: 'Built-in guidance for using the workflow tool.',
          enabled: true,
          source: { kind: 'extension', label: 'system-dynamic-workflows', extensionId: 'system-dynamic-workflows' },
          location: { kind: 'file', path: skillFile },
        },
      ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['skills', 'search', 'workflow'] }, ctx({ stdio: { stdout } }) as never);
    await backend.ds4ToolsCli({ args: ['skills', 'get', 'dynamic-workflows'] }, ctx({ stdio: { stdout } }) as never);

    expect(stdout.write.mock.calls[0]?.[0]).toContain('dynamic-workflows (system-dynamic-workflows)');
    expect(stdout.write.mock.calls[1]?.[0]).toContain('No module exports. Use workflow.finish().');
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a matching skill body through the DS4 CLI', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-skill-'));
    const skillFile = path.join(dir, 'SKILL.md');
    await writeFile(skillFile, '---\nname: Browser\n---\n\nUse the browser carefully.', 'utf8');
    backend.__setDs4SkillsApiForTest(backendSkills);
    backendSkills.buildSkillInventoryAsync.mockResolvedValueOnce([
      {
        id: 'browser',
        title: 'Browser',
        description: 'Use browser automation.',
        enabled: true,
        location: { kind: 'file', path: skillFile },
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['skills', 'get', 'browser'] }, ctx({ stdio: { stdout } }) as never);

    expect(stdout.write.mock.calls[0]?.[0]).toContain('Path:');
    expect(stdout.write.mock.calls[0]?.[0]).toContain('Use the browser carefully.');
    await rm(dir, { recursive: true, force: true });
  });

  it('uses protocol-provided tool context when the Rust CLI forwards bash environment metadata', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    backendTools.listInvocableExtensionTools.mockResolvedValueOnce([
      {
        name: 'artifact',
        source: { extensionId: 'system-artifacts', toolId: 'artifact' },
        description: 'Artifact tool',
        inputSchema: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] },
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli(
      {
        args: ['artifact', '--json', '{"action":"list"}'],
        toolContext: {
          conversationId: 'conversation-from-cli',
          sessionId: 'conversation-from-cli',
          sessionFile: '/sessions/from-cli.jsonl',
        },
      },
      ctx({ stdio: { stdout }, toolContext: undefined }) as never,
    );

    expect(backendTools.invokeToolByName).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'artifact',
        input: { action: 'list', conversationId: 'conversation-from-cli' },
        toolContext: expect.objectContaining({
          conversationId: 'conversation-from-cli',
          sessionId: 'conversation-from-cli',
          sessionFile: '/sessions/from-cli.jsonl',
        }),
      }),
    );
  });

  it('converts tool schemas into CLI flags before invoking tools', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    backendTools.listInvocableExtensionTools.mockResolvedValueOnce([
      {
        name: 'web_search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'integer', description: 'Result count' },
          },
          required: ['query'],
        },
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['web_search', '--query', 'hello', '--count', '5'] }, ctx({ stdio: { stdout } }) as never);

    expect(backendTools.invokeToolByName).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'web_search',
        input: { query: 'hello', count: 5 },
      }),
    );
  });

  it('prints generated per-tool CLI help from the schema', async () => {
    backend.__setDs4ToolsApiForTest(backendTools);
    backendTools.listInvocableExtensionTools.mockResolvedValueOnce([
      {
        name: 'web_search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'integer', description: 'Result count' },
          },
          required: ['query'],
        },
      },
    ]);
    const stdout = { write: vi.fn() };

    await backend.ds4ToolsCli({ args: ['help', 'web_search'] }, ctx({ stdio: { stdout } }) as never);

    const output = stdout.write.mock.calls[0]?.[0] as string;
    expect(output).toContain('Usage: ds4 web_search [flags]');
    expect(output).toContain('--query <string> required');
    expect(output).toContain('--count <integer>');
  });
});

describe('DS4 file tools', () => {
  it('supports compact chunk reads, raw reads, and compact directory listing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-extension-'));
    try {
      await writeFile(path.join(dir, 'sample.txt'), 'one\ntwo\nthree\nfour\n', 'utf8');
      const context = ctx({ runtime: { getRepoRoot: () => dir }, toolContext: { conversationId: 'conversation-1', cwd: dir } });

      const readResult = await backend.read({ path: 'sample.txt', start_line: 2, max_lines: 2 }, context);
      const rawResult = await backend.read({ path: 'sample.txt', raw: true, start_line: 2, max_lines: 2 }, context);
      const listResult = await backend.list({ path: '.' }, context);

      expect(readResult.text).toBe('2|two\n3|three');
      expect(readResult.details).toEqual(expect.objectContaining({ format: 'compact-line-gutter', startLine: 2, shownLines: 2 }));
      expect(rawResult.text).toBe('two\nthree');
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

  it('continues compact reads with more', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds4-extension-'));
    try {
      await writeFile(path.join(dir, 'sample.txt'), 'one\ntwo\nthree\nfour\n', 'utf8');
      const storageState = new Map<string, unknown>();
      const context = ctx({
        runtime: { getRepoRoot: () => dir },
        toolContext: { conversationId: 'conversation-1', cwd: dir },
        storage: {
          get: vi.fn(async (key: string) => storageState.get(key) ?? null),
          put: vi.fn(async (key: string, value: unknown) => {
            storageState.set(key, value);
            return { ok: true };
          }),
          delete: vi.fn(async (key: string) => {
            storageState.delete(key);
            return { ok: true, deleted: true };
          }),
        },
      });

      await backend.read({ path: 'sample.txt', start_line: 1, max_lines: 2 }, context);
      const result = await backend.more({ count: 2 }, context);

      expect(result.text).toBe('3|three\n4|four');
      expect(context.storage.put).toHaveBeenLastCalledWith(
        'read-state:conversation-1',
        expect.objectContaining({ path: 'sample.txt', nextLine: 5, count: 2 }),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('DS4 bash jobs', () => {
  it('auto-wraps simple supported bash commands with RTK when enabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const spawn = vi.fn(async () => ({ pid: 42, usingPty: false, executionWrappers: [], kill: vi.fn(), write: vi.fn(), resize: vi.fn() }));
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) => (key === 'settings' ? { shellCompression: 'rtk' } : null)),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
      shell: {
        exec: vi.fn(async (input: { args?: string[] }) => {
          const command = input.args?.join('\n') ?? '';
          if (command.includes('command -v rtk')) {
            return {
              stdout: 'installed=yes\npath=/opt/homebrew/bin/rtk\nversion=rtk 0.28.2\ngain_exit=0\ngain=Saved 100 tokens\n',
              stderr: '',
              command: 'sh',
              args: [],
              executionWrappers: [],
            };
          }
          return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        }),
        spawn,
      },
    });

    await backend.bash({ command: 'git status --short', refresh_sec: 0.001 }, context);

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ args: ['-lc', 'rtk git status --short'] }));
  });

  it('enables RTK wrapping by default when RTK is available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const exec = vi.fn(async (input: { args?: string[] }) => {
      const command = input.args?.join('\n') ?? '';
      if (command.includes('command -v rtk')) {
        return {
          stdout: 'installed=yes\npath=/opt/homebrew/bin/rtk\nversion=rtk 0.28.2\ngain_exit=0\ngain=Saved 100 tokens\n',
          stderr: '',
          command: 'sh',
          args: [],
          executionWrappers: [],
        };
      }
      return { stdout: 'ok', stderr: '', command: 'sh', args: [], executionWrappers: [] };
    });
    const context = ctx({
      storage: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
      shell: {
        exec,
        spawn: vi.fn(),
      },
    });

    await backend.bash({ command: 'git status --short' }, context);

    expect(exec).toHaveBeenCalledWith(expect.objectContaining({ args: ['-lc', 'rtk git status --short'] }));
  });

  it('passes conversation metadata to synchronous bash commands so the ds4 CLI can call conversation-scoped tools', async () => {
    const exec = vi.fn(async () => ({ stdout: 'ok', stderr: '', command: 'sh', args: [], executionWrappers: [] }));
    const context = ctx({
      shell: {
        exec,
        spawn: vi.fn(),
      },
      toolContext: {
        conversationId: 'conversation-1',
        sessionFile: '/sessions/conversation-1.jsonl',
        cwd: '/repo',
      },
    });

    await backend.bash({ command: 'ds4 artifact --json \'{"action":"list"}\'' }, context);

    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          NEON_PILOT_SOURCE_CONVERSATION_ID: 'conversation-1',
          NEON_PILOT_SOURCE_SESSION_FILE: '/sessions/conversation-1.jsonl',
        },
      }),
    );
  });

  it('leaves complex shell commands unwrapped even when RTK is enabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const spawn = vi.fn(async () => ({ pid: 42, usingPty: false, executionWrappers: [], kill: vi.fn(), write: vi.fn(), resize: vi.fn() }));
    const context = ctx({
      storage: {
        get: vi.fn(async (key: string) => (key === 'settings' ? { shellCompression: 'rtk' } : null)),
        put: vi.fn(async () => ({ ok: true })),
        delete: vi.fn(async () => ({ ok: true, deleted: true })),
      },
      shell: {
        exec: vi.fn(async (input: { args?: string[] }) => {
          const command = input.args?.join('\n') ?? '';
          if (command.includes('command -v rtk')) {
            return {
              stdout: 'installed=yes\npath=/opt/homebrew/bin/rtk\nversion=rtk 0.28.2\ngain_exit=0\ngain=Saved 100 tokens\n',
              stderr: '',
              command: 'sh',
              args: [],
              executionWrappers: [],
            };
          }
          return { stdout: '', stderr: '', command: 'sh', args: [], executionWrappers: [] };
        }),
        spawn,
      },
    });

    await backend.bash({ command: 'git status --short && git diff --stat', refresh_sec: 0.001 }, context);

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ args: ['-lc', 'git status --short && git diff --stat'] }));
  });

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

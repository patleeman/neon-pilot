import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

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
        contextWindow: 100000,
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
      models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }],
    });
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
          modelBytes: 0,
          tools: expect.any(Object),
          rtk: expect.objectContaining({ installed: false, valid: false }),
        }),
      );
      expect(result.settings).toEqual({ shellCompression: 'off' });
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
      expect(launchScript).toContain('Downloading DeepSeek V4 Flash model');
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

    expect(current.settings).toEqual({ shellCompression: 'rtk' });
    expect(current.status.runtime.rtk).toEqual(
      expect.objectContaining({ installed: true, valid: true, path: '/opt/homebrew/bin/rtk', version: 'rtk 0.28.2' }),
    );
    expect(saved.settings).toEqual({ shellCompression: 'off' });
    expect(context.storage.put).toHaveBeenCalledWith('settings', { shellCompression: 'off' });
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
        modelProfile: { kind: 'resolved', profile: { id: 'ds4-compatible' } },
      },
    );

    expect(calls).toEqual([['bash', 'read', 'edit', 'subagent']]);
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

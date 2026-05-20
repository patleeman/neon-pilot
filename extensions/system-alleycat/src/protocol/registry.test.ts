import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionState } from '../codexJsonRpcServer.js';
import { REGISTERED_HANDLERS } from './index.js';

function conn(): ConnectionState {
  return { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set(), transportAuthenticated: true };
}

interface SpawnInput {
  onStdout?: (chunk: string) => void;
  onExit?: (event: { code: number; signal: string | null }) => void;
}

function ctx(): ExtensionBackendContext {
  const storage = new Map<string, unknown>();
  return {
    runtime: { getRepoRoot: () => process.cwd() },
    models: { list: async () => [{ id: 'gpt-test', name: 'GPT Test', supportedReasoningEfforts: ['low'] }] },
    storage: {
      get: vi.fn(async (key: string) => storage.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
        return { ok: true };
      }),
      delete: vi.fn(async (key: string) => {
        storage.delete(key);
        return { ok: true };
      }),
      list: vi.fn(async (prefix: string) =>
        [...storage.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })),
      ),
    },
    conversations: {
      sendMessage: vi.fn(async () => ({ ok: true })),
      appendTranscriptBlock: vi.fn(async () => ({ ok: true })),
      subscribe: vi.fn(() => undefined),
    },
    shell: {
      exec: vi.fn(async () => ({ stdout: 'ok\n', stderr: '', exitCode: 7 })),
      spawn: vi.fn(async ({ onStdout, onExit }: SpawnInput) => {
        onStdout?.('spawned\n');
        onExit?.({ code: 0, signal: null });
        return { pid: 123, kill: vi.fn(), executionWrappers: [] };
      }),
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as ExtensionBackendContext;
}

async function call(method: string, params: unknown, context = ctx(), notify = vi.fn()) {
  const handler = REGISTERED_HANDLERS[method];
  expect(handler, `${method} should be registered`).toBeTypeOf('function');
  return await handler(params, context, conn(), notify);
}

describe('system-alleycat protocol registry compatibility surface', () => {
  let tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
    tempDirs = [];
  });

  it('keeps the mobile-facing discovery/config/model/account/app surfaces renderable', async () => {
    await expect(call('initialize', { clientInfo: { name: 'kitty' } })).resolves.toMatchObject({ capabilities: { streams: true } });
    await expect(call('model/list', {})).resolves.toMatchObject({ data: [{ id: 'gpt-test' }] });
    await expect(call('modelProvider/capabilities/read', {})).resolves.toMatchObject({ capabilities: { supportsVision: true } });
    await expect(call('account/read', {})).resolves.toMatchObject({ account: { type: 'apiKey' }, requiresOpenaiAuth: false });
    await expect(call('account/rateLimits/read', {})).resolves.toMatchObject({ rateLimits: { limitId: 'neon-pilot' } });
    await expect(call('config/read', { cwd: '/root', includeLayers: true })).resolves.toMatchObject({
      config: { model_provider: 'neon-pilot' },
      layers: [],
    });
    await expect(call('configRequirements/read', {})).resolves.toMatchObject({ requirements: [] });
    await expect(call('app/list', {})).resolves.toMatchObject({ data: [{ id: 'neon-pilot', available: true }], nextCursor: null });
    await expect(call('skills/list', { cwd: process.cwd() })).resolves.toMatchObject({ data: expect.any(Array) });
  });

  it('keeps filesystem and command hooks operational for mobile file picker and shell actions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alleycat-registry-'));
    tempDirs.push(dir);
    const file = join(dir, 'hello.txt');

    await expect(call('fs/createDirectory', { path: join(dir, 'sub') })).resolves.toEqual({});
    await expect(call('fs/writeFile', { path: file, dataBase64: Buffer.from('hello').toString('base64') })).resolves.toEqual({});
    await expect(call('fs/readFile', { path: file })).resolves.toMatchObject({ dataBase64: Buffer.from('hello').toString('base64') });
    await expect(call('fs/getMetadata', { path: file })).resolves.toMatchObject({ isFile: true });
    await expect(call('fs/readDirectory', { path: dir })).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ fileName: 'hello.txt' })]),
    });
    await expect(call('fs/fuzzyFileSearch', { roots: [dir], query: 'hello' })).resolves.toMatchObject({
      files: [expect.objectContaining({ fileName: 'hello.txt' })],
    });

    await expect(call('command/exec', { command: 'echo ok', processId: 'cmd-1' })).resolves.toMatchObject({
      processId: 'cmd-1',
      stdout: 'ok\n',
      exitCode: 7,
    });
    const notify = vi.fn();
    await expect(call('process/spawn', { command: 'echo', args: ['ok'] }, ctx(), notify)).resolves.toMatchObject({
      processId: expect.stringMatching(/^proc-/),
      pid: 123,
    });
    expect(notify).toHaveBeenCalledWith(
      'process/outputDelta',
      expect.objectContaining({ stream: 'stdout', dataBase64: Buffer.from('spawned\n').toString('base64') }),
    );
    expect(notify).toHaveBeenCalledWith('process/exited', expect.objectContaining({ code: 0, signal: null }));
  });

  it('returns explicit unsupported errors for hooks Neon Pilot cannot back yet', async () => {
    await expect(call('fs/watch', { path: process.cwd() })).rejects.toThrow('unsupported by Neon Pilot Kitty Litter bridge');
    await expect(call('mcpServer/tool/call', {})).rejects.toThrow('unsupported by Neon Pilot Kitty Litter bridge');
    await expect(call('marketplace/add', {})).rejects.toThrow('unsupported by Neon Pilot Kitty Litter bridge');
    await expect(call('feedback/upload', {})).rejects.toThrow('unsupported by Neon Pilot Kitty Litter bridge');
  });
});

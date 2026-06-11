import { PassThrough } from 'node:stream';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setNeonPilotAgentApisForTest, neonPilotAgent, neonPilotAgentCli, readSettings, updateSettings } from './backend';

function createStorage(initial: Record<string, unknown> = {}) {
  const state = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => state.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      state.set(key, value);
    }),
  };
}

function ctx(overrides: Record<string, unknown> = {}) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-test-'));
  return {
    runtime: { getRepoRoot: () => '/repo' },
    runtimeSettingsFilePath: join(tempRoot, 'runtime', 'settings.json'),
    toolContext: { cwd: '/repo', conversationId: 'conversation-1', sessionFile: '/session.jsonl' },
    storage: createStorage(),
    models: { list: vi.fn(async () => []), saveProvider: vi.fn(async () => ({})), saveProviderModel: vi.fn(async () => ({})) },
    ui: { invalidate: vi.fn() },
    ...overrides,
  } as never;
}

describe('system-neon-pilot-admin-cli agent backend', () => {
  afterEach(() => {
    __setNeonPilotAgentApisForTest({ agent: null, runs: null });
  });

  it('runs one-shot tasks through the host agent seam', async () => {
    const runAgentTask = vi.fn(async () => ({ text: 'done', model: 'gpt', provider: 'openai' }));
    __setNeonPilotAgentApisForTest({ agent: { runAgentTask } });

    await expect(neonPilotAgent({ action: 'run_task', prompt: 'Review this', tools: 'default' }, ctx())).resolves.toMatchObject({
      text: 'done',
      details: { action: 'run_task', model: 'gpt', provider: 'openai' },
    });
    expect(runAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Review this', cwd: '/repo', tools: 'default' }),
      expect.anything(),
    );
  });

  it('starts durable subagents through the durable run seam', async () => {
    const startBackgroundRun = vi.fn(async () => ({ accepted: true, runId: 'run-1', logPath: '/logs/run-1.log' }));
    __setNeonPilotAgentApisForTest({ runs: { pingDaemon: vi.fn(async () => true), startBackgroundRun } });

    await expect(
      neonPilotAgent({ action: 'subagent_start', prompt: 'Investigate flaky tests', allowedTools: 'read,bash' }, ctx()),
    ).resolves.toMatchObject({
      details: { action: 'subagent_start', runId: 'run-1', taskSlug: 'investigate-flaky-tests' },
    });
    expect(startBackgroundRun).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        agent: { prompt: 'Investigate flaky tests', allowedTools: ['read', 'bash'] },
        source: expect.objectContaining({ id: 'conversation-1', filePath: '/session.jsonl' }),
      }),
    );
  });

  it('lists simplified runs filtered by kind', async () => {
    __setNeonPilotAgentApisForTest({
      runs: {
        listDurableRuns: vi.fn(async () => ({
          runs: [
            {
              runId: 'sub-1',
              manifest: { kind: 'background-run', spec: { metadata: { taskSlug: 'probe' } } },
              status: { status: 'running' },
            },
            { runId: 'cmd-1', manifest: { kind: 'raw-shell', spec: { shellCommand: 'pnpm test' } }, status: { status: 'done' } },
          ],
        })),
      },
    });

    await expect(neonPilotAgent({ action: 'runs_list', kind: 'subagent' }, ctx())).resolves.toMatchObject({
      details: { runCount: 1, runs: [expect.objectContaining({ id: 'sub-1', kind: 'subagent', status: 'running' })] },
    });
  });

  it('persists entrypoint settings with default enabled values', async () => {
    const storage = createStorage();
    const context = ctx({ storage });

    await expect(readSettings({}, context)).resolves.toEqual({ settings: { cliEnabled: true } });
    await expect(updateSettings({ cliEnabled: false }, context)).resolves.toEqual({
      settings: { cliEnabled: false },
    });
    await expect(readSettings({}, context)).resolves.toEqual({ settings: { cliEnabled: false } });
  });

  it('maps CLI commands to agent actions', async () => {
    const stdout = new PassThrough();
    let output = '';
    stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    __setNeonPilotAgentApisForTest({ agent: { runAgentTask: vi.fn(async () => ({ text: 'ok' })) } });

    await neonPilotAgentCli({ args: ['run', '--prompt', 'Hello', '--json'] }, {
      ...ctx(),
      stdio: { stdin: new PassThrough(), stdout, stderr: new PassThrough() },
      signal: new AbortController().signal,
      protocolId: 'neon-pilot-agent',
    } as never);

    expect(JSON.parse(output)).toMatchObject({ action: 'run_task' });
  });

  it('runs bootstrap doctor with readiness checks', async () => {
    __setNeonPilotAgentApisForTest({ runs: { pingDaemon: vi.fn(async () => true) } });
    const context = ctx({
      models: { list: vi.fn(async () => [{ id: 'gpt-5.4', provider: 'openai-codex' }]) },
    });

    await neonPilotAgent({ action: 'bootstrap_defaults_set', provider: 'openai-codex', model: 'gpt-5.4' }, context);
    await expect(neonPilotAgent({ action: 'bootstrap_doctor' }, context)).resolves.toMatchObject({
      details: {
        ready: true,
        checks: {
          cliEnabled: true,
          daemon: true,
          defaultProviderConfigured: true,
          defaultModelConfigured: true,
          modelInventoryReadable: true,
        },
      },
    });
  });

  it('stores provider keys from CLI stdin without exposing the key in output details', async () => {
    const saveProvider = vi.fn(async () => ({}));
    const context = ctx({ models: { list: vi.fn(async () => []), saveProvider, saveProviderModel: vi.fn(async () => ({})) } });

    await expect(
      neonPilotAgent(
        {
          action: 'set-key',
          cli: { command: 'bootstrap provider set-key', args: ['openai'], flags: { stdin: true }, stdinText: 'sk-secret\n' },
        },
        context,
      ),
    ).resolves.toMatchObject({
      text: 'Stored credential for openai.',
      details: { action: 'bootstrap_provider_set_key', provider: 'openai', credentialStored: true },
    });
    expect(saveProvider).toHaveBeenCalledWith({ provider: 'openai', apiKey: 'sk-secret' });
  });

  it('writes runtime defaults for agent bootstrap', async () => {
    const context = ctx();
    await neonPilotAgent(
      {
        action: 'set',
        cli: {
          command: 'bootstrap defaults set',
          flags: { provider: 'openai-codex', model: 'gpt-5.4', cwd: '/Users/patrick/workingdir' },
        },
      },
      context,
    );

    expect(JSON.parse(readFileSync((context as { runtimeSettingsFilePath: string }).runtimeSettingsFilePath, 'utf-8'))).toMatchObject({
      defaultProvider: 'openai-codex',
      defaultModel: 'gpt-5.4',
      defaultCwd: '/Users/patrick/workingdir',
    });
  });

  it('rejects CLI protocol calls when the CLI entrypoint is disabled', async () => {
    const storage = createStorage({ settings: { cliEnabled: false } });

    await expect(
      neonPilotAgentCli({ args: ['run', '--prompt', 'Hello'] }, {
        ...ctx({ storage }),
        stdio: { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() },
        signal: new AbortController().signal,
        protocolId: 'neon-pilot-agent',
      } as never),
    ).rejects.toThrow('CLI entrypoint is disabled in Settings.');
  });
});

import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompanionRuntime } from '../../daemon/companion/types.js';
import type { RunnableTaskDefinition } from './tasks-runner.js';

const mocks = vi.hoisted(() => ({
  resolveCompanionRuntime: vi.fn(),
  loadDaemonConfig: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('../../daemon/companion/runtime.js', () => ({
  resolveCompanionRuntime: mocks.resolveCompanionRuntime,
}));

vi.mock('../../config.js', () => ({
  loadDaemonConfig: mocks.loadDaemonConfig,
}));

import { runTaskInIsolatedPi } from './tasks-runner.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTask(overrides: Partial<RunnableTaskDefinition> = {}): RunnableTaskDefinition {
  return {
    key: 'task.md',
    filePath: '/tmp/task.md',
    fileName: 'task.md',
    id: 'nightly-run',
    enabled: true,
    schedule: {
      type: 'cron',
      expression: '* * * * *',
      parsed: {
        raw: '* * * * *',
        minute: { values: new Set<number>(), wildcard: true },
        hour: { values: new Set<number>(), wildcard: true },
        dayOfMonth: { values: new Set<number>(), wildcard: true },
        month: { values: new Set<number>(), wildcard: true },
        dayOfWeek: { values: new Set<number>(), wildcard: true },
      },
    },
    prompt: 'Run nightly checks',
    profile: 'shared',
    timeoutSeconds: 60,
    targetType: 'conversation',
    threadMode: 'dedicated',
    threadSessionFile: '/sessions/nightly.jsonl',
    threadConversationId: 'conv-nightly',
    ...overrides,
  };
}

function createRuntime(overrides: Partial<CompanionRuntime> = {}): CompanionRuntime {
  let conversationListener: ((event: unknown) => void) | undefined;
  return {
    listConversations: vi.fn(),
    updateConversationTabs: vi.fn(),
    duplicateConversation: vi.fn(),
    readModels: vi.fn(),
    readConversationBootstrap: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-nightly', isRunning: false } }),
    readConversationBlockImage: vi.fn(),
    createConversation: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-created' } }),
    resumeConversation: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-nightly' } }),
    promptConversation: vi.fn().mockImplementation(async () => {
      queueMicrotask(() => {
        conversationListener?.({ type: 'agent_start' });
        conversationListener?.({ type: 'text_delta', delta: 'done' });
        conversationListener?.({ type: 'turn_end' });
      });
      return { ok: true, accepted: true, delivery: 'started' };
    }),
    parallelPromptConversation: vi.fn(),
    restoreConversationQueuePrompt: vi.fn(),
    manageConversationParallelJob: vi.fn(),
    cancelConversationDeferredResume: vi.fn(),
    fireConversationDeferredResume: vi.fn(),
    abortConversation: vi.fn().mockResolvedValue({ ok: true }),
    takeOverConversation: vi.fn(),
    renameConversation: vi.fn(),
    changeConversationCwd: vi.fn(),
    readConversationAutoMode: vi.fn(),
    updateConversationAutoMode: vi.fn(),
    readConversationModelPreferences: vi.fn(),
    updateConversationModelPreferences: vi.fn().mockResolvedValue({ ok: true }),
    createConversationCheckpoint: vi.fn(),
    listConversationArtifacts: vi.fn(),
    readConversationArtifact: vi.fn(),
    listConversationCheckpoints: vi.fn(),
    readConversationCheckpoint: vi.fn(),
    listConversationAttachments: vi.fn(),
    readConversationAttachment: vi.fn(),
    createConversationAttachment: vi.fn(),
    updateConversationAttachment: vi.fn(),
    readConversationAttachmentAsset: vi.fn(),
    listKnowledgeEntries: vi.fn(),
    searchKnowledge: vi.fn(),
    readKnowledgeFile: vi.fn(),
    writeKnowledgeFile: vi.fn(),
    createKnowledgeFolder: vi.fn(),
    renameKnowledgeEntry: vi.fn(),
    deleteKnowledgeEntry: vi.fn(),
    createKnowledgeImageAsset: vi.fn(),
    importKnowledge: vi.fn(),
    listScheduledTasks: vi.fn(),
    readScheduledTask: vi.fn(),
    readScheduledTaskLog: vi.fn(),
    createScheduledTask: vi.fn(),
    updateScheduledTask: vi.fn(),
    deleteScheduledTask: vi.fn(),
    runScheduledTask: vi.fn(),
    listDurableRuns: vi.fn(),
    readDurableRun: vi.fn(),
    readDurableRunLog: vi.fn(),
    cancelDurableRun: vi.fn(),
    subscribeApp: vi.fn(),
    subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
      conversationListener = onEvent;
      return vi.fn();
    }),
    ...overrides,
  } as CompanionRuntime;
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.loadDaemonConfig.mockReturnValue({});
  mocks.spawn.mockReset();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runTaskInIsolatedPi', () => {
  it('resumes the automation thread, prompts through the conversation runtime, and succeeds on turn_end', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const runtime = createRuntime();
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const result = await runTaskInIsolatedPi({
      task: createTask({ modelRef: 'provider/model-a', thinkingLevel: 'high', cwd: '/repo' }),
      attempt: 2,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      timedOut: false,
      cancelled: false,
    });
    expect(result.outputText).toContain('done');
    expect(runtime.resumeConversation).toHaveBeenCalledWith({ sessionFile: '/sessions/nightly.jsonl', cwd: '/repo' });
    expect(runtime.updateConversationModelPreferences).toHaveBeenCalledWith({
      conversationId: 'conv-nightly',
      model: 'provider/model-a',
      thinkingLevel: 'high',
      surfaceId: 'automation-nightly-run',
    });
    expect(runtime.promptConversation).toHaveBeenCalledWith({
      conversationId: 'conv-nightly',
      text: 'Run nightly checks',
      behavior: 'followUp',
      surfaceId: 'automation-nightly-run',
    });
    expect(existsSync(result.logPath)).toBe(true);
    expect(statSync(result.logPath).mode & 0o777).toBe(0o600);
    const log = readFileSync(result.logPath, 'utf-8');
    expect(log).toContain('# mode=conversation-runtime');
    expect(log).toContain('# conversation=conv-nightly');
    expect(log).not.toContain('command=pi');
  });

  it('keeps watching after turn_end and fails when the conversation emits a delayed error', async () => {
    vi.useFakeTimers();
    const runsRoot = createTempDir('tasks-runner-runs-');
    let listener: ((event: unknown) => void) | undefined;
    const runtime = createRuntime({
      readConversationBootstrap: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-nightly', isRunning: true } }),
      subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
        listener = onEvent;
        return vi.fn();
      }),
      promptConversation: vi.fn().mockImplementation(async () => {
        queueMicrotask(() => {
          listener?.({ type: 'agent_start' });
          listener?.({ type: 'turn_end' });
          setTimeout(() => listener?.({ type: 'error', message: 'context_length_exceeded' }), 10);
        });
        return { ok: true, accepted: true, delivery: 'started' };
      }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const resultPromise = runTaskInIsolatedPi({ task: createTask(), attempt: 1, runsRoot });
    await vi.advanceTimersByTimeAsync(1020);
    const result = await resultPromise;

    expect(result).toMatchObject({
      success: false,
      exitCode: 1,
      error: 'context_length_exceeded',
    });
  });

  it('succeeds on terminal conversation events even when agent_start is not observed', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    let listener: ((event: unknown) => void) | undefined;
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
        listener = onEvent;
        return vi.fn();
      }),
      promptConversation: vi.fn().mockImplementation(async () => {
        queueMicrotask(() => {
          listener?.({ type: 'text_delta', delta: 'done without start' });
          listener?.({ type: 'agent_end' });
        });
        return { ok: true, accepted: true, delivery: 'started' };
      }),
      readConversationBootstrap: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-nightly', isRunning: false } }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const result = await runTaskInIsolatedPi({
      task: createTask({ cwd: '/repo' }),
      attempt: 1,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      timedOut: false,
      cancelled: false,
    });
    expect(result.outputText).toContain('done without start');
  });

  it('creates a conversation for threadless automations instead of shelling out to a CLI', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const runtime = createRuntime();
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const result = await runTaskInIsolatedPi({
      task: createTask({
        targetType: 'background-agent',
        threadMode: 'none',
        threadSessionFile: undefined,
        threadConversationId: undefined,
        cwd: '/repo/background',
      }),
      attempt: 1,
      runsRoot,
    });

    expect(result.success).toBe(true);
    expect(runtime.createConversation).toHaveBeenCalledWith({ cwd: '/repo/background' });
    expect(runtime.promptConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-created',
        text: 'Run nightly checks',
      }),
    );
  });

  it('falls back to the standalone agent runner when the backend conversation runtime is unavailable', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    mocks.resolveCompanionRuntime.mockResolvedValue(null);
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      queueMicrotask(() => {
        child.stdout.emit('data', 'standalone done\n');
        child.emit('close', 0, null);
      });
      return child;
    });

    const result = await runTaskInIsolatedPi({
      task: createTask({ cwd: '/repo' }),
      attempt: 1,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      outputText: 'standalone done',
    });
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--prompt', 'Run nightly checks', '--cwd', '/repo', '--session-file', '/sessions/nightly.jsonl']),
      expect.objectContaining({ cwd: '/repo', env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: '1' }) }),
    );
    const log = readFileSync(result.logPath, 'utf-8');
    expect(log).toContain('# mode=standalone-agent-runner');
    expect(log).toContain('# sessionFile=/sessions/nightly.jsonl');
  });

  it('returns cancellation result when signal is already aborted before dispatch', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const runtime = createRuntime();
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);
    const controller = new AbortController();
    controller.abort();

    const result = await runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      success: false,
      cancelled: true,
      timedOut: false,
      exitCode: 1,
      error: 'Task run cancelled before dispatch',
    });
    expect(runtime.promptConversation).not.toHaveBeenCalled();
  });

  it('aborts the conversation and reports cancellation when the abort signal fires during execution', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const controller = new AbortController();
    let subscribed = false;
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(async () => {
        subscribed = true;
        return vi.fn();
      }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const promise = runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(subscribed).toBe(true));
    controller.abort();

    const result = await promise;
    expect(result).toMatchObject({
      success: false,
      cancelled: true,
      timedOut: false,
      error: 'Task run cancelled',
    });
    expect(runtime.abortConversation).toHaveBeenCalledWith({ conversationId: 'conv-nightly' });
  });

  it('tears down late conversation subscriptions and skips prompt dispatch when cancellation fires before subscribe resolves', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    let resolveSubscribe: ((value: () => void) => void) | null = null;
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(
        async () =>
          new Promise<() => void>((resolve) => {
            resolveSubscribe = resolve;
          }),
      ),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const promise = runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(resolveSubscribe).not.toBeNull());
    controller.abort();
    resolveSubscribe?.(unsubscribe);

    const result = await promise;
    expect(result).toMatchObject({
      success: false,
      cancelled: true,
      timedOut: false,
      error: 'Task run cancelled',
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(runtime.promptConversation).not.toHaveBeenCalled();
    expect(runtime.abortConversation).toHaveBeenCalledWith({ conversationId: 'conv-nightly' });
  });

  it('reports assistant error events as failed task runs', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    let listener: ((event: unknown) => void) | undefined;
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
        listener = onEvent;
        return vi.fn();
      }),
      promptConversation: vi.fn().mockImplementation(async () => {
        queueMicrotask(() => {
          listener?.({ type: 'agent_start' });
          listener?.({ type: 'error', message: 'model exploded' });
        });
        return { ok: true, accepted: true, delivery: 'started' };
      }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const result = await runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: false,
      exitCode: 1,
      error: 'model exploded',
    });
  });

  it('times out stalled conversation runs and aborts the conversation', async () => {
    vi.useFakeTimers();
    const runsRoot = createTempDir('tasks-runner-runs-');
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
        queueMicrotask(() => onEvent({ type: 'agent_start' }));
        return vi.fn();
      }),
      readConversationBootstrap: vi.fn().mockResolvedValue({ sessionMeta: { id: 'conv-nightly', isRunning: true } }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const promise = runTaskInIsolatedPi({
      task: createTask({ timeoutSeconds: 1 }),
      attempt: 1,
      runsRoot,
    });

    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(result).toMatchObject({
      success: false,
      timedOut: true,
      cancelled: false,
      error: 'Task timed out after 1s',
    });
    expect(runtime.abortConversation).toHaveBeenCalledWith({ conversationId: 'conv-nightly' });
  });

  it('truncates captured conversation output to keep result payload bounded', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    let listener: ((event: unknown) => void) | undefined;
    const runtime = createRuntime({
      subscribeConversation: vi.fn().mockImplementation(async (_input, onEvent) => {
        listener = onEvent;
        return vi.fn();
      }),
      promptConversation: vi.fn().mockImplementation(async () => {
        queueMicrotask(() => {
          listener?.({ type: 'agent_start' });
          listener?.({ type: 'text_delta', delta: 'x'.repeat(17_000) });
          listener?.({ type: 'turn_end' });
        });
        return { ok: true, accepted: true, delivery: 'started' };
      }),
    });
    mocks.resolveCompanionRuntime.mockResolvedValue(runtime);

    const result = await runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
    });

    expect(result.success).toBe(true);
    expect(result.outputText).toContain('[output truncated]');
  });
});

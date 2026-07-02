import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunnableTaskDefinition } from './tasks-runner.js';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
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

function mockSpawnLifecycle(run: (child: MockChildProcess) => void): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  mocks.spawn.mockReturnValueOnce(child);
  queueMicrotask(() => run(child));
  return child;
}

type MockChildProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.spawn.mockReset();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runTaskInIsolatedPi', () => {
  it('runs scheduled tasks through the standalone agent runner', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    mockSpawnLifecycle((child) => {
      child.stdout.emit('data', 'standalone done\n');
      child.emit('close', 0, null);
    });

    const result = await runTaskInIsolatedPi({
      task: createTask({ cwd: '/repo', allowedTools: ['read', 'bash'] }),
      attempt: 2,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      timedOut: false,
      cancelled: false,
      outputText: 'standalone done',
    });
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        '--prompt',
        'Run nightly checks',
        '--tools',
        'read,bash',
        '--cwd',
        '/repo',
        '--session-file',
        '/sessions/nightly.jsonl',
      ]),
      expect.objectContaining({ cwd: '/repo', env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: '1' }) }),
    );
    expect(existsSync(result.logPath)).toBe(true);
    expect(statSync(result.logPath).mode & 0o777).toBe(0o600);
    const log = readFileSync(result.logPath, 'utf-8');
    expect(log).toContain('# mode=standalone-agent-runner');
    expect(log).toContain('# sessionFile=/sessions/nightly.jsonl');
  });

  it('keeps conversation-target standalone runs attached to their owner session', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    mockSpawnLifecycle((child) => {
      child.stdout.emit('data', 'The user wants me to reply exactly.');
      child.stdout.emit('data', 'nightly check passed\n');
      child.emit('close', 0, null);
    });

    const result = await runTaskInIsolatedPi({
      task: createTask({ prompt: 'Reply exactly: nightly check passed', targetType: 'conversation', cwd: '/repo' }),
      attempt: 1,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: true,
      outputText: 'nightly check passed',
    });
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--session-file', '/sessions/nightly.jsonl']),
      expect.objectContaining({ cwd: '/repo' }),
    );
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--prompt', 'Reply exactly: nightly check passed']),
      expect.anything(),
    );
    expect(mocks.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        '--system-prompt-supplement',
        expect.stringContaining('<exact_reply>\nnightly check passed\n</exact_reply>'),
      ]),
      expect.anything(),
    );
    expect(mocks.spawn).toHaveBeenCalledWith(process.execPath, expect.not.arrayContaining(['--no-session']), expect.anything());
  });

  it('returns cancellation result when signal is already aborted before dispatch', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
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
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('cancels the standalone runner when the abort signal fires during execution', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    const controller = new AbortController();
    let child!: MockChildProcess;
    mocks.spawn.mockImplementationOnce(() => {
      child = new EventEmitter() as MockChildProcess;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn(() => {
        queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
        return true;
      });
      return child;
    });

    const promise = runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalled());
    controller.abort();

    const result = await promise;
    expect(result).toMatchObject({
      success: false,
      cancelled: true,
      timedOut: false,
      error: 'Task run cancelled',
    });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('reports standalone runner failures', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    mockSpawnLifecycle((child) => {
      child.stderr.emit('data', 'model exploded\n');
      child.emit('close', 1, null);
    });

    const result = await runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
    });

    expect(result).toMatchObject({
      success: false,
      exitCode: 1,
      error: 'Standalone agent exited with code 1.',
    });
    expect(result.outputText).toContain('model exploded');
  });

  it('truncates captured standalone output to keep result payload bounded', async () => {
    const runsRoot = createTempDir('tasks-runner-runs-');
    mockSpawnLifecycle((child) => {
      child.stdout.emit('data', 'x'.repeat(17_000));
      child.emit('close', 0, null);
    });

    const result = await runTaskInIsolatedPi({
      task: createTask(),
      attempt: 1,
      runsRoot,
    });

    expect(result.success).toBe(true);
    expect(result.outputText).toContain('[output truncated]');
  });
});

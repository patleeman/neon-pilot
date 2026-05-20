import { describe, expect, it, vi } from 'vitest';

import { command } from './command.js';

const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

describe('system-alleycat command protocol', () => {
  it('streams command output and exit notifications for mobile terminal rendering', async () => {
    const ctx = {
      shell: {
        exec: vi.fn().mockResolvedValue({ stdout: 'hello\n', stderr: 'warn\n', exitCode: 2 }),
      },
    };
    const notify = vi.fn();

    await expect(command.exec({ processId: 'p1', command: 'echo hello' }, ctx as never, conn, notify)).resolves.toMatchObject({
      processId: 'p1',
      stdout: 'hello\n',
      stderr: 'warn\n',
      exitCode: 2,
    });
    expect(notify).toHaveBeenCalledWith('command/exec/outputDelta', {
      processId: 'p1',
      stream: 'stdout',
      dataBase64: Buffer.from('hello\n').toString('base64'),
    });
    expect(notify).toHaveBeenCalledWith('command/exec/outputDelta', {
      processId: 'p1',
      stream: 'stderr',
      dataBase64: Buffer.from('warn\n').toString('base64'),
    });
    expect(notify).toHaveBeenCalledWith('command/exec/exited', { processId: 'p1', exitCode: 2, signal: null });
  });

  it('aborts an active command execution when terminated', async () => {
    let signal: AbortSignal | undefined;
    const ctx = {
      shell: {
        exec: vi.fn(
          (input: { signal?: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              signal = input.signal;
              input.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        ),
      },
    };
    const notify = vi.fn();

    const execPromise = command.exec({ processId: 'p1', command: ['sleep', '60'] }, ctx as never, conn, notify);
    await vi.waitFor(() => expect(signal).toBeDefined());

    await expect(command.terminate({ processId: 'p1' }, ctx as never, conn, notify)).resolves.toEqual({});
    expect(signal?.aborted).toBe(true);
    await expect(execPromise).rejects.toThrow('aborted');
  });
});

import { describe, expect, it, vi } from 'vitest';

import { command } from './command.js';

const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

describe('system-alleycat command protocol', () => {
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

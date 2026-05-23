import { describe, expect, it } from 'vitest';

import { enqueueSessionIndexWrite } from './sessionIndexWriteQueue';

describe('sessionIndexWriteQueue', () => {
  it('queues writes after a previous write promise', async () => {
    const events: string[] = [];
    let releasePrevious!: () => void;
    const previousWrite = new Promise<void>((resolve) => {
      releasePrevious = () => {
        events.push('previous');
        resolve();
      };
    });

    const queued = enqueueSessionIndexWrite({
      previousWrite,
      indexFile: '/tmp/index.json',
      json: '{}',
      writeFileFn: ((file, data, callback) => {
        events.push(`${file}:${data}`);
        callback(null);
      }) as typeof import('node:fs').writeFile,
    });

    await Promise.resolve();
    expect(events).toEqual([]);
    releasePrevious();
    await queued;
    expect(events).toEqual(['previous', '/tmp/index.json:{}']);
  });

  it('resolves even when write callbacks receive an error', async () => {
    await expect(
      enqueueSessionIndexWrite({
        previousWrite: null,
        indexFile: '/tmp/index.json',
        json: '{}',
        writeFileFn: ((_file, _data, callback) => {
          callback(new Error('nope'));
        }) as typeof import('node:fs').writeFile,
      }),
    ).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { ExtensionProcessTerminationBlockedError, withExtensionProcessGuard } from './extensionProcessGuard.js';

describe('extensionProcessGuard', () => {
  it('allows normal async work and returns the callback result', async () => {
    await expect(withExtensionProcessGuard('ext', 'startup', async () => 'ok')).resolves.toBe('ok');
  });

  it('blocks process.exit inside guarded extension work', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'startup', async () => {
        process.exit(1);
      }),
    ).rejects.toMatchObject({
      name: 'ExtensionProcessTerminationBlockedError',
      extensionId: 'ext',
      operation: 'startup',
      api: 'process.exit',
    });
  });

  it('blocks process.abort inside guarded extension work', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'health check', async () => {
        process.abort();
      }),
    ).rejects.toBeInstanceOf(ExtensionProcessTerminationBlockedError);
  });

  it('blocks process.kill only when the extension targets the current process', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'handler', async () => {
        process.kill(process.pid, 0);
      }),
    ).rejects.toMatchObject({ api: 'process.kill(process.pid)' });
  });
});

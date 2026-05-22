import { describe, expect, it } from 'vitest';

import { initialize } from './initialize.js';

describe('system-alleycat initialize protocol extra coverage', () => {
  it('marks the connection initialized, stores client info, and returns compatibility fields', async () => {
    const conn = { initialized: false } as { initialized: boolean; clientInfo?: unknown };

    const result = await initialize.handler({ clientInfo: { name: 'client', version: '1' } }, {} as never, conn as never);

    expect(conn).toMatchObject({ initialized: true, clientInfo: { name: 'client', version: '1' } });
    expect(result).toMatchObject({
      codexHome: expect.any(String),
      platformFamily: expect.stringMatching(/^(unix|windows)$/),
      platformOs: expect.stringMatching(/^(macos|windows|linux)$/),
      hostname: expect.any(String),
      version: '0.125.0',
      capabilities: { experimentalApi: true, streams: true, files: true, commands: true },
    });
    expect(result.userAgent).toContain('neon-pilot');
  });
});

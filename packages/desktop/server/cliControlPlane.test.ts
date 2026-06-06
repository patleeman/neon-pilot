import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getNeonPilotCliControlPlaneFile,
  readNeonPilotCliControlPlaneRecord,
  removeNeonPilotCliControlPlaneRecord,
  writeNeonPilotCliControlPlaneRecord,
} from './cliControlPlane.js';

describe('cliControlPlane', () => {
  it('writes, reads, and removes a protected runtime discovery record', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-control-'));
    try {
      const filePath = writeNeonPilotCliControlPlaneRecord(
        {
          pid: 123,
          extensionHost: { baseUrl: 'http://127.0.0.1:1000', token: 'ext-token' },
          localBackend: { baseUrl: 'http://127.0.0.1:1001', token: 'backend-token' },
        },
        root,
      );

      expect(filePath).toBe(getNeonPilotCliControlPlaneFile(root));
      expect(statSync(filePath).mode & 0o777).toBe(0o600);
      expect(readNeonPilotCliControlPlaneRecord(root)).toMatchObject({
        version: 1,
        pid: 123,
        extensionHost: { baseUrl: 'http://127.0.0.1:1000', token: 'ext-token' },
        localBackend: { baseUrl: 'http://127.0.0.1:1001', token: 'backend-token' },
      });

      removeNeonPilotCliControlPlaneRecord(root);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

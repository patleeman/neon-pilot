import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
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

  it('writes, reads, and removes the record under the layout systemState path', () => {
    const layoutRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-layout-'));
    try {
      const layout = resolveDesktopRootLayout({ root: layoutRoot });

      const filePath = writeNeonPilotCliControlPlaneRecord(
        {
          pid: 456,
          extensionHost: { baseUrl: 'http://127.0.0.1:2000', token: 'ext-token-layout' },
          localBackend: { baseUrl: 'http://127.0.0.1:2001', token: 'backend-token-layout' },
        },
        undefined,
        layout,
      );

      expect(filePath).toBe(getNeonPilotCliControlPlaneFile(undefined, layout));
      expect(filePath).toBe(join(layout.systemState, 'desktop', 'cli-control-plane.json'));
      expect(existsSync(filePath)).toBe(true);

      const record = readNeonPilotCliControlPlaneRecord(undefined, layout);
      expect(record).not.toBeNull();
      expect(record).toMatchObject({
        version: 1,
        pid: 456,
        extensionHost: { baseUrl: 'http://127.0.0.1:2000', token: 'ext-token-layout' },
        localBackend: { baseUrl: 'http://127.0.0.1:2001', token: 'backend-token-layout' },
      });

      removeNeonPilotCliControlPlaneRecord(undefined, layout);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      rmSync(layoutRoot, { recursive: true, force: true });
    }
  });

  it('uses explicit stateRoot over layout when both are provided', () => {
    const customRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-custom-state-'));
    const layoutRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-layout-root-'));
    try {
      const layout = resolveDesktopRootLayout({ root: layoutRoot });

      const filePath = writeNeonPilotCliControlPlaneRecord(
        {
          pid: 789,
          extensionHost: { baseUrl: 'http://127.0.0.1:3000', token: 'ext-token-both' },
        },
        customRoot,
        layout,
      );

      // When stateRoot is explicitly provided, it takes precedence over layout
      expect(filePath).toBe(join(customRoot, 'desktop', 'cli-control-plane.json'));
      expect(existsSync(filePath)).toBe(true);
      expect(existsSync(join(layout.systemState, 'desktop', 'cli-control-plane.json'))).toBe(false);

      const record = readNeonPilotCliControlPlaneRecord(customRoot, layout);
      expect(record).not.toBeNull();
      expect(record).toMatchObject({
        version: 1,
        pid: 789,
        extensionHost: { baseUrl: 'http://127.0.0.1:3000', token: 'ext-token-both' },
      });

      removeNeonPilotCliControlPlaneRecord(customRoot, layout);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      rmSync(customRoot, { recursive: true, force: true });
      rmSync(layoutRoot, { recursive: true, force: true });
    }
  });

  it('returns null from non-existent layout-derived path when no legacy stateRoot exists', () => {
    const layoutRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-empty-layout-'));
    try {
      const layout = resolveDesktopRootLayout({ root: layoutRoot });

      // No record was written, so read should return null
      const record = readNeonPilotCliControlPlaneRecord(undefined, layout);
      expect(record).toBeNull();
    } finally {
      rmSync(layoutRoot, { recursive: true, force: true });
    }
  });
});

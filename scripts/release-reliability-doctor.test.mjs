import { describe, expect, it } from 'vitest';

import {
  checkConversationAdminFlows,
  checkDeferredResumeLifecycle,
  checkExtensionStateSanity,
  checkHeartbeatConfig,
  checkInstallableCatalogCompatibility,
  checkPackagingExternalsConsistency,
  checkUnifiedAdminSurface,
  collectInstallableCatalogCompatibility,
  satisfiesVersionRange,
} from './release-reliability-doctor.mjs';

const manifest = (id, contributes = {}) => ({ path: `${id}/extension.json`, manifest: { id, contributes } });

describe('release reliability doctor', () => {
  it('accepts the canonical neon_pilot internal admin surface', () => {
    const result = checkUnifiedAdminSurface([
      manifest('system-neon-pilot-admin-cli', {
        tools: [{ id: 'neon-pilot-admin', name: 'neon_pilot', description: 'Canonical internal Neon Pilot self-admin tool.' }],
        cliCommands: [{ command: 'heartbeats list' }],
      }),
      manifest('system-mcp', {
        tools: [{ id: 'mcp', name: 'mcp', description: 'Not a Neon Pilot self-admin surface; use neon_pilot.' }],
      }),
    ]);

    expect(result.ok).toBe(true);
  });

  it('rejects extra internal self-admin tools', () => {
    const result = checkUnifiedAdminSurface([
      manifest('system-neon-pilot-admin-cli', {
        tools: [{ id: 'neon-pilot-admin', name: 'neon_pilot', description: 'Canonical internal Neon Pilot self-admin tool.' }],
      }),
      manifest('system-conversation-tools', {
        tools: [{ id: 'conversation-admin', name: 'conversation_admin', description: 'Conversation admin tool.' }],
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('Unexpected internal admin-like tool conversation_admin');
  });

  it('validates conversation, deferred resume, and extension state seams in repo manifests', () => {
    expect(checkConversationAdminFlows().ok).toBe(true);
    expect(checkDeferredResumeLifecycle().ok).toBe(true);
    expect(checkExtensionStateSanity().ok).toBe(true);
  });

  it('validates heartbeat command inventory', () => {
    const result = checkHeartbeatConfig([
      manifest('system-neon-pilot-admin-cli', {
        tools: [
          {
            name: 'neon_pilot',
            inputSchema: { properties: { command: { enum: ['heartbeat_start', 'heartbeat_list', 'heartbeat_stop'] } } },
          },
        ],
        cliCommands: [{ command: 'heartbeats start' }, { command: 'heartbeats list' }, { command: 'heartbeats stop' }],
      }),
    ]);

    expect(result.ok).toBe(true);
  });

  it('validates baked installable catalog compatibility against the app version', () => {
    const result = checkInstallableCatalogCompatibility('0.11.22', [
      { id: 'system-knowledge', name: 'Knowledge', neonPilot: '>=0.10.0' },
      { id: 'system-writing-studio', name: 'Writing Studio', neonPilot: '>=0.10.0 <0.11.0' },
    ]);

    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('system-writing-studio');
    expect(result.failures.join('\n')).toContain('package.json is 0.11.22');
  });

  it('parses installable catalog compatibility metadata', () => {
    expect(
      collectInstallableCatalogCompatibility(`
        export const INSTALLABLE_EXTENSION_CATALOG = [
          { id: 'system-knowledge', name: 'Knowledge', compatibility: { neonPilot: '>=0.10.0' } },
        ];
      `),
    ).toEqual([{ id: 'system-knowledge', name: 'Knowledge', neonPilot: '>=0.10.0' }]);
  });

  it('checks semver ranges used by catalog compatibility metadata', () => {
    expect(satisfiesVersionRange('0.11.22', '>=0.10.0')).toBe(true);
    expect(satisfiesVersionRange('0.11.22', '>=0.10.0 <0.11.0')).toBe(false);
    expect(satisfiesVersionRange('0.11.0-rc.1', '>=0.11.0-rc.1 <0.11.0')).toBe(true);
    expect(satisfiesVersionRange('0.11.22', '^0.11.0')).toBe(null);
  });

  describe('packaging externals consistency', () => {
    it('accepts a runtime bare specifier shipped in both files and asarUnpack', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: ['node_modules/@earendil-works/pi-coding-agent{,/**/*}'],
        asarUnpacked: ['node_modules/@earendil-works/pi-coding-agent/**/*'],
        runtimeSpecifiers: ['@earendil-works/pi-coding-agent'],
      });
      expect(result.ok).toBe(true);
      expect(result.failures).toEqual([]);
    });

    it('flags a runtime bare specifier missing from electron-builder files and asarUnpack', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: [],
        asarUnpacked: [],
        runtimeSpecifiers: ['@earendil-works/pi-coding-agent'],
      });
      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain('is not in electron-builder files');
      expect(result.failures.join('\n')).toContain('is not in asarUnpack');
      expect(result.failures.join('\n')).toContain('node_modules/@earendil-works/pi-coding-agent{,/**/*}');
      expect(result.failures.join('\n')).toContain('node_modules/@earendil-works/pi-coding-agent/**/*');
    });

    it('flags a runtime bare specifier present in files but absent from asarUnpack (asymmetry)', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: ['node_modules/some-native-pkg{,/**/*}'],
        asarUnpacked: [],
        runtimeSpecifiers: [],
      });
      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain("'node_modules/some-native-pkg' is in electron-builder files but not asarUnpack");
    });

    it('flags a package present in asarUnpack but absent from electron-builder files', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: [],
        asarUnpacked: ['node_modules/orphan-pkg/**/*'],
        runtimeSpecifiers: [],
      });
      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain("'node_modules/orphan-pkg' is in asarUnpack but not electron-builder files");
    });

    it('requires createRequire native runtime packages even when static analysis cannot see them', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: [],
        asarUnpacked: [],
      });

      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain(
        "Runtime bare specifier '@ffmpeg-installer/darwin-arm64' is not in electron-builder files",
      );
      expect(result.failures.join('\n')).toContain("Runtime bare specifier '@ffmpeg-installer/ffmpeg' is not in electron-builder files");
      expect(result.failures.join('\n')).toContain("Runtime bare specifier 'whisper-cpp-node' is not in electron-builder files");
      expect(result.failures.join('\n')).toContain(
        "Runtime bare specifier '@whisper-cpp-node/darwin-arm64' is not in electron-builder files",
      );
    });

    it('exempts Node/Electron built-ins from the on-disk requirement', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: [],
        asarUnpacked: [],
        runtimeSpecifiers: ['fs', 'node:fs/promises', 'crypto', 'electron'],
      });
      expect(result.ok).toBe(true);
    });

    it('exempts resolver-redirected (@neon-pilot/*) and allowlisted CJS/Electron packages from the on-disk requirement', () => {
      const result = checkPackagingExternalsConsistency({
        filesShipped: ['node_modules/ajv{,/**/*}', 'node_modules/fsevents{,/**/*}'],
        asarUnpacked: [],
        runtimeSpecifiers: ['@neon-pilot/core', 'ajv', 'ajv-formats', 'fsevents'],
      });
      expect(result.ok).toBe(true);
    });
  });
});

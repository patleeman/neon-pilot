import { beforeEach, describe, expect, it, vi } from 'vitest';

const findExtensionEntry = vi.fn();
const readExtensionRegistryConfig = vi.fn();
const writeExtensionRegistryConfig = vi.fn();
const invalidateExtensionRegistryReadCaches = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  findExtensionEntry,
  readExtensionRegistryConfig,
  writeExtensionRegistryConfig,
  invalidateExtensionRegistryReadCaches,
}));

const { clearExtensionHostAuditEvents, listExtensionHostAuditEvents } = await import('./extensionHostAudit.js');
const { assertExtensionPermission, extensionHasPermission, setExtensionPermissionGranted } = await import('./extensionPermissions.js');

describe('extensionPermissions', () => {
  beforeEach(() => {
    clearExtensionHostAuditEvents();
    findExtensionEntry.mockReset();
    readExtensionRegistryConfig.mockReturnValue({});
    writeExtensionRegistryConfig.mockReset();
    invalidateExtensionRegistryReadCaches.mockReset();
  });

  describe('extensionHasPermission', () => {
    it('returns true when the extension declares the permission and it is not revoked', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });
      readExtensionRegistryConfig.mockReturnValue({});

      expect(extensionHasPermission('ext', 'agent:run')).toBe(true);
    });

    it('returns false when the extension does not declare the permission', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
      readExtensionRegistryConfig.mockReturnValue({});

      expect(extensionHasPermission('ext', 'agent:run')).toBe(false);
      expect(extensionHasPermission('ext', 'agent:conversations')).toBe(false);
    });

    it('returns false when the permission is revoked even though declared', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run', 'agent:conversations'] } });
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: ['agent:run'] } });

      expect(extensionHasPermission('ext', 'agent:run')).toBe(false);
      expect(extensionHasPermission('ext', 'agent:conversations')).toBe(true);
    });

    it('returns true for a different extension when one has revoked permissions', () => {
      findExtensionEntry.mockImplementation((extensionId: string) => {
        if (extensionId === 'ext-a') return { manifest: { permissions: ['agent:run'] } };
        if (extensionId === 'ext-b') return { manifest: { permissions: ['agent:run'] } };
        return null;
      });
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { 'ext-a': ['agent:run'] } });

      expect(extensionHasPermission('ext-a', 'agent:run')).toBe(false);
      expect(extensionHasPermission('ext-b', 'agent:run')).toBe(true);
    });

    it('returns true after a revoked permission is re-granted (removed from revoked list)', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: [] } });

      expect(extensionHasPermission('ext', 'agent:run')).toBe(true);
    });

    it('keeps locked extension permissions effective even if stale config contains a revocation', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { 'system-settings': ['agent:run'] } });

      expect(extensionHasPermission('system-settings', 'agent:run')).toBe(true);
    });
  });

  describe('assertExtensionPermission', () => {
    it('throws a consistent host permission error when a permission is missing', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
      readExtensionRegistryConfig.mockReturnValue({});

      expect(() => assertExtensionPermission('ext', 'attention:write', 'attention events')).toThrow(
        'Extension "ext" requires permission attention:write to use attention events.',
      );
      expect(listExtensionHostAuditEvents()).toEqual([
        expect.objectContaining({
          requestType: 'permission',
          requestName: 'permission:ext:attention:write',
          ok: false,
          error: 'Extension "ext" requires permission attention:write to use attention events.',
        }),
      ]);
    });

    it('throws when the permission is revoked even though declared', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: ['agent:run'] } });

      expect(() => assertExtensionPermission('ext', 'agent:run', 'agent runs')).toThrow(
        'Extension "ext" requires permission agent:run to use agent runs.',
      );
    });

    it('passes when the permission is declared and not revoked', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });

      expect(() => assertExtensionPermission('ext', 'agent:run', 'agent runs')).not.toThrow();
    });
  });

  describe('setExtensionPermissionGranted', () => {
    beforeEach(() => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });
    });

    it('revokes a permission by adding it to the revoked list', () => {
      readExtensionRegistryConfig.mockReturnValue({});

      setExtensionPermissionGranted('ext', 'agent:run', false);

      expect(writeExtensionRegistryConfig).toHaveBeenCalledWith(
        expect.objectContaining({ revokedPermissions: { ext: ['agent:run'] } }),
        undefined,
      );
      expect(invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith(undefined);
    });

    it('re-grants a revoked permission by removing it from the revoked list', () => {
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: ['agent:run', 'agent:conversations'] } });

      setExtensionPermissionGranted('ext', 'agent:run', true);

      expect(writeExtensionRegistryConfig).toHaveBeenCalledWith(
        expect.objectContaining({ revokedPermissions: { ext: ['agent:conversations'] } }),
        undefined,
      );
      expect(invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith(undefined);
    });

    it('removes empty extension entries from revokedPermissions', () => {
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: ['agent:run'] } });

      setExtensionPermissionGranted('ext', 'agent:run', true);

      expect(writeExtensionRegistryConfig.mock.calls[0]?.[0].revokedPermissions).not.toHaveProperty('ext');
      expect(writeExtensionRegistryConfig.mock.calls[0]?.[1]).toBeUndefined();
    });

    it('throws when trying to revoke a permission from a locked extension', () => {
      readExtensionRegistryConfig.mockReturnValue({});

      // system-settings is in LOCKED_EXTENSION_IDS
      expect(() => setExtensionPermissionGranted('system-settings', 'agent:run', false)).toThrow(
        'Cannot revoke permission agent:run from system-settings: this extension is required by the application.',
      );
    });

    it('does not throw when granting (re-granting) to a locked extension', () => {
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { 'system-settings': ['agent:run'] } });

      expect(() => setExtensionPermissionGranted('system-settings', 'agent:run', true)).not.toThrow();
    });

    it('rejects unknown permission strings at the grant boundary', () => {
      expect(() => setExtensionPermissionGranted('ext', 'unknown:permission' as never, false)).toThrow(
        'Unknown extension permission: unknown:permission.',
      );
    });

    it('rejects permission updates for missing extensions', () => {
      findExtensionEntry.mockReturnValue(null);

      expect(() => setExtensionPermissionGranted('missing-ext', 'agent:run', false)).toThrow(
        'Cannot update permission agent:run for missing-ext: extension is not installed.',
      );
    });

    it('rejects permission updates for permissions the extension does not declare', () => {
      findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });

      expect(() => setExtensionPermissionGranted('ext', 'shell:execute', false)).toThrow(
        'Cannot update permission shell:execute for ext: permission is not declared by the extension.',
      );
    });

    it('is idempotent when revoking an already-revoked permission', () => {
      readExtensionRegistryConfig.mockReturnValue({ revokedPermissions: { ext: ['agent:run'] } });

      setExtensionPermissionGranted('ext', 'agent:run', false);

      // Should still write config with same revoked list
      expect(writeExtensionRegistryConfig).toHaveBeenCalledWith(
        expect.objectContaining({ revokedPermissions: { ext: ['agent:run'] } }),
        undefined,
      );
    });

    it('is idempotent when re-granting an already-granted permission', () => {
      readExtensionRegistryConfig.mockReturnValue({});

      setExtensionPermissionGranted('ext', 'agent:run', true);

      // Should still write config (without ext entry)
      expect(writeExtensionRegistryConfig.mock.calls[0]?.[0].revokedPermissions).not.toHaveProperty('ext');
      expect(writeExtensionRegistryConfig.mock.calls[0]?.[1]).toBeUndefined();
    });

    it('passes stateRoot through to config functions when provided', () => {
      readExtensionRegistryConfig.mockReturnValue({});

      setExtensionPermissionGranted('ext', 'agent:run', false, '/custom/state/root');

      expect(readExtensionRegistryConfig).toHaveBeenCalledWith('/custom/state/root');
      expect(writeExtensionRegistryConfig).toHaveBeenCalledWith(expect.anything(), '/custom/state/root');
      expect(invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith('/custom/state/root');
    });
  });
});

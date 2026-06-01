import { beforeEach, describe, expect, it, vi } from 'vitest';

const findExtensionEntry = vi.fn();

vi.mock('./extensionRegistry.js', () => ({ findExtensionEntry }));

const { clearExtensionHostAuditEvents, listExtensionHostAuditEvents } = await import('./extensionHostAudit.js');
const { assertExtensionPermission, extensionHasPermission } = await import('./extensionPermissions.js');

describe('extensionPermissions', () => {
  beforeEach(() => {
    clearExtensionHostAuditEvents();
    findExtensionEntry.mockReset();
  });

  it('reads declared permissions from the extension registry', () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:run'] } });

    expect(extensionHasPermission('ext', 'agent:run')).toBe(true);
    expect(extensionHasPermission('ext', 'agent:conversations')).toBe(false);
  });

  it('throws a consistent host permission error when a permission is missing', () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });

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
});

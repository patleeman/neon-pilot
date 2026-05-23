import { describe, expect, it } from 'vitest';

import { isArtifactsRailMode, resolveActiveExtensionWorkbenchSurface, resolveWorkbenchRailMode } from './workbenchRailModel';

function surface(overrides: Record<string, unknown>) {
  return {
    id: 'panel',
    extensionId: 'ext',
    kind: 'right-tool-panel',
    title: 'Panel',
    ...overrides,
  } as never;
}

function view(overrides: Record<string, unknown>) {
  return {
    id: 'detail',
    extensionId: 'ext',
    kind: 'workbench',
    title: 'Detail',
    ...overrides,
  } as never;
}

describe('workbench rail model', () => {
  it('uses the built-in mode when no extension surface is active', () => {
    expect(resolveWorkbenchRailMode('files', null)).toBe('files');
  });

  it('maps known system extension surfaces to their built-in slots', () => {
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-files' }))).toBe('files');
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-artifacts' }))).toBe('artifacts');
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-browser' }))).toBe('browser');
  });

  it('prefers explicit tool slots over inferred extension slots', () => {
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-files', toolSlot: 'custom-slot' }))).toBe('custom-slot');
  });

  it('falls back to extension rail mode for custom surfaces', () => {
    expect(resolveWorkbenchRailMode('browser', surface({ extensionId: 'my-ext', id: 'panel-a' }))).toBe('extension:my-ext:panel-a');
  });

  it('resolves detail workbench surfaces from extension rail modes', () => {
    const detail = view({ extensionId: 'my-ext', id: 'detail-a' });
    expect(
      resolveActiveExtensionWorkbenchSurface({
        activeWorkbenchTool: 'extension:my-ext:panel-a',
        extensionRightToolPanels: [surface({ extensionId: 'my-ext', id: 'panel-a', detailView: 'detail-a' })],
        extensionWorkbenchSurfaces: [detail],
      }),
    ).toBe(detail);
  });

  it('resolves detail workbench surfaces from built-in slot modes', () => {
    const detail = view({ extensionId: 'system-files', id: 'files-detail' });
    expect(
      resolveActiveExtensionWorkbenchSurface({
        activeWorkbenchTool: 'files',
        extensionRightToolPanels: [surface({ extensionId: 'system-files', id: 'files-panel', detailView: 'files-detail' })],
        extensionWorkbenchSurfaces: [detail],
      }),
    ).toBe(detail);
  });

  it('detects artifacts rail modes', () => {
    expect(isArtifactsRailMode('artifacts')).toBe(true);
    expect(isArtifactsRailMode('extension:system-artifacts:panel')).toBe(true);
    expect(isArtifactsRailMode('files')).toBe(false);
  });
});

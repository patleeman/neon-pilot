import { describe, expect, it } from 'vitest';

import {
  isArtifactsRailMode,
  isNewWorkbenchTabMode,
  isSinglePaneWorkbenchMode,
  resolveActiveExtensionWorkbenchSurface,
  resolveWorkbenchRailMode,
  shouldKeepActiveToolWhenConversationHasNoSavedSelection,
  shouldOpenRailForWorkbenchTool,
  singletonWorkbenchToolTabId,
} from './workbenchRailModel';

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

  it('maps declared extension tool slots to stable rail modes', () => {
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-files', toolSlot: 'files' }))).toBe('files');
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-artifacts', toolSlot: 'artifacts' }))).toBe('artifacts');
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-browser', toolSlot: 'browser' }))).toBe('browser');
    expect(resolveWorkbenchRailMode('files', surface({ extensionId: 'system-terminal', toolSlot: 'terminal' }))).toBe('terminal');
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
        extensionRightToolPanels: [
          surface({ extensionId: 'system-files', id: 'files-panel', detailView: 'files-detail', toolSlot: 'files' }),
        ],
        extensionWorkbenchSurfaces: [detail],
      }),
    ).toBe(detail);
  });

  it('detects artifacts rail modes', () => {
    expect(isArtifactsRailMode('artifacts')).toBe(true);
    expect(isArtifactsRailMode('extension:system-artifacts:panel')).toBe(false);
    expect(isArtifactsRailMode('files')).toBe(false);
  });

  it('detects the workbench new-tab mode', () => {
    expect(isNewWorkbenchTabMode('new')).toBe(true);
    expect(isNewWorkbenchTabMode('files')).toBe(false);
  });

  it('keeps chat and terminal as single-pane workbench tabs', () => {
    expect(isSinglePaneWorkbenchMode('chat')).toBe(true);
    expect(isSinglePaneWorkbenchMode('terminal')).toBe(true);
    expect(isSinglePaneWorkbenchMode('files')).toBe(false);
    expect(isSinglePaneWorkbenchMode('files', surface({ toolSlot: 'terminal' }))).toBe(true);
  });

  it('opens the paired rail for two-pane extension workbench tools', () => {
    expect(shouldOpenRailForWorkbenchTool('files', surface({ toolSlot: 'files', detailView: 'files-detail' }))).toBe(true);
    expect(shouldOpenRailForWorkbenchTool('terminal', surface({ toolSlot: 'terminal', detailView: 'terminal-detail' }))).toBe(false);
    expect(shouldOpenRailForWorkbenchTool('files', surface({ toolSlot: 'files' }))).toBe(false);
  });

  it('does not assign singleton tabs to generic extension tools', () => {
    expect(singletonWorkbenchToolTabId('extension:system-notes:notes', surface({ toolSlot: 'notes' }), 'conversation-1')).toBeNull();
    expect(singletonWorkbenchToolTabId('terminal', surface({ toolSlot: 'terminal' }), 'conversation-1')).toBeNull();
  });

  it('does not keep conversation-scoped extension tools open without a saved workbench selection', () => {
    expect(shouldKeepActiveToolWhenConversationHasNoSavedSelection('extension:system-notes:notes')).toBe(false);
    expect(shouldKeepActiveToolWhenConversationHasNoSavedSelection('files')).toBe(false);
    expect(shouldKeepActiveToolWhenConversationHasNoSavedSelection('terminal')).toBe(false);
  });
});

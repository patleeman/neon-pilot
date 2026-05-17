// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildExtension: vi.fn(),
  exportExtension: vi.fn(),
  extensionInstallations: vi.fn(),
  notifyExtensionRegistryChanged: vi.fn(),
  openPath: vi.fn(),
  reloadExtension: vi.fn(),
  validateExtension: vi.fn(),
  extensionKeybindings: vi.fn(),
}));

vi.mock('@personal-agent/extensions/data', () => ({
  api: {
    buildExtension: mocks.buildExtension,
    exportExtension: mocks.exportExtension,
    extensionInstallations: mocks.extensionInstallations,
    reloadExtension: mocks.reloadExtension,
    validateExtension: mocks.validateExtension,
    extensionKeybindings: mocks.extensionKeybindings,
  },
  EXTENSION_REGISTRY_CHANGED_EVENT: 'pa-extension-registry-changed',
  notifyExtensionRegistryChanged: mocks.notifyExtensionRegistryChanged,
}));

vi.mock('@personal-agent/extensions/workbench', () => ({
  getDesktopBridge: () => ({
    openPath: mocks.openPath,
  }),
}));

vi.mock('@personal-agent/extensions/workbench-browser', () => ({
  getDesktopBridge: () => ({
    openPath: mocks.openPath,
  }),
}));

import { ExtensionManagerPage } from './frontend';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function createExtension() {
  return {
    id: 'menu-test',
    name: 'Menu Test',
    description: 'Extension menu feedback test.',
    enabled: true,
    status: 'enabled',
    packageType: 'user',
    packageRoot: '/tmp/menu-test',
    routes: [],
    manifest: { contributes: { views: [] } },
    diagnostics: [],
    errors: [],
    skills: [],
    tools: [],
    backendActions: [],
    permissions: [],
  } as never;
}

function renderPage(options?: { toast?: ReturnType<typeof vi.fn>; notify?: ReturnType<typeof vi.fn> }) {
  const toast = options?.toast ?? vi.fn();
  const notify = options?.notify ?? vi.fn();

  render(
    <MemoryRouter>
      <ExtensionManagerPage
        pa={{ ui: { toast, notify }, commands: { list: vi.fn().mockResolvedValue([]) } } as never}
        context={{} as never}
        surface={{} as never}
        params={{}}
      />
    </MemoryRouter>,
  );

  return { toast, notify };
}

describe('ExtensionManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extensionInstallations.mockResolvedValue([createExtension()]);
    mocks.extensionKeybindings.mockResolvedValue([]);
    mocks.reloadExtension.mockResolvedValue({ ok: true, id: 'menu-test', reloaded: true, message: 'Extension backend reloaded.' });
    mocks.validateExtension.mockResolvedValue({
      ok: true,
      extensionId: 'menu-test',
      packageRoot: '/tmp/menu-test',
      findings: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    });
  });

  it('keeps the row actions menu focused on opening the package folder', async () => {
    renderPage();

    await screen.findByText('Menu Test');
    fireEvent.click(screen.getByLabelText('More actions'));

    expect(screen.getByText('Open folder')).toBeTruthy();
    expect(screen.queryByText('Build')).toBeNull();
    expect(screen.queryByText('Reload')).toBeNull();
    expect(screen.queryByText('Validate')).toBeNull();
    expect(screen.queryByText('Run self-test')).toBeNull();
    expect(screen.queryByText('Snapshot')).toBeNull();
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Copy diagnostics')).toBeNull();
  });
});

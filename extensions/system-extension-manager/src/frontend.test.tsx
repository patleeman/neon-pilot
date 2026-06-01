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

vi.mock('@neon-pilot/extensions/data', () => ({
  api: {
    buildExtension: mocks.buildExtension,
    exportExtension: mocks.exportExtension,
    extensionInstallations: mocks.extensionInstallations,
    reloadExtension: mocks.reloadExtension,
    validateExtension: mocks.validateExtension,
    extensionKeybindings: mocks.extensionKeybindings,
  },
  EXTENSION_REGISTRY_CHANGED_EVENT: 'neon-pilot-extension-registry-changed',
  notifyExtensionRegistryChanged: mocks.notifyExtensionRegistryChanged,
}));

vi.mock('@neon-pilot/extensions/workbench', () => ({
  getDesktopBridge: () => ({
    openPath: mocks.openPath,
  }),
}));

vi.mock('@neon-pilot/extensions/workbench-browser', () => ({
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

function createConfigurableExtension() {
  return {
    ...createExtension(),
    id: 'configurable-test',
    name: 'Configurable Test',
    manifest: {
      contributes: {
        views: [],
        settings: {
          'configurableTest.enabled': {
            type: 'boolean',
            default: true,
            description: 'Toggle a test setting.',
          },
        },
      },
    },
  } as never;
}

function createSystemExtension() {
  return {
    ...createExtension(),
    id: 'system-menu-test',
    name: 'System Menu Test',
    packageType: 'system',
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

function renderPageWithPa(pa: Record<string, unknown>) {
  render(
    <MemoryRouter>
      <ExtensionManagerPage pa={pa as never} context={{} as never} surface={{} as never} params={{}} />
    </MemoryRouter>,
  );
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

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('More actions'));

    expect(screen.getByText('Open folder')).toBeTruthy();
    expect(screen.queryByText('Build')).toBeNull();
    expect(screen.queryByText('Validate')).toBeNull();
    expect(screen.queryByText('Run self-test')).toBeNull();
    expect(screen.queryByText('Snapshot')).toBeNull();
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Copy diagnostics')).toBeNull();
  });

  it('shows a single extensions list with source labels and no catalog tab', async () => {
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Installed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Built-in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Available' })).toBeNull();
    expect(screen.queryByText('USER')).toBeNull();
    expect(screen.getAllByText('Installed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'commands' })).toBeNull();
  });

  it('combines installed add-ons and built-ins in the all extensions count', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension(), createSystemExtension()]);
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.getByText('System Menu Test')).toBeTruthy();
    expect(screen.getByText('2 installed · 2 enabled')).toBeTruthy();
  });

  it('shows settings actions only for configurable extensions', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension(), createConfigurableExtension()]);
    renderPage();

    expect(await screen.findByText('Configurable Test')).toBeTruthy();
    expect(screen.getByLabelText('Settings for Configurable Test')).toBeTruthy();
    expect(screen.queryByLabelText('Settings for Menu Test')).toBeNull();
  });

  it('shows catalog-only extensions in the install modal instead of the installed table', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'available-only',
          name: 'Available Only',
          description: 'Catalog-only extension.',
          version: '1.0.0',
          tag: 'v1.0.0',
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Available Only')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);
    expect(await screen.findByText('Available Only')).toBeTruthy();
  });

  it('loads the installable catalog without starting a polling interval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const callAction = vi.fn().mockResolvedValue({ ok: true, version: '0.9.1-rc.6', tag: 'v0.9.1-rc.6', extensions: [] });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(callAction).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 5_000)).toBe(false);
  });

  it('installs marketplace behavior package sources from the marketplace form', async () => {
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'listInstallableExtensions') return { ok: true, version: '0.9.1-rc.6', tag: 'v0.9.1-rc.6', extensions: [] };
      if (action === 'installMarketplacePackage') return { ok: true, installed: true };
      return { ok: true };
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);
    fireEvent.change(screen.getByPlaceholderText('Extension, agent plugin, marketplace package, URL, or local path'), {
      target: { value: 'https://example.com/claude-instructions.git' },
    });
    const selectors = screen.getAllByRole('combobox');
    fireEvent.change(selectors[0] as HTMLSelectElement, { target: { value: 'instruction-pack' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);

    await screen.findByText('Installed agent plugin package as a Neon Pilot extension.');
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'installMarketplacePackage', {
      source: 'https://example.com/claude-instructions.git',
      ecosystem: 'codex',
      packageType: 'instruction-pack',
    });
  });
});

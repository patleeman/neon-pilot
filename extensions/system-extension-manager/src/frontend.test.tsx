// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildExtension: vi.fn(),
  deleteExtension: vi.fn(),
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
    deleteExtension: mocks.deleteExtension,
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

import { ExtensionManagerPage, ExtensionRepositoriesSettingsPanel } from './frontend';

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

function renderRepositoriesSettingsPanel(pa: Record<string, unknown>) {
  render(<ExtensionRepositoriesSettingsPanel pa={pa as never} context={{} as never} surface={{} as never} params={{}} />);
}

describe('ExtensionManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extensionInstallations.mockResolvedValue([createExtension()]);
    mocks.extensionKeybindings.mockResolvedValue([]);
    mocks.deleteExtension.mockResolvedValue({ ok: true, extensionId: 'menu-test', deleted: true });
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

  it('links configurable extensions to Settings', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension(), createConfigurableExtension()]);
    renderPage();

    expect(await screen.findByText('Configurable Test')).toBeTruthy();
    expect(screen.getByLabelText('Configure Configurable Test in Settings').getAttribute('href')).toBe('/settings#settings-extensions');
    expect(screen.queryByLabelText('Configure Menu Test in Settings')).toBeNull();
  });

  it('points extension details to Settings instead of rendering duplicate controls', async () => {
    mocks.extensionInstallations.mockResolvedValue([createConfigurableExtension()]);
    renderPage();

    expect(await screen.findByText('Configurable Test')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Details for Configurable Test'));

    expect(await screen.findByRole('dialog', { name: 'Extension details' })).toBeTruthy();
    expect(screen.getByText('Configure Configurable Test from Settings.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open settings' }).getAttribute('href')).toBe('/settings#settings-extensions');
    expect(screen.queryByText('Toggle a test setting.')).toBeNull();
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

  it('does not offer catalog items already marked installed by the catalog', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-agent-browser',
          name: 'Agent Browser',
          description: 'Control browsers and Electron apps.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
        },
        {
          id: 'available-only',
          name: 'Available Only',
          description: 'Catalog-only extension.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: false,
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);

    expect(await screen.findByText('Available Only')).toBeTruthy();
    expect(within(screen.getByRole('dialog', { name: 'Install extension' })).queryByText('Agent Browser')).toBeNull();
  });

  it('shows catalog-installed extensions in the installed list when summaries lag', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-agent-browser',
          name: 'Agent Browser',
          description: 'Control browsers and Electron apps.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
          enabled: false,
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Agent Browser')).toBeTruthy();
  });

  it('removes deleted catalog-installed extensions from the installed list', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-onboarding',
          name: 'Onboarding',
          description: 'Creates a one-time onboarding conversation.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
          enabled: true,
        },
      ],
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-onboarding',
        name: 'Onboarding',
        description: 'Creates a one-time onboarding conversation.',
        enabled: true,
        packageType: 'user',
      } as never,
    ]);
    mocks.deleteExtension.mockResolvedValue({ ok: true, extensionId: 'system-onboarding', deleted: true });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Onboarding')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Uninstall'));

    await screen.findByText('No extensions installed');
    expect(screen.queryByText('Onboarding')).toBeNull();
  });

  it('updates catalog-installed extensions from the actions menu', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.10.2',
      tag: 'v0.10.2',
      extensions: [
        {
          id: 'system-browser',
          name: 'Browser',
          description: 'Browse web pages beside a conversation.',
          version: '0.1.0',
          availableVersion: '0.1.0',
          installedVersion: '0.0.1',
          tag: 'v0.10.2',
          installed: true,
          enabled: true,
          updateAvailable: true,
        },
      ],
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-browser',
        name: 'Browser',
        description: 'Browse web pages beside a conversation.',
        enabled: true,
        packageType: 'user',
        version: '0.0.1',
      } as never,
    ]);
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Update available: 0.0.1 -> 0.1.0')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Update'));

    expect(await screen.findByText('Updated Browser to 0.1.0.')).toBeTruthy();
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateCatalogExtension', { id: 'system-browser' });
    expect(mocks.notifyExtensionRegistryChanged).toHaveBeenCalled();
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
    expect(callAction).toHaveBeenCalledTimes(2);
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'listInstallableExtensions', {});
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'readExtensionSources', {});
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 5_000)).toBe(false);
  });

  it('renders extension repositories as a settings panel', async () => {
    const callAction = vi.fn().mockResolvedValue({
      sources: [
        { id: 'neon-pilot', type: 'github', owner: 'patleeman', repo: 'neon-pilot-extensions', enabled: true, name: 'Neon Pilot Extensions' },
      ],
    });

    renderRepositoriesSettingsPanel({
      ui: { notify: vi.fn() },
      extensions: { callAction },
    });

    expect(await screen.findByText('Neon Pilot Extensions')).toBeTruthy();
    expect(screen.getByPlaceholderText('GitHub repo URL or owner/repo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'readExtensionSources', {});
  });

  it('adds extension repositories from the settings panel', async () => {
    const readResult = {
      sources: [
        { id: 'neon-pilot', type: 'github', owner: 'patleeman', repo: 'neon-pilot-extensions', enabled: true, name: 'Neon Pilot Extensions' },
      ],
    };
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'readExtensionSources') return readResult;
      if (action === 'updateExtensionSources') return { ok: true, sources: readResult.sources };
      return { ok: true };
    });

    renderRepositoriesSettingsPanel({
      ui: { notify: vi.fn() },
      extensions: { callAction },
    });

    fireEvent.change(await screen.findByPlaceholderText('GitHub repo URL or owner/repo'), {
      target: { value: 'https://github.com/example/neon-extensions.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add repo' }));

    await screen.findByText('Added example/neon-extensions.');
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateExtensionSources', {
      sources: [
        readResult.sources[0],
        { id: 'example-neon-extensions', type: 'github', owner: 'example', repo: 'neon-extensions', enabled: true },
      ],
    });
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
